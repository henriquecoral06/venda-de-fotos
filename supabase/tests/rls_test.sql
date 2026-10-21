-- Testes de RLS. Rodar no SQL editor do Supabase (ou `psql` com o role postgres).
-- Tudo dentro de uma transação com ROLLBACK: não deixa dados no banco.
-- Sucesso = retorna uma linha "RLS OK". Falha = exceção "RLS FALHOU: <caso>".
--
-- Simula usuários trocando o role para `authenticated` e injetando o JWT via
-- request.jwt.claims (é o que o PostgREST faz). Os perfis nascem de inserts em
-- auth.users com o role `postgres`, para exercitar o trigger handle_new_user.
-- Sem tabelas/funções auxiliares: o role authenticated não acessa tabelas
-- temporárias, e set_config('role') feito dentro de uma função é desfeito na saída.
--
-- Modelo: 1 instalação = 1 organização. A primeira conta criada vira dona de
-- "Minha organização", que nasce com o cadastro fechado; as seguintes entram
-- como membros quando o dono abre o cadastro. Com `cadastro_aberto = false`, handle_new_user levanta
-- 'Cadastro fechado…': o trigger é AFTER INSERT, então a exceção desfaz o
-- insert em auth.users (e o perfil) e o cliente recebe erro no `signUp`.
--
-- Ao criar uma tabela de feature, acrescente aqui os casos dela no mesmo molde
-- dos de `galerias` (membro vê o da organização, removido só vê o seu,
-- ninguém cria em nome de outro). A venda (galeria pública, pedido e download)
-- tem a seção própria no fim.

begin;

do $$
declare
  u_dono     uuid := gen_random_uuid();
  u_membro   uuid := gen_random_uuid();
  u_terceiro uuid := gen_random_uuid();
  org_id uuid;
  gal_org uuid;
  gal_membro uuid;
  foto_a uuid;
  foto_b uuid;
  cod text;
  cod_pacote text;
  j jsonb;
  gal_evento uuid;
  lp uuid;
  chave_org text;
  foto_evento uuid;
  papel_atual public.papel_organizacao;
  aberto boolean;
  n int;
  txt text;
  ok boolean;
begin
  -- Base vazia só dentro desta transação: sem nenhuma organização, o primeiro
  -- cadastro tem de virar dono. O `rollback` do fim devolve tudo (o cascade
  -- tira os vínculos e o `on delete set null` desmarca o conteúdo, só aqui).
  delete from public.organizacoes;

  -- ── cadastro ────────────────────────────────────────────────────────────
  -- 0. 1º cadastro: perfil com o nome do metadata + organização criada + dono
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_dono, 'dono@exemplo.test', jsonb_build_object('nome', 'Ana Dona'));

  select count(*) into n from public.perfis
   where id = u_dono and nome = 'Ana Dona' and email = 'dono@exemplo.test';
  if n <> 1 then raise exception 'RLS FALHOU: handle_new_user não copiou nome/e-mail'; end if;

  select count(*) into n from public.organizacoes;
  if n <> 1 then raise exception 'RLS FALHOU: 1º cadastro deixou % organizações, esperado 1', n; end if;
  select o.id, o.nome, o.cadastro_aberto into org_id, txt, aberto from public.organizacoes o;
  if txt <> 'Minha organização' then raise exception 'RLS FALHOU: organização nasceu com nome %', txt; end if;
  if aberto then raise exception 'RLS FALHOU: organização nasceu com o cadastro aberto'; end if;
  -- O dono abre o cadastro para a equipe (aqui direto, como postgres).
  update public.organizacoes set cadastro_aberto = true where id = org_id;
  select papel into papel_atual from public.organizacao_membros
   where user_id = u_dono and organizacao_id = org_id;
  if papel_atual is distinct from 'dono' then
    raise exception 'RLS FALHOU: 1º cadastro não virou dono (papel %)', papel_atual;
  end if;

  -- 1. 2º cadastro: entra como membro da mesma organização, sem criar outra
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_membro, 'membro@exemplo.test', '{}'::jsonb);
  select count(*) into n from public.organizacoes;
  if n <> 1 then raise exception 'RLS FALHOU: 2º cadastro criou outra organização (% no total)', n; end if;
  select papel into papel_atual from public.organizacao_membros
   where user_id = u_membro and organizacao_id = org_id;
  if papel_atual is distinct from 'membro' then
    raise exception 'RLS FALHOU: 2º cadastro não entrou como membro (papel %)', papel_atual;
  end if;
  select nome into txt from public.perfis where id = u_membro;
  if txt <> 'membro' then raise exception 'RLS FALHOU: nome sem metadata deveria ser a parte local do e-mail, veio %', txt; end if;

  -- ── dono ────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.galerias (user_id, organizacao_id, titulo, slug)
  values (u_dono, org_id, 'Galeria da organização', 'rls-galeria-org')
  returning id into gal_org;

  -- 2. insert direto em organizacoes/organizacao_membros é negado
  begin
    insert into public.organizacoes (nome) values ('Direta');
    raise exception 'RLS FALHOU: insert direto em organizacoes permitido';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.organizacao_membros (user_id, organizacao_id, papel)
    values (u_dono, org_id, 'membro');
    raise exception 'RLS FALHOU: insert direto em organizacao_membros permitido';
  exception when insufficient_privilege then null;
  end;

  -- 3. o perfil muda o nome, não o e-mail
  update public.perfis set nome = 'Ana Dona Silva' where id = u_dono;
  if not found then raise exception 'RLS FALHOU: dono não edita o próprio perfil'; end if;
  begin
    update public.perfis set email = 'outro@exemplo.test' where id = u_dono;
    raise exception 'RLS FALHOU: perfil trocou o e-mail pelo cliente';
  exception when insufficient_privilege then null;
  end;

  -- 4. dono edita o nome da organização
  update public.organizacoes set nome = 'Organização Exemplo' where id = org_id;
  if not found then raise exception 'RLS FALHOU: dono não editou o nome da organização'; end if;

  -- 5. garantir_organizacao não mexe em quem já tem vínculo
  if public.garantir_organizacao() then
    raise exception 'RLS FALHOU: garantir_organizacao devolveu true para o dono já vinculado';
  end if;

  -- 6. ninguém fora ainda; o dono não remove a si mesmo
  select count(*) into n from public.contas_fora_da_organizacao() c where c.user_id in (u_dono, u_membro);
  if n <> 0 then raise exception 'RLS FALHOU: contas_fora_da_organizacao listou % contas vinculadas', n; end if;
  begin
    perform public.remover_membro(u_dono);
    raise exception 'RLS FALHOU: o dono removeu a si mesmo';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;

  -- 7. dono fecha o cadastro
  if public.definir_cadastro_aberto(false) then
    raise exception 'RLS FALHOU: definir_cadastro_aberto(false) devolveu true';
  end if;

  -- ── cadastro fechado ────────────────────────────────────────────────────
  perform set_config('role', 'none', true);

  -- 8. o 3º cadastro é recusado e não deixa perfil nem vínculo
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (u_terceiro, 'terceiro@exemplo.test', jsonb_build_object('nome', 'Caio Terceiro'));
    raise exception 'RLS FALHOU: cadastro fechado aceitou conta nova';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
    if sqlerrm not like 'Cadastro fechado%' then
      raise exception 'RLS FALHOU: cadastro fechado falhou com outra mensagem: %', sqlerrm;
    end if;
  end;
  select count(*) into n from auth.users where id = u_terceiro;
  if n <> 0 then raise exception 'RLS FALHOU: cadastro fechado deixou a conta em auth.users'; end if;
  select count(*) into n from public.perfis where id = u_terceiro;
  if n <> 0 then raise exception 'RLS FALHOU: cadastro fechado deixou o perfil'; end if;

  -- 9. o dono reabre e o 3º entra como membro
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if not public.definir_cadastro_aberto(true) then
    raise exception 'RLS FALHOU: definir_cadastro_aberto(true) devolveu false';
  end if;

  perform set_config('role', 'none', true);
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_terceiro, 'terceiro@exemplo.test', jsonb_build_object('nome', 'Caio Terceiro'));
  select papel into papel_atual from public.organizacao_membros
   where user_id = u_terceiro and organizacao_id = org_id;
  if papel_atual is distinct from 'membro' then
    raise exception 'RLS FALHOU: 3º cadastro com o cadastro reaberto não entrou (papel %)', papel_atual;
  end if;

  -- ── membro ──────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.galerias (user_id, titulo, slug)
  values (u_membro, 'Galeria pessoal', 'rls-galeria-pessoal')
  returning id into gal_membro;

  -- 10. membro enxerga o que é da organização, os colegas e o próprio
  select count(*) into n from public.galerias;
  if n <> 2 then raise exception 'RLS FALHOU: membro enxerga % galerias, esperado 2', n; end if;
  select count(*) into n from public.perfis;
  if n <> 3 then raise exception 'RLS FALHOU: membro enxerga % perfis, esperado 3', n; end if;
  select count(*) into n from public.organizacao_membros;
  if n <> 3 then raise exception 'RLS FALHOU: membro enxerga % vínculos, esperado 3', n; end if;

  -- 11. membro edita o que é da organização (regra da policy padrão)
  update public.galerias set descricao = 'editado pelo membro' where id = gal_org;
  if not found then raise exception 'RLS FALHOU: membro não editou galeria da organização'; end if;

  -- 12. membro não cria em nome de outro nem escreve em organizacao_membros
  begin
    insert into public.galerias (user_id, organizacao_id, titulo, slug)
    values (u_dono, org_id, 'Forjada', 'rls-forjada');
    raise exception 'RLS FALHOU: membro criou galeria em nome do dono';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.organizacao_membros (user_id, organizacao_id, papel)
    values (u_membro, org_id, 'dono');
    raise exception 'RLS FALHOU: membro inseriu em organizacao_membros';
  exception when insufficient_privilege then null;
  end;

  -- 13. membro não edita o perfil de outro nem a organização
  update public.perfis set nome = 'Renomeado' where id = u_dono;
  if found then raise exception 'RLS FALHOU: membro renomeou o perfil do dono'; end if;
  update public.organizacoes set nome = 'Renomeada pelo membro' where id = org_id;
  if found then raise exception 'RLS FALHOU: membro renomeou a organização'; end if;
  update public.organizacoes set cadastro_aberto = false where id = org_id;
  if found then raise exception 'RLS FALHOU: membro fechou o cadastro pela tabela'; end if;

  -- 14. só o dono chama as funções de gestão
  begin
    perform public.remover_membro(u_terceiro);
    raise exception 'RLS FALHOU: membro removeu outro membro';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    perform public.readmitir_membro(u_membro);
    raise exception 'RLS FALHOU: membro chamou readmitir_membro';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    select count(*) into n from public.contas_fora_da_organizacao();
    raise exception 'RLS FALHOU: membro listou as contas fora da organização';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    perform public.definir_cadastro_aberto(false);
    raise exception 'RLS FALHOU: membro fechou o cadastro';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;

  -- ── dono remove o membro ────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.remover_membro(u_membro);
  select count(*) into n from public.organizacao_membros;
  if n <> 2 then raise exception 'RLS FALHOU: remover_membro deixou % vínculos, esperado 2', n; end if;

  -- 15. o removido aparece em contas_fora_da_organizacao
  select count(*) into n from public.contas_fora_da_organizacao() c
   where c.user_id = u_membro and c.nome = 'membro' and c.email = 'membro@exemplo.test';
  if n <> 1 then raise exception 'RLS FALHOU: contas_fora_da_organizacao não listou o removido'; end if;

  -- ── removido ────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 16. deixa de ver a organização, mas mantém o que é dele
  select count(*) into n from public.galerias;
  if n <> 1 then raise exception 'RLS FALHOU: removido enxerga % galerias, esperado 1 (a dele)', n; end if;
  select count(*) into n from public.organizacoes;
  if n <> 0 then raise exception 'RLS FALHOU: removido enxerga % organizações', n; end if;
  select count(*) into n from public.organizacao_membros;
  if n <> 0 then raise exception 'RLS FALHOU: removido enxerga % vínculos', n; end if;
  select count(*) into n from public.perfis;
  if n <> 1 then raise exception 'RLS FALHOU: removido enxerga % perfis, esperado 1 (o dele)', n; end if;

  -- 17. não marca registro como sendo da organização nem em nome de outro
  begin
    insert into public.galerias (user_id, organizacao_id, titulo, slug)
    values (u_membro, org_id, 'Infiltrada', 'rls-infiltrada');
    raise exception 'RLS FALHOU: removido inseriu galeria na organização';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.galerias (user_id, titulo, slug) values (u_dono, 'Forjada', 'rls-forjada-2');
    raise exception 'RLS FALHOU: removido inseriu galeria em nome do dono';
  exception when insufficient_privilege then null;
  end;
  update public.galerias set descricao = 'x' where id = gal_org;
  if found then raise exception 'RLS FALHOU: removido editou galeria da organização'; end if;

  -- 18. garantir_organizacao não reentra sozinho
  if public.garantir_organizacao() then
    raise exception 'RLS FALHOU: garantir_organizacao readmitiu o removido';
  end if;
  select count(*) into n from public.organizacao_membros;
  if n <> 0 then raise exception 'RLS FALHOU: removido voltou à organização sem o dono'; end if;

  -- ── dono readmite ───────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.readmitir_membro(u_membro);
  begin
    perform public.readmitir_membro(u_membro);
    raise exception 'RLS FALHOU: readmitiu quem já é membro';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  select count(*) into n from public.contas_fora_da_organizacao() c where c.user_id = u_membro;
  if n <> 0 then raise exception 'RLS FALHOU: readmitido continua em contas_fora_da_organizacao'; end if;

  -- 19. o readmitido volta a ver a organização, como membro
  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.galerias;
  if n <> 2 then raise exception 'RLS FALHOU: readmitido enxerga % galerias, esperado 2', n; end if;
  if public.meu_papel() is distinct from 'membro' then
    raise exception 'RLS FALHOU: readmitido voltou com papel %', public.meu_papel();
  end if;

  -- ── venda de fotos ──────────────────────────────────────────────────────
  -- 21. o dono põe fotos, preço e senha e publica a galeria da organização
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.fotos (galeria_id, user_id, organizacao_id, nome_arquivo,
                            caminho_original, caminho_previa, caminho_miniatura, largura, altura, ordem)
  values (gal_org, u_dono, org_id, 'a.jpg', org_id || '/rls/a.jpg', org_id || '/rls/a-previa.jpg', org_id || '/rls/a-mini.jpg', 100, 80, 1)
  returning id into foto_a;
  insert into public.fotos (galeria_id, user_id, organizacao_id, nome_arquivo,
                            caminho_original, caminho_previa, caminho_miniatura, largura, altura, ordem)
  values (gal_org, u_dono, org_id, 'b.jpg', org_id || '/rls/b.jpg', org_id || '/rls/b-previa.jpg', org_id || '/rls/b-mini.jpg', 100, 80, 2)
  returning id into foto_b;
  update public.galerias
     set status = 'publicada', senha = 'segredo', preco_foto = 15, preco_pacote = 25
   where id = gal_org;
  if not found then raise exception 'RLS FALHOU: dono não publicou a galeria'; end if;
  select chave into chave_org from public.galerias where id = gal_org;

  -- o dono não enxerga a galeria pessoal do membro, então não põe foto nela
  begin
    insert into public.fotos (galeria_id, user_id, organizacao_id, nome_arquivo,
                              caminho_original, caminho_previa, caminho_miniatura, largura, altura)
    values (gal_membro, u_dono, org_id, 'x.jpg', 'x/original.jpg', 'x/previa.jpg', 'x/mini.jpg', 10, 10);
    raise exception 'RLS FALHOU: dono pôs foto na galeria pessoal do membro';
  exception when insufficient_privilege then null;
  end;

  -- 22. o visitante não lê tabela nenhuma; a galeria vem da função, com senha
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);

  begin
    perform 1 from public.galerias;
    raise exception 'RLS FALHOU: visitante leu a tabela galerias';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.pedidos;
    raise exception 'RLS FALHOU: visitante leu a tabela pedidos';
  exception when insufficient_privilege then null;
  end;

  -- O nome legível não abre galeria de cliente: só a chave do link.
  if public.galeria_publica('rls-galeria-org', 'segredo') is not null then
    raise exception 'RLS FALHOU: galeria de cliente abriu pelo slug';
  end if;
  j := public.galeria_publica(chave_org, 'errada');
  if j is null or (j ->> 'liberada')::boolean or j ? 'fotos' then
    raise exception 'RLS FALHOU: galeria com senha errada liberou as fotos: %', j;
  end if;
  j := public.galeria_publica(upper(chave_org), 'segredo');
  if j is null or not (j ->> 'liberada')::boolean or jsonb_array_length(j -> 'fotos') <> 2 then
    raise exception 'RLS FALHOU: galeria com a senha certa não veio com as 2 fotos: %', j;
  end if;
  if j::text like '%/rls/a.jpg%' then
    raise exception 'RLS FALHOU: galeria pública expôs o caminho do original';
  end if;
  if public.galeria_publica('rls-galeria-pessoal', '') is not null then
    raise exception 'RLS FALHOU: galeria em rascunho apareceu para o visitante';
  end if;

  -- 23. pedido: o preço sai da galeria; senha e fotos são conferidas
  if public.criar_pedido(chave_org, 'errada', 'Cliente', 'cliente@exemplo.test', '',
                         array[foto_a], false) is not null then
    raise exception 'RLS FALHOU: pedido criado com a senha errada';
  end if;
  begin
    perform public.criar_pedido(chave_org, 'segredo', 'Cliente', 'cliente@exemplo.test', 'abc',
                                array[foto_a], false);
    raise exception 'RLS FALHOU: pedido aceitou telefone inválido';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    perform public.criar_pedido(chave_org, 'segredo', 'Cliente', 'cliente@exemplo.test', '',
                                array[foto_a, gen_random_uuid()], false);
    raise exception 'RLS FALHOU: pedido aceitou foto de fora da galeria';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;

  cod := public.criar_pedido(chave_org, 'segredo', 'Cliente Teste', 'Cliente@Exemplo.test', '',
                             array[foto_a, foto_a], false);
  j := public.pedido_publico(cod);
  if (j ->> 'valor_total')::numeric <> 15 or j ->> 'status' <> 'aguardando_pagamento'
     or j ->> 'cliente_email' <> 'cliente@exemplo.test' then
    raise exception 'RLS FALHOU: pedido avulso veio errado: %', j;
  end if;
  if jsonb_array_length(j -> 'itens') <> 1 or (j -> 'itens' -> 0 ->> 'original') is not null then
    raise exception 'RLS FALHOU: pedido não pago expôs o original ou repetiu a foto: %', j;
  end if;
  if public.foto_original_liberada(org_id || '/rls/a.jpg') then
    raise exception 'RLS FALHOU: original liberado antes do pagamento';
  end if;
  if public.pedido_publico('codigo-inexistente') is not null then
    raise exception 'RLS FALHOU: pedido_publico devolveu pedido para código inexistente';
  end if;

  cod_pacote := public.criar_pedido(chave_org, 'segredo', 'Cliente Pacote', 'pacote@exemplo.test',
                                    '', null, true);
  j := public.pedido_publico(cod_pacote);
  if (j ->> 'valor_total')::numeric <> 25 or jsonb_array_length(j -> 'itens') <> 2 then
    raise exception 'RLS FALHOU: pacote completo veio errado: %', j;
  end if;

  -- 24. o membro vê os pedidos e marca como pago; não cria pedido nem muda valor
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.pedidos;
  if n <> 2 then raise exception 'RLS FALHOU: membro enxerga % pedidos, esperado 2', n; end if;
  select count(*) into n from public.pedido_itens;
  if n <> 3 then raise exception 'RLS FALHOU: membro enxerga % itens de pedido, esperado 3', n; end if;
  begin
    update public.pedidos set valor_total = 1 where codigo = cod;
    raise exception 'RLS FALHOU: membro alterou o valor do pedido';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.pedidos (galeria_id, user_id, organizacao_id, cliente_nome, cliente_email, valor_total)
    values (gal_org, u_membro, org_id, 'Forjado', 'f@exemplo.test', 0);
    raise exception 'RLS FALHOU: membro criou pedido direto na tabela';
  exception when insufficient_privilege then null;
  end;
  update public.pedidos set status = 'pago' where codigo = cod;
  if not found then raise exception 'RLS FALHOU: membro não marcou o pedido como pago'; end if;
  select count(*) into n from public.pedidos where codigo = cod and pago_em is not null;
  if n <> 1 then raise exception 'RLS FALHOU: pedido pago ficou sem pago_em'; end if;

  select count(*) into n from public.configuracoes_loja;
  if n <> 1 then raise exception 'RLS FALHOU: membro não lê as configurações da loja'; end if;
  update public.configuracoes_loja set chave_pix = 'membro' where id = 1;
  if found then raise exception 'RLS FALHOU: membro editou as configurações da loja'; end if;
  update public.configuracoes_loja set cor_primaria = '#000000' where id = 1;
  if found then raise exception 'RLS FALHOU: membro trocou a cor da marca'; end if;

  -- 25. pago, o visitante recebe o caminho do original e o Storage o libera
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  j := public.pedido_publico(cod);
  if j -> 'itens' -> 0 ->> 'original' is distinct from org_id || '/rls/a.jpg' then
    raise exception 'RLS FALHOU: pedido pago sem o caminho do original: %', j;
  end if;
  if not public.foto_original_liberada(org_id || '/rls/a.jpg') then
    raise exception 'RLS FALHOU: original do pedido pago não foi liberado';
  end if;
  if public.foto_original_liberada(org_id || '/rls/b.jpg') then
    raise exception 'RLS FALHOU: foto só de pedido não pago foi liberada';
  end if;

  -- 26. só o dono edita a loja; galeria com pedido não é excluída
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.configuracoes_loja set chave_pix = 'pix@exemplo.test' where id = 1;
  if not found then raise exception 'RLS FALHOU: dono não editou as configurações da loja'; end if;

  -- 27. marca: o dono define logo e cores; cor fora do formato é recusada; a
  --     galeria pública devolve a marca
  update public.configuracoes_loja
     set cor_primaria = '#112233', cor_secundaria = '#aabbcc', logo_caminho = org_id || '/logo.png'
   where id = 1;
  if not found then raise exception 'RLS FALHOU: dono não definiu a marca'; end if;
  begin
    update public.configuracoes_loja set cor_primaria = 'vermelho' where id = 1;
    raise exception 'RLS FALHOU: cor fora do formato aceita';
  exception when check_violation then null;
  end;
  j := public.galeria_publica(chave_org, 'segredo');
  if j -> 'marca' ->> 'cor_primaria' is distinct from '#112233'
     or j -> 'marca' ->> 'logo' is distinct from org_id || '/logo.png' then
    raise exception 'RLS FALHOU: galeria pública sem a marca: %', j -> 'marca';
  end if;

  -- 28. evento aberto: vitrine pública, sem busca por selfie (removida)
  insert into public.galerias (user_id, organizacao_id, titulo, slug, status, tipo, categoria, local)
  values (u_dono, org_id, 'Torneio de futebol', 'rls-evento', 'publicada', 'evento', 'Futebol', 'Ginásio')
  returning id into gal_evento;
  insert into public.fotos (galeria_id, user_id, organizacao_id, nome_arquivo,
                            caminho_original, caminho_previa, caminho_miniatura, largura, altura)
  values (gal_evento, u_dono, org_id, 'e.jpg', org_id || '/rls/e.jpg', org_id || '/rls/e-previa.jpg',
          org_id || '/rls/e-mini.jpg', 100, 80)
  returning id into foto_evento;
  if to_regclass('public.rostos') is not null
     or to_regprocedure('public.buscar_fotos_por_rosto(text, text, real[])') is not null then
    raise exception 'RLS FALHOU: a busca por selfie continua no banco';
  end if;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  j := public.eventos_publicos();
  if not exists (select 1 from jsonb_array_elements(j -> 'eventos') e where e ->> 'slug' = 'rls-evento') then
    raise exception 'RLS FALHOU: evento publicado fora da vitrine: %', j;
  end if;
  if exists (select 1 from jsonb_array_elements(j -> 'eventos') e where e ->> 'slug' = 'rls-galeria-org') then
    raise exception 'RLS FALHOU: galeria de cliente apareceu na vitrine';
  end if;
  j := public.galeria_publica('rls-evento', '');
  if j ->> 'tipo' <> 'evento' or j ->> 'categoria' <> 'Futebol' or j ? 'busca_rosto' then
    raise exception 'RLS FALHOU: galeria de evento veio errada: %', j;
  end if;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    delete from public.galerias where id = gal_org;
    raise exception 'RLS FALHOU: galeria com pedido foi excluída';
  exception when foreign_key_violation then null;
  end;

  -- 29. landing page: segredo nunca lido, página pública sem o token, envio
  --     para a API de Conversões só com tudo configurado
  insert into public.landing_pages (user_id, organizacao_id, titulo, slug, modelo, publicada,
                                    meta_pixel_id, meta_capi_ativa)
  values (u_dono, org_id, 'Anúncio', 'rls-landing', 'editorial', true, '123456789', true)
  returning id into lp;
  perform public.definir_token_capi(lp, 'TOKEN-SECRETO-RLS');
  if not public.landing_tem_token_capi(lp) then
    raise exception 'RLS FALHOU: token da API de Conversões não ficou salvo';
  end if;
  begin
    perform 1 from public.landing_segredos;
    raise exception 'RLS FALHOU: conta logada leu landing_segredos';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.landing_pages (user_id, titulo, slug, modelo)
    values (u_dono, 'Errada', 'rls-landing-errada', 'nao-existe');
    raise exception 'RLS FALHOU: landing com modelo inexistente';
  exception when check_violation then null;
  end;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    perform 1 from public.landing_pages;
    raise exception 'RLS FALHOU: visitante leu landing_pages';
  exception when insufficient_privilege then null;
  end;
  j := public.landing_publica('rls-landing');
  if j is null or j ->> 'modelo' <> 'editorial' or not (j -> 'rastreamento' ->> 'meta_capi')::boolean
     or jsonb_typeof(j -> 'eventos') <> 'array' then
    raise exception 'RLS FALHOU: landing pública veio errada: %', j;
  end if;
  if j::text like '%TOKEN-SECRETO-RLS%' then
    raise exception 'RLS FALHOU: landing pública expôs o token';
  end if;
  if not exists (select 1 from jsonb_array_elements(j -> 'eventos') e where e ->> 'slug' = 'rls-evento') then
    raise exception 'RLS FALHOU: landing sem a seção de eventos: %', j -> 'eventos';
  end if;
  if not public.enviar_evento_meta('rls-landing', 'PageView', 'ev-1', 'https://x.test/l/rls-landing',
                                   'agente', '200.1.1.1', 'fb.1.1.1', '') then
    raise exception 'RLS FALHOU: evento da API de Conversões não foi enviado';
  end if;
  begin
    perform public.enviar_evento_meta('rls-landing', 'Purchase', 'ev-2', '', '', '', '', '');
    raise exception 'RLS FALHOU: evento fora da lista aceito';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    perform public.definir_token_capi(lp, 'invasor');
    raise exception 'RLS FALHOU: visitante trocou o token';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.landing_pages set publicada = false where id = lp;
  if public.landing_publica('rls-landing') is not null then
    raise exception 'RLS FALHOU: landing não publicada apareceu';
  end if;
  if public.enviar_evento_meta('rls-landing', 'PageView', 'ev-3', '', '', '', '', '') then
    raise exception 'RLS FALHOU: evento enviado de landing não publicada';
  end if;

  -- 30. download liberado pelo fotógrafo; limite de pedidos e de senha errada
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.galerias set download_liberado = true where id = gal_evento;
  if not found then raise exception 'RLS FALHOU: dono não liberou o download'; end if;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  j := public.galeria_publica('rls-evento', '');
  if j -> 'fotos' -> 0 ->> 'original' is distinct from org_id || '/rls/e.jpg' then
    raise exception 'RLS FALHOU: galeria com download liberado sem o original: %', j -> 'fotos';
  end if;
  if not public.foto_original_liberada(org_id || '/rls/e.jpg') then
    raise exception 'RLS FALHOU: Storage não liberou o original da galeria liberada';
  end if;
  j := public.galeria_publica(chave_org, 'segredo');
  if j -> 'fotos' -> 0 ->> 'original' is not null then
    raise exception 'RLS FALHOU: galeria sem download liberado expôs o original';
  end if;

  ok := false;
  for n in 1..12 loop
    begin
      perform public.criar_pedido('rls-evento', '', 'Robô', 'robo' || n || '@exemplo.test', '',
                                  array[foto_evento], false);
    exception when others then
      if sqlerrm like 'Muitas tentativas%' then ok := true; exit; end if;
      raise;
    end;
  end loop;
  if not ok then raise exception 'RLS FALHOU: 12 pedidos seguidos do mesmo visitante sem limite'; end if;

  ok := false;
  for n in 1..12 loop
    begin
      perform public.galeria_publica(chave_org, 'chute' || n);
    exception when others then
      if sqlerrm like 'Muitas tentativas%' then ok := true; exit; end if;
      raise;
    end;
  end loop;
  if not ok then raise exception 'RLS FALHOU: 12 senhas erradas seguidas sem bloqueio'; end if;
  begin
    perform public.galeria_publica(chave_org, 'segredo');
    raise exception 'RLS FALHOU: galeria abriu durante o bloqueio por tentativas';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    perform 1 from public.limites_acesso;
    raise exception 'RLS FALHOU: visitante leu limites_acesso';
  exception when insufficient_privilege then null;
  end;

  -- 31. original pago: o Storage assina o link, mas listar a pasta não o mostra
  perform set_config('role', 'none', true);
  insert into storage.objects (bucket_id, name) values ('originais', org_id || '/rls/a.jpg');
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  perform set_config('storage.operation', 'storage.object.sign', true);
  select count(*) into n from storage.objects where bucket_id = 'originais' and name = org_id || '/rls/a.jpg';
  if n <> 1 then raise exception 'RLS FALHOU: comprador não consegue assinar o original pago'; end if;
  perform set_config('storage.operation', 'storage.object.list', true);
  select count(*) into n from storage.objects where bucket_id = 'originais';
  if n <> 0 then raise exception 'RLS FALHOU: visitante listou % original(is)', n; end if;
  perform set_config('storage.operation', '', true);
  perform set_config('role', 'none', true);

  -- 32. formulário da landing: o visitante envia, só a equipe lê; com limite
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.landing_pages set publicada = true, conteudo = '{"cta_tipo": "whatsapp"}' where id = lp;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin
    perform public.enviar_contato_landing('rls-landing', '{"nome": "Ana"}');
    raise exception 'RLS FALHOU: contato aceito em landing sem formulário';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.landing_pages set conteudo = '{"cta_tipo": "popup"}' where id = lp;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  if not public.enviar_contato_landing('rls-landing',
       '{"nome": " Ana ", "email": "ana@exemplo.test", "invasor": "x"}') then
    raise exception 'RLS FALHOU: contato válido recusado';
  end if;
  begin
    perform public.enviar_contato_landing('rls-landing', '{"email": "nao-e-email"}');
    raise exception 'RLS FALHOU: contato aceitou e-mail inválido';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    perform 1 from public.landing_contatos;
    raise exception 'RLS FALHOU: visitante leu landing_contatos';
  exception when insufficient_privilege then null;
  end;
  ok := false;
  for n in 1..8 loop
    begin
      perform public.enviar_contato_landing('rls-landing', jsonb_build_object('nome', 'Robô ' || n));
    exception when others then
      if sqlerrm like 'Muitas tentativas%' then ok := true; exit; end if;
      raise;
    end;
  end loop;
  if not ok then raise exception 'RLS FALHOU: formulário sem limite de envios'; end if;

  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select dados into j from public.landing_contatos where landing_id = lp order by created_at limit 1;
  if j ->> 'nome' is distinct from 'Ana' or j ? 'invasor' then
    raise exception 'RLS FALHOU: contato gravado errado: %', j;
  end if;
  begin
    insert into public.landing_contatos (landing_id, user_id, organizacao_id, dados)
    values (lp, u_dono, org_id, '{}');
    raise exception 'RLS FALHOU: equipe gravou contato direto na tabela';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);

  -- ── reparo na instalação vazia ──────────────────────────────────────────
  -- 20. sem organização nenhuma, garantir_organizacao cria e faz dono
  perform set_config('role', 'none', true);
  delete from public.organizacoes;

  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ok := public.garantir_organizacao();
  if not ok then raise exception 'RLS FALHOU: garantir_organizacao não criou a organização na base vazia'; end if;
  if public.meu_papel() is distinct from 'dono' then
    raise exception 'RLS FALHOU: garantir_organizacao não fez dono (papel %)', public.meu_papel();
  end if;

  -- e uma segunda conta não reentra por ele: a organização já existe
  perform set_config('request.jwt.claims', json_build_object('sub', u_terceiro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if public.garantir_organizacao() then
    raise exception 'RLS FALHOU: garantir_organizacao criou uma segunda organização';
  end if;

  perform set_config('role', 'none', true);
  select count(*) into n from public.organizacoes;
  if n <> 1 then raise exception 'RLS FALHOU: base terminou com % organizações, esperado 1', n; end if;

  create temp table rls_resultado as select 'RLS OK'::text as resultado;
end $$;

select * from rls_resultado;

rollback;
