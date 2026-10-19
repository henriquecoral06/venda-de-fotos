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

- `/dashboard`: vendido, a receber, galerias publicadas, fotos enviadas e os pedidos que aguardam
  pagamento.
- `/galerias`: lista com capa, situação (rascunho, publicada, arquivada), fotos, pedidos e preço.
  Cada galeria é de **cliente** (link e senha) ou **evento aberto** (torneio, corrida, festa), com
  categoria, local e busca por selfie.
- `/galerias/$id`: envio em lote (arrastar e soltar), grade de fotos, escolha da capa, exclusão,
  link para copiar e edição da galeria (título, link, cliente, data, senha, preço por foto, pacote
  com todas as fotos, mensagem). Em evento aberto, os rostos são encontrados no envio e há o botão
  "Procurar rostos nas fotos" para as que subiram antes.
- `/pedidos`: pedidos dos clientes com filtro por situação, detalhe com as fotos escolhidas,
  confirmar pagamento e cancelar.
- `/loja`: logo (PNG, JPG, WebP ou SVG; o SVG vira PNG no navegador) e cores da marca (sugeridas a
  partir da logo), nome exibido ao cliente, texto da
  marca d'água, chave Pix, WhatsApp para comprovantes e instruções de pagamento (só o dono edita).
  A logo e as cores aparecem na galeria e no pedido do cliente.
- `/equipe` e `/perfil`, do template.

**Telas do cliente** (sem conta, sempre claras)

- `/eventos`: vitrine do estúdio com os eventos abertos publicados, busca por nome ou local e
  filtro por categoria.
- `/g/<link>`: galeria com capa, senha opcional, grade, visualização ampliada com setas do
  teclado, seleção de fotos guardada no navegador, compra avulsa ou do pacote completo. Em evento
  aberto: busca por selfie (com consentimento) e pedido de remoção da foto pelo WhatsApp.
- `/pedido/<código>`: situação do pedido, Pix para copiar, botão de WhatsApp com o comprovante e,
  depois do pagamento, os downloads dos originais (um a um ou todos).

## Como as fotos ficam protegidas

- Cada foto tem três arquivos no Supabase Storage: miniatura (640 px) e prévia (1600 px) com marca
  d'água no bucket público `previas`, e o original no bucket privado `originais`.
- O visitante não lê nenhuma tabela. Tudo passa pelas funções `galeria_publica` (só galeria
  publicada, com a senha certa), `criar_pedido` (o preço sai da galeria, nunca do navegador),
  `pedido_publico` (o caminho do original só aparece com o pedido pago) e
  `foto_original_liberada`, que a policy do Storage usa para assinar o download só de foto que faz
  parte de pedido pago.
- Galeria com preço zero entrega de graça: o pedido já nasce pago.

## Busca por selfie

- Reconhecimento facial no navegador com [face-api](https://github.com/vladmandic/face-api)
  (MIT). A biblioteca e os modelos ficam em `public/rostos` e só são baixados por quem usa a busca
  ou envia fotos de evento; não entram no bundle nem no Worker.
- No envio, o painel calcula um vetor de 128 números por rosto (detector SSD, bom para multidão) e
  grava em `rostos` (pgvector). A selfie do visitante é lida no aparelho dele (detector leve, com o
  preciso como reserva); só o vetor vai para `buscar_fotos_por_rosto`, que não grava nada.
- Distância menor que 0,5 conta como encontrada; entre 0,4 e 0,5 a foto aparece marcada como
  "Talvez seja você".
- LGPD: consentimento antes da selfie e pedido de remoção pelo WhatsApp da loja na foto ampliada.

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

## Estrutura da solução

```
src/features/galerias/   galerias e fotos: api, formulário, envio, grade, marca d'água (imagens.ts)
src/features/pedidos/    pedidos do painel: api, tabela, detalhe
src/features/loja/       configurações da loja (linha única)
src/features/vitrine/    lado do cliente: galeria pública, checkout, visualizador
src/lib/fotos.ts         buckets, URL pública, link da galeria e do pedido
src/routes/g.$slug.tsx           galeria do cliente
src/routes/pedido.$codigo.tsx    pedido do cliente
src/routes/eventos.tsx           vitrine de eventos abertos
src/lib/rostos.ts                reconhecimento facial no navegador (carrega public/rostos)
supabase/migrations/20261014150000_venda_de_fotos.sql   tabelas, funções, Storage e reparo
supabase/migrations/20261019120000_eventos_abertos.sql  eventos, rostos e busca por selfie
```

## Próximos passos

- Pagamento automático (Mercado Pago ou Asaas com webhook), no lugar da confirmação manual do Pix.
- E-mail para o cliente quando o pedido é criado e quando é pago.
- Limite de tentativas de senha e de pedidos por visitante.
- Download em ZIP e favoritos/seleção para álbum.
- Busca por número de camisa/peito nos eventos (marcação ou OCR no navegador).
- Limite de buscas por selfie por visitante.
- Domínio próprio e página de portfólio do fotógrafo.
