import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CartaoMetricaProps {
  rotulo: string;
  /** Número (formatado com `num`) ou texto já formatado, como "R$ 284.320". */
  valor: number | string;
  /** Variação em pontos percentuais, com sinal: 12.4, -1.8. */
  delta?: number;
  /**
   * Se subir é bom. `false` para métricas em que cair é a boa notícia
   * (reembolso, cancelamento, custo, churn).
   */
  melhorQuandoSobe?: boolean;
  /** Base nomeada da variação, como "vs. mês anterior". Só aparece com o delta. */
  comparacao?: string;
}

/**
 * Quadrante de número das métricas.
 *
 * A seta vem do sinal do `delta` e a cor vem de `delta × melhorQuandoSobe`: um
 * reembolso que sobe fica vermelho com a seta para cima. Sem base de
 * comparação não mostre delta.
 */
export function CartaoMetrica({
  rotulo,
  valor,
  delta,
  melhorQuandoSobe = true,
  comparacao,
}: CartaoMetricaProps) {
  const temDelta = typeof delta === "number" && Number.isFinite(delta);
  const subiu = temDelta && delta > 0;
  const estavel = temDelta && delta === 0;
  const bom = subiu === melhorQuandoSobe;

  const Seta = estavel ? Minus : subiu ? ArrowUpRight : ArrowDownRight;
  const tom = estavel ? "text-muted-foreground" : bom ? "text-emerald-deep" : "text-danger-deep";

  // Sinal explícito nos dois lados; o menos é U+2212, não hífen.
  const rotuloDelta = temDelta
    ? `${subiu ? "+" : estavel ? "" : "−"}${num(Math.abs(delta), 1)}%`
    : null;

  return (
    <Card className="p-5">
      <span className="text-caption font-medium uppercase tracking-label text-muted-foreground">
        {rotulo}
      </span>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p className="text-heading-lg tabular-nums text-foreground">
          {typeof valor === "number" ? num(valor) : valor}
        </p>
        {rotuloDelta && (
          <span className={cn("inline-flex items-center gap-0.5 text-label-md font-semibold", tom)}>
            <Seta className="size-3.5" aria-hidden="true" />
            {rotuloDelta}
          </span>
        )}
      </div>
      {comparacao && rotuloDelta && (
        <p className="mt-1 text-caption text-muted-foreground">{comparacao}</p>
      )}
    </Card>
  );
}

/** Esqueleto da grade de métricas (quatro cartões por padrão). */
export function SkeletonMetricas({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: quantidade }, (_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}
