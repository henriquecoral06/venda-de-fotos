-- ============================================================================
-- Remove a busca de fotos por selfie
--
-- O fotógrafo decidiu não oferecer reconhecimento facial. Saem a função
-- pública de busca, a tabela `rostos` (os vetores de rosto já gravados são
-- apagados junto, o que também encerra a guarda de dado biométrico) e as
-- colunas `galerias.busca_rosto` e `fotos.rostos_analisados_em`. A extensão
-- `vector` fica instalada: não pesa e pode servir a outra função no futuro.
--
-- `eventos_publicos` e `galeria_publica` são recriadas sem o campo
-- `busca_rosto`; o restante é igual às versões de `eventos_abertos` e de
-- `revisao_seguranca`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Funções públicas sem a busca por rosto
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Busca, rostos e colunas de apoio
-- ---------------------------------------------------------------------------
drop function if exists public.buscar_fotos_por_rosto(text, text, real[]);
drop table if exists public.rostos;
alter table public.galerias drop column if exists busca_rosto;
alter table public.fotos drop column if exists rostos_analisados_em;

-- ---------------------------------------------------------------------------
-- 3. Auto-reparo sem `rostos` e sem a busca
-- ---------------------------------------------------------------------------
-- Igual à versão de `revisao_seguranca`, sem o grant de `rostos` e sem
-- `buscar_fotos_por_rosto` na lista de funções públicas.
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
    grant select, insert, update, delete on public.landing_pages to authenticated;

    grant all on
      public.perfis, public.organizacoes, public.organizacao_membros,
      public.configuracoes_loja, public.galerias, public.fotos, public.pedidos,
      public.pedido_itens, public.landing_pages, public.landing_segredos,
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
