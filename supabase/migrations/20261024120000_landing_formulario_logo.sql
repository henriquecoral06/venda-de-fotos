-- ============================================================================
-- Landing pages: formulário em popup e logo para fundo escuro
--
-- 1. O CTA da landing pode abrir um formulário (popup) em vez do WhatsApp. O
--    fotógrafo escolhe os campos (nome, e-mail, telefone e um campo com o
--    rótulo que quiser) no conteúdo da landing; as respostas ficam em
--    `landing_contatos`, que só a equipe lê. O visitante envia por
--    `enviar_contato_landing`, com limite de envios por visitante.
-- 2. A loja ganha a logo para fundo escuro (`logo_escuro_caminho`), ao lado da
--    que já existe (para fundo claro). Cada tela usa a que contrasta com o
--    fundo dela.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Logo para fundo escuro
-- ---------------------------------------------------------------------------
alter table public.configuracoes_loja
  add column if not exists logo_escuro_caminho text not null default '';

grant update (logo_escuro_caminho) on public.configuracoes_loja to authenticated;

-- Igual à de `marca_da_loja`, com a logo para fundo escuro.
create or replace function public.marca_publica()
returns jsonb
language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'logo', nullif(c.logo_caminho, ''),
    'logo_escuro', nullif(c.logo_escuro_caminho, ''),
    'cor_primaria', nullif(c.cor_primaria, ''),
    'cor_secundaria', nullif(c.cor_secundaria, '')
  )
  from public.configuracoes_loja c
  where c.id = 1;
$$;
revoke execute on function public.marca_publica() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2. Contatos recebidos pelo formulário da landing
-- ---------------------------------------------------------------------------
-- `user_id`/`organizacao_id` copiam os da landing: o contato aparece para quem
-- vê a landing. Sem insert/update pelo cliente: só pela função abaixo.
create table if not exists public.landing_contatos (
  id uuid primary key default gen_random_uuid(),
  landing_id uuid not null references public.landing_pages(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  -- {nome, email, telefone, personalizado}: só os campos que o formulário pediu.
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_contatos_landing_idx on public.landing_contatos (landing_id, created_at desc);
create index if not exists landing_contatos_user_idx on public.landing_contatos (user_id);
create index if not exists landing_contatos_organizacao_idx on public.landing_contatos (organizacao_id);

drop trigger if exists landing_contatos_set_updated_at on public.landing_contatos;
create trigger landing_contatos_set_updated_at before update on public.landing_contatos
  for each row execute function public.set_updated_at();

revoke all on public.landing_contatos from anon, authenticated;
grant select, delete on public.landing_contatos to authenticated;
grant all on public.landing_contatos to service_role;
alter table public.landing_contatos enable row level security;

-- Policy padrão de conteúdo (leitura e exclusão).
drop policy if exists landing_contatos_select on public.landing_contatos;
create policy landing_contatos_select on public.landing_contatos
  for select to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists landing_contatos_delete on public.landing_contatos;
create policy landing_contatos_delete on public.landing_contatos
  for delete to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));

-- Envio do formulário pelo visitante. A landing precisa estar publicada e com
-- o CTA em popup; só entram os campos conhecidos, com tamanho limitado. Cinco
-- envios por visitante a cada hora.
create or replace function public.enviar_contato_landing(_slug text, _dados jsonb)
returns boolean
language plpgsql security definer
set search_path = public as $$
declare
  l public.landing_pages%rowtype;
  _limpos jsonb := '{}'::jsonb;
  _campo text;
  _valor text;
  _ip text := public.ip_do_visitante();
begin
  select * into l from public.landing_pages
   where slug = lower(trim(coalesce(_slug, ''))) and publicada;
  if not found or coalesce(l.conteudo ->> 'cta_tipo', '') <> 'popup' then
    raise exception 'Formulário indisponível.';
  end if;
  if jsonb_typeof(coalesce(_dados, 'null'::jsonb)) <> 'object' then
    raise exception 'Preencha o formulário.';
  end if;

  foreach _campo in array array['nome', 'email', 'telefone', 'personalizado'] loop
    _valor := trim(coalesce(_dados ->> _campo, ''));
    if char_length(_valor) > 1000 then
      raise exception 'Texto longo demais.';
    end if;
    if _valor <> '' then
      _limpos := _limpos || jsonb_build_object(_campo, _valor);
    end if;
  end loop;
  if _limpos = '{}'::jsonb then
    raise exception 'Preencha o formulário.';
  end if;
  if _limpos ? 'email' and (_limpos ->> 'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;

  perform public.conferir_limite('contato', _ip, 5, interval '1 hour');
  insert into public.landing_contatos (landing_id, user_id, organizacao_id, dados)
  values (l.id, l.user_id, l.organizacao_id, _limpos);
  perform public.registrar_acesso('contato', _ip);
  return true;
end;
$$;
revoke execute on function public.enviar_contato_landing(text, jsonb) from anon, authenticated, public;
grant execute on function public.enviar_contato_landing(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Auto-reparo com os objetos novos
-- ---------------------------------------------------------------------------
-- Igual à versão de `remover_busca_selfie`, com `landing_contatos`, a função
-- de envio e a coluna da logo para fundo escuro.
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
              logo_caminho, logo_escuro_caminho, cor_primaria, cor_secundaria, marca_dagua_ativa)
      on public.configuracoes_loja to authenticated;
    grant select, insert, update, delete on public.galerias to authenticated;
    grant select, insert, update, delete on public.fotos to authenticated;
    grant select, update (status) on public.pedidos to authenticated;
    grant select on public.pedido_itens to authenticated;
    grant select, insert, update, delete on public.landing_pages to authenticated;
    grant select, delete on public.landing_contatos to authenticated;

    grant all on
      public.perfis, public.organizacoes, public.organizacao_membros,
      public.configuracoes_loja, public.galerias, public.fotos, public.pedidos,
      public.pedido_itens, public.landing_pages, public.landing_segredos,
      public.limites_acesso, public.landing_contatos
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
      public.landing_publica(text),
      public.enviar_contato_landing(text, jsonb),
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
