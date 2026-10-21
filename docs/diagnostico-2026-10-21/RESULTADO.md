# Revisão do FotoVenda: resultado

Branch `revisao-completa`. Diagnóstico de partida em [`RELATORIO.md`](RELATORIO.md). Capturas
de antes em `capturas/` e de depois em `capturas-depois/` (só na máquina local, fora do git:
somam 62 MB).

Modelo de negócio confirmado: **um fotógrafo (ou estúdio) por instalação**. Cada fotógrafo vai
copiar o projeto (Lovable) e criar a própria conta, que vira a dona.

## O que foi corrigido

### Crítico (segurança)

| Antes                                                                                                                               | Agora                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1. Qualquer conta nova entrava na equipe e via tudo (o cadastro nascia aberto)                                                     | A organização nasce com o cadastro **fechado**: a primeira conta vira dona e as seguintes só entram quando o dono abre o cadastro em Equipe. O texto de Equipe avisa que quem entra vê tudo      |
| A3. Galeria abria pelo nome (`/g/casamento-ana`)                                                                                    | Galeria de cliente e evento com senha abrem só por **link secreto** (`/g/<16 caracteres>`). O nome legível só abre evento sem senha (o da vitrine). Botão **Gerar novo link** quando o link vaza |
| A4. Senha da galeria sem limite (60 tentativas em 0,3 s)                                                                            | 10 erradas por visitante e galeria em 15 min (e 100 por galeria em 1 h) bloqueiam a galeria por alguns minutos                                                                                   |
| A5. Pedidos falsos sem limite                                                                                                       | 10 pedidos por visitante e por e-mail em 1 h; telefone validado no banco                                                                                                                         |
| **Novo, achado na verificação**: a permissão do comprador também deixava **listar** a pasta de originais e descobrir os já vendidos | A policy do Storage vale só para **assinar** o link (`storage.operation()`); listar não mostra nada a quem é de fora                                                                             |

### Funcional

- B1. Lista de galerias e dashboard mostram a capa (a escolhida ou a primeira foto).
- B2. Visualizador: deslizar no celular, setas maiores, fotos vizinhas pré-carregadas.
- B3. Download em **ZIP**, no pedido pago e na galeria liberada, montado no navegador e dividido
  em partes (até 400 MB no celular, 1,5 GB no computador).
- B4. Envio: pula as fotos que já subiram (reenviar a pasta continua de onde parou), tenta de novo
  sozinho uma vez, lista as falhas com "Tentar de novo" e avisa antes de fechar a aba.
- B6. Validação em português embaixo de cada campo, com borda vermelha e foco no primeiro erro
  (nova galeria, checkout, senha da galeria); telefone conferido.
- B7. Aviso de "loja sem Pix" no dashboard e na tela da loja.
- B9. Arquivo de foto faltando vira um bloco neutro em vez da imagem quebrada.
- B10. Formulário de galeria com cabeçalho e rodapé fixos; só o meio rola.
- Confirmação para cancelar pedido (individual e em massa), remover membro e trocar o link.
- `/perfil` com estado de carregamento e de erro.

### Fotos e performance

- Prévias em **WebP** (JPEG de reserva), marca d'água **mais leve** (fonte menor, menos repetições)
  e **opcional** (interruptor em Loja e pagamento).
- **Download liberado** pelo fotógrafo, por galeria: o cliente baixa os originais sem pedido
  (ensaio já pago).
- Grade em linhas justificadas, montada de 60 em 60 fotos conforme a rolagem: abre rápido com
  centenas de fotos e nunca carrega o original para exibir.

### Visual

- Sistema de design documentado em [`docs/DESIGN.md`](../DESIGN.md): paleta, uma fonte (Geist),
  escala, espaços, bordas e componentes padrão. Ícones só do lucide.
- **Galeria do cliente**: folha de rosto (capa inteira e o título grande e leve embaixo), grade
  sem buracos, interface discreta, acento na cor da marca (ou tinta, sem marca); o verde do painel
  saiu das telas do cliente. Tela de senha dividida (foto e formulário).
- **Dashboard**: "Para fazer agora" no topo, números numa faixa compacta, galerias recentes com
  capa, pedidos recentes; "Nova galeria" abre o formulário direto.
- Tabelas sem corte no celular; 404 e página de erro com os componentes do sistema.

## Verificação final

- Fluxo do fotógrafo (entrada, dashboard, nova galeria com erros de validação, envio de 6 fotos e
  de um arquivo inválido, reenvio, publicação, galeria liberada, novo link) e do cliente (vitrine,
  nome adivinhado, senha vazia/errada/certa, grade, visualizador com setas e deslizar, seleção,
  checkout com erro, pedido, pagamento confirmado, ZIP do pedido com 2 fotos, ZIP da galeria com 3
  fotos, download avulso) em 1440 px e 390 px, mais o painel no tema escuro.
- Console e rede: nenhum erro, nenhuma requisição falhando. A exceção é o 404 da rota inexistente,
  que é proposital.
- Isolamento e acesso: **24 de 24** conferências ([`seguranca-depois.json`](seguranca-depois.json)).
  Cadastro fechado recusa conta nova; conta removida da equipe não lê, não altera, não exclui, não
  assina nem lista nada do estúdio; o visitante não lê nenhuma tabela, não abre galeria pelo nome,
  não vê fotos sem a senha, não baixa original sem pagamento e é bloqueado nas tentativas e nos
  pedidos em série.
- `npm run build` ok, `npm run lint` com 0 erros, `npm run format`, `RLS OK` e `REPARO OK`
  (casos novos 30 e 31).

## Não foi feito (sugestões para as próximas versões)

1. **Favoritos e seleção para álbum**: o cliente marca as fotos e envia sem pagar.
2. **Pagamento online** (Pix automático ou cartão, com liberação automática).
3. **E-mails**: galeria publicada, pedido criado, pagamento confirmado.
4. Agenda de ensaios, orçamentos e contratos; cadastro de clientes com histórico.
5. Validade da galeria (expira em X dias) e contagem de visitas e downloads.
6. Retomar envio **depois de fechar a aba** (hoje retoma reenviando a pasta) e envio direto do
   celular em segundo plano.
7. Conferir o conteúdo do arquivo no servidor: hoje o navegador só gera a prévia de uma imagem de
   verdade, mas o Storage aceita qualquer conteúdo com o tipo declarado de imagem.
8. Apagar do Storage os arquivos que sobram quando a exclusão é interrompida no meio.
9. Zoom com pinça no visualizador.
10. A marca d'água nova vale para as fotos enviadas daqui em diante; as prévias antigas continuam
    com a marca anterior (reenviar a foto refaz a prévia).

## Para levar à produção

1. Aplicar `supabase/migrations/20261022120000_revisao_seguranca.sql` no Supabase de produção.
2. Fazer o merge do branch na main (a Cloudflare publica sozinha).
3. A organização que já existe em produção continua com o cadastro **aberto** (a mudança vale para
   instalações novas). Feche em Equipe.
4. Links de galeria de cliente já enviados pelo nome deixam de abrir: mande o link novo (botão
   "Copiar" na galeria).
