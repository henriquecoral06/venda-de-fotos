import { useEffect, type ReactNode } from "react";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";
import { urlLogo, variaveisDaMarca, type Marca } from "@/lib/marca";

/**
 * Sem cor de marca, o acento das telas do cliente é a própria tinta do texto:
 * a foto é a cor da página, e o verde do painel não é do fotógrafo.
 */
const ACENTO_NEUTRO: Record<string, string> = {
  "--primary": "oklch(0.204 0 0)",
  "--primary-foreground": "oklch(1 0 0)",
  "--ring": "oklch(0.204 0 0)",
};

/**
 * Casca das telas do cliente final (galeria, pedido e vitrine): barra com a
 * logo (ou o nome) do fotógrafo e rodapé discreto. Sempre clara
 * (`PREFIXOS_SEMPRE_CLAROS` em `__root.tsx`); a largura é de cada tela.
 */
export function LayoutPublico({
  fotografo,
  marca,
  acoes,
  children,
}: {
  fotografo: string;
  marca?: Marca | null | undefined;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const primaria = marca?.cor_primaria ?? null;
  const secundaria = marca?.cor_secundaria ?? null;

  // Folha de estilo própria com `!important`: o tema do painel grava as mesmas
  // variáveis inline no `<html>` e não pode sobrescrever a marca (nem perder
  // as dele quando a tela do cliente sai). Vale também para Sheet e Dialog,
  // que abrem em portal fora desta árvore.
  useEffect(() => {
    const daMarca = variaveisDaMarca({
      logo: null,
      cor_primaria: primaria,
      cor_secundaria: secundaria,
    });
    const variaveis = Object.keys(daMarca).length > 0 ? daMarca : ACENTO_NEUTRO;
    const declaracoes = Object.entries(variaveis)
      .map(([nome, valor]) => `${nome}: ${valor} !important;`)
      .join(" ");
    const estilo = document.createElement("style");
    estilo.dataset["marcaDaLoja"] = "";
    estilo.textContent = `:root { ${declaracoes} }`;
    document.head.appendChild(estilo);
    return () => estilo.remove();
  }, [primaria, secundaria]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[96rem] items-center justify-between gap-3 px-4 md:px-8">
          <span className={cn("flex min-w-0 items-center", !marca?.logo && "text-label-lg")}>
            {marca?.logo ? (
              <img
                src={urlLogo(marca.logo)}
                alt={fotografo || "Logo do fotógrafo"}
                className="h-8 max-w-40 object-contain"
              />
            ) : (
              <span className="truncate text-foreground">{fotografo || "Galeria de fotos"}</span>
            )}
          </span>
          {acoes && <div className="flex shrink-0 items-center gap-1.5">{acoes}</div>}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-2 px-4 py-8 text-caption text-faint md:px-8">
        <span>
          © {new Date().getFullYear()} {fotografo || "Fotógrafo"}. As fotos são protegidas por
          direito autoral.
        </span>
        <span>Entregue com {BRAND.name}</span>
      </footer>
    </div>
  );
}
