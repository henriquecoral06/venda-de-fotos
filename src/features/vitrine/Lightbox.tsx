import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { urlPrevia } from "@/lib/fotos";
import { cn } from "@/lib/utils";
import { linkDownload, type FotoPublica } from "./api";

/** Arrasto mínimo, em px, para contar como troca de foto. */
const ARRASTO_TROCA = 60;

/**
 * Visualização ampliada. O fundo é preto nos dois temas: foto se vê melhor
 * sobre fundo neutro escuro, por isso as cores fixas aqui. No celular, deslizar
 * para o lado troca de foto (o gesto vertical e a pinça continuam do navegador).
 */
export function Lightbox({
  fotos,
  indice,
  aoMudarIndice,
  aoFechar,
  selecionadas,
  aoAlternar,
  podeSelecionar,
  whatsappRemocao = "",
}: {
  fotos: FotoPublica[];
  indice: number | null;
  aoMudarIndice: (indice: number) => void;
  aoFechar: () => void;
  selecionadas: Set<string>;
  aoAlternar: (id: string) => void;
  podeSelecionar: boolean;
  /** Evento aberto: quem aparece na foto pede a remoção ao estúdio (LGPD). */
  whatsappRemocao?: string;
}) {
  const foto = indice === null ? undefined : fotos[indice];
  const total = fotos.length;
  const [arrasto, setArrasto] = useState(0);
  const [baixando, setBaixando] = useState(false);
  const inicio = useRef<{ x: number; y: number; id: number } | null>(null);

  const anterior = () => indice !== null && aoMudarIndice((indice - 1 + total) % total);
  const proxima = () => indice !== null && aoMudarIndice((indice + 1) % total);

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

  // Carrega as vizinhas antes do toque.
  useEffect(() => {
    if (indice === null || total < 2) return;
    for (const passo of [1, -1]) {
      const vizinha = fotos[(indice + passo + total) % total];
      if (vizinha) new Image().src = urlPrevia(vizinha.previa);
    }
  }, [indice, fotos, total]);

  const marcada = foto ? selecionadas.has(foto.id) : false;

  async function baixar() {
    if (!foto?.original) return;
    setBaixando(true);
    try {
      const a = document.createElement("a");
      a.href = await linkDownload(foto.original, foto.nome);
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível baixar a foto.");
    } finally {
      setBaixando(false);
    }
  }

  function aoTocar(e: React.PointerEvent) {
    if (e.pointerType === "mouse" || total < 2) return;
    inicio.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function aoMover(e: React.PointerEvent) {
    const i = inicio.current;
    if (!i || i.id !== e.pointerId) return;
    const dx = e.clientX - i.x;
    // Gesto mais vertical que horizontal fica com o navegador.
    if (Math.abs(dx) > Math.abs(e.clientY - i.y)) setArrasto(dx);
  }
  function aoSoltar(e: React.PointerEvent) {
    const i = inicio.current;
    inicio.current = null;
    if (!i || i.id !== e.pointerId) return;
    if (arrasto <= -ARRASTO_TROCA) proxima();
    else if (arrasto >= ARRASTO_TROCA) anterior();
    setArrasto(0);
  }

  return (
    <Dialog open={foto !== undefined} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 border-0 bg-black p-0 text-white sm:rounded-none [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">{foto?.nome ?? "Foto"}</DialogTitle>
        <DialogDescription className="sr-only">
          Use as setas do teclado ou deslize para o lado para ver as outras fotos.
        </DialogDescription>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm tabular-nums text-white/60">
            {indice !== null ? indice + 1 : 0} de {total}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 text-white hover:bg-white/15 hover:text-white"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden px-0 sm:px-20"
          onPointerDown={aoTocar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
        >
          {foto && (
            <img
              key={foto.id}
              src={urlPrevia(foto.previa)}
              alt={foto.nome}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={arrasto ? { transform: `translateX(${arrasto}px)` } : undefined}
              className={cn(
                "max-h-full max-w-full select-none object-contain",
                arrasto === 0 && "transition-transform duration-200",
              )}
            />
          )}
          {total > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-3 top-1/2 hidden size-12 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white sm:inline-flex"
                aria-label="Foto anterior"
                onClick={anterior}
              >
                <ChevronLeft className="size-7" strokeWidth={1.5} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 hidden size-12 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white sm:inline-flex"
                aria-label="Próxima foto"
                onClick={proxima}
              >
                <ChevronRight className="size-7" strokeWidth={1.5} />
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0">
            <p className="truncate text-sm text-white/80">{foto?.nome}</p>
            {whatsappRemocao && foto && (
              <a
                href={`https://wa.me/${whatsappRemocao}?text=${encodeURIComponent(
                  `Olá! Apareço na foto ${foto.nome} (${window.location.href}) e gostaria que ela fosse removida.`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="text-caption text-white/50 underline hover:text-white"
              >
                Esta foto é sua? Pedir remoção
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {foto?.original && (
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/15 hover:text-white"
                disabled={baixando}
                onClick={() => void baixar()}
              >
                {baixando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Baixar
              </Button>
            )}
            {podeSelecionar && foto && (
              <Button
                size="sm"
                variant={marcada ? "secondary" : "default"}
                className={cn(!marcada && "bg-white text-black hover:bg-white/85")}
                onClick={() => aoAlternar(foto.id)}
              >
                {marcada ? <Check className="size-4" /> : <Plus className="size-4" />}
                {marcada ? "Escolhida" : "Escolher"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
