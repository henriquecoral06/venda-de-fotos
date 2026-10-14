# Instruções do repositório

Manual de engenharia: `.claude/skills/ceia-desenvolver/SKILL.md`. Leia antes de criar feature,
tabela, migration, rota ou server function.

Stack: TanStack Start (rotas por arquivo em `src/routes`), React 19, TypeScript estrito,
Tailwind v4 + shadcn/ui, React Query, Supabase (Postgres, Auth, RLS). O build é para Workers.

As seis regras que mais quebram:

1. Migration nova sempre em arquivo novo com timestamp, idempotente; nunca editar uma aplicada.
2. Toda tabela com RLS e a policy padrão de `anotacoes`; caso novo em `supabase/tests/rls_test.sql`.
   Todo objeto novo (tabela, view, função) entra no `garantir_instalacao()`: a migration recria a
   função com os grants dele (manual, seção 3) e toda linha inicial entra na seção 0 dele.
3. `src/integrations/supabase/types.ts` é mantido à mão e muda junto com cada migration.
4. Sem API do Node no servidor; service role só em server function com `requireSupabaseAuth`,
   importando `client.server` dentro do handler.
5. Só tokens do design system (`bg-card`, `text-muted-foreground`…): nada de cor fixa nem `dark:`
   com cor fixa; página com `PageHeader`, `EstadoVazio`, `Skeletons` e `p-4 md:p-8`.
6. Antes de commitar: `npm run build`, `npm run lint` (0 erros) e `npm run format`.

Tudo em português do Brasil: código, comentários, UI, docs e mensagens de commit.
