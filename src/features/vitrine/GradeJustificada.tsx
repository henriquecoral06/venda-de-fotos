import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface ItemDaGrade {
  id: string;
  largura: number;
  altura: number;
}

interface Linha<T> {
  itens: { item: T; indice: number; largura: number }[];
  altura: number;
}

/** Fotos montadas por vez; as próximas entram quando o fim da grade aparece. */
const LOTE = 60;
const ESPACO = 4;

/**
 * Linhas com a mesma altura, cada foto na proporção dela: nada é recortado e
 * a linha preenche a largura toda. A última linha não estica (fica na altura
 * alvo), para uma foto sozinha não virar um banner.
 */
function montarLinhas<T extends ItemDaGrade>(
  itens: T[],
  larguraTotal: number,
  alturaAlvo: number,
): Linha<T>[] {
  const linhas: Linha<T>[] = [];
  let atual: { item: T; indice: number; proporcao: number }[] = [];
  let somaProporcoes = 0;

  const fechar = (esticar: boolean) => {
    if (atual.length === 0) return;
    const livre = larguraTotal - ESPACO * (atual.length - 1);
    // A última linha acompanha a anterior, sem ficar mais alta que ela.
    const anterior = linhas.at(-1)?.altura ?? alturaAlvo;
    const altura = esticar ? livre / somaProporcoes : Math.min(alturaAlvo, anterior);
    linhas.push({
      altura,
      itens: atual.map((a) => ({ item: a.item, indice: a.indice, largura: a.proporcao * altura })),
    });
    atual = [];
    somaProporcoes = 0;
  };

  itens.forEach((item, indice) => {
    const proporcao = item.largura > 0 && item.altura > 0 ? item.largura / item.altura : 1;
    atual.push({ item, indice, proporcao });
    somaProporcoes += proporcao;
    const larguraNaAltura = somaProporcoes * alturaAlvo + ESPACO * (atual.length - 1);
    if (larguraNaAltura >= larguraTotal) fechar(true);
  });
  fechar(false);
  return linhas;
}

export function GradeJustificada<T extends ItemDaGrade>({
  itens,
  renderizar,
}: {
  itens: T[];
  renderizar: (item: T, indice: number, tamanho: { largura: number; altura: number }) => ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [visiveis, setVisiveis] = useState(LOTE);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Lista nova (busca por selfie, por exemplo) recomeça do primeiro lote.
  useEffect(() => setVisiveis(LOTE), [itens]);

  useEffect(() => {
    const el = fim.current;
    if (!el || visiveis >= itens.length) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setVisiveis((v) => v + LOTE);
      },
      { rootMargin: "1200px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visiveis, itens.length]);

  const alturaAlvo = largura < 640 ? 150 : largura < 1100 ? 240 : 300;
  const linhas = useMemo(
    () => (largura > 0 ? montarLinhas(itens.slice(0, visiveis), largura, alturaAlvo) : []),
    [itens, visiveis, largura, alturaAlvo],
  );

  return (
    <div ref={caixa} className="w-full">
      <ul className="flex flex-col" style={{ gap: ESPACO }}>
        {linhas.map((linha) => (
          <li key={linha.itens[0]?.item.id} className="flex" style={{ gap: ESPACO }}>
            {linha.itens.map(({ item, indice, largura: l }) => (
              <div
                key={item.id}
                className="relative shrink-0"
                style={{ width: l, height: linha.altura }}
              >
                {renderizar(item, indice, { largura: l, altura: linha.altura })}
              </div>
            ))}
          </li>
        ))}
      </ul>
      <div ref={fim} aria-hidden="true" />
    </div>
  );
}
