-- ============================================================================
-- Revisão de segurança e entrega
--
-- 1. Cadastro fecha sozinho: a organização nasce com `cadastro_aberto = false`.
--    A primeira conta continua virando dona (não há organização para entrar);
--    as seguintes só entram quando o dono reabre o cadastro em Equipe.
-- 2. Link secreto da galeria (`chave`, 16 caracteres aleatórios): galeria de
--    cliente e evento com senha só abrem por `/g/<chave>`. O `slug` legível só
--    abre evento sem senha (o da vitrine). Adivinhar o nome não abre nada.
-- 3. Limite de tentativas: senha errada (10 por visitante e galeria em 15 min,
--    100 por galeria em 1 h) e pedidos (10 por visitante e por e-mail em 1 h).
--    O visitante é o IP que o gateway do Supabase repassa nos cabeçalhos.
-- 4. Download liberado pelo fotógrafo (`download_liberado`): a galeria inteira
--    sai em alta resolução, sem pedido, para quem abre o link.
-- 5. Marca d'água opcional nas prévias (`marca_dagua_ativa` na loja).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cadastro fechado por padrão
-- ---------------------------------------------------------------------------
alter table public.organizacoes alter column cadastro_aberto set default false;

-- ---------------------------------------------------------------------------
-- 2. Colunas novas
-- ---------------------------------------------------------------------------
alter table public.galerias
  add column if not exists chave text,
  add column if not exists download_liberado boolean not null default false;

update public.galerias
   set chave = encode(extensions.gen_random_bytes(8), 'hex')
 where chave is null;

alter table public.galerias
  alter column chave set default encode(extensions.gen_random_bytes(8), 'hex'),
  alter column chave set not null;

do $$ begin
  alter table public.galerias
    add constraint galerias_chave_formato check (chave ~ '^[0-9a-f]{16}$');
exception when duplicate_object then null; end $$;

create unique index if not exists galerias_chave_idx on public.galerias (chave);

alter table public.configuracoes_loja
  add column if not exists marca_dagua_ativa boolean not null default true;

grant update (marca_dagua_ativa) on public.configuracoes_loja to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Limites de acesso (sem grant para o cliente: só as funções abaixo)
-- ---------------------------------------------------------------------------
create table if not exists public.limites_acesso (
  id bigint generated always as identity primary key,
  acao text not null,
  chave text not null,
  criado_em timestamptz not null default now()
);
create index if not exists limites_acesso_idx on public.limites_acesso (acao, chave, criado_em desc);

revoke all on public.limites_acesso from anon, authenticated;
grant all on public.limites_acesso to service_role;
alter table public.limites_acesso enable row level security;

-- IP do visitante: o gateway repassa `x-forwarded-for` (o primeiro é o cliente).
create or replace function public.ip_do_visitante()
returns text
language sql stable
set search_path = public as $$
  select coalesce(
    nullif(trim(split_part(coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip', ''), ',', 1)), ''),
    nullif(trim(split_part(coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'sem-ip'
  );
$$;

create or replace function public.conferir_limite(_acao text, _chave text, _maximo int, _janela interval)
returns void
language plpgsql stable security definer
set search_path = public as $$
begin
  if (select count(*) from public.limites_acesso l
       where l.acao = _acao and l.chave = _chave and l.criado_em > now() - _janela) >= _maximo then
    raise exception 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  end if;
end;
$$;

create or replace function public.registrar_acesso(_acao text, _chave text)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  insert into public.limites_acesso (acao, chave) values (_acao, _chave);
  -- Limpeza de vez em quando: as janelas mais longas são de 1 hora.
  if random() < 0.02 then
    delete from public.limites_acesso where criado_em < now() - interval '1 day';
  end if;
end;
$$;

-- Galeria publicada pelo link: a chave abre qualquer uma; o slug só abre
-- evento sem senha.
create or replace function public.galeria_pelo_link(_link text)
returns uuid
language sql stable security definer
set search_path = public as $$
  select g.id from public.galerias g
   where g.status = 'publicada'
     and (g.chave = lower(trim(coalesce(_link, '')))
          or (g.slug = lower(trim(coalesce(_link, ''))) and g.tipo = 'evento' and g.senha = ''))
   limit 1;
$$;

-- Confere a senha com limite de tentativas. Devolve false (e registra a falha)
-- quando a senha veio errada; levanta exceção quando passou do limite.
create or replace function public.conferir_senha_galeria(_galeria public.galerias, _senha text)
returns boolean
language plpgsql security definer
set search_path = public as $$
declare
  _visitante text := _galeria.id::text || ':' || public.ip_do_visitante();
begin
  if _galeria.senha = '' then
    return true;
  end if;
  perform public.conferir_limite('senha', _visitante, 10, interval '15 minutes');
  perform public.conferir_limite('senha-galeria', _galeria.id::text, 100, interval '1 hour');
  if coalesce(_senha, '') = _galeria.senha then
    return true;
  end if;
  if coalesce(_senha, '') <> '' then
    perform public.registrar_acesso('senha', _visitante);
    perform public.registrar_acesso('senha-galeria', _galeria.id::text);
  end if;
  return false;
end;
$$;

revoke execute on function public.ip_do_visitante() from anon, authenticated, public;
revoke execute on function public.conferir_limite(text, text, int, interval) from anon, authenticated, public;
revoke execute on function public.registrar_acesso(text, text) from anon, authenticated, public;
revoke execute on function public.galeria_pelo_link(text) from anon, authenticated, public;
revoke execute on function public.conferir_senha_galeria(public.galerias, text) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 4. Funções públicas com link secreto e limites
-- ---------------------------------------------------------------------------
-- Link público da galeria: o slug para evento sem senha; a chave para o resto.
create or replace function public.link_da_galeria(_galeria public.galerias)
returns text
language sql immutable
set search_path = public as $$
  select case when _galeria.tipo = 'evento' and _galeria.senha = '' then _galeria.slug else _galeria.chave end;
$$;
revoke execute on function public.link_da_galeria(public.galerias) from anon, authenticated, public;

-- Igual à de `eventos_abertos`, achando a galeria pelo link, com o limite de
-- senha e o download liberado. Volátil: grava as tentativas erradas.
create or replace function public.galeria_publica(_slug text, _senha text default '')
returns jsonb
language plpgsql volatile security definer
set search_path = public as $$
declare
  g public.galerias%rowtype;
  base jsonb;
begin
  select * into g from public.galerias where id = public.galeria_pelo_link(_slug);
  if not found then
    return null;
  end if;

  base := jsonb_build_object(
    'slug', public.link_da_galeria(g),
    'titulo', g.titulo,
    'descricao', g.descricao,
    'data_evento', g.data_evento,
    'fotografo', public.nome_fotografo(g.organizacao_id),
    'marca', public.marca_publica(),
    'tipo', g.tipo,
    'categoria', g.categoria,
    'local', g.local,
    'busca_rosto', g.tipo = 'evento' and g.busca_rosto,
    'contato_whatsapp', (select c.whatsapp from public.configuracoes_loja c where c.id = 1),
    'protegida', g.senha <> '',
    'capa', coalesce(
      (select f.caminho_previa from public.fotos f where f.id = g.capa_foto_id),
      (select f.caminho_previa from public.fotos f
        where f.galeria_id = g.id order by f.ordem, f.created_at, f.id limit 1)
    ),
    'total_fotos', (select count(*) from public.fotos f where f.galeria_id = g.id)
  );

  if not public.conferir_senha_galeria(g, _senha) then
    return base || jsonb_build_object('liberada', false, 'senha_incorreta', coalesce(_senha, '') <> '');
  end if;

  return base || jsonb_build_object(
    'liberada', true,
    'preco_foto', g.preco_foto,
    'preco_pacote', g.preco_pacote,
    'download_liberado', g.download_liberado,
    'fotos', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', f.id,
                 'nome', f.nome_arquivo,
                 'previa', f.caminho_previa,
                 'miniatura', f.caminho_miniatura,
                 'largura', f.largura,
                 'altura', f.altura,
                 'tamanho', f.tamanho_bytes,
                 'original', case when g.download_liberado then f.caminho_original end)
               order by f.ordem, f.created_at, f.id)
        from public.fotos f
       where f.galeria_id = g.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.galeria_publica(text, text) from anon, authenticated, public;
grant execute on function public.galeria_publica(text, text) to anon, authenticated;

-- Igual à de `venda_de_fotos`, com o link secreto e os limites. Senha errada
-- devolve null (em vez de exceção) para a tentativa ficar registrada.
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
  _ip text := public.ip_do_visitante();
begin
  select * into g from public.galerias where id = public.galeria_pelo_link(_slug);
  if not found then
    raise exception 'Galeria não encontrada.';
  end if;
  if not public.conferir_senha_galeria(g, _senha) then
    return null;
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
  if _telefone <> '' and (_telefone !~ '^[0-9()+\s.-]+$'
       or char_length(regexp_replace(_telefone, '\D', '', 'g')) not between 10 and 13) then
    raise exception 'Informe o WhatsApp com DDD (ex.: 11 91234-5678) ou deixe em branco.';
  end if;

  perform public.conferir_limite('pedido', _ip, 10, interval '1 hour');
  perform public.conferir_limite('pedido-email', _email, 10, interval '1 hour');

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

  perform public.registrar_acesso('pedido', _ip);
  perform public.registrar_acesso('pedido-email', _email);

  return _pedido.codigo;
end;
$$;
revoke execute on function public.criar_pedido(text, text, text, text, text, uuid[], boolean)
  from anon, authenticated, public;
grant execute on function public.criar_pedido(text, text, text, text, text, uuid[], boolean)
  to anon, authenticated;

-- Igual à de `eventos_abertos`, com o link e o limite de senha. Senha errada
-- devolve null.
create or replace function public.buscar_fotos_por_rosto(_slug text, _senha text, _rosto real[])
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions as $$
declare
  g public.galerias%rowtype;
  alvo extensions.vector(128);
begin
  select * into g from public.galerias where id = public.galeria_pelo_link(_slug);
  if not found or g.tipo <> 'evento' or not g.busca_rosto then
    raise exception 'Esta galeria não tem busca por selfie.';
  end if;
  if not public.conferir_senha_galeria(g, _senha) then
    return null;
  end if;
  if coalesce(array_length(_rosto, 1), 0) <> 128 then
    raise exception 'Rosto inválido. Tente outra selfie.';
  end if;
  alvo := _rosto::extensions.vector(128);

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.foto_id, 'distancia', round(r.d::numeric, 3))
                     order by r.d)
      from (
        select x.foto_id, min(x.embedding <-> alvo) as d
          from public.rostos x
         where x.galeria_id = g.id
         group by x.foto_id
        having min(x.embedding <-> alvo) < 0.5
         order by d
         limit 300
      ) r
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.buscar_fotos_por_rosto(text, text, real[]) from anon, authenticated, public;
grant execute on function public.buscar_fotos_por_rosto(text, text, real[]) to anon, authenticated;

-- Igual à de `marca_da_loja`, com o link público da galeria.
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
    'galeria', jsonb_build_object('titulo', g.titulo, 'slug', public.link_da_galeria(g)),
    'fotografo', public.nome_fotografo(p.organizacao_id),
    'marca', public.marca_publica(),
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
                 'tamanho', f.tamanho_bytes,
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

-- Igual à de `venda_de_fotos`, liberando também a galeria com download liberado.
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
  ) or exists (
    select 1
      from public.fotos f
      join public.galerias g on g.id = f.galeria_id
     where f.caminho_original = _caminho and g.download_liberado and g.status = 'publicada'
  );
$$;
revoke execute on function public.foto_original_liberada(text) from anon, authenticated, public;
grant execute on function public.foto_original_liberada(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Auto-reparo com os objetos novos
-- ---------------------------------------------------------------------------
-- Igual à versão de `landing_pages`, com `marca_dagua_ativa` no grant da loja e
-- `limites_acesso` só para service_role. As funções auxiliares novas
-- (`ip_do_visitante`, `conferir_limite`, `registrar_acesso`,
-- `galeria_pelo_link`, `conferir_senha_galeria`, `link_da_galeria`) ficam sem
-- EXECUTE para anon/authenticated: só as funções públicas as chamam.
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

  if not exists (select 1 from storage.buckets where id = 'marca') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('marca', 'marca', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
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

    -- Tabelas. `anon` não lê nenhuma tabela.
    grant select, update (nome) on public.perfis to authenticated;
    grant select, update (nome, cadastro_aberto) on public.organizacoes to authenticated;
    grant select on public.organizacao_membros to authenticated;
    grant select,
      update (nome_exibicao, chave_pix, instrucoes_pagamento, whatsapp, texto_marca_dagua,
              logo_caminho, cor_primaria, cor_secundaria, marca_dagua_ativa)
      on public.configuracoes_loja to authenticated;
    grant select, insert, update, delete on public.galerias to authenticated;
    grant select, insert, update, delete on public.fotos to authenticated;
    grant select, update (status) on public.pedidos to authenticated;
    grant select on public.pedido_itens to authenticated;
    grant select, insert, delete on public.rostos to authenticated;
    grant select, insert, update, delete on public.landing_pages to authenticated;

    grant all on
      public.perfis, public.organizacoes, public.organizacao_membros,
      public.configuracoes_loja, public.galerias, public.fotos, public.pedidos,
      public.pedido_itens, public.rostos, public.landing_pages, public.landing_segredos,
      public.limites_acesso
      to service_role;
    grant usage, select on all sequences in schema public to service_role;

    -- Funções chamadas pelo cliente logado.
    grant execute on function
      public.minha_organizacao(),
      public.meu_papel(),
      public.mesma_organizacao(uuid),
      public.garantir_organizacao(),
      public.remover_membro(uuid),
      public.readmitir_membro(uuid),
      public.contas_fora_da_organizacao(),
      public.definir_cadastro_aberto(boolean),
      public.definir_token_capi(uuid, text),
      public.landing_tem_token_capi(uuid)
      to authenticated, service_role;

    -- Funções públicas da venda: também para o visitante.
    grant execute on function
      public.galeria_publica(text, text),
      public.criar_pedido(text, text, text, text, text, uuid[], boolean),
      public.pedido_publico(text),
      public.foto_original_liberada(text),
      public.eventos_publicos(),
      public.buscar_fotos_por_rosto(text, text, real[]),
      public.landing_publica(text),
      public.enviar_evento_meta(text, text, text, text, text, text, text, text)
      to anon, authenticated, service_role;

    -- Este reparo: chamado também por visitante (tela de entrada).
    grant execute on function public.garantir_instalacao()
      to anon, authenticated, service_role;

    -- Funções de trigger e auxiliares (`set_updated_at`, `handle_new_user`,
    -- `perfis_proteger_campos`, `pedidos_marcar_pago_em`, `nome_fotografo`,
    -- `marca_publica` e as da seção 2 desta migration) ficam sem EXECUTE para
    -- anon/authenticated.

    reparou := true;
  end if;

  return reparou;
end;
$$;

revoke all on function public.garantir_instalacao() from public, anon, authenticated;
grant execute on function public.garantir_instalacao() to anon, authenticated, service_role;

do $$ begin perform public.garantir_instalacao(); end $$;
