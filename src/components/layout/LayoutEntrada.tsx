import type { ReactNode } from "react";
import { Download, Images, Wallet } from "lucide-react";
import { LogoSimbolo } from "@/components/ui/logo-simbolo";
import { BRAND } from "@/config/brand";

const DESTAQUES = [
  { icone: Images, texto: "Galerias com marca d'água, senha e link próprio para cada cliente" },
  { icone: Wallet, texto: "O cliente escolhe as fotos e paga por foto ou pelo pacote completo" },
  { icone: Download, texto: "Download em alta resolução liberado assim que o pagamento cai" },
];

/**
 * Casca das telas públicas (entrada e nova senha): painel de marca escuro à
 * esquerda a partir de `lg`, conteúdo à direita. Estas telas são sempre claras
 * (`ROTAS_SEMPRE_CLARAS` em `__root.tsx`).
 */
export function LayoutEntrada({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* ── Painel de marca (deliberadamente escuro nos dois temas) ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 p-10 text-neutral-50 lg:flex">
        <div className="relative flex items-center gap-3">
          <LogoSimbolo className="size-10" title="" />
          <span className="text-base font-semibold tracking-tight">{BRAND.name}</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <div>
            <h1 className="text-[34px] font-semibold leading-tight tracking-tight">
              {BRAND.tagline}
            </h1>
            <p className="mt-3 text-[15px] text-neutral-400">
              Entre com a sua conta para gerenciar galerias, pedidos e vendas.
            </p>
          </div>
          <div className="space-y-4">
            {DESTAQUES.map((d) => (
              <div key={d.texto} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-neutral-800">
                  <d.icone size={16} strokeWidth={1.75} className="text-neutral-200" />
                </div>
                <span className="text-[13px] text-neutral-300">{d.texto}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative font-mono text-[11px] text-neutral-500">
          Powered by {BRAND.company}
        </p>
      </div>

      {/* ── Conteúdo ── */}
      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2 lg:items-start">
            <LogoSimbolo className="size-12 lg:hidden" />
            <h2 className="text-2xl font-bold tracking-tight">{titulo}</h2>
            <p className="text-center text-sm text-muted-foreground lg:text-left">{descricao}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
