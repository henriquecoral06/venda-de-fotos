-- ============================================================================
-- Auto-reparo: linhas iniciais
--
-- O remix copia a estrutura do banco (tabelas, funções, triggers, privilégios),
-- mas não os dados. Toda linha que o app precisa para funcionar (linha única de
-- configuração, registro de exemplo) some na cópia. `garantir_instalacao()`
-- passa a ter a seção 0, onde a solução lista essas linhas para recriá-las.
-- No template a seção 0 fica sem código: ele não tem linha inicial.
-- O restante da função é idêntico ao da migration `auto_reparo_remix`.
-- ============================================================================

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
  --    Toda linha única (ex.: configurações com id = 1) ou dado de exemplo que o
  --    app precisa para funcionar entra aqui, no formato abaixo, e também no seed
  --    da migration que cria a tabela. Só recria o que falta; nunca sobrescreve.
  --
  --    if not exists (select 1 from public.<tabela> where id = 1) then
  --      insert into public.<tabela> (id) values (1) on conflict (id) do nothing;
  --      reparou := true;
  --    end if;

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

  -- 2. Contas criadas enquanto o trigger faltava: sem perfil. Faz o mesmo que
  --    `handle_new_user` teria feito, na ordem de criação (a mais antiga vira
  --    dona se não houver organização), com o mesmo advisory lock. Com o cadastro
  --    fechado a conta já existe e não há o que recusar: fica com perfil e sem
  --    vínculo, o mesmo estado de quem foi removido, até o dono readmitir.
  --    Quem já tem perfil e não tem vínculo foi removido pelo dono: não mexe.
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

  -- 3. Privilégios. A cópia devolve tudo junto, então três sentinelas (coisas
  --    que nunca ficam liberadas nas migrations) bastam para saber se é preciso
  --    refazer a lista inteira.
  if has_table_privilege('anon', 'public.perfis', 'SELECT')
     or has_table_privilege('authenticated', 'public.organizacao_membros', 'INSERT')
     or has_function_privilege('anon', 'public.remover_membro(uuid)', 'EXECUTE') then

    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke all on all functions in schema public from public, anon, authenticated;

    -- Tabelas (fundação §6). `anon` não lê nenhuma tabela.
    grant select, update (nome) on public.perfis to authenticated;
    grant select, update (nome, cadastro_aberto) on public.organizacoes to authenticated;
    grant select on public.organizacao_membros to authenticated;
    grant select, insert, update, delete on public.anotacoes to authenticated;

    grant all on
      public.perfis, public.organizacoes, public.organizacao_membros, public.anotacoes
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

    -- Este reparo: chamado também por visitante (tela de entrada).
    grant execute on function public.garantir_instalacao()
      to anon, authenticated, service_role;

    -- Funções de trigger (`set_updated_at`, `handle_new_user`,
    -- `perfis_proteger_campos`) ficam sem EXECUTE para anon/authenticated:
    -- o trigger dispara sem precisar do privilégio.

    reparou := true;
  end if;

  return reparou;
end;
$$;

revoke all on function public.garantir_instalacao() from public, anon, authenticated;
grant execute on function public.garantir_instalacao() to anon, authenticated, service_role;

-- Roda já na aplicação da migration (e na reexecução de uma cópia, onde um
-- `select` solto poderia ficar para trás).
do $$ begin perform public.garantir_instalacao(); end $$;
