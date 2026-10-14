import { useEffect } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { urlPrevia } from "@/lib/fotos";
import { cn } from "@/lib/utils";
import type { FotoPublica } from "./api";

/**
 * Visualização ampliada. O fundo é preto nos dois temas: foto se vê melhor
 * sobre fundo neutro escuro, por isso as cores fixas aqui.
 */
export function Lightbox({
  fotos,
  indice,
  aoMudarIndice,
  aoFechar,
  selecionadas,
  aoAlternar,
  podeSelecionar,
}: {
  fotos: FotoPublica[];
  indice: number | null;
  aoMudarIndice: (indice: number) => void;
  aoFechar: () => void;
  selecionadas: Set<string>;
  aoAlternar: (id: string) => void;
  podeSelecionar: boolean;
}) {
  const foto = indice === null ? undefined : fotos[indice];
  const total = fotos.length;

  useEffect(() => {
    if (indice === null) return;
    function teclado(e: KeyboardEvent) {
      if (indice === null) return;
      if (e.key === "ArrowRight") aoMudarIndice((indice + 1) % total);
      if (e.key === "ArrowLeft") aoMudarIndice((indice - 1 + total) % total);
    }
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [indice, total, aoMudarIndice]);

  // Carrega a próxima prévia antes do clique.
  useEffect(() => {
    if (indice === null) return;
    const proxima = fotos[(indice + 1) % total];
    if (proxima) new Image().src = urlPrevia(proxima.previa);
  }, [indice, fotos, total]);

  const marcada = foto ? selecionadas.has(foto.id) : false;

  return (
    <Dialog open={foto !== undefined} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 border-0 bg-black p-0 text-white sm:rounded-none [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">{foto?.nome ?? "Foto"}</DialogTitle>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm tabular-nums text-white/70">
            {indice !== null ? indice + 1 : 0} / {total}
          </span>
          <div className="flex items-center gap-2">
            {podeSelecionar && foto && (
              <Button
                size="sm"
                variant={marcada ? "secondary" : "default"}
                className={cn(!marcada && "bg-white text-black hover:bg-white/85")}
                onClick={() => aoAlternar(foto.id)}
              >
                {marcada ? <Check className="size-4" /> : <Plus className="size-4" />}
                {marcada ? "Selecionada" : "Selecionar"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-white hover:bg-white/15 hover:text-white"
              aria-label="Fechar"
              onClick={aoFechar}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16">
          {foto && (
            <img
              key={foto.id}
              src={urlPrevia(foto.previa)}
              alt={foto.nome}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-full max-w-full select-none object-contain"
            />
          )}
          {total > 1 && indice !== null && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 size-11 -translate-y-1/2 bg-black/40 text-white hover:bg-white/15 hover:text-white"
                aria-label="Foto anterior"
                onClick={() => aoMudarIndice((indice - 1 + total) % total)}
              >
                <ChevronLeft className="size-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 size-11 -translate-y-1/2 bg-black/40 text-white hover:bg-white/15 hover:text-white"
                aria-label="Próxima foto"
                onClick={() => aoMudarIndice((indice + 1) % total)}
              >
                <ChevronRight className="size-6" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
