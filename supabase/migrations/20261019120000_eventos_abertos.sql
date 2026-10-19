-- ============================================================================
-- Eventos abertos: vitrine do estúdio e busca de fotos por selfie
--
-- Além da galeria de um cliente (com senha), o fotógrafo publica galerias de
-- evento (torneio, corrida, festa) para pessoas que ele não conhece. Elas
-- aparecem na vitrine pública `/eventos`, por categoria, e quem esteve no
-- evento acha as próprias fotos com uma selfie.
--
-- Reconhecimento facial no navegador (face-api): no envio, o painel calcula um
-- vetor de 128 números para cada rosto da foto e grava em `rostos` (pgvector).
-- Na busca, o visitante calcula o vetor da selfie no próprio navegador e manda
-- só o vetor para `buscar_fotos_por_rosto`; a selfie não sai do aparelho e o
-- vetor dela não é gravado.
--
-- `galeria_publica` ganha tipo, categoria, local, busca por rosto e o WhatsApp
-- da loja (pedido de remoção, LGPD); o restante é igual ao de `marca_da_loja`.
-- ============================================================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Galeria de evento
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.tipo_galeria as enum ('privada', 'evento');
exception when duplicate_object then null; end $$;

alter table public.galerias
  add column if not exists tipo public.tipo_galeria not null default 'privada',
  add column if not exists categoria text not null default ''
    check (char_length(categoria) <= 60),
  add column if not exists local text not null default ''
    check (char_length(local) <= 120),
  add column if not exists busca_rosto boolean not null default true;

-- Quando o painel já procurou rostos na foto (com ou sem achar): evita
-- reanalisar no botão "Procurar rostos nas fotos já enviadas".
alter table public.fotos
  add column if not exists rostos_analisados_em timestamptz;

create index if not exists galerias_eventos_idx
  on public.galerias (status, tipo, data_evento desc);

-- ---------------------------------------------------------------------------
-- 2. Rostos das fotos (um por rosto encontrado; a foto pode ter vários)
-- ---------------------------------------------------------------------------
create table if not exists public.rostos (
  id uuid primary key default gen_random_uuid(),
  foto_id uuid not null references public.fotos(id) on delete cascade,
  galeria_id uuid not null references public.galerias(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  embedding extensions.vector(128) not null,
  created_at timestamptz not null default now()
);

create index if not exists rostos_foto_idx on public.rostos (foto_id);
create index if not exists rostos_galeria_idx on public.rostos (galeria_id);
create index if not exists rostos_user_idx on public.rostos (user_id);
create index if not exists rostos_organizacao_idx on public.rostos (organizacao_id);

revoke all on public.rostos from anon, authenticated;
grant select, insert, delete on public.rostos to authenticated;
grant all on public.rostos to service_role;

alter table public.rostos enable row level security;

-- Policy padrão; só entra rosto de foto que a conta enxerga, na galeria dela.
drop policy if exists rostos_select on public.rostos;
create policy rostos_select on public.rostos
  for select to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists rostos_insert on public.rostos;
create policy rostos_insert on public.rostos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (organizacao_id is null or organizacao_id = public.minha_organizacao())
    and exists (select 1 from public.fotos f where f.id = foto_id and f.galeria_id = rostos.galeria_id)
  );
drop policy if exists rostos_delete on public.rostos;
create policy rostos_delete on public.rostos
  for delete to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));

-- ---------------------------------------------------------------------------
-- 3. Funções públicas
-- ---------------------------------------------------------------------------
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
    'marca', public.marca_publica(),
    'tipo', g.tipo,
    'categoria', g.categoria,
    'local', g.local,
    'busca_rosto', g.tipo = 'evento' and g.busca_rosto,
    'contato_whatsapp', (select c.whatsapp from public.configuracoes_loja c where c.id = 1),
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

-- Vitrine: eventos publicados, do mais recente para o mais antigo. A galeria
-- de evento com senha fica fora (ela é para quem recebeu o link).
create or replace function public.eventos_publicos()
returns jsonb
language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'fotografo', public.nome_fotografo((select o.id from public.organizacoes o order by o.created_at limit 1)),
    'marca', public.marca_publica(),
    'eventos', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'slug', g.slug,
                 'titulo', g.titulo,
                 'categoria', g.categoria,
                 'local', g.local,
                 'data_evento', g.data_evento,
                 'preco_foto', g.preco_foto,
                 'busca_rosto', g.busca_rosto,
                 'total_fotos', (select count(*) from public.fotos f where f.galeria_id = g.id),
                 'capa', coalesce(
                   (select f.caminho_miniatura from public.fotos f where f.id = g.capa_foto_id),
                   (select f.caminho_miniatura from public.fotos f
                     where f.galeria_id = g.id order by f.ordem, f.created_at, f.id limit 1)
                 ))
               order by g.data_evento desc nulls last, g.created_at desc)
        from public.galerias g
       where g.status = 'publicada' and g.tipo = 'evento' and g.senha = ''
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.eventos_publicos() from anon, authenticated, public;
grant execute on function public.eventos_publicos() to anon, authenticated;

-- Busca por selfie: recebe só o vetor (128 números) calculado no navegador.
-- Devolve as fotos da galeria com um rosto a menos de 0,5 de distância
-- (euclidiana, a escala do face-api), da mais parecida para a menos.
create or replace function public.buscar_fotos_por_rosto(_slug text, _senha text, _rosto real[])
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  g public.galerias%rowtype;
  alvo extensions.vector(128);
begin
  select * into g from public.galerias
   where slug = lower(trim(coalesce(_slug, ''))) and status = 'publicada';
  if not found or g.tipo <> 'evento' or not g.busca_rosto then
    raise exception 'Esta galeria não tem busca por selfie.';
  end if;
  if g.senha <> '' and coalesce(_senha, '') <> g.senha then
    raise exception 'Senha da galeria incorreta.';
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

-- ---------------------------------------------------------------------------
-- 4. Auto-reparo com os objetos novos
-- ---------------------------------------------------------------------------
-- Igual à versão de `marca_da_loja`, com `rostos` e as duas funções públicas
-- novas na seção 3.
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

    -- Tabelas (fundação §6 e esta migration §6). `anon` não lê nenhuma tabela.
    grant select, update (nome) on public.perfis to authenticated;
    grant select, update (nome, cadastro_aberto) on public.organizacoes to authenticated;
    grant select on public.organizacao_membros to authenticated;
    grant select,
      update (nome_exibicao, chave_pix, instrucoes_pagamento, whatsapp, texto_marca_dagua,
              logo_caminho, cor_primaria, cor_secundaria)
      on public.configuracoes_loja to authenticated;
    grant select, insert, update, delete on public.galerias to authenticated;
    grant select, insert, update, delete on public.fotos to authenticated;
    grant select, update (status) on public.pedidos to authenticated;
    grant select on public.pedido_itens to authenticated;
    grant select, insert, delete on public.rostos to authenticated;

    grant all on
      public.perfis, public.organizacoes, public.organizacao_membros,
      public.configuracoes_loja, public.galerias, public.fotos, public.pedidos,
      public.pedido_itens, public.rostos
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
      public.foto_original_liberada(text),
      public.eventos_publicos(),
      public.buscar_fotos_por_rosto(text, text, real[])
      to anon, authenticated, service_role;

    -- Este reparo: chamado também por visitante (tela de entrada).
    grant execute on function public.garantir_instalacao()
      to anon, authenticated, service_role;

    -- Funções de trigger e auxiliares (`set_updated_at`, `handle_new_user`,
    -- `perfis_proteger_campos`, `pedidos_marcar_pago_em`, `nome_fotografo`,
    -- `marca_publica`)
    -- ficam sem EXECUTE para anon/authenticated.

    reparou := true;
  end if;

  return reparou;
end;
$$;

revoke all on function public.garantir_instalacao() from public, anon, authenticated;
grant execute on function public.garantir_instalacao() to anon, authenticated, service_role;

do $$ begin perform public.garantir_instalacao(); end $$;
