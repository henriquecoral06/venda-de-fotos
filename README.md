# Venda de Fotos

Plataforma para fotógrafos entregarem e venderem fotos online, no estilo Alboom.

## Visão geral

O fotógrafo cria galerias de eventos ou ensaios, envia as fotos e compartilha um link com os clientes. O cliente vê as fotos com marca d'água, escolhe as que quer, paga online e baixa em alta resolução.

## Funcionalidades planejadas

### Para o fotógrafo (painel)
- [ ] Cadastro e login
- [ ] Criação de galerias (evento, ensaio, formatura, esporte)
- [ ] Upload em lote com geração automática de miniaturas e marca d'água
- [ ] Tabela de preços por foto, pacotes e combos
- [ ] Galerias públicas ou protegidas por senha
- [ ] Seleção de fotos pelo cliente (prova / álbum)
- [ ] Relatório de vendas e financeiro
- [ ] Site/portfólio próprio com domínio personalizado

### Para o cliente
- [ ] Navegação na galeria com visualização ampliada
- [ ] Busca por reconhecimento facial ("encontre suas fotos")
- [ ] Carrinho e checkout (Pix, cartão, boleto)
- [ ] Download em alta resolução após o pagamento
- [ ] Favoritos e compartilhamento

### Plataforma
- [ ] Planos de assinatura para fotógrafos
- [ ] Split de pagamento (comissão da plataforma)
- [ ] Notificações por e-mail

## Stack sugerida

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js + TypeScript + Tailwind CSS |
| Backend / Banco | Supabase (Postgres, Auth, Storage) |
| Processamento de imagens | Sharp (miniaturas e marca d'água) |
| Pagamentos | Mercado Pago, Asaas ou Stripe |
| E-mails | Resend |
| Hospedagem | Vercel |

## Status

Projeto em fase inicial.
