import { CampoData } from "@/components/CampoData";
import { cn } from "@/lib/utils";

export interface Intervalo {
  /** ISO `AAAA-MM-DD`; vazio = sem limite. */
  inicio: string;
  fim: string;
}

/**
 * Par de datas travado por construção: o `max` da inicial é a final e o `min`
 * da final é a inicial. Um preset de período (7/14/30 dias) escreve neste
 * mesmo estado; o intervalo é a fonte da verdade.
 */
export function IntervaloDatas({
  valor,
  aoMudar,
  min,
  max,
  rotuloAria = "Intervalo de datas",
  className,
}: {
  valor: Intervalo;
  aoMudar: (valor: Intervalo) => void;
  min?: string;
  max?: string;
  rotuloAria?: string;
  className?: string;
}) {
  const { inicio, fim } = valor;
  const maxInicio = fim || max;
  const minFim = inicio || min;

  return (
    <div
      role="group"
      aria-label={rotuloAria}
      className={cn("inline-flex flex-wrap items-center gap-2", className)}
    >
      <CampoData
        value={inicio}
        {...(min ? { min } : {})}
        {...(maxInicio ? { max: maxInicio } : {})}
        onChange={(e) => aoMudar({ inicio: e.target.value, fim })}
        aria-label="Data inicial"
      />
      <span className="text-caption text-mute" aria-hidden="true">
        até
      </span>
      <CampoData
        value={fim}
        {...(minFim ? { min: minFim } : {})}
        {...(max ? { max } : {})}
        onChange={(e) => aoMudar({ inicio, fim: e.target.value })}
        aria-label="Data final"
      />
    </div>
  );
}
