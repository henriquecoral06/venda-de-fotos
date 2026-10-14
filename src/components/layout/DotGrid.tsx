import { useEffect, useRef } from "react";

/**
 * Grade de pontos de fundo — camada fixa atrás da página INTEIRA.
 * A segunda camada tem pontos da marca revelados num círculo de 220px
 * que segue o cursor (some em telas sem cursor).
 */
export function DotGrid() {
  const spot = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const elemento = spot.current;
    if (!elemento) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let quadro = 0;
    const aoMover = (evento: PointerEvent) => {
      if (quadro) return;
      const { clientX, clientY } = evento;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        elemento.style.setProperty("--mx", `${clientX}px`);
        elemento.style.setProperty("--my", `${clientY}px`);
      });
    };

    window.addEventListener("pointermove", aoMover, { passive: true });
    return () => {
      window.removeEventListener("pointermove", aoMover);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <>
      <div className="ds-dotgrid" aria-hidden="true" />
      <div ref={spot} className="ds-dotgrid-spot" aria-hidden="true" />
    </>
  );
}
