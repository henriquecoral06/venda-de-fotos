# Diagnóstico do FotoVenda — etapa 1

Data: 21/10/2026. Nenhum código foi alterado nesta etapa.

Como foi feito: leitura do código e das 7 migrations; sistema rodando localmente (Supabase local +
`npm run dev`); fluxos percorridos com Playwright como fotógrafo e como cliente, em 1440 px e
390 px; testes de acesso direto pela API com duas contas de fotógrafo e sem login; consultas só
de leitura no banco de produção. As 71 capturas estão em [`capturas/`](capturas/) (prefixo
`desktop-` ou `mobile-`; `0x` = criação, `p` = painel, `c` = cliente).

---

## 1. Mapa do sistema

**Stack.** TanStack Start (React 19, rotas por arquivo, SSR) em Cloudflare Workers; TypeScript
estrito; Tailwind v4 + shadcn/ui; React Query; Supabase (Postgres com RLS, Auth, Storage,
pgvector para rostos, pg_net para a API de Conversões da Meta). Ícones: só `lucide-react`. Fonte:
Geist (painel); as landing pages usam também Cormorant Garamond e Instrument Serif.

**Pastas.**

```
src/routes/            telas (arquivo = rota); _authenticated/ = painel logado
src/features/<area>/   api.ts (React Query + Supabase) e componentes de cada área
                       galerias, pedidos, loja, vitrine (lado do cliente), landing, equipe, perfil
src/components/        layout, componentes do design system (PageHeader, Tabela, Skeletons…), ui/ (shadcn)
src/lib/               utilitários (fotos, marca, rostos, formatação, navegação)
src/integrations/supabase/  clientes, tipos (mantidos à mão), middleware de auth
supabase/migrations/   7 migrations (fundação, reparo, venda de fotos, marca, eventos, landing)
supabase/tests/        rls_test.sql, remix_reparo_test.sql
public/rostos/         face-api e modelos (reconhecimento facial no navegador)
```

**Banco (public).** `perfis`, `organizacoes`, `organizacao_membros` (do template);
`configuracoes_loja` (**linha única**, id = 1: nome, Pix, WhatsApp, marca d'água, logo, cores);
`galerias` (cliente ou evento, slug, senha em texto, preços, status); `fotos` (3 caminhos:
original, prévia, miniatura); `pedidos` + `pedido_itens`; `rostos` (vetores de 128 números);
`landing_pages` + `landing_segredos`. Storage: `previas` (público, prévias com marca d'água),
`originais` (privado), `marca` (público, logos e imagens das landings).

**Autenticação.** Supabase Auth com e-mail e senha, magic link e redefinição de senha. O cliente
final não tem conta: entra pela galeria (link + senha opcional) e acompanha o pedido por um
código de 32 caracteres. Tudo que o visitante vê passa por funções `security definer`
(`galeria_publica`, `criar_pedido`, `pedido_publico`, `eventos_publicos`,
`buscar_fotos_por_rosto`, `landing_publica`, `enviar_evento_meta`).

**Modelo de negócio embutido no código (importante).** O template é de **uma organização por
instalação**: a primeira conta vira dona e as seguintes entram como membros da **mesma**
organização (equipe), enquanto o cadastro estiver aberto. Com o cadastro fechado, ninguém novo
consegue criar conta. Loja, Pix, marca, vitrine `/eventos` e landing pages são de um estúdio só.
Ou seja: hoje é um sistema de **um estúdio com equipe**, não uma plataforma com vários fotógrafos
independentes pagando assinatura.

**Telas.**

| Quem      | Rota                                   | O que faz                                                                       |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Público   | `/`                                    | redireciona para entrada ou painel                                              |
| Público   | `/auth`, `/redefinir-senha`            | entrar, cadastrar, magic link, nova senha                                       |
| Fotógrafo | `/dashboard`                           | vendido, a receber, galerias publicadas, fotos, pedidos aguardando              |
| Fotógrafo | `/galerias`, `/galerias/$id`           | lista com filtros e seleção em massa; detalhe com envio, capa, exclusão, edição |
| Fotógrafo | `/pedidos`                             | lista, filtro, detalhe, confirmar pagamento, cancelar                           |
| Fotógrafo | `/landing-pages`, `/landing-pages/$id` | 4 modelos, editor, pixels, API de Conversões                                    |
| Fotógrafo | `/loja`                                | logo, cores, nome, marca d'água, Pix, WhatsApp, instruções                      |
| Fotógrafo | `/equipe`, `/perfil`                   | membros e cadastro aberto/fechado; nome e senha                                 |
| Cliente   | `/eventos`                             | vitrine de eventos abertos com busca e categoria                                |
| Cliente   | `/g/$slug`                             | galeria: senha, grade, visualizador, seleção, compra, selfie (eventos)          |
| Cliente   | `/pedido/$codigo`                      | situação, Pix, WhatsApp do comprovante, downloads após pagamento                |
| Cliente   | `/l/$slug`                             | landing page de anúncio                                                         |

**O que não existe:** cadastro de clientes, ensaios/agenda, orçamentos, contratos, pagamento
online, seleção de fotos para álbum (sem compra), favoritos, aprovação, download em ZIP, e-mails
automáticos.

---

## 2. Relatório priorizado

### (A) Crítico — segurança e perda de dados

| #   | Problema                                                                                                                                                                                                                                                                      | Evidência                                                                                                                                                  | Onde                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A1  | **Produção está com o cadastro aberto.** Qualquer pessoa que criar conta no site entra como membro do estúdio e vê todas as galerias (com senhas), pedidos (nome, e-mail e telefone dos clientes), landing pages; altera e exclui galerias; **baixa os originais** sem pagar. | Produção: `cadastro_aberto = true`. Local: a conta 2 leu 5 galerias e 6 pedidos, alterou uma galeria da conta 1 e assinou a URL de um original (HTTP 200). | `/equipe` → "Cadastro de contas novas"; `handle_new_user`          |
| A2  | **Não há isolamento entre fotógrafos.** Pelo desenho atual, todo membro vê tudo da organização. Se a ideia é vender para vários fotógrafos, isso é estrutural: loja, Pix, marca, vitrine e landing são globais (linha única).                                                 | `configuracoes_loja` com `check (id = 1)`; `eventos_publicos` lista galerias de todas as contas.                                                           | migrations 0928, 1014, 1019                                        |
| A3  | **Galerias privadas abertas por adivinhação.** O link é o nome da galeria (`/g/casamento-ana-e-joao`). Sem senha, qualquer um que adivinhe o nome entra e compra. Com senha, quem adivinha ainda vê título, foto de capa, local, data e quantidade de fotos.                  | `galeria_publica` sem senha devolveu `titulo`, `capa`, `data_evento`, `local`, `total_fotos`.                                                              | `galeria_publica`, `FormularioGaleria` (slug sugerido pelo título) |
| A4  | **Senha da galeria sem limite de tentativas.** 60 senhas erradas em 0,3 s, nenhum bloqueio. Senha guardada em texto puro.                                                                                                                                                     | teste `4-seguranca.js`                                                                                                                                     | `galeria_publica`                                                  |
| A5  | **Pedidos falsos sem limite.** Um visitante criou 20 pedidos seguidos, que poluem o painel e o "A receber". (Apaguei os 20 de teste.)                                                                                                                                         | teste `4-seguranca.js`                                                                                                                                     | `criar_pedido`                                                     |
| A6  | Exclusão de galeria apaga as fotos no banco; os arquivos no Storage precisam ser apagados pelo navegador. Se a aba fechar no meio, ficam arquivos órfãos (custo, não vazamento: os caminhos são UUID).                                                                        | leitura do código                                                                                                                                          | `useExcluirGalerias`                                               |

Pontos que **passaram**: visitante sem login não lê nenhuma tabela (401 em todas as 10); não
lista arquivos de nenhum bucket; não baixa original sem pedido pago (400); a galeria do cliente
não carrega nenhum original (0 requisições a `originais`); token da API de Conversões não sai do
banco; nenhuma chave secreta no repositório nem no histórico do git (só a publishable key, que é
pública por natureza); `criar_pedido` recusa galeria não publicada, sem nome, e-mail inválido e
fotos de outra galeria; o preço sai do banco, nunca do navegador; Storage recusa `text/html` e
arquivos acima do limite (10 MB nas prévias, 50 MB nos originais).

### (B) Funcional — bugs e fluxos incompletos

| #   | Problema                                                                                                                                                                         | Onde                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| B1  | Lista de galerias mostra ícone vazio no lugar da capa quando o fotógrafo não escolheu a capa à mão (o detalhe usa a primeira foto; a lista só lê `capa_foto_id`).                | `galerias` (desktop/mobile-p02), `api.ts:115` |
| B2  | Visualizador sem **swipe** no celular: só setas pequenas.                                                                                                                        | `Lightbox.tsx` (mobile-c06)                   |
| B3  | Sem download em **ZIP**: o cliente baixa uma por uma (ou várias abas).                                                                                                           | `pedido.$codigo.tsx`                          |
| B4  | Envio de fotos: sem retomar, sem tentar de novo por arquivo, sem lista de falhas (só os 3 primeiros erros em toast, que somem). Fechar a aba perde o envio sem aviso.            | `EnvioFotos.tsx`                              |
| B5  | Upload aceita qualquer conteúdo com tipo declarado `image/jpeg` (o Storage confere o tipo declarado, não o conteúdo). Baixo risco, porque é servido como imagem.                 | Storage                                       |
| B6  | Telefone do comprador aceita "abc" no navegador (o banco recusa depois, com mensagem genérica). Validação toda nativa do navegador (balões do Chrome), não no padrão do sistema. | `Checkout.tsx`, `FormularioGaleria.tsx`       |
| B7  | Loja sem Pix configurado: o pedido é criado mesmo assim e o cliente só lê "o fotógrafo vai entrar em contato". Nada avisa o fotógrafo de que falta o Pix.                        | `/loja`, `pedido.$codigo`                     |
| B8  | O fotógrafo não é avisado de pedido novo (nem e-mail, nem notificação). O cliente também não recebe e-mail com o link do pedido.                                                 | —                                             |
| B9  | Foto sem arquivo (falha no meio do envio) aparece como imagem quebrada, sem substituto.                                                                                          | `GradeFotos`, `pedido.$codigo`                |
| B10 | Modal "Nova galeria" é mais alto que a tela no desktop: o título some e é preciso rolar dentro do modal.                                                                         | desktop-07                                    |

### (C) Experiência e visual

| #   | Problema                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Galeria do cliente com cara de painel, não de vitrine: cabeçalho genérico com ícone de câmera, botões verdes de sistema, rodapé "Galeria entregue com FotoVenda". Falta tipografia editorial, espaço e foco total nas fotos. |
| C2  | Marca d'água muito pesada (texto grande repetido em diagonal, inclusive na capa), "Minha organização" quando o nome da loja não foi preenchido. Atrapalha ver a foto.                                                        |
| C3  | Grade em masonry com colunas desalinhadas no fim (buracos grandes); em celular, 2 colunas com cantos muito arredondados.                                                                                                     |
| C4  | Dashboard não mostra o que importa: 4 cartões ocupam a tela inteira no celular; não há "galerias em rascunho", "pedidos novos", "seleções recebidas".                                                                        |
| C5  | Tabelas no celular: cabeçalhos cortados ("Clie…", "Val…") e a coluna Situação sai da tela em Galerias.                                                                                                                       |
| C6  | Cor de destaque inconsistente: botões pretos no painel, verdes na entrada da galeria, no 404 e no checkout.                                                                                                                  |
| C7  | Editor de landing no celular: a prévia fica no fim de um formulário muito longo.                                                                                                                                             |
| C8  | Texto de ajuda técnico demais para o fotógrafo ("A prévia… é gerada no seu navegador").                                                                                                                                      |

### (D) Funcionalidades que um fotógrafo esperaria

1. **Clientes** (cadastro, histórico de galerias e pedidos de cada um).
2. **Seleção para álbum / prova**: o cliente marca favoritas e envia a seleção (sem pagar), com
   limite de fotos e prazo; o fotógrafo recebe e vê a lista.
3. **Pagamento online** (Pix automático/cartão via Mercado Pago, Asaas ou Stripe) com liberação
   automática do download.
4. **Download em ZIP** e liberação de download pelo fotógrafo sem pedido (entrega de ensaio pago
   fora do sistema).
5. **E-mails**: galeria publicada, pedido criado, pagamento confirmado, lembrete de vencimento.
6. **Validade da galeria** (expira em X dias) e contador de visitas/downloads.
7. Agenda de ensaios, orçamentos e contratos (escopo maior; decidir se entra).
8. Domínio próprio do estúdio.

---

## 3. Fotos e performance (o que já existe)

- Três versões por foto, geradas no navegador: miniatura 640 px e prévia 1600 px (JPEG, com marca
  d'água), original intocado. A galeria nunca carrega o original. ✔
- `loading="lazy"` na grade; `object-fit` sem distorção. ✔
- Visualizador com setas do teclado. ✔ Sem swipe. ✘
- Envio em paralelo (3 de cada vez) com barra de progresso; 6 fotos em 3 s localmente. ✔
- Não testei com centenas de fotos reais. Pelo código: `galeria_publica` devolve todas as fotos de
  uma vez (cerca de 250 bytes por foto, uns 250 KB para mil fotos) e a grade monta todas no DOM.
  Deve aguentar algumas centenas. Para milhares, vale paginar ou virtualizar.
- Prévias em JPEG, não WebP (WebP ficaria 25–35% menor).

---

## 4. Erros de console e rede

Nenhum erro de JavaScript em nenhuma tela. Os únicos registros foram esperados (400 do login com
senha errada, 404 da rota inexistente) ou vinham de linhas de teste antigas sem arquivo no
Storage, que viram imagem quebrada (ver B9). Nenhuma tela com rolagem lateral em 390 px. As telas
têm carregamento (Skeletons), estado vazio e estado de erro, exceto `/perfil`, que não trata erro
ao carregar.

---

## 5. Decisões de negócio que preciso de você antes da etapa 2

1. **Um estúdio ou vários fotógrafos?** Hoje é um estúdio por instalação (com equipe). Se forem
   vários fotógrafos pagantes, cada um precisa de organização própria, loja/Pix/marca próprios e
   vitrine própria (por exemplo `/s/<estudio>/eventos`). É uma mudança grande no banco e em quase
   todas as telas.
2. **Fechar o cadastro em produção agora?** É um clique em `/equipe` e corta o A1 na hora. Se for
   multi-fotógrafo, o cadastro volta a abrir depois, já com isolamento.
3. **O que o cliente pode fazer:** só comprar (como hoje) ou também escolher favoritas para
   álbum, aprovar e baixar sem pagar quando o fotógrafo liberar?
4. **Cobrança:** continua Pix manual ou entra um gateway (qual)?
5. **Escopo de agenda, orçamentos e contratos:** entra nesta revisão ou fica para depois?
