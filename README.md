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
- `/galerias/$id`: envio em lote (arrastar e soltar), grade de fotos, escolha da capa, exclusão,
  link para copiar e edição da galeria (título, link, cliente, data, senha, preço por foto, pacote
  com todas as fotos, mensagem).
- `/pedidos`: pedidos dos clientes com filtro por situação, detalhe com as fotos escolhidas,
  confirmar pagamento e cancelar.
- `/loja`: nome exibido ao cliente, texto da marca d'água, chave Pix, WhatsApp para comprovantes e
  instruções de pagamento (só o dono edita).
- `/equipe` e `/perfil`, do template.

**Telas do cliente** (sem conta, sempre claras)

- `/g/<link>`: galeria com capa, senha opcional, grade, visualização ampliada com setas do
  teclado, seleção de fotos guardada no navegador, compra avulsa ou do pacote completo.
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
supabase/migrations/20261014150000_venda_de_fotos.sql   tabelas, funções, Storage e reparo
```

## Próximos passos

- Pagamento automático (Mercado Pago ou Asaas com webhook), no lugar da confirmação manual do Pix.
- E-mail para o cliente quando o pedido é criado e quando é pago.
- Limite de tentativas de senha e de pedidos por visitante.
- Download em ZIP e favoritos/seleção para álbum.
- Domínio próprio e página de portfólio do fotógrafo.
