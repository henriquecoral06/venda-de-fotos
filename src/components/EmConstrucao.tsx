import { EstadoVazio, PageHeader } from "@/components/PageHeader";

/** Placeholder de tela ainda não implementada. */
export function EmConstrucao({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader titulo={titulo} {...(descricao ? { descricao } : {})} />
      <EstadoVazio titulo="Em construção" descricao="Esta área ainda não foi implementada." />
    </div>
  );
}
