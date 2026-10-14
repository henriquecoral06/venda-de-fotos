import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Cartão selecionável, para grades de opções (seleção única ou múltipla). */
export function CardOpcao({
  titulo,
  descricao,
  selecionado,
  onSelecionar,
}: {
  titulo: string;
  descricao?: string;
  selecionado: boolean;
  onSelecionar: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={onSelecionar}
      className="h-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card
        className={cn(
          "h-full gap-1 p-3 transition-colors duration-150",
          selecionado
            ? "border-primary bg-primary/5"
            : "border-input hover:border-foreground/25 hover:bg-secondary/60",
        )}
      >
        <span
          className={cn("block text-label-lg", selecionado ? "text-primary" : "text-foreground")}
        >
          {titulo}
        </span>
        {descricao && (
          <span className="mt-1 block text-caption text-muted-foreground">{descricao}</span>
        )}
      </Card>
    </button>
  );
}
