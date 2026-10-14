import { useEffect, type ReactNode } from "react";
import { Camera } from "lucide-react";
import { BRAND } from "@/config/brand";
import { urlLogo, variaveisDaMarca, type Marca } from "@/lib/marca";

/**
 * Casca das telas do cliente final (galeria e pedido): barra com a logo (ou o
 * nome) do fotógrafo e rodapé discreto. Sempre clara (`PREFIXOS_SEMPRE_CLAROS`
 * em `__root.tsx`); a largura é de cada tela. Com a marca configurada, as
 * cores dela valem enquanto a tela está montada.
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
  // as dele quando a tela do cliente sai).
  useEffect(() => {
    const variaveis = variaveisDaMarca({
      logo: null,
      cor_primaria: primaria,
      cor_secundaria: secundaria,
    });
    const declaracoes = Object.entries(variaveis)
      .map(([nome, valor]) => `${nome}: ${valor} !important;`)
      .join(" ");
    if (!declaracoes) return;
    const estilo = document.createElement("style");
    estilo.dataset["marcaDaLoja"] = "";
    estilo.textContent = `:root { ${declaracoes} }`;
    document.head.appendChild(estilo);
    return () => estilo.remove();
  }, [primaria, secundaria]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <span className="flex min-w-0 items-center gap-2 text-label-lg text-foreground">
            {marca?.logo ? (
              <img
                src={urlLogo(marca.logo)}
                alt={fotografo || "Logo"}
                className="h-9 max-w-40 object-contain"
              />
            ) : (
              <>
                <Camera className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{fotografo || "Galeria de fotos"}</span>
              </>
            )}
          </span>
          {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-6 text-center text-caption text-muted-foreground">
        Galeria entregue com {BRAND.name}
      </footer>
    </div>
  );
}
