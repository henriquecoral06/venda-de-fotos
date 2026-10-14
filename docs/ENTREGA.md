# Antes de entregar a solução

Checklist do último commit antes da entrega. Tudo o que não é do cliente sai do repositório.

## Remover

- [ ] `.claude/` (manual de engenharia, configuração local)
- [ ] `CLAUDE.md`
- [ ] `docs/ENTREGA.md` (este arquivo) e qualquer outro documento de trabalho em `docs/`
- [ ] `docs/README_CLIENTE.md`, depois de virar o `README.md` (ver abaixo)
- [ ] Feature de exemplo `anotacoes`, se a solução não a usa: `src/features/anotacoes/`,
      `src/routes/_authenticated/anotacoes.tsx`, a entrada em `src/lib/navegacao.ts`, as métricas
      do `dashboard.tsx`, a tabela em `types.ts` e uma migration nova com `drop table` (a de
      fundação não é editada)
- [ ] Contas e dados de teste no banco de produção
- [ ] `.env` local (não é versionado; conferir que não entrou em nenhum commit)

## Conferir

- [ ] `npm run build` sem erro
- [ ] `npm run lint` com 0 erros
- [ ] `supabase/tests/rls_test.sql` devolve `RLS OK` e `supabase/tests/remix_reparo_test.sql`
      devolve `REPARO OK` no banco de produção
- [ ] Todo objeto novo (tabela, view, função) está nos privilégios de `garantir_instalacao()`,
      na versão mais recente da função (migration `auto_reparo_remix` ou posterior)
- [ ] _Authentication → URL Configuration_ com a URL de produção em _Site URL_ e
      `https://<domínio>/**` em _Redirect URLs_ (magic link e nova senha)
- [ ] Busca por termos internos vazia, por exemplo:
      `git grep -i -E "template|ceia|anotac|TODO|FIXME"`, revisando cada ocorrência
- [ ] `README.md` reescrito para o cliente a partir de `docs/README_CLIENTE.md`
- [ ] `src/config/brand.ts` com o nome e a tagline finais
- [ ] Antes do primeiro cadastro no publicado e em cada remix de teste: `GET <SUPABASE_URL>/auth/v1/settings`
      com a publishable key devolve `external.email` = `true`
- [ ] Depois de ligar ou desligar provedor de login no painel do Cloud, revisar o diff (o assistente
      da plataforma pode alterar código) e reverter o que não foi pedido
- [ ] Histórico do repositório conectado integrado por merge (`--allow-unrelated-histories` na
      primeira vez), sem force push
- [ ] Teste de remix de verdade: remixar, chamar a tela de entrada, conferir linhas iniciais,
      cadastro e painel
