import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Páginas à vista: a primeira, a última e as vizinhas da atual; o resto vira "…". */
function paginasVisiveis(atual: number, total: number): (number | "…")[] {
  const lista: (number | "…")[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - atual) <= 1) lista.push(p);
    else if (lista.at(-1) !== "…") lista.push("…");
  }
  return lista;
}

/**
 * Navegação por número de página, embaixo de uma lista longa. `pagina`
 * começa em 1. Some quando tudo cabe numa página.
 */
export function Paginacao({
  pagina,
  porPagina,
  total,
  aoMudar,
  className,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  aoMudar: (pagina: number) => void;
  className?: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(total, pagina * porPagina);

  return (
    <nav
      aria-label="Páginas"
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <p className="text-caption text-muted-foreground tabular-nums">
        {de.toLocaleString("pt-BR")}–{ate.toLocaleString("pt-BR")} de{" "}
        {total.toLocaleString("pt-BR")}
      </p>
      <ul className="flex items-center gap-1">
        <li>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Página anterior"
            disabled={pagina <= 1}
            onClick={() => aoMudar(pagina - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </li>
        {paginasVisiveis(pagina, paginas).map((p, i) =>
          p === "…" ? (
            <li key={`reticencias-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Button
                variant={p === pagina ? "outline" : "ghost"}
                size="icon"
                aria-label={`Página ${p}`}
                aria-current={p === pagina ? "page" : undefined}
                className="tabular-nums"
                onClick={() => aoMudar(p)}
              >
                {p}
              </Button>
            </li>
          ),
        )}
        <li>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próxima página"
            disabled={pagina >= paginas}
            onClick={() => aoMudar(pagina + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </li>
      </ul>
    </nav>
  );
}
