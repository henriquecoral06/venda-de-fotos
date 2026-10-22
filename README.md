# FotoVenda

Plataforma para fotógrafos entregarem e venderem fotos online, no estilo Alboom. O fotógrafo cria
galerias, envia as fotos (a prévia com marca d'água é gerada no navegador) e manda o link para o
cliente. O cliente escolhe as fotos, faz o pedido e baixa os originais em alta resolução quando o
pagamento é confirmado.

Feito a partir do [ceia-template](https://github.com/oconversaoextrema/ceia-template) (versão em
`STARTER_VERSION`). O manual de engenharia está em
[`.claude/skills/ceia-desenvolver/SKILL.md`](./.claude/skills/ceia-desenvolver/SKILL.md) e vale para
toda mudança neste repositório.

## O que já funciona

**Painel do fotógrafo** (área logada)

- `/dashboard`: "Para fazer agora" (pagamentos para confirmar, galerias prontas para publicar ou
  sem fotos, loja sem Pix), os números da venda, as galerias e os pedidos recentes.
- `/galerias`: lista com capa, situação (rascunho, publicada, arquivada), fotos, pedidos e preço.
  Cada galeria é de **cliente** (link e senha) ou **evento aberto** (torneio, corrida, festa), com
  categoria e local.
- `/galerias/$id`: envio em lote (arrastar e soltar; reenviar a mesma pasta continua de onde
  parou, com nova tentativa e lista das falhas), grade de fotos, escolha da capa, exclusão, link
  secreto para copiar ou trocar, e edição da galeria (título, cliente, data, senha, preço por foto,
  pacote com todas as fotos, mensagem, download liberado sem pedido).
- `/pedidos`: pedidos dos clientes com filtro por situação, detalhe com as fotos escolhidas,
  confirmar pagamento e cancelar.
- `/loja`: logo (PNG, JPG, WebP ou SVG; o SVG vira PNG no navegador) e cores da marca (sugeridas a
  partir da logo), nome exibido ao cliente, marca d'água (liga e desliga, com o texto), chave Pix, WhatsApp para comprovantes e instruções de pagamento (só o dono edita).
  Pagamento online (Asaas ou Mercado Pago) e e-mail automático das fotos pelo Resend: ver
  "Pagamento online e e-mail".
  A logo e as cores aparecem na galeria e no pedido do cliente.
- `/landing-pages`: páginas para anúncios em quatro modelos (Editorial, Portfólio, Estúdio e
  Clássico), com textos, fotos e cores editáveis e prévia ao vivo. Cada uma instala Meta Pixel,
  GA4, Google Ads, Google Tag Manager, TikTok Pixel, código próprio e a API de Conversões da Meta,
  e todas mostram os eventos da vitrine. O botão de contato abre o WhatsApp (ou um link) ou um
  formulário em popup com os campos que o fotógrafo escolhe; as respostas ficam na aba Contatos.
- `/equipe` e `/perfil`, do template.

**Telas do cliente** (sem conta, sempre claras)

- `/eventos`: vitrine do estúdio com os eventos abertos publicados, busca por nome ou local e
  filtro por categoria.
- `/g/<link>`: galeria com folha de rosto (capa e título), senha opcional, grade justificada que
  carrega aos poucos, visualização ampliada com setas, teclado e deslizar no celular, seleção de
  fotos guardada no navegador, compra avulsa ou do pacote completo. Com o download liberado pelo
  fotógrafo: baixar uma foto ou todas em ZIP. Em evento
  aberto: pedido de remoção da foto pelo WhatsApp (LGPD).
- `/l/<link>`: landing page publicada, com os pixels e as tags do fotógrafo.
- `/pedido/<código>`: situação do pedido, Pix para copiar (ou Pix com QR Code e cartão pelo gateway,
  quando o pagamento online está ligado), botão de WhatsApp com o comprovante e,
  depois do pagamento, os downloads dos originais (um a um ou todos em ZIP, montado no navegador e
  dividido em partes quando passa do que o aparelho aguenta).

## Como as fotos ficam protegidas

- Cada foto tem três arquivos no Supabase Storage: miniatura (640 px) e prévia (1600 px), em WebP
  (JPEG no navegador que não gera WebP) e com marca d'água opcional, no bucket público `previas`,
  e o original no bucket privado `originais`.
- **Link secreto**: galeria de cliente e evento com senha abrem só por `/g/<chave>`, 16
  caracteres aleatórios. O nome legível (`/g/casamento-ana`) só abre evento sem senha, o da
  vitrine. O fotógrafo troca a chave em "Gerar novo link" quando o link vaza.
- **Limites**: 10 senhas erradas por visitante e galeria em 15 minutos (e 100 por galeria em uma
  hora) bloqueiam a galeria por alguns minutos; 10 pedidos por visitante e por e-mail em uma hora.
  O visitante é o IP que o gateway do Supabase repassa (`limites_acesso`, sem acesso do cliente).
- **Cadastro fechado por padrão**: a primeira conta da instalação vira dona; as seguintes só
  entram quando o dono abre o cadastro em Equipe (e fecha depois).
- O visitante não lê nenhuma tabela. Tudo passa pelas funções `galeria_publica` (só galeria
  publicada, com a senha certa), `criar_pedido` (o preço sai da galeria, nunca do navegador),
  `pedido_publico` (o caminho do original só aparece com o pedido pago) e
  `foto_original_liberada`, que a policy do Storage usa para assinar o download só de foto que faz
  parte de pedido pago ou de galeria com download liberado. A policy vale só para assinar o link:
  listar a pasta de originais não mostra nada a quem não é da equipe.
- Galeria com preço zero entrega de graça: o pedido já nasce pago.

## Como rodar

1. Crie um projeto gratuito no Supabase e copie URL, _publishable key_ e _secret key_.
2. `cp .env.example .env` e preencha (a service role vai em `.env.local`).
3. Aplique as migrations de `supabase/migrations/` em ordem (`npx supabase db push` ou SQL Editor)
   e rode `supabase/tests/rls_test.sql` (`RLS OK`) e `supabase/tests/remix_reparo_test.sql`
   (`REPARO OK`). A migration cria os buckets `previas` e `originais` e as policies deles.
4. Em _Authentication → URL Configuration_: `http://localhost:8080` e `http://localhost:8080/**`.
5. `npm install` e `npm run dev` → `http://localhost:8080`. A primeira conta vira dona.

Para desenvolver com o Supabase local: `npx supabase init`, `npx supabase start` e use a URL e as
chaves que o `npx supabase status` mostrar.

## Produção

- **Supabase:** projeto `venda-de-fotos` (região São Paulo), em
  `https://nyvkoigzwvrdhuimiifr.supabase.co`, com as quatro migrations aplicadas e os testes
  `RLS OK` e `REPARO OK` rodados nele.
- **Cloudflare Workers:** o build gera um Worker (`cloudflare-module`). O nome (`venda-de-fotos`)
  e as variáveis públicas ficam em `wrangler.jsonc`; a URL e a publishable key do build ficam em
  `.env.production` (só valores públicos, versionado).

Para ligar o repositório a um Worker (Workers & Pages → Create → Import a repository):

1. Nome do Worker: `venda-de-fotos` (precisa ser igual ao de `wrangler.jsonc`).
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`. Sem o build command
   o deploy falha com "Missing entry-point": o app compilado (`.output`) só existe depois do build.
3. Depois do primeiro deploy, no Supabase em _Authentication → URL Configuration_: a URL do Worker
   (`https://venda-de-fotos.<sua-conta>.workers.dev` ou o domínio próprio) em _Site URL_ e
   `https://<mesmo endereço>/**` em _Redirect URLs_.
4. Abra o site e crie a primeira conta na aba Cadastrar: ela vira dona. A confirmação de e-mail
   está ligada, então confirme pelo link recebido antes de entrar.

## Scripts

| Comando             | O que faz                                 |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | servidor de desenvolvimento na porta 8080 |
| `npm run build`     | `tsc --noEmit` e build de produção        |
| `npm run typecheck` | só a checagem de tipos                    |
| `npm run lint`      | ESLint (o esperado é 0 erros)             |
| `npm run format`    | Prettier em todo o repositório            |

## Landing pages e rastreamento

- Os modelos são originais, inspirados no estilo de sites de fotógrafos; as cores ficam em
  variáveis `--lp-*` da própria página, fora do design system do painel.
- Pixels e tags são instalados no navegador do visitante com o código oficial de cada plataforma,
  depois de validar o formato do ID. O botão de contato dispara `Contact`, o envio do formulário
  dispara `Lead` e o clique num evento dispara `ViewContent`, além do `PageView`.
- Formulário: `enviar_contato_landing` grava em `landing_contatos` (só a equipe lê), com 5 envios
  por visitante a cada hora.
- No celular, os quatro modelos têm menu no cabeçalho e um botão de contato preso embaixo, que só
  aparece enquanto nenhum outro botão de contato está na tela.
- Logo: a loja tem uma logo para fundo claro e outra para fundo escuro; cada modelo usa a que
  contrasta com o fundo do cabeçalho.
- API de Conversões da Meta: o token fica em `landing_segredos`, que nenhum cliente lê. O navegador
  chama uma server function que junta IP e user agent e chama `enviar_evento_meta`, que envia para a
  Meta pelo `pg_net`. Pixel e API usam o mesmo `event_id`, então a Meta não conta em dobro. Use o
  "código de teste" do Gerenciador de Eventos para conferir antes de rodar anúncios.

## Pagamento online e e-mail

- Em Loja e pagamento o dono escolhe: Pix manual, Asaas ou Mercado Pago. As chaves (do gateway e do
  Resend) ficam em `loja_segredos`, que nenhum cliente lê; as funções do banco nunca as devolvem.
- O banco fala com o gateway pela extensão `http` (o comprador precisa do QR Code na hora). Asaas
  pede o CPF de quem paga; o cartão abre a página do gateway e nunca passa por aqui.
- O pedido só vira pago quando o banco consulta o pagamento com a chave do fotógrafo e confere
  status, referência (código do pedido) e valor. O aviso do gateway chega em
  `/api/pagamentos/<gateway>` (segredo no cabeçalho `asaas-access-token` ou em `?secret=`) e só
  dispara essa consulta; a página do pedido também consulta a cada 20 s enquanto está aberta.
- Asaas: ao salvar a chave, o webhook é criado ou regravado na conta; a tela lê o webhook real e
  oferece regravar quando ele some ou pausa. Mercado Pago: o endereço de aviso vai em cada cobrança
  e precisa ser https.
- Pedido pago (pelo gateway, à mão ou grátis) manda o link das fotos ao comprador pelo Resend
  (`pg_net`), uma vez; o detalhe do pedido permite reenviar. O remetente precisa ser de um domínio
  verificado no Resend.
- Avisos recebidos ficam em `pagamentos_eventos` (90 dias). Estorno e chargeback não voltam o
  pedido sozinhos: cancele em Pedidos.

## Estrutura da solução

```
src/features/galerias/   galerias e fotos: api, formulário, envio, grade, marca d'água (imagens.ts)
src/features/pedidos/    pedidos do painel: api, tabela, detalhe
src/features/loja/       configurações da loja (linha única)
src/features/vitrine/    lado do cliente: galeria pública, checkout, visualizador
docs/DESIGN.md           sistema de design: paleta, tipografia, componentes e as regras de cada tela
src/features/landing/    landing pages: modelos, editor, rastreamento e API de Conversões
src/lib/fotos.ts         buckets, URL pública, link da galeria e do pedido
src/routes/g.$slug.tsx           galeria do cliente
src/routes/pedido.$codigo.tsx    pedido do cliente
src/routes/eventos.tsx           vitrine de eventos abertos
src/routes/l.$slug.tsx           landing page pública
supabase/migrations/20261014150000_venda_de_fotos.sql   tabelas, funções, Storage e reparo
supabase/migrations/20261019120000_eventos_abertos.sql  eventos abertos e vitrine
supabase/migrations/20261021120000_landing_pages.sql    landing pages, segredos e API de Conversões
supabase/migrations/20261022120000_revisao_seguranca.sql link secreto, limites, cadastro fechado, download liberado
supabase/migrations/20261023120000_remover_busca_selfie.sql tira a busca por selfie e apaga os rostos
supabase/migrations/20261024120000_landing_formulario_logo.sql formulário da landing e logo para fundo escuro
supabase/migrations/20261025120000_pagamento_online.sql   Asaas, Mercado Pago, webhook e e-mail das fotos
src/routes/api.pagamentos.$gateway.ts                    webhook dos gateways
```

## Próximos passos

- E-mail para o cliente quando o pedido é criado (o de pedido pago já existe).
- Estorno e chargeback do gateway cancelando o pedido sozinhos.
- Favoritos e seleção para álbum (o cliente marca e envia, sem pagar).
- Busca por número de camisa/peito nos eventos (marcação ou OCR no navegador).
- Domínio próprio e página de portfólio do fotógrafo.
