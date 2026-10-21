import { useCallback, useEffect, useMemo, useState } from "react";
import { CtaFixoMobile, URL_FONTES, variaveisCores } from "./comum";
import { FormularioLanding } from "./FormularioLanding";
import { ModeloClassico } from "./modelos/Classico";
import { ModeloEditorial } from "./modelos/Editorial";
import { ModeloEstudio } from "./modelos/Estudio";
import { ModeloPortfolio } from "./modelos/Portfolio";
import type { DadosLanding, ModeloLanding } from "./tipos";

/** Botão do CTA fixo do celular e do formulário, no estilo de cada modelo. */
const BOTAO_DO_MODELO: Record<ModeloLanding, string> = {
  editorial:
    "inline-flex items-center bg-[var(--lp-primaria)] px-6 py-3.5 text-sm tracking-wide text-[var(--lp-sobre-primaria)]",
  portfolio:
    "inline-flex items-center rounded-full bg-[var(--lp-primaria)] px-6 py-3.5 text-sm font-medium text-[var(--lp-sobre-primaria)]",
  estudio:
    "inline-flex items-center rounded-full bg-[var(--lp-primaria)] px-6 py-3.5 text-sm font-medium text-[var(--lp-sobre-primaria)]",
  classico:
    "inline-flex items-center bg-[var(--lp-primaria)] px-6 py-3.5 text-xs uppercase tracking-[0.2em] text-[var(--lp-sobre-primaria)]",
};

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

/**
 * Desenha o modelo e, por cima dele, o formulário do popup e o CTA fixo do
 * celular. Na prévia do painel (`previa`) o CTA fixo fica de fora: a página é
 * desenhada em largura de computador dentro de uma caixa reduzida.
 */
export function RenderLanding({
  dados,
  previa = false,
}: {
  dados: DadosLanding;
  previa?: boolean;
}) {
  useFontesLanding();
  const [raiz, setRaiz] = useState<HTMLDivElement | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const popup = dados.conteudo.cta_tipo === "popup";
  const { aoClicarCta } = dados;

  const d = useMemo<DadosLanding>(
    () => ({
      ...dados,
      aoClicarCta: () => {
        aoClicarCta();
        if (popup) setFormularioAberto(true);
      },
    }),
    [dados, aoClicarCta, popup],
  );
  const fechar = useCallback(() => setFormularioAberto(false), []);

  const modelo = (() => {
    switch (d.modelo) {
      case "editorial":
        return <ModeloEditorial d={d} />;
      case "portfolio":
        return <ModeloPortfolio d={d} />;
      case "estudio":
        return <ModeloEstudio d={d} />;
      case "classico":
        return <ModeloClassico d={d} />;
    }
  })();

  return (
    <div ref={setRaiz} style={variaveisCores(d.cores)}>
      {modelo}
      {!previa && <CtaFixoMobile raiz={raiz} d={d} classe={BOTAO_DO_MODELO[d.modelo]} />}
      {popup && (
        <FormularioLanding
          d={d}
          aberto={formularioAberto}
          aoFechar={fechar}
          classeBotao={BOTAO_DO_MODELO[d.modelo]}
        />
      )}
    </div>
  );
}
