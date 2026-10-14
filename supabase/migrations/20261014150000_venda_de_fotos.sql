-- ============================================================================
-- Venda de fotos: galerias, fotos, pedidos e configurações da loja
--
-- O fotógrafo (conta logada) cria galerias e envia fotos. Cada foto tem três
-- arquivos no Storage: miniatura e prévia com marca d'água (bucket público
-- `previas`, geradas no navegador) e o original (bucket privado `originais`). O cliente abre a galeria pelo link
-- `/g/<slug>` sem conta, escolhe as fotos e cria um pedido; com o pedido pago,
-- baixa os originais pelo código do pedido.
--
-- O visitante (`anon`) não lê nenhuma tabela: tudo o que é público passa pelas
-- funções `galeria_publica`, `criar_pedido`, `pedido_publico` e
-- `foto_original_liberada` (security definer, que conferem status e senha).
--
-- Remove também a tabela de exemplo `anotacoes`, que a solução não usa.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.status_galeria as enum ('rascunho', 'publicada', 'arquivada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_pedido as enum ('aguardando_pagamento', 'pago', 'cancelado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------------
drop table if exists public.anotacoes;

-- Linha única (id = 1): dados da loja que o cliente vê na galeria e no pedido.
create table if not exists public.configuracoes_loja (
  id int primary key default 1 check (id = 1),
  nome_exibicao text not null default '',
  chave_pix text not null default '',
  instrucoes_pagamento text not null default '',
  whatsapp text not null default '',
  texto_marca_dagua text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.configuracoes_loja (id) values (1) on conflict (id) do nothing;

-- Senha vazia = galeria aberta. Fica em texto porque o fotógrafo precisa
-- vê-la para repassar ao cliente; `anon` nunca lê a tabela.
create table if not exists public.galerias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis(id) on delete cascade,
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  titulo text not null check (char_length(titulo) between 2 and 200),
  slug text not null unique
    check (char_length(slug) between 3 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descricao text not null default '',
  data_evento date,
  cliente_nome text not null default '',
  cliente_email text not null default '',
  status public.status_galeria not null default 'rascunho',
  senha text not null default '',
  preco_foto numeric(10, 2) not null default 0 check (preco_foto >= 0),
  -- Nulo = a galeria não vende o pacote com todas as fotos.
  preco_pacote numeric(10, 2) check (preco_pacote is null or preco_pacote >= 0),
  capa_foto_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  galeria_id uuid not null references public.galerias(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  nome_arquivo text not null,
  caminho_original text not null unique,
  caminho_previa text not null unique,
  caminho_miniatura text not null unique,
  largura int not null check (largura > 0),
  altura int not null check (altura > 0),
  tamanho_bytes bigint not null default 0,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.galerias
    add constraint galerias_capa_foto_id_fkey
    foreign key (capa_foto_id) references public.fotos(id) on delete set null;
exception when duplicate_object then null; end $$;

-- `user_id`/`organizacao_id` copiam os da galeria: o pedido aparece para quem
-- vê a galeria. Galeria com pedido não é excluída (restrict): arquive.
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default replace(gen_random_uuid()::text, '-', ''),
  galeria_id uuid not null references public.galerias(id) on delete restrict,
  user_id uuid not null references public.perfis(id) on delete cascade,
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  cliente_nome text not null,
  cliente_email text not null,
  cliente_telefone text not null default '',
  pacote_completo boolean not null default false,
  valor_total numeric(10, 2) not null check (valor_total >= 0),
  status public.status_pedido not null default 'aguardando_pagamento',
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedido_itens (
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  foto_id uuid not null references public.fotos(id) on delete restrict,
  preco numeric(10, 2) not null check (preco >= 0),
  primary key (pedido_id, foto_id)
);

-- ---------------------------------------------------------------------------
-- 3. Índices
-- ---------------------------------------------------------------------------
create index if not exists galerias_user_idx on public.galerias (user_id);
create index if not exists galerias_organizacao_idx on public.galerias (organizacao_id);
create index if not exists fotos_galeria_idx on public.fotos (galeria_id, ordem);
create index if not exists fotos_user_idx on public.fotos (user_id);
create index if not exists fotos_organizacao_idx on public.fotos (organizacao_id);
create index if not exists pedidos_galeria_idx on public.pedidos (galeria_id);
create index if not exists pedidos_user_idx on public.pedidos (user_id);
create index if not exists pedidos_organizacao_idx on public.pedidos (organizacao_id, created_at desc);
create index if not exists pedido_itens_foto_idx on public.pedido_itens (foto_id);

-- ---------------------------------------------------------------------------
-- 4. Funções
-- ---------------------------------------------------------------------------

-- 4.1 `pago_em` acompanha o status (o cliente só altera `status`).
create or replace function public.pedidos_marcar_pago_em()
returns trigger
language plpgsql
set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.pago_em := case when new.status = 'pago' then now() else null end;
  end if;
  return new;
end;
$$;
revoke execute on function public.pedidos_marcar_pago_em() from anon, authenticated, public;

-- 4.2 Nome exibido ao cliente: o da loja ou, sem ele, o da organização.
create or replace function public.nome_fotografo(_organizacao_id uuid)
returns text
language sql stable security definer
set search_path = public as $$
  select coalesce(
    nullif(trim((select c.nome_exibicao from public.configuracoes_loja c where c.id = 1)), ''),
    (select o.nome from public.organizacoes o where o.id = _organizacao_id),
    ''
  );
$$;
revoke execute on function public.nome_fotografo(uuid) from anon, authenticated, public;

-- 4.3 Galeria para o visitante. Só galeria publicada; com senha errada devolve
--     só a capa e o título (`liberada: false`). Nulo = não existe.
create or replace function public.galeria_publica(_slug text, _senha text default '')
returns jsonb
language plpgsql stable security definer
set search_path = public as $$
declare
  g public.galerias%rowtype;
  base jsonb;
begin
  select * into g from public.galerias
   where slug = lower(trim(coalesce(_slug, ''))) and status = 'publicada';
  if not found then
    return null;
  end if;

  base := jsonb_build_object(
    'slug', g.slug,
    'titulo', g.titulo,
    'descricao', g.descricao,
    'data_evento', g.data_evento,
    'fotografo', public.nome_fotografo(g.organizacao_id),
    'protegida', g.senha <> '',
    -- Sem capa escolhida, vale a primeira foto da galeria.
    'capa', coalesce(
      (select f.caminho_previa from public.fotos f where f.id = g.capa_foto_id),
      (select f.caminho_previa from public.fotos f
        where f.galeria_id = g.id order by f.ordem, f.created_at, f.id limit 1)
    ),
    'total_fotos', (select count(*) from public.fotos f where f.galeria_id = g.id)
  );

  if g.senha <> '' and coalesce(_senha, '') <> g.senha then
    return base || jsonb_build_object('liberada', false);
  end if;

  return base || jsonb_build_object(
    'liberada', true,
    'preco_foto', g.preco_foto,
    'preco_pacote', g.preco_pacote,
    'fotos', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', f.id,
                 'nome', f.nome_arquivo,
                 'previa', f.caminho_previa,
                 'miniatura', f.caminho_miniatura,
                 'largura', f.largura,
                 'altura', f.altura)
               order by f.ordem, f.created_at, f.id)
        from public.fotos f
       where f.galeria_id = g.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.galeria_publica(text, text) from anon, authenticated, public;
grant execute on function public.galeria_publica(text, text) to anon, authenticated;

-- 4.4 Pedido do visitante. O preço sai da galeria, nunca do cliente. Total
--     zero (galeria de entrega gratuita) nasce pago. Devolve o código do pedido.
create or replace function public.criar_pedido(
  _slug text,
  _senha text,
  _nome text,
  _email text,
  _telefone text,
  _fotos uuid[],
  _pacote_completo boolean
)
returns text
language plpgsql security definer
set search_path = public as $$
declare
  g public.galerias%rowtype;
  _ids uuid[];
  _qtd int;
  _total numeric(10, 2);
  _preco_item numeric(10, 2);
  _pedido public.pedidos%rowtype;
begin
  select * into g from public.galerias
   where slug = lower(trim(coalesce(_slug, ''))) and status = 'publicada';
  if not found then
    raise exception 'Galeria não encontrada.';
  end if;
  if g.senha <> '' and coalesce(_senha, '') <> g.senha then
    raise exception 'Senha da galeria incorreta.';
  end if;

  _nome := trim(coalesce(_nome, ''));
  _email := lower(trim(coalesce(_email, '')));
  _telefone := trim(coalesce(_telefone, ''));
  if char_length(_nome) < 2 or char_length(_nome) > 120 then
    raise exception 'Informe o seu nome.';
  end if;
  if _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(_email) > 200 then
    raise exception 'Informe um e-mail válido.';
  end if;
  if char_length(_telefone) > 30 then
    raise exception 'Telefone inválido.';
  end if;

  if coalesce(_pacote_completo, false) then
    if g.preco_pacote is null then
      raise exception 'Esta galeria não vende o pacote completo.';
    end if;
    select array_agg(f.id) into _ids from public.fotos f where f.galeria_id = g.id;
    _qtd := coalesce(array_length(_ids, 1), 0);
    if _qtd = 0 then
      raise exception 'A galeria ainda não tem fotos.';
    end if;
    _total := g.preco_pacote;
    _preco_item := 0;
  else
    select array_agg(distinct x) into _ids from unnest(coalesce(_fotos, '{}')) as x;
    _qtd := coalesce(array_length(_ids, 1), 0);
    if _qtd = 0 then
      raise exception 'Escolha pelo menos uma foto.';
    end if;
    if _qtd > 1000 then
      raise exception 'Escolha no máximo 1.000 fotos por pedido.';
    end if;
    if (select count(*) from public.fotos f where f.galeria_id = g.id and f.id = any(_ids)) <> _qtd then
      raise exception 'Há fotos que não pertencem a esta galeria.';
    end if;
    _preco_item := g.preco_foto;
    _total := g.preco_foto * _qtd;
  end if;

  insert into public.pedidos (
    galeria_id, user_id, organizacao_id, cliente_nome, cliente_email, cliente_telefone,
    pacote_completo, valor_total, status, pago_em
  ) values (
    g.id, g.user_id, g.organizacao_id, _nome, _email, _telefone,
    coalesce(_pacote_completo, false), _total,
    case when _total = 0 then 'pago'::public.status_pedido else 'aguardando_pagamento' end,
    case when _total = 0 then now() else null end
  ) returning * into _pedido;

  insert into public.pedido_itens (pedido_id, foto_id, preco)
  select _pedido.id, x, _preco_item from unnest(_ids) as x;

  return _pedido.codigo;
end;
$$;
revoke execute on function public.criar_pedido(text, text, text, text, text, uuid[], boolean)
  from anon, authenticated, public;
grant execute on function public.criar_pedido(text, text, text, text, text, uuid[], boolean)
  to anon, authenticated;

-- 4.5 Pedido pelo código (quem tem o código é o cliente). O caminho do
--     original só aparece com o pedido pago.
create or replace function public.pedido_publico(_codigo text)
returns jsonb
language plpgsql stable security definer
set search_path = public as $$
declare
  p public.pedidos%rowtype;
  g public.galerias%rowtype;
  c public.configuracoes_loja%rowtype;
begin
  select * into p from public.pedidos where codigo = trim(coalesce(_codigo, ''));
  if not found then
    return null;
  end if;
  select * into g from public.galerias where id = p.galeria_id;
  select * into c from public.configuracoes_loja where id = 1;

  return jsonb_build_object(
    'codigo', p.codigo,
    'status', p.status,
    'cliente_nome', p.cliente_nome,
    'cliente_email', p.cliente_email,
    'pacote_completo', p.pacote_completo,
    'valor_total', p.valor_total,
    'created_at', p.created_at,
    'pago_em', p.pago_em,
    'galeria', jsonb_build_object('titulo', g.titulo, 'slug', g.slug),
    'fotografo', public.nome_fotografo(p.organizacao_id),
    'pagamento', jsonb_build_object(
      'chave_pix', coalesce(c.chave_pix, ''),
      'instrucoes', coalesce(c.instrucoes_pagamento, ''),
      'whatsapp', coalesce(c.whatsapp, '')
    ),
    'itens', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'foto_id', f.id,
                 'nome', f.nome_arquivo,
                 'previa', f.caminho_previa,
                 'miniatura', f.caminho_miniatura,
                 'preco', i.preco,
                 'original', case when p.status = 'pago' then f.caminho_original end)
               order by f.ordem, f.created_at, f.id)
        from public.pedido_itens i
        join public.fotos f on f.id = i.foto_id
       where i.pedido_id = p.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.pedido_publico(text) from anon, authenticated, public;
grant execute on function public.pedido_publico(text) to anon, authenticated;

-- 4.6 Policy do Storage: o original só é baixado por quem não é da
--     organização quando faz parte de um pedido pago.
create or replace function public.foto_original_liberada(_caminho text)
returns boolean
language sql stable security definer
set search_path = public as $$
  select exists (
    select 1
      from public.fotos f
      join public.pedido_itens i on i.foto_id = f.id
      join public.pedidos p on p.id = i.pedido_id
     where f.caminho_original = _caminho and p.status = 'pago'
  );
$$;
revoke execute on function public.foto_original_liberada(text) from anon, authenticated, public;
grant execute on function public.foto_original_liberada(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists galerias_set_updated_at on public.galerias;
create trigger galerias_set_updated_at before update on public.galerias
  for each row execute function public.set_updated_at();

drop trigger if exists fotos_set_updated_at on public.fotos;
create trigger fotos_set_updated_at before update on public.fotos
  for each row execute function public.set_updated_at();

drop trigger if exists pedidos_set_updated_at on public.pedidos;
create trigger pedidos_set_updated_at before update on public.pedidos
  for each row execute function public.set_updated_at();

drop trigger if exists pedidos_marcar_pago_em_trg on public.pedidos;
create trigger pedidos_marcar_pago_em_trg before update on public.pedidos
  for each row execute function public.pedidos_marcar_pago_em();

drop trigger if exists configuracoes_loja_set_updated_at on public.configuracoes_loja;
create trigger configuracoes_loja_set_updated_at before update on public.configuracoes_loja
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Privilégios de tabela
-- ---------------------------------------------------------------------------
revoke all on
  public.configuracoes_loja, public.galerias, public.fotos, public.pedidos, public.pedido_itens
  from anon, authenticated;

grant select,
  update (nome_exibicao, chave_pix, instrucoes_pagamento, whatsapp, texto_marca_dagua)
  on public.configuracoes_loja to authenticated;
grant select, insert, update, delete on public.galerias to authenticated;
grant select, insert, update, delete on public.fotos to authenticated;
-- Pedido nasce só por `criar_pedido`; o fotógrafo muda o status.
grant select, update (status) on public.pedidos to authenticated;
grant select on public.pedido_itens to authenticated;

grant all on
  public.configuracoes_loja, public.galerias, public.fotos, public.pedidos, public.pedido_itens
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.configuracoes_loja enable row level security;
alter table public.galerias enable row level security;
alter table public.fotos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

-- configuracoes_loja: quem é da organização lê; só o dono edita.
drop policy if exists configuracoes_loja_select on public.configuracoes_loja;
create policy configuracoes_loja_select on public.configuracoes_loja
  for select to authenticated
  using (public.minha_organizacao() is not null);
drop policy if exists configuracoes_loja_update on public.configuracoes_loja;
create policy configuracoes_loja_update on public.configuracoes_loja
  for update to authenticated
  using (public.meu_papel() = 'dono')
  with check (public.meu_papel() = 'dono');

-- galerias: policy padrão de conteúdo.
drop policy if exists galerias_select on public.galerias;
create policy galerias_select on public.galerias
  for select to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists galerias_insert on public.galerias;
create policy galerias_insert on public.galerias
  for insert to authenticated
  with check (user_id = auth.uid() and (organizacao_id is null or organizacao_id = public.minha_organizacao()));
drop policy if exists galerias_update on public.galerias;
create policy galerias_update on public.galerias
  for update to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()))
  with check (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists galerias_delete on public.galerias;
create policy galerias_delete on public.galerias
  for delete to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));

-- fotos: policy padrão; só entra foto em galeria que a conta enxerga.
drop policy if exists fotos_select on public.fotos;
create policy fotos_select on public.fotos
  for select to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists fotos_insert on public.fotos;
create policy fotos_insert on public.fotos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (organizacao_id is null or organizacao_id = public.minha_organizacao())
    and exists (select 1 from public.galerias g where g.id = galeria_id)
  );
drop policy if exists fotos_update on public.fotos;
create policy fotos_update on public.fotos
  for update to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()))
  with check (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists fotos_delete on public.fotos;
create policy fotos_delete on public.fotos
  for delete to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));

-- pedidos: leitura e troca de status pela policy padrão; sem insert/delete.
drop policy if exists pedidos_select on public.pedidos;
create policy pedidos_select on public.pedidos
  for select to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos
  for update to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()))
  with check (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));

-- pedido_itens: acompanha o pedido (a subconsulta passa pela RLS de pedidos).
drop policy if exists pedido_itens_select on public.pedido_itens;
create policy pedido_itens_select on public.pedido_itens
  for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));

-- ---------------------------------------------------------------------------
-- 8. Storage
-- ---------------------------------------------------------------------------
-- Caminho dos arquivos: `<organização ou conta>/<galeria>/<arquivo>`. A
-- primeira pasta decide quem envia e apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('previas', 'previas', true, 10485760, array['image/jpeg', 'image/webp']),
  ('originais', 'originais', false, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists previas_select on storage.objects;
create policy previas_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'previas'
    and (storage.foldername(name))[1] in (auth.uid()::text, public.minha_organizacao()::text)
  );
drop policy if exists previas_insert on storage.objects;
create policy previas_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'previas'
    and (storage.foldername(name))[1] in (auth.uid()::text, public.minha_organizacao()::text)
  );
drop policy if exists previas_delete on storage.objects;
create policy previas_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'previas'
    and (storage.foldername(name))[1] in (auth.uid()::text, public.minha_organizacao()::text)
  );

drop policy if exists originais_select on storage.objects;
create policy originais_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'originais'
    and (storage.foldername(name))[1] in (auth.uid()::text, public.minha_organizacao()::text)
  );
drop policy if exists originais_select_comprador on storage.objects;
create policy originais_select_comprador on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'originais' and public.foto_original_liberada(name));
drop policy if exists originais_insert on storage.objects;
create policy originais_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'originais'
    and (storage.foldername(name))[1] in (auth.uid()::text, public.minha_organizacao()::text)
  );
drop policy if exists originais_delete on storage.objects;
create policy originais_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'originais'
    and (storage.foldername(name))[1] in (auth.uid()::text, public.minha_organizacao()::text)
  );

-- ---------------------------------------------------------------------------
-- 9. Auto-reparo com os objetos novos
-- ---------------------------------------------------------------------------
-- Igual à versão de `reparo_linhas_iniciais`, com a seção 0 (configurações e
-- buckets) e a seção 3 (grants) atualizadas para esta migration.
create or replace function public.garantir_instalacao()
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  reparou boolean := false;
  u record;
  meta jsonb;
  _nome text;
  _org uuid;
  _aberto boolean;
begin
  -- 0. Linhas iniciais (o remix copia a estrutura, não os dados).
  if not exists (select 1 from public.configuracoes_loja where id = 1) then
    insert into public.configuracoes_loja (id) values (1) on conflict (id) do nothing;
    reparou := true;
  end if;

  if not exists (select 1 from storage.buckets where id = 'previas') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('previas', 'previas', true, 10485760, array['image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
    reparou := true;
  end if;

  if not exists (select 1 from storage.buckets where id = 'originais') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('originais', 'originais', false, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    reparou := true;
  end if;

  -- 1. Triggers em auth.users (fundação §5).
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
    reparou := true;
  end if;

  -- 2. Contas criadas enquanto o trigger faltava (ver `auto_reparo_remix`).
  if exists (
    select 1 from auth.users au
     where not exists (select 1 from public.perfis p where p.id = au.id)
  ) then
    perform pg_advisory_xact_lock(hashtext('ceia.organizacao_unica'));

    for u in
      select au.id, au.email, au.raw_user_meta_data
        from auth.users au
       where not exists (select 1 from public.perfis p where p.id = au.id)
       order by au.created_at, au.id
    loop
      meta := coalesce(u.raw_user_meta_data, '{}'::jsonb);
      _nome := nullif(trim(coalesce(meta ->> 'nome', '')), '');
      if _nome is null then
        _nome := split_part(coalesce(u.email, ''), '@', 1);
      end if;
      if _nome = '' then
        _nome := 'Usuário';
      end if;

      insert into public.perfis (id, nome, email)
      values (u.id, _nome, coalesce(u.email, ''))
      on conflict (id) do nothing;

      if not exists (select 1 from public.organizacao_membros m where m.user_id = u.id) then
        _org := null;
        select o.id, o.cadastro_aberto into _org, _aberto
          from public.organizacoes o
         order by o.created_at, o.id
         limit 1;
        if _org is null then
          insert into public.organizacoes (nome) values ('Minha organização') returning id into _org;
          insert into public.organizacao_membros (user_id, organizacao_id, papel)
          values (u.id, _org, 'dono')
          on conflict (user_id) do nothing;
        elsif _aberto then
          insert into public.organizacao_membros (user_id, organizacao_id, papel)
          values (u.id, _org, 'membro')
          on conflict (user_id) do nothing;
        end if;
      end if;

      reparou := true;
    end loop;
  end if;

  -- 3. Privilégios (sentinelas e lista completa).
  if has_table_privilege('anon', 'public.perfis', 'SELECT')
     or has_table_privilege('authenticated', 'public.organizacao_membros', 'INSERT')
     or has_function_privilege('anon', 'public.remover_membro(uuid)', 'EXECUTE') then

    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke all on all functions in schema public from public, anon, authenticated;

    -- Tabelas (fundação §6 e esta migration §6). `anon` não lê nenhuma tabela.
    grant select, update (nome) on public.perfis to authenticated;
    grant select, update (nome, cadastro_aberto) on public.organizacoes to authenticated;
    grant select on public.organizacao_membros to authenticated;
    grant select,
      update (nome_exibicao, chave_pix, instrucoes_pagamento, whatsapp, texto_marca_dagua)
      on public.configuracoes_loja to authenticated;
    grant select, insert, update, delete on public.galerias to authenticated;
    grant select, insert, update, delete on public.fotos to authenticated;
    grant select, update (status) on public.pedidos to authenticated;
    grant select on public.pedido_itens to authenticated;

    grant all on
      public.perfis, public.organizacoes, public.organizacao_membros,
      public.configuracoes_loja, public.galerias, public.fotos, public.pedidos,
      public.pedido_itens
      to service_role;
    grant usage, select on all sequences in schema public to service_role;

    -- Funções chamadas pelo cliente logado (fundação §4).
    grant execute on function
      public.minha_organizacao(),
      public.meu_papel(),
      public.mesma_organizacao(uuid),
      public.garantir_organizacao(),
      public.remover_membro(uuid),
      public.readmitir_membro(uuid),
      public.contas_fora_da_organizacao(),
      public.definir_cadastro_aberto(boolean)
      to authenticated, service_role;

    -- Funções públicas da venda (esta migration §4): também para o visitante.
    grant execute on function
      public.galeria_publica(text, text),
      public.criar_pedido(text, text, text, text, text, uuid[], boolean),
      public.pedido_publico(text),
      public.foto_original_liberada(text)
      to anon, authenticated, service_role;

    -- Este reparo: chamado também por visitante (tela de entrada).
    grant execute on function public.garantir_instalacao()
      to anon, authenticated, service_role;

    -- Funções de trigger e auxiliares (`set_updated_at`, `handle_new_user`,
    -- `perfis_proteger_campos`, `pedidos_marcar_pago_em`, `nome_fotografo`)
    -- ficam sem EXECUTE para anon/authenticated.

    reparou := true;
  end if;

  return reparou;
end;
$$;

revoke all on function public.garantir_instalacao() from public, anon, authenticated;
grant execute on function public.garantir_instalacao() to anon, authenticated, service_role;

do $$ begin perform public.garantir_instalacao(); end $$;
