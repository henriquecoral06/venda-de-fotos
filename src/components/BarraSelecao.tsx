import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Barra das ações em massa, mostrada no lugar dos filtros enquanto há linhas
 * marcadas na `Tabela` (estilo Gerenciador de Anúncios).
 */
export function BarraSelecao({
  quantidade,
  singular,
  plural,
  aoLimpar,
  children,
}: {
  quantidade: number;
  singular: string;
  plural: string;
  aoLimpar: () => void;
  /** Botões das ações (`variant="outline"`; excluir com `ghost` e cor de perigo). */
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-2 px-3 py-2">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Limpar seleção"
        onClick={aoLimpar}
      >
        <X className="size-4" />
      </Button>
      <span className="mr-2 text-label-md text-foreground">
        {quantidade.toLocaleString("pt-BR")} {quantidade === 1 ? singular : plural}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </Card>
  );
}
