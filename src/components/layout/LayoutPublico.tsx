import type { ReactNode } from "react";
import { Camera } from "lucide-react";
import { BRAND } from "@/config/brand";

/**
 * Casca das telas do cliente final (galeria e pedido): barra com o nome do
 * fotógrafo e rodapé discreto. Sempre clara (`PREFIXOS_SEMPRE_CLAROS` em
 * `__root.tsx`); a largura é de cada tela.
 */
export function LayoutPublico({
  fotografo,
  acoes,
  children,
}: {
  fotografo: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <span className="flex min-w-0 items-center gap-2 text-label-lg text-foreground">
            <Camera className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{fotografo || "Galeria de fotos"}</span>
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
