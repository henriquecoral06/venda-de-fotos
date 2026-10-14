-- ============================================================================
-- Fundação do schema: contas, organização única e a tabela de exemplo
--
-- 1 instalação = 1 organização. A primeira conta criada vira `dono` de
-- "Minha organização"; as seguintes entram como `membro`, enquanto o cadastro
-- estiver aberto (`organizacoes.cadastro_aberto`). Com o cadastro fechado, o
-- trigger em auth.users recusa a conta nova e o `signUp` devolve erro.
--
--   * `perfis`: um por conta, criado pelo trigger `handle_new_user`;
--   * `organizacoes` / `organizacao_membros`: a organização e o vínculo;
--   * `anotacoes`: tabela de exemplo com a policy padrão de conteúdo
--     ("dono do registro OU membro da organização do registro"). Toda tabela
--     de feature nova segue o mesmo molde.
--
-- O arquivo é idempotente: enums via DO/exception, tabelas/índices com
-- `if not exists`, funções com `create or replace`, policies e triggers com
-- `drop … if exists`, privilégios com `revoke`/`grant` explícitos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.papel_organizacao as enum ('dono', 'membro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------------

-- Perfil da conta. Criado pelo trigger em auth.users; nunca pelo cliente.
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  -- false: o trigger de cadastro recusa contas novas.
  cadastro_aberto boolean not null default true,
  created_at timestamptz not null default now()
);

-- Uma conta pertence a no máximo uma organização (user_id é a chave).
-- Sem linha aqui = conta removida pelo dono: entra no app, mas só vê o que é dela.
create table if not exists public.organizacao_membros (
  user_id uuid primary key references public.perfis(id) on delete cascade,
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  papel public.papel_organizacao not null,
  created_at timestamptz not null default now()
);

-- Exemplo de tabela de feature. `organizacao_id` nulo = registro pessoal.
create table if not exists public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis(id) on delete cascade,
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  titulo text not null,
  conteudo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Índices
-- ---------------------------------------------------------------------------
create index if not exists organizacao_membros_organizacao_idx
  on public.organizacao_membros (organizacao_id);

create index if not exists anotacoes_user_idx on public.anotacoes (user_id);
create index if not exists anotacoes_organizacao_idx on public.anotacoes (organizacao_id);
create index if not exists anotacoes_organizacao_created_idx
  on public.anotacoes (organizacao_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Funções
-- ---------------------------------------------------------------------------

-- 4.1 updated_at genérico
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.set_updated_at() from anon, authenticated, public;

-- 4.2 Cadastro: perfil + vínculo com a organização única.
--     O nome chega em options.data do signUp e vira raw_user_meta_data.
--     Nenhuma organização ainda → cria "Minha organização" e a conta vira dono.
--     Já existe → entra como membro da mais antiga, se o cadastro estiver
--     aberto; fechado → exceção. O trigger é AFTER INSERT: a exceção desfaz o
--     insert em auth.users e a conta não é criada.
--     O advisory lock serializa dois cadastros simultâneos na instalação vazia,
--     para não nascerem duas organizações.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  _nome text;
  _org uuid;
  _aberto boolean;
begin
  _nome := nullif(trim(coalesce(meta ->> 'nome', '')), '');
  if _nome is null then
    _nome := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  if _nome = '' then
    _nome := 'Usuário';
  end if;

  insert into public.perfis (id, nome, email)
  values (new.id, _nome, coalesce(new.email, ''))
  on conflict (id) do nothing;

  perform pg_advisory_xact_lock(hashtext('ceia.organizacao_unica'));

  if not exists (select 1 from public.organizacao_membros m where m.user_id = new.id) then
    select o.id, o.cadastro_aberto into _org, _aberto
      from public.organizacoes o
     order by o.created_at, o.id
     limit 1;
    if _org is null then
      insert into public.organizacoes (nome) values ('Minha organização') returning id into _org;
      insert into public.organizacao_membros (user_id, organizacao_id, papel)
      values (new.id, _org, 'dono')
      on conflict (user_id) do nothing;
    elsif not _aberto then
      raise exception 'Cadastro fechado. Peça ao responsável para liberar.';
    else
      insert into public.organizacao_membros (user_id, organizacao_id, papel)
      values (new.id, _org, 'membro')
      on conflict (user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- 4.3 O e-mail do perfil acompanha o do Auth; o cliente não o altera.
--     O privilégio de coluna (seção 6) já barra; o trigger cobre um grant
--     mais largo adicionado depois.
create or replace function public.perfis_proteger_campos()
returns trigger
language plpgsql
set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.email is distinct from old.email then
      raise exception 'Não é permitido alterar o e-mail do perfil.' using errcode = '42501';
    end if;
    if new.id is distinct from old.id then
      raise exception 'Não é permitido alterar o id do perfil.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.perfis_proteger_campos() from anon, authenticated, public;

-- 4.4 Contexto do usuário logado. Security definer: as policies consultam
--     `organizacao_membros` sem cair na RLS da própria tabela.
create or replace function public.minha_organizacao()
returns uuid
language sql stable security definer
set search_path = public as $$
  select m.organizacao_id from public.organizacao_membros m where m.user_id = auth.uid();
$$;
revoke execute on function public.minha_organizacao() from anon, public;
grant execute on function public.minha_organizacao() to authenticated;

create or replace function public.meu_papel()
returns public.papel_organizacao
language sql stable security definer
set search_path = public as $$
  select m.papel from public.organizacao_membros m where m.user_id = auth.uid();
$$;
revoke execute on function public.meu_papel() from anon, public;
grant execute on function public.meu_papel() to authenticated;

-- Colegas de organização, sem consultar `perfis` (a policy de SELECT de perfis
-- não pode consultar a própria tabela).
create or replace function public.mesma_organizacao(_user uuid)
returns boolean
language sql stable security definer
set search_path = public as $$
  select exists (
    select 1
      from public.organizacao_membros alvo
      join public.organizacao_membros eu on eu.organizacao_id = alvo.organizacao_id
     where alvo.user_id = _user and eu.user_id = auth.uid()
  );
$$;
revoke execute on function public.mesma_organizacao(uuid) from anon, public;
grant execute on function public.mesma_organizacao(uuid) to authenticated;

-- 4.5 Reparo chamado pelo app a cada carregamento da área logada.
--     Já tem vínculo → nada. Não existe organização nenhuma → cria e vira dono.
--     Existe organização e a conta está fora → nada: é o estado "removido pelo
--     dono", e só o dono readmite. Devolve true quando a conta passou a ter vínculo.
create or replace function public.garantir_organizacao()
returns boolean
language plpgsql security definer
set search_path = public as $$
declare
  _org uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada. Faça login novamente.';
  end if;
  if exists (select 1 from public.organizacao_membros m where m.user_id = auth.uid()) then
    return false;
  end if;
  -- O vínculo aponta para `perfis`: sem perfil não há o que vincular.
  if not exists (select 1 from public.perfis p where p.id = auth.uid()) then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('ceia.organizacao_unica'));

  if exists (select 1 from public.organizacoes) then
    return false;
  end if;

  insert into public.organizacoes (nome) values ('Minha organização') returning id into _org;
  insert into public.organizacao_membros (user_id, organizacao_id, papel)
  values (auth.uid(), _org, 'dono');
  return true;
end;
$$;
revoke execute on function public.garantir_organizacao() from anon, public;
grant execute on function public.garantir_organizacao() to authenticated;

-- 4.6 Gestão pelo dono
create or replace function public.remover_membro(_user_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
declare
  _org uuid;
begin
  select m.organizacao_id into _org from public.organizacao_membros m
   where m.user_id = auth.uid() and m.papel = 'dono';
  if not found then
    raise exception 'Só o dono da organização pode remover membros.';
  end if;
  if _user_id = auth.uid() then
    raise exception 'O dono não pode remover a si mesmo.';
  end if;
  delete from public.organizacao_membros where user_id = _user_id and organizacao_id = _org;
  if not found then
    raise exception 'Membro não encontrado nesta organização.';
  end if;
end;
$$;
revoke execute on function public.remover_membro(uuid) from anon, public;
grant execute on function public.remover_membro(uuid) to authenticated;

create or replace function public.readmitir_membro(_user_id uuid)
returns void
language plpgsql security definer
set search_path = public as $$
declare
  _org uuid;
begin
  select m.organizacao_id into _org from public.organizacao_membros m
   where m.user_id = auth.uid() and m.papel = 'dono';
  if not found then
    raise exception 'Só o dono da organização pode readmitir membros.';
  end if;
  if not exists (select 1 from public.perfis p where p.id = _user_id) then
    raise exception 'Conta não encontrada.';
  end if;
  if exists (select 1 from public.organizacao_membros m where m.user_id = _user_id) then
    raise exception 'Esta conta já faz parte da organização.';
  end if;
  insert into public.organizacao_membros (user_id, organizacao_id, papel)
  values (_user_id, _org, 'membro');
end;
$$;
revoke execute on function public.readmitir_membro(uuid) from anon, public;
grant execute on function public.readmitir_membro(uuid) to authenticated;

-- Security definer porque a policy `perfis_select` só mostra o próprio perfil e
-- os colegas: quem está fora não aparece para o dono pelo RLS.
create or replace function public.contas_fora_da_organizacao()
returns table (user_id uuid, nome text, email text)
language plpgsql stable security definer
set search_path = public as $$
begin
  if not exists (
    select 1 from public.organizacao_membros m
     where m.user_id = auth.uid() and m.papel = 'dono'
  ) then
    raise exception 'Só o dono da organização pode ver as contas fora dela.';
  end if;

  return query
    select p.id, p.nome, p.email
      from public.perfis p
     where not exists (select 1 from public.organizacao_membros m where m.user_id = p.id)
     order by p.nome, p.id;
end;
$$;
revoke execute on function public.contas_fora_da_organizacao() from anon, public;
grant execute on function public.contas_fora_da_organizacao() to authenticated;

-- Liga/desliga a entrada de contas novas. Devolve o valor gravado.
create or replace function public.definir_cadastro_aberto(_aberto boolean)
returns boolean
language plpgsql security definer
set search_path = public as $$
declare
  _org uuid;
begin
  select m.organizacao_id into _org from public.organizacao_membros m
   where m.user_id = auth.uid() and m.papel = 'dono';
  if not found then
    raise exception 'Só o dono da organização pode liberar ou fechar o cadastro.';
  end if;
  if _aberto is null then
    raise exception 'Informe se o cadastro fica aberto ou fechado.';
  end if;
  update public.organizacoes set cadastro_aberto = _aberto where id = _org;
  return _aberto;
end;
$$;
revoke execute on function public.definir_cadastro_aberto(boolean) from anon, public;
grant execute on function public.definir_cadastro_aberto(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists perfis_proteger_campos_trg on public.perfis;
create trigger perfis_proteger_campos_trg
  before update on public.perfis
  for each row execute function public.perfis_proteger_campos();

drop trigger if exists perfis_set_updated_at on public.perfis;
create trigger perfis_set_updated_at before update on public.perfis
  for each row execute function public.set_updated_at();

drop trigger if exists anotacoes_set_updated_at on public.anotacoes;
create trigger anotacoes_set_updated_at before update on public.anotacoes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Privilégios de tabela
-- ---------------------------------------------------------------------------
-- Parte do zero: os privilégios padrão do schema public dariam tudo a `anon` e
-- `authenticated`. Cada tabela recebe só o que o cliente usa.
revoke all on
  public.perfis, public.organizacoes, public.organizacao_membros, public.anotacoes
  from anon, authenticated;

-- Colunas editáveis pelo cliente: um campo novo em `perfis` ou `organizacoes`
-- só é editável depois de entrar nestes grants.
grant select, update (nome) on public.perfis to authenticated;
grant select, update (nome, cadastro_aberto) on public.organizacoes to authenticated;
grant select on public.organizacao_membros to authenticated;
grant select, insert, update, delete on public.anotacoes to authenticated;

grant all on
  public.perfis, public.organizacoes, public.organizacao_membros, public.anotacoes
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.organizacoes enable row level security;
alter table public.organizacao_membros enable row level security;
alter table public.anotacoes enable row level security;

-- perfis: o próprio e os colegas. Sem insert/delete pelo cliente
-- (o trigger em auth.users cria; o cascade apaga).
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.mesma_organizacao(id));

drop policy if exists perfis_update on public.perfis;
create policy perfis_update on public.perfis
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- organizacoes: leitura da minha; edição só pelo dono.
-- Sem insert/delete pelo cliente (só pelas funções).
drop policy if exists organizacoes_select on public.organizacoes;
create policy organizacoes_select on public.organizacoes
  for select to authenticated
  using (id = public.minha_organizacao());

drop policy if exists organizacoes_update on public.organizacoes;
create policy organizacoes_update on public.organizacoes
  for update to authenticated
  using (id = public.minha_organizacao() and public.meu_papel() = 'dono')
  with check (id = public.minha_organizacao() and public.meu_papel() = 'dono');

-- organizacao_membros: leitura da minha organização; nenhuma escrita pelo cliente.
drop policy if exists organizacao_membros_select on public.organizacao_membros;
create policy organizacao_membros_select on public.organizacao_membros
  for select to authenticated
  using (organizacao_id = public.minha_organizacao());

-- Policy padrão de conteúdo: o dono do registro vê/edita/apaga o seu; qualquer
-- membro da organização vê/edita/apaga o que é da organização. Só se cria em
-- nome próprio, e só na própria organização (ou sem organização).
drop policy if exists anotacoes_select on public.anotacoes;
create policy anotacoes_select on public.anotacoes
  for select to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists anotacoes_insert on public.anotacoes;
create policy anotacoes_insert on public.anotacoes
  for insert to authenticated
  with check (user_id = auth.uid() and (organizacao_id is null or organizacao_id = public.minha_organizacao()));
drop policy if exists anotacoes_update on public.anotacoes;
create policy anotacoes_update on public.anotacoes
  for update to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()))
  with check (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
drop policy if exists anotacoes_delete on public.anotacoes;
create policy anotacoes_delete on public.anotacoes
  for delete to authenticated
  using (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
