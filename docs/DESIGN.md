# Sistema de design do FotoVenda

Base: o design system do template (versão em `DS_VERSION`), com os tokens em `src/styles.css`.
Este documento registra as regras de uso e as decisões desta solução. Regras gerais do DS
(tokens, escala, botões, tabelas) estão em `.claude/skills/ceia-desenvolver/SKILL.md`, seção 5.

## Dois ambientes

|          | Painel do fotógrafo                                                      | Telas do cliente (`/g`, `/pedido`, `/eventos`)                          |
| -------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Objetivo | trabalho rápido, denso, sem ruído                                        | as fotos em primeiro plano, a interface some                            |
| Escopo   | `.ds-app` (campo de 36 px, raio menor, tipo um degrau abaixo)            | fora do `.ds-app` (campo em pílula de 44 px)                            |
| Tema     | claro, escuro ou do sistema                                              | sempre claro (`PREFIXOS_SEMPRE_CLAROS`)                                 |
| Acento   | `--primary` do DS (verde) em seleção e destaque; ação principal em tinta | cor da marca do fotógrafo; sem marca, a própria tinta (`LayoutPublico`) |

As landing pages (`/l/...`) são modelos de anúncio com paleta e fontes próprias (`--lp-*`), fora
deste sistema de propósito: cada fotógrafo troca as cores pelo painel.

## Paleta (tema claro)

| Papel                          | Token                                                                   | Valor     |
| ------------------------------ | ----------------------------------------------------------------------- | --------- |
| Fundo da página                | `--background` / `bg-background`                                        | `#fafafa` |
| Superfície (card, diálogo)     | `--card` / `bg-card`                                                    | `#ffffff` |
| Texto principal (tinta)        | `--foreground` / `text-foreground`                                      | `#171717` |
| Texto de apoio                 | `--muted-foreground`                                                    | `#525252` |
| Texto discreto (rodapé, vazio) | `--faint` / `text-faint`                                                | `#a1a1a1` |
| Linha                          | `--border`                                                              | `#ececec` |
| Acento do painel               | `--primary`                                                             | `#059669` |
| Feedback                       | `success`, `warning`, `info`, `destructive` (par `-soft` + texto forte) | —         |

O tema escuro troca os mesmos tokens (`.dark` em `styles.css`). Cor fixa só no visualizador de
fotos (fundo preto nos dois temas, para a foto) e nas landing pages.

## Tipografia

Uma família: **Geist** (texto e interface). Números de tabela com `tabular-nums`.

| Uso                                   | Classe                                                           |
| ------------------------------------- | ---------------------------------------------------------------- |
| Título de galeria e vitrine (cliente) | `text-heading-xl font-light`, `md:text-display-xl md:font-light` |
| Título de página do painel            | `PageHeader` (`text-heading-lg` no `.ds-app`)                    |
| Título de seção                       | `text-heading-sm`                                                |
| Texto corrido                         | `text-body-md` (linha de até ~70 caracteres, `max-w-prose`)      |
| Rótulo de campo e de item             | `text-label-md`                                                  |
| Apoio, dica, erro de campo            | `text-caption`                                                   |

O título das telas do cliente usa peso leve e tamanho grande: a elegância vem da escala e do
espaço, não de uma segunda fonte.

## Espaço, bordas e sombra

- Escala de 4 px do Tailwind. Página: `p-4 md:p-8`; entre seções do painel, `space-y-8`.
- Superfície por contorno: `Card` com borda de 1 px e sem sombra. Sombra só no que flutua
  (barra de seleção da galeria, menus e diálogos).
- Raio: o do escopo (`rounded-lg`/`rounded-xl`). Fotos na galeria do cliente têm canto reto e
  4 px entre elas, como numa folha de contato.

## Componentes padrão

- **Botões**: `default` (pílula em tinta) para a ação principal; `outline` para a alternativa;
  `ghost` para ação de linha ou barra; `destructive` só para confirmar exclusão. Nas telas do
  cliente, a ação principal leva `CLASSE_BOTAO_MARCA` (cor da marca).
- **Campos**: `Input`, `Textarea`, `Select` dentro de `Campo` (rótulo, dica e `erro`). Formulário
  com `noValidate`: a validação é do zod, com a mensagem em português embaixo do campo, borda
  vermelha (`aria-invalid`) e foco no primeiro campo com erro (`src/lib/validacao.ts`).
- **Confirmação**: `ConfirmarAcao` para tudo que não se desfaz (excluir, cancelar pedido,
  remover membro, trocar o link da galeria).
- **Estados**: `Skeletons` ao carregar, `EstadoVazio` para vazio (sempre dizendo o que fazer) e
  para erro (com "Tentar de novo").
- **Imagem**: `Miniatura` no lugar de `<img>` em listas: arquivo faltando vira um bloco neutro.
- **Tabelas**: `Tabela`, com colunas escondidas no celular (`hidden sm:table-cell`).
- **Galeria do cliente**: `GradeJustificada` (linhas de mesma altura, sem recorte, montadas aos
  poucos) e `Lightbox` (setas, teclado e deslizar no celular).

## Ícones

Só `lucide-react`, traço 1,5 a 2, tamanho 16 a 20 px (`size-4`/`size-5`).
