-- ============================================================================
-- Landing pages para anúncios, com pixels, tags e API de Conversões
--
-- O fotógrafo escolhe um de quatro modelos (editorial, portfólio, estúdio e
-- clássico), troca textos, fotos e cores e publica em `/l/<slug>`. Toda
-- landing tem uma seção com os eventos abertos da vitrine (`eventos_publicos`).
--
-- Rastreamento: os IDs públicos (Meta Pixel, GA4, Google Ads, Tag Manager,
-- TikTok) e o código livre de head/body ficam em `landing_pages` e vão para o
-- navegador. O token da API de Conversões da Meta é segredo: fica em
-- `landing_segredos`, que nenhum cliente lê; só `enviar_evento_meta` o usa,
-- enviando o evento à Meta pelo próprio banco (pg_net).
-- ============================================================================

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis(id) on delete cascade,
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  titulo text not null check (char_length(titulo) between 2 and 120),
  slug text not null unique
    check (char_length(slug) between 3 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  modelo text not null check (modelo in ('editorial', 'portfolio', 'estudio', 'classico')),
  publicada boolean not null default false,
  -- {fundo, texto, primaria, destaque} em hex.
  cores jsonb not null default '{}'::jsonb,
  -- Textos, serviços, imagens e opções da seção de eventos (formato no app).
  conteudo jsonb not null default '{}'::jsonb,
  meta_pixel_id text not null default '' check (meta_pixel_id ~ '^[0-9]{0,20}$'),
  ga4_id text not null default '' check (ga4_id ~ '^(G-[A-Z0-9]{4,16})?$'),
  google_ads_id text not null default '' check (google_ads_id ~ '^(AW-[0-9]{4,16})?$'),
  gtm_id text not null default '' check (gtm_id ~ '^(GTM-[A-Z0-9]{4,12})?$'),
  tiktok_pixel_id text not null default '' check (tiktok_pixel_id ~ '^[A-Z0-9]{0,30}$'),
  -- Código livre do fotógrafo (outras tags); vai para a página como veio.
  codigo_head text not null default '' check (char_length(codigo_head) <= 20000),
  codigo_body text not null default '' check (char_length(codigo_body) <= 20000),
  meta_capi_ativa boolean not null default false,
  meta_test_event_code text not null default '' check (char_length(meta_test_event_code) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_pages_user_idx on public.landing_pages (user_id);
create index if not exists landing_pages_organizacao_idx on public.landing_pages (organizacao_id);

-- Segredos por landing. Sem grant para anon/authenticated: só as funções abaixo.
create table if not exists public.landing_segredos (
  landing_id uuid primary key references public.landing_pages(id) on delete cascade,
  meta_capi_token text not null default '',
  updated_at timestamptz not null default now()
);

drop trigger if exists landing_pages_set_updated_at on public.landing_pages;
create trigger landing_pages_set_updated_at before update on public.landing_pages
  for each row execute function public.set_updated_at();

revoke all on public.landing_pages, public.landing_segredos from anon, authenticated;
grant select, insert, update, delete on public.landing_pages to authenticated;
grant all on public.landing_pages, public.landing_segredos to service_role;

alter table public.landing_pages enable row level security;
alter table public.landing_segredos enable row level security;

-- Policy padrão de conteúdo.
drop policy if exists landing_pages_select on public.landing_pages;
create policy landing_pages_select on public.landing_pages
  for select to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists landing_pages_insert on public.landing_pages;
create policy landing_pages_insert on public.landing_pages
  for insert to authenticated
  with check (user_id = auth.uid() and (organizacao_id is null or organizacao_id = public.minha_organizacao()));
drop policy if exists landing_pages_update on public.landing_pages;
create policy landing_pages_update on public.landing_pages
  for update to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()))
  with check (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists landing_pages_delete on public.landing_pages;
create policy landing_pages_delete on public.landing_pages
  for delete to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));

-- ---------------------------------------------------------------------------
-- 2. Token da API de Conversões (gravar e saber se existe, nunca ler)
-- ---------------------------------------------------------------------------
-- Security definer: a tabela de segredos não tem grant. A permissão é a da
-- policy padrão da landing, conferida aqui dentro com `auth.uid()`.
create or replace function public.definir_token_capi(_landing uuid, _token text)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not exists (
    select 1 from public.landing_pages l
     where l.id = _landing
       and (l.user_id = auth.uid() or (l.organizacao_id is not null and l.organizacao_id = public.minha_organizacao()))
  ) then
    raise exception 'Landing page não encontrada.';
  end if;
  if char_length(coalesce(_token, '')) > 500 then
    raise exception 'Token longo demais.';
  end if;
  insert into public.landing_segredos (landing_id, meta_capi_token, updated_at)
  values (_landing, trim(coalesce(_token, '')), now())
  on conflict (landing_id) do update
    set meta_capi_token = excluded.meta_capi_token, updated_at = now();
end;
$$;

create or replace function public.landing_tem_token_capi(_landing uuid)
returns boolean
language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.landing_segredos s
      join public.landing_pages l on l.id = s.landing_id
     where s.landing_id = _landing and s.meta_capi_token <> ''
       and (l.user_id = auth.uid() or (l.organizacao_id is not null and l.organizacao_id = public.minha_organizacao()))
  );
$$;

revoke execute on function public.definir_token_capi(uuid, text) from anon, public;
grant execute on function public.definir_token_capi(uuid, text) to authenticated;
revoke execute on function public.landing_tem_token_capi(uuid) from anon, public;
grant execute on function public.landing_tem_token_capi(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Funções públicas
-- ---------------------------------------------------------------------------
-- Landing publicada para o visitante: modelo, cores, conteúdo, IDs públicos
-- de rastreamento, marca da loja e os eventos da vitrine (até 9).
create or replace function public.landing_publica(_slug text)
returns jsonb
language plpgsql stable security definer
set search_path = public as $$
declare
  l public.landing_pages%rowtype;
  vitrine jsonb;
begin
  select * into l from public.landing_pages
   where slug = lower(trim(coalesce(_slug, ''))) and publicada;
  if not found then
    return null;
  end if;
  vitrine := public.eventos_publicos();
  return jsonb_build_object(
    'slug', l.slug,
    'modelo', l.modelo,
    'cores', l.cores,
    'conteudo', l.conteudo,
    'fotografo', vitrine -> 'fotografo',
    'marca', vitrine -> 'marca',
    'whatsapp', (select c.whatsapp from public.configuracoes_loja c where c.id = 1),
    'eventos', coalesce((
      select jsonb_agg(e) from (
        select e from jsonb_array_elements(vitrine -> 'eventos') e limit 9
      ) x
    ), '[]'::jsonb),
    'rastreamento', jsonb_build_object(
      'meta_pixel_id', l.meta_pixel_id,
      'ga4_id', l.ga4_id,
      'google_ads_id', l.google_ads_id,
      'gtm_id', l.gtm_id,
      'tiktok_pixel_id', l.tiktok_pixel_id,
      'codigo_head', l.codigo_head,
      'codigo_body', l.codigo_body,
      'meta_capi', l.meta_capi_ativa and l.meta_pixel_id <> ''
    )
  );
end;
$$;
revoke execute on function public.landing_publica(text) from anon, authenticated, public;
grant execute on function public.landing_publica(text) to anon, authenticated;

-- API de Conversões da Meta: o navegador manda o evento (com o mesmo event_id
-- do pixel, para a Meta deduplicar) e o banco repassa com o token guardado.
-- Só eventos conhecidos; IP e user agent vêm do servidor do app.
create or replace function public.enviar_evento_meta(
  _slug text,
  _evento text,
  _event_id text,
  _url text,
  _user_agent text,
  _ip text,
  _fbp text,
  _fbc text
)
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare
  l public.landing_pages%rowtype;
  token text;
  usuario jsonb;
  corpo jsonb;
begin
  select * into l from public.landing_pages
   where slug = lower(trim(coalesce(_slug, ''))) and publicada;
  if not found or not l.meta_capi_ativa or l.meta_pixel_id = '' then
    return false;
  end if;
  if _evento not in ('PageView', 'ViewContent', 'Contact', 'Lead') then
    raise exception 'Evento não aceito.';
  end if;
  select s.meta_capi_token into token from public.landing_segredos s where s.landing_id = l.id;
  if coalesce(token, '') = '' then
    return false;
  end if;

  usuario := jsonb_strip_nulls(jsonb_build_object(
    'client_user_agent', nullif(left(coalesce(_user_agent, ''), 500), ''),
    'client_ip_address', nullif(left(coalesce(_ip, ''), 64), ''),
    'fbp', nullif(left(coalesce(_fbp, ''), 200), ''),
    'fbc', nullif(left(coalesce(_fbc, ''), 500), '')
  ));
  corpo := jsonb_build_object(
    'data', jsonb_build_array(jsonb_build_object(
      'event_name', _evento,
      'event_time', extract(epoch from now())::bigint,
      'event_id', left(coalesce(_event_id, ''), 100),
      'action_source', 'website',
      'event_source_url', left(coalesce(_url, ''), 1000),
      'user_data', usuario
    ))
  );
  if l.meta_test_event_code <> '' then
    corpo := corpo || jsonb_build_object('test_event_code', l.meta_test_event_code);
  end if;

  perform net.http_post(
    url := 'https://graph.facebook.com/v21.0/' || l.meta_pixel_id || '/events?access_token=' || token,
    body := corpo,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return true;
end;
$$;
revoke execute on function public.enviar_evento_meta(text, text, text, text, text, text, text, text)
  from anon, authenticated, public;
grant execute on function public.enviar_evento_meta(text, text, text, text, text, text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Auto-reparo com os objetos novos
-- ---------------------------------------------------------------------------
-- Igual à versão de `eventos_abertos`, com as landing pages e as funções delas
-- na seção 3. `landing_segredos` só tem grant para service_role.
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
    grant select, insert, update, delete on public.landing_pages to authenticated;

    grant all on
      public.perfis, public.organizacoes, public.organizacao_membros,
      public.configuracoes_loja, public.galerias, public.fotos, public.pedidos,
      public.pedido_itens, public.rostos, public.landing_pages, public.landing_segredos
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
      public.definir_cadastro_aberto(boolean),
      public.definir_token_capi(uuid, text),
      public.landing_tem_token_capi(uuid)
      to authenticated, service_role;

    -- Funções públicas da venda (esta migration §4): também para o visitante.
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
