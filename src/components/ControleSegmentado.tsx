import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OpcaoSegmentada<V extends string> {
  valor: V;
  rotulo: ReactNode;
}

/**
 * Escolha única entre 2 a 4 opções curtas, todas à vista. Com mais opções ou
 * rótulo longo, use `Select`. Teclado de radiogroup: setas, Home e End movem
 * a seleção; só o item marcado entra na ordem de Tab.
 */
export function ControleSegmentado<V extends string>({
  opcoes,
  valor,
  aoMudar,
  rotuloAria,
  className,
}: {
  opcoes: readonly OpcaoSegmentada<V>[];
  valor: V;
  aoMudar: (valor: V) => void;
  rotuloAria?: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function mover(e: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const total = opcoes.length;
    let destino: number;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") destino = (indice + 1) % total;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") destino = (indice - 1 + total) % total;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = total - 1;
    else return;
    e.preventDefault();
    const opcao = opcoes[destino];
    if (!opcao) return;
    aoMudar(opcao.valor);
    refs.current[destino]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={rotuloAria}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-hairline bg-elevated p-0.5",
        className,
      )}
    >
      {opcoes.map((o, i) => {
        const marcado = o.valor === valor;
        return (
          <button
            key={o.valor}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={marcado}
            tabIndex={marcado ? 0 : -1}
            onClick={() => aoMudar(o.valor)}
            onKeyDown={(e) => mover(e, i)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              marcado ? "bg-surface text-ink shadow-xs" : "text-mute hover:text-ink",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
