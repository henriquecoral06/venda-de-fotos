import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { RenderLanding } from "./RenderLanding";
import type { DadosLanding } from "./tipos";

const LARGURA_DESKTOP = 1280;

/**
 * A landing desenhada em 1280 px de largura e reduzida para caber no espaço,
 * como numa tela de computador. `altura` corta a prévia (miniatura); sem ela,
 * a página aparece inteira.
 */
export function PreviaEscalada({
  dados,
  altura,
  className,
}: {
  dados: DadosLanding;
  altura?: number;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const pagina = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.3);
  const [alturaPagina, setAlturaPagina] = useState(800);

  useLayoutEffect(() => {
    const el = caixa.current;
    const conteudo = pagina.current;
    if (!el || !conteudo) return;
    const medir = () => {
      setEscala(el.clientWidth / LARGURA_DESKTOP);
      setAlturaPagina(conteudo.scrollHeight);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    observador.observe(conteudo);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={caixa}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ height: altura ?? alturaPagina * escala }}
    >
      <div
        ref={pagina}
        // A prévia não é navegável: os links levariam o painel para outra página.
        className="pointer-events-none absolute left-0 top-0 origin-top-left select-none"
        style={{ width: LARGURA_DESKTOP, transform: `scale(${escala})` }}
        aria-hidden="true"
        inert
      >
        <RenderLanding dados={dados} previa />
      </div>
    </div>
  );
}
