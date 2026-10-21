import { useEffect } from "react";
import { URL_FONTES } from "./comum";
import { ModeloClassico } from "./modelos/Classico";
import { ModeloEditorial } from "./modelos/Editorial";
import { ModeloEstudio } from "./modelos/Estudio";
import { ModeloPortfolio } from "./modelos/Portfolio";
import type { DadosLanding } from "./tipos";

/** Carrega as fontes dos modelos uma vez por página (público e prévia do painel). */
function useFontesLanding() {
  useEffect(() => {
    if (document.querySelector(`link[href="${URL_FONTES}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = URL_FONTES;
    document.head.appendChild(link);
  }, []);
}

export function RenderLanding({ dados }: { dados: DadosLanding }) {
  useFontesLanding();
  switch (dados.modelo) {
    case "editorial":
      return <ModeloEditorial d={dados} />;
    case "portfolio":
      return <ModeloPortfolio d={dados} />;
    case "estudio":
      return <ModeloEstudio d={dados} />;
    case "classico":
      return <ModeloClassico d={dados} />;
  }
}
