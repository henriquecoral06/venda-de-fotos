import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { num } from "@/lib/format";
import { CHAVE_GALERIAS, analisarFotosPendentes, useResumoRostos, type Autoria } from "./api";

/**
 * Situação da busca por selfie numa galeria de evento: quantas fotos já
 * tiveram os rostos procurados e quantos rostos há. Fotos enviadas antes de a
 * galeria virar evento ficam pendentes até o botão rodar.
 */
export function CartaoRostos({ galeriaId, autoria }: { galeriaId: string; autoria: Autoria }) {
  const qc = useQueryClient();
  const resumo = useResumoRostos(galeriaId, true);
  const [andamento, setAndamento] = useState<{ feitas: number; total: number } | null>(null);

  async function analisar() {
    setAndamento({ feitas: 0, total: 0 });
    try {
      const r = await analisarFotosPendentes(galeriaId, autoria, (feitas, total) =>
        setAndamento({ feitas, total }),
      );
      toast.success(
        `${num(r.fotos)} foto${r.fotos === 1 ? "" : "s"} analisada${r.fotos === 1 ? "" : "s"}, ${num(r.rostos)} rosto${r.rostos === 1 ? "" : "s"} encontrado${r.rostos === 1 ? "" : "s"}.`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível analisar as fotos.");
    } finally {
      setAndamento(null);
      await qc.invalidateQueries({ queryKey: [...CHAVE_GALERIAS, "rostos", galeriaId] });
    }
  }

  const pendentes = resumo.data ? resumo.data.totalFotos - resumo.data.analisadas : 0;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="flex items-start gap-3">
        <ScanFace className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="text-label-md text-foreground">Busca por selfie</p>
          {resumo.isPending ? (
            <Skeleton className="h-4 w-56" />
          ) : resumo.isError ? (
            <p className="text-sm text-danger">{resumo.error.message}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {num(resumo.data.rostos)} rosto{resumo.data.rostos === 1 ? "" : "s"} em{" "}
              {num(resumo.data.analisadas)} de {num(resumo.data.totalFotos)} fotos analisadas.
              {pendentes > 0 && ` ${num(pendentes)} ainda sem análise.`}
            </p>
          )}
        </div>
      </div>
      {andamento ? (
        <div className="w-full space-y-1.5 sm:w-64">
          <Progress
            value={andamento.total ? Math.round((andamento.feitas / andamento.total) * 100) : 0}
            aria-label="Andamento da análise de rostos"
          />
          <p className="text-caption text-muted-foreground">
            Analisando {num(andamento.feitas)} de {num(andamento.total)}… Não feche esta página.
          </p>
        </div>
      ) : (
        pendentes > 0 && (
          <Button variant="outline" onClick={() => void analisar()}>
            {andamento ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ScanFace className="size-4" />
            )}
            Procurar rostos nas fotos
          </Button>
        )
      )}
    </Card>
  );
}
