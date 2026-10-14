import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueletos de carregamento das páginas. A ideia é a tela trocar na hora
 * do clique e mostrar a "forma" do conteúdo enquanto os dados chegam, em vez
 * de segurar a tela anterior ou exibir um "Carregando...".
 */

/** Título + descrição da página, no mesmo tamanho do PageHeader. */
export function SkeletonCabecalho({ acoes = 1 }: { acoes?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {acoes > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: acoes }, (_, i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-full" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Tabela dentro de um Card, com cabeçalho e N linhas. */
export function SkeletonTabela({ linhas = 5, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <Card className="p-0">
      <div className="flex gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: colunas }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
          {Array.from({ length: colunas }, (_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </Card>
  );
}

/** Lista de cards empilhados. */
export function SkeletonLista({ itens = 4 }: { itens?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: itens }, (_, i) => (
        <Card key={i} className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-5 w-64 max-w-[70%]" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48" />
        </Card>
      ))}
    </div>
  );
}

/** Formulário em card: N campos rotulados e um botão. */
export function SkeletonFormulario({ campos = 4 }: { campos?: number }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-3">
        {Array.from({ length: campos }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-36 rounded-full" />
    </Card>
  );
}

/**
 * Esqueleto genérico usado pelo roteador enquanto a próxima rota carrega
 * (chunk de código + guard de autenticação). Renderiza dentro do layout,
 * então a sidebar e o header continuam no lugar.
 */
export function SkeletonPagina() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <SkeletonCabecalho />
      <SkeletonLista itens={3} />
    </div>
  );
}
