-- ============================================================================
-- Marca da loja: logo e cores
--
-- O dono envia a logo (bucket público `marca`, PNG/JPG/WebP até 2 MB; SVG fica
-- de fora porque pode carregar script) e escolhe a cor principal e a de apoio,
-- sugeridas a partir da logo no navegador. As telas do cliente (galeria e
-- pedido) usam a logo no cabeçalho e as cores nos botões e na seleção.
--
-- `galeria_publica` e `pedido_publico` passam a devolver `marca`; o restante
-- delas é igual ao da migration `venda_de_fotos`. `garantir_instalacao()` ganha
-- o bucket na seção 0 e as colunas novas no grant de `configuracoes_loja`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colunas
-- ---------------------------------------------------------------------------
-- Cor vazia = a tela do cliente usa a cor padrão do sistema.
alter table public.configuracoes_loja
  add column if not exists logo_caminho text not null default '',
  add column if not exists cor_primaria text not null default ''
    check (cor_primaria = '' or cor_primaria ~ '^#[0-9a-f]{6}$'),
  add column if not exists cor_secundaria text not null default ''
    check (cor_secundaria = '' or cor_secundaria ~ '^#[0-9a-f]{6}$');

grant update (logo_caminho, cor_primaria, cor_secundaria)
  on public.configuracoes_loja to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Funções
-- ---------------------------------------------------------------------------
-- Marca para o visitante (auxiliar das funções públicas, sem EXECUTE direto).
create or replace function public.marca_publica()
returns jsonb
language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'logo', nullif(c.logo_caminho, ''),
    'cor_primaria', nullif(c.cor_primaria, ''),
    'cor_secundaria', nullif(c.cor_secundaria, '')
  )
  from public.configuracoes_loja c
  where c.id = 1;
$$;
revoke execute on function public.marca_publica() from anon, authenticated, public;

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

-- ---------------------------------------------------------------------------
-- 3. Storage: bucket da marca, escrito só pelo dono, na pasta da organização
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists marca_select on storage.objects;
create policy marca_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] = public.minha_organizacao()::text
  );
drop policy if exists marca_insert on storage.objects;
create policy marca_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] = public.minha_organizacao()::text
    and public.meu_papel() = 'dono'
  );
drop policy if exists marca_delete on storage.objects;
create policy marca_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] = public.minha_organizacao()::text
    and public.meu_papel() = 'dono'
  );

-- ---------------------------------------------------------------------------
-- 4. Auto-reparo com os objetos novos
-- ---------------------------------------------------------------------------
-- Igual à versão de `venda_de_fotos`, com o bucket `marca` na seção 0 e as
-- colunas da marca no grant de `configuracoes_loja` (seção 3).
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
