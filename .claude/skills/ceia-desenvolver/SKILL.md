---
name: ceia-desenvolver
description: Manual de engenharia deste repositório (TanStack Start + Supabase). Use ao configurar uma solução nova a partir do template, criar feature, tabela, migration, policy de RLS, rota ou server function, mexer em tela seguindo o design system, ou antes de commitar.
---

# Desenvolver uma solução a partir do template

Stack: TanStack Start + TanStack Router (rotas por arquivo), React 19, TypeScript estrito,
Tailwind v4, shadcn/ui, React Query, Supabase (Postgres, Auth, RLS) no plano gratuito. O build
gera um Worker (Cloudflare), então o código de servidor roda sem APIs do Node.

## 1. Começar uma solução

1. **Marca**: edite `src/config/brand.ts` (`name`, `tagline`; `company` fica). É o único ponto de
   marca no código; título e descrição da aba saem dele. Favicon (`public/favicon*`) e paleta
   (tokens em `src/styles.css`) são opcionais.
2. **Projeto Supabase**: crie um projeto gratuito em supabase.com. Em _Project Settings → API
   Keys_ copie a URL, a _publishable key_ (`sb_publishable_…`) e a _secret key_ (`sb_secret_…`).
3. **`.env`**: `cp .env.example .env` e preencha:
   - `VITE_SUPABASE_URL` e `SUPABASE_URL` = URL do projeto;
   - `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_PUBLISHABLE_KEY` = publishable key;
   - `SUPABASE_SERVICE_ROLE_KEY` = secret key (só servidor; nunca com prefixo `VITE_`).
     O `.env` está no `.gitignore`. Segredos de desenvolvimento (a service role) ficam em
     `.env.local`, que também fica fora do git; o `.env` do projeto publicado guarda só os
     valores públicos e é versionado.
4. **Schema**: aplique `supabase/migrations/*` em ordem, por um dos caminhos:
   - CLI: `npx supabase init` (cria `supabase/config.toml`; não mexe nas migrations),
     `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`;
   - ou cole cada arquivo, em ordem de timestamp, no _SQL Editor_ do painel.
     Depois rode no SQL Editor `supabase/tests/rls_test.sql` (esperado: uma linha `RLS OK`) e
     `supabase/tests/remix_reparo_test.sql` (esperado: `REPARO OK`).
5. **Auth**: em _Authentication → Sign In / Providers → Email_, decida sobre _Confirm email_
   (ligado, a conta só entra depois do link recebido). Em _URL Configuration_, ponha a URL do dev
   (`http://localhost:8080`) em _Site URL_ e `http://localhost:8080/**` em _Redirect URLs_ (o
   magic link volta para `/` e o link de nova senha para `/redefinir-senha`); depois, as de
   produção.
6. `npm install` e `npm run dev` (sobe em `http://localhost:8080`).
7. **Primeira conta**: aba "Cadastrar" em `/`. Ela vira `dono` de "Minha organização" (renomeie
   em Equipe). As contas seguintes entram como `membro` enquanto o cadastro estiver aberto; o
   dono fecha e reabre em Equipe. A tela de entrada tem ainda "Magic Link" (só para quem já tem
   conta: `shouldCreateUser: false`) e "Esqueceu a senha?", que leva a `/redefinir-senha`. Os
   dois respondem de forma neutra ("Se houver uma conta com este e-mail…"). Erros do Auth em
   português ficam em `src/lib/auth-errors.ts`.

## 2. Modelo de dados e permissões

- 1 instalação = 1 organização. `perfis` (um por conta, criado pelo trigger `handle_new_user`),
  `organizacoes` (com `cadastro_aberto`), `organizacao_membros` (`user_id` é chave: no máximo uma
  organização por conta; sem linha = removido pelo dono).
- Funções: `minha_organizacao()`, `meu_papel()`, `mesma_organizacao(uuid)`,
  `garantir_organizacao()` (reparo chamado pelo layout logado; só cria organização se não existir
  nenhuma), `remover_membro`, `readmitir_membro`, `contas_fora_da_organizacao`,
  `definir_cadastro_aberto` (as quatro últimas só para o dono).
- Cadastro fechado: o trigger levanta `Cadastro fechado…` e o insert em `auth.users` é desfeito.
  O Auth devolve ao cliente o erro genérico `Database error saving new user`; a tela de entrada
  traduz os dois para "Cadastro fechado. Peça ao responsável para liberar.".
- **Auto-reparo** (`garantir_instalacao()`, migration `auto_reparo_remix`): quando o banco é
  copiado reexecutando as migrations (remix), GRANT/REVOKE soltos e triggers em `auth.users`
  podem ficar para trás. A função recria o trigger `on_auth_user_created`, cria perfil e vínculo
  das contas que nasceram sem ele (a mais antiga vira dona se não houver organização) e, se uma
  das três sentinelas de privilégio falhar, revoga tudo de `anon`/`authenticated` em `public` e
  reaplica a lista exata de grants. O app a chama sozinho: no `beforeLoad` de `/` (no servidor,
  como visitante, no máximo a cada 10 minutos por instância, `src/lib/instalacao.ts`) e no
  `GarantirPerfil` da área logada quando a conta chega sem perfil ou sem organização. Falha
  nunca bloqueia a tela. O remix copia a estrutura, não os dados: linhas iniciais (linha única
  de configuração, registro de exemplo) entram na seção 0 da função.
- **Policy padrão de conteúdo** (a de `anotacoes`): select/update/delete quando
  `user_id = auth.uid()` **ou** `organizacao_id = minha_organizacao()`; insert só com
  `user_id = auth.uid()` e `organizacao_id` nulo ou igual à minha. `organizacao_id` nulo =
  registro pessoal. Quem é removido continua vendo só o que é dele.
- Privilégios explícitos: cada tabela começa com `revoke all … from anon, authenticated` e recebe
  só o que o cliente usa. Colunas editáveis de `perfis`/`organizacoes` estão em grant de coluna
  (`update (nome)`): campo novo editável pelo cliente entra no grant.

## 3. Criar uma feature (copiando `anotacoes`)

1. **Migration nova** em `supabase/migrations/AAAAMMDDHHMMSS_<assunto>.sql`. Nunca edite uma
   migration já aplicada: correção é outra migration. Idempotente, no estilo da fundação:
   `create table if not exists`, `create index if not exists`, `create or replace function`,
   `drop policy if exists` + `create policy`, `drop trigger if exists` + `create trigger`, enum em
   `do $$ … exception when duplicate_object`.
2. **Tabela** com `id uuid default gen_random_uuid()`, `user_id → perfis on delete cascade`,
   `organizacao_id → organizacoes on delete set null`, `created_at`/`updated_at` e o trigger
   `set_updated_at`. Índices em `user_id` e `organizacao_id`.
3. **Privilégios e RLS**: `revoke all on public.<t> from anon, authenticated;`,
   `grant select, insert, update, delete on public.<t> to authenticated;`,
   `grant all on public.<t> to service_role;`, `enable row level security` e as quatro policies
   copiadas de `anotacoes` (troque o nome da tabela). Função nova: `security definer` só quando
   precisar ler o que a RLS esconde, sempre com `set search_path = public`,
   `revoke execute … from anon, public` e `grant execute … to authenticated`.
   **Todo objeto novo entra no `garantir_instalacao()`**: na mesma migration, recrie a função
   (`create or replace`, copiando a versão mais recente) com os grants da tabela, view ou função
   nova na seção 3 dela, e termine com `do $$ begin perform public.garantir_instalacao(); end $$;`.
   O que não estiver listado fica fechado para `anon`/`authenticated` depois de um reparo.
   **Dado inicial** (linha única de configuração, registro de exemplo): seed na migration da
   tabela e também na seção 0 do `garantir_instalacao()` (`if not exists (…) then insert …;
   reparou := true; end if;`). Caso no `remix_reparo_test.sql`: apagar a linha antes do reparo e
   conferir que ela voltou depois.
4. **Teste**: acrescente os casos da tabela em `supabase/tests/rls_test.sql` (membro vê o da
   organização, removido só vê o seu, ninguém cria em nome de outro) e rode até dar `RLS OK`.
   Em `supabase/tests/remix_reparo_test.sql`, confira os privilégios da tabela nova depois do
   reparo, até dar `REPARO OK`.
5. **Tipos**: atualize `src/integrations/supabase/types.ts` à mão (Row/Insert/Update,
   Relationships, Functions, Enums, `Constants`). Ele é a fonte dos tipos do cliente Supabase.
6. **Dados**: `src/features/<feature>/api.ts` no molde de `features/anotacoes/api.ts`: uma raiz
   de `queryKey` por recurso (`["<feature>"]`), `useQuery` para leitura, `useMutation` que
   invalida a raiz, validação com zod e mensagens de erro em português.
7. **Tela**: componentes em `src/features/<feature>/` e a rota em
   `src/routes/_authenticated/<feature>.tsx`. Lista com `Tabela` (ordenação por coluna) e filtro
   curto com `ControleSegmentado`, como em `/anotacoes`. Estados: `SkeletonTabela`/`SkeletonLista`
   ao carregar, `EstadoVazio` para vazio e erro, toast de sucesso/erro, `Dialog` para formulário,
   `AlertDialog` para excluir.
8. **Menu**: uma entrada em `NAV` de `src/lib/navegacao.ts` e o href em `RotaNavEstatica`.
   Menu lateral e trilha saem dali.

## 4. Regras da stack

- **Rotas por arquivo** em `src/routes` (`index.tsx` = `/`, `$id` = parâmetro, `_authenticated/`
  = área logada). `src/routeTree.gen.ts` é gerado pelo plugin do router: não editar à mão.
- **Área logada** (`_authenticated/route.tsx`): `ssr: false`, `beforeLoad` com
  `supabase.auth.getSession()` e redirect para `/`. A barreira real é a RLS.
- **Leitura e escrita comuns vão direto do cliente** (`@/integrations/supabase/client`) com RLS.
  Server function só para o que precisa de segredo ou service role.
- **Server function**: arquivo `serverFns.ts` da feature,
  `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(zod).handler(…)`.
  `context.supabase` consulta em nome do usuário (com RLS) e `context.userId` identifica quem
  chamou. Service role só com `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")`
  dentro do handler, e só depois de conferir a permissão pelo `context.supabase`.
- **Sem API do Node no servidor** (`fs`, `path`, `child_process`, `Buffer` de Node, `node:*`): o
  build é para Workers. Módulo só de servidor termina em `.server.ts`.
- **Arquivos**: extração de texto e geração de PDF/planilha acontecem no navegador.
- **React Query**: `queryKey` com a raiz do recurso; toda mutação invalida a raiz; o contexto do
  usuário vem só de `usePerfil()` (`["perfil"]`).
- **TypeScript estrito** (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`): nada de
  `any`, nada de `// @ts-ignore`.
- Código, comentários, UI e docs em português do Brasil. Comentário só quando explica o porquê
  de uma regra.
- **A RLS falha em silêncio**: update ou delete em linha que a policy esconde afeta zero linhas
  e não devolve erro. Ação sobre dado de outra conta (remover membro, excluir registro com filhos
  sem chave estrangeira) é uma função `security definer` que confere o papel, faz tudo numa
  transação e levanta exceção com a mensagem para a tela; o toast de sucesso só depois de
  `error` nulo, como em `features/equipe/api.ts`.
- **Tela ao vivo** (canal do Supabase Realtime): use o status do `subscribe`. Enquanto não for
  `SUBSCRIBED`, busque de novo a cada 5 s; ao voltar a `SUBSCRIBED` e ao reabrir a aba
  (`visibilitychange`), busque uma vez para recuperar o que chegou com o canal fora.
- **Webhook recebido de outro sistema**: o segredo vale no cabeçalho **ou** em `?secret=` na URL
  (há servidores que não repassam cabeçalho), recusa sem segredo e grava uma linha de log por
  evento. Se o app configura o webhook no outro lado, a tela de diagnóstico lê a configuração
  real, compara com a esperada (URL, eventos, segredo) e regrava quando divergir; status
  "conectado" guardado no banco não prova nada. Gire o segredo só depois de o outro lado aceitar
  o novo.
- **Telefone**: número digitado pela pessoa passa pela normalização (DDI 55 quando faltar);
  número que chega de uma integração com o DDI (JID do WhatsApp, por exemplo) fica como veio.
- **CSV para Excel**: separador `;`, BOM UTF-8 no início e aspas escapadas.

## 5. Regras do design system

Versão do DS aplicada em `DS_VERSION`.

- **Tokens, nunca cor fixa**: `bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`… Nada de
  `bg-white`, `text-gray-500`, hex ou `dark:` com cor fixa: os tokens já trocam no tema escuro.
- **Escala tipográfica**: `text-display-{2xl,xl,lg}` (só hero, nunca em tela de sistema),
  `text-heading-{xl,lg,md,sm}`, `text-body-{xl,lg,md,sm}`, `text-label-{lg,md}`, `text-caption`,
  `text-eyebrow`, `text-code`. Token novo de tamanho entra também na lista do `cn` em
  `src/lib/utils.ts`, senão o `cn` o descarta ao lado de uma cor.
- **Escopo antes de `className`**: `.ds-app` (na raiz do `AppLayout` e no `body` enquanto ele está
  montado, para alcançar Dialog, Sheet e Popover) reaponta raio, tipografia (um degrau menor),
  campo (`--ds-input-*`: 36 px, canto `md`) e rótulo (`--ds-label-*`: minúscula, sem tracking).
  Fora dele (login) o campo é pílula de 44 px e o rótulo é versalete. Corrigir raio ou tamanho
  card a card é sinal de escopo faltando.
- **Campos**: `Input`, `Textarea`, `SelectTrigger` e `CampoData` já leem `--ds-input-*`; não
  fixe `h-*`, `rounded-*` nem `px-*` neles. Ícone à esquerda pela prop `icone` do `Input`, nunca
  com `pl-*` e ícone absoluto na mão. `Label` e `Campo` seguem `--ds-label-*`.
- **Ícones**: a biblioteca de ícones deste template é lucide; Phosphor não entra. A regra de
  `weight` do DS não se aplica: o equivalente ao `regular` é `strokeWidth` 1.5 (padrão) a 2
  (ativo/ênfase), em 16 a 20 px.
- **Botões** (sempre pílula; `size="default"` e `size="field"` têm a altura do campo do escopo):
  `default` (pílula `inverse`) é a ação principal da tela ou do formulário; `secondary`
  (`outline` é o mesmo visual) é a ação alternativa ao lado dela, como Cancelar ou Tentar de
  novo; `ghost` é ação de linha, de ícone ou de barra de ferramentas; `shiny` (ou `shiny-brand`)
  é o CTA de destaque, no máximo um por tela; `destructive` confirma exclusão; `link` é navegação
  dentro de texto. `bg-brand-gradient` não é fundo de botão: fica para selos e checks.
- **Tracking**: `tracking-label` (0.04em) em rótulo de formulário, cabeçalho de tabela e etiqueta
  de UI. `tracking-eyebrow` (0.14em) é decoração de marketing: fora de tela de sistema.
- **Nomes de feedback**: no template `text-success`, `text-warning`, `text-danger` e `text-info`
  já são a cor de texto (o `-deep` do DS); `bg-*-soft` é o fundo. Os `text-*-deep` existem só como
  apelido do mesmo valor: prefira o nome curto.
- **Feedback soft/deep**: fundo suave + texto forte (`bg-success-soft text-success`,
  `bg-warning-soft text-warning`, `bg-destructive-soft text-danger`,
  `bg-info-soft text-info`) ou as variantes de `Badge` (`success`, `warning`, `danger`, `info`).
- **Badge de estado ≠ identidade**: os tons de estado significam bom/ruim (status de linha).
  Categoria, plano ou tipo usa `secondary`/`outline` ou a cor de gráfico da entidade.
- **Escolha única**: 2 a 4 opções curtas, todas à vista → `ControleSegmentado`. 5 ou mais,
  rótulo longo ou lista que cresce → `Select`. `Tabs` só troca de painel, não filtra.
- **Período**: preset (7/14/30 dias, em `ControleSegmentado`) e intervalo (`IntervaloDatas`) são
  um estado só. O intervalo é a fonte da verdade; o preset escreve nele e só aparece marcado
  quando coincide. Data solta: `CampoData` (nativo, valor em ISO).
- **Filtro muda a tela inteira**: gráfico, indicadores e tabela se refazem contra a mesma fatia.
  Controle que muda de estado e não muda a tela não entra.
- **Número com variação**: `CartaoMetrica` quando há delta e base de comparação; número de apoio
  sem variação não vira `CartaoMetrica`. Use `delta` (número com sinal) e
  `melhorQuandoSobe={false}` quando cair é a boa notícia (reembolso, custo, churn). A seta vem do
  sinal, a cor de sinal × sentido; nunca um booleano só para as duas.
- **Delta com base nomeada**: sempre com `comparacao` ("vs. mês anterior") e contra uma janela
  anterior completa. Sem base ou com janela incompleta, sem delta (e sem a legenda "vs. …").
- **Tabela ordena pelo dado**: lista de dados usa `Tabela` (`colunas` + `linhas`); quando a
  célula é montada de outro campo (moeda, "dd/mm", "Hoje"/"Ontem"), a coluna leva
  `valorOrdenacao` com o valor bruto. `numerica` alinha à direita com `tabular-nums`; total no
  `rodape` (`<tfoot>`), parado quando a ordem muda; zero e vazio viram "–" em `text-faint`
  sozinhos; coluna que duplica outra sai. `ui/table` cru só para tabela sem dados (layout).
- **Trilha derivada da navegação**: a do `AppHeader` sai de `montarTrilha` (`NAV`); nunca
  escreva trilha à mão numa tela. Item intermediário sem tela própria sai como texto.
- **Gráfico**: só existem `--chart-1..3`, `--meta` e `--google`. A cor segue a entidade, nunca o
  ranking (`--chart-1..3` em ordem fixa; filtrar não repinta as séries que sobram). Uma quarta série vira "Outros" ou facetas. Com 2+ séries a legenda
  está sempre presente. Nunca eixo duplo: medidas de grandeza diferente viram dois gráficos ou
  índice sobre base comum. Texto do gráfico em token de texto, não na cor da série; eixo com passo
  redondo; barra com teto de 24 px e canto só na ponta do dado; tooltip ao lado da marca; rótulo
  direto só no ponto que o título cita; no hover realce a série, não esmaeça as outras.
- **Superfície por contorno**: `Card` com borda de 1 px, `rounded-xl` (vira 16 px no `.ds-app`),
  fundo `surface` nos dois temas, sem sombra projetada, sem preenchimento extra e sem brilho de
  borda no hover. `Badge` também sem sombra. Gradiente da marca (`text-brand-gradient`,
  `bg-brand-gradient`, `fill-brand-gradient`) da esquerda para a direita e, em título, só no
  trecho destacado.
- **Componentes**: `src/components/ui/*` (shadcn adaptado; 42 componentes) antes de criar
  qualquer coisa. Página começa com `PageHeader`; vazio e erro com `EstadoVazio`; carregamento
  com `Skeletons`/`SkeletonMetricas`; campo rotulado com `Campo`; número com `CartaoMetrica`;
  lista de dados com `Tabela`; escolha única curta com `ControleSegmentado`; período com
  `IntervaloDatas` (data solta com `CampoData`).
- **Layout de página**: `<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">` (largura
  `max-w-xl` a `max-w-6xl` conforme a tela). O padding é de cada página, não do layout.
- **Login sempre claro**: `/` e `/redefinir-senha` não acompanham o tema (`ROTAS_SEMPRE_CLARAS`
  no `__root.tsx`, lida pelo script anti-FOUC e pelo `forcarClaro` do `ThemeProvider`). Tela
  pública nova entra nessa lista e usa `LayoutEntrada` (painel de marca + conteúdo).
- Teste cada tela nova em claro, escuro e 375 px de largura.

## 6. Antes de cada commit

```bash
npm run build    # tsc --noEmit + vite build
npm run lint     # 0 erros
npm run format   # Prettier
```

Mexeu em migration ou policy: rode `supabase/tests/rls_test.sql` (`RLS OK`) e
`supabase/tests/remix_reparo_test.sql` (`REPARO OK`).
Commits pequenos, mensagem em português dizendo o que muda.

## 7. Pronto para entregar

- [ ] `brand.ts` com nome e tagline da solução; meta tags coerentes.
- [ ] Todas as migrations aplicadas no projeto de produção, `rls_test.sql` com `RLS OK` e
      `remix_reparo_test.sql` com `REPARO OK`.
- [ ] Toda tabela, view e função da solução com os privilégios em `garantir_instalacao()`.
- [ ] `types.ts` igual ao schema; `npm run build` e `npm run lint` sem erro.
- [ ] Cada tela testada em claro, escuro e 375 px; estados de carregamento, vazio e erro.
- [ ] Primeira conta criada vira dona; cadastro fecha e reabre em Equipe.
- [ ] Antes do primeiro cadastro no publicado e em cada remix de teste, conferir
      `GET <SUPABASE_URL>/auth/v1/settings` com a publishable key: `external.email` precisa ser
      `true`. Projeto criado sem autenticação pelo assistente da plataforma nasce com o e-mail
      desligado.
- [ ] Ligar ou desligar provedor de login no painel do Cloud dispara o assistente da plataforma,
      que pode alterar código (ex.: botão de login social). Depois de mexer ali, revisar o diff e
      reverter o que não foi pedido.
- [ ] O repositório conectado não aceita reescrever histórico: integrar por merge
      (`--allow-unrelated-histories` na primeira vez), nunca force push.
- [ ] Teste de remix de verdade: remixar, chamar a tela de entrada, conferir as linhas iniciais,
      o cadastro e o painel.
- [ ] Checklist de `docs/ENTREGA.md` cumprido.
