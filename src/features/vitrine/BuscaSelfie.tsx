import { useRef, useState } from "react";
import { Camera, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLASSE_BOTAO_MARCA } from "@/lib/marca";
import { rostoDaSelfie } from "@/lib/rostos";
import { cn } from "@/lib/utils";
import { buscarFotosPorRosto, type FotoEncontrada } from "./api";

type Etapa = "aguardando" | "lendo" | "buscando";

const TEXTO_ETAPA: Record<Etapa, string> = {
  aguardando: "",
  lendo: "Lendo o seu rosto…",
  buscando: "Procurando nas fotos do evento…",
};

/**
 * Busca por selfie com consentimento (LGPD): a selfie é lida no navegador e só
 * o vetor do rosto vai para a busca. Nada é gravado.
 */
export function BuscaSelfie({
  aberto,
  aoMudarAberto,
  slug,
  senha,
  aoEncontrar,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  slug: string;
  senha: string;
  aoEncontrar: (fotos: FotoEncontrada[]) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [consentiu, setConsentiu] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("aguardando");
  const [erro, setErro] = useState<string | null>(null);
  const ocupado = etapa !== "aguardando";

  async function buscar(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    try {
      setEtapa("lendo");
      const rosto = await rostoDaSelfie(arquivo);
      setEtapa("buscando");
      aoEncontrar(await buscarFotosPorRosto(slug, senha, rosto));
      aoMudarAberto(false);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível fazer a busca.");
    } finally {
      setEtapa("aguardando");
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !ocupado && aoMudarAberto(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Encontre as suas fotos</DialogTitle>
          <DialogDescription>
            Tire uma selfie de frente, com o rosto bem iluminado. Mostramos só as fotos do evento em
            que você aparece.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <p className="text-caption text-muted-foreground">
            A selfie é analisada aqui no seu aparelho e não é enviada nem guardada. Para a busca,
            sai daqui apenas uma sequência de números que descreve o rosto, usada uma vez e
            descartada.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
          <Checkbox
            checked={consentiu}
            onCheckedChange={(v) => setConsentiu(v === true)}
            disabled={ocupado}
            className="mt-0.5"
          />
          <span>Autorizo o uso da minha selfie para procurar as minhas fotos neste evento.</span>
        </label>

        {erro && (
          <p className="text-sm text-danger" role="alert">
            {erro}
          </p>
        )}

        <input
          ref={entrada}
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          onChange={(e) => void buscar(e.target.files?.[0])}
        />

        <DialogFooter>
          <Button
            className={cn("w-full", CLASSE_BOTAO_MARCA)}
            disabled={!consentiu || ocupado}
            onClick={() => entrada.current?.click()}
          >
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {ocupado ? TEXTO_ETAPA[etapa] : "Tirar ou escolher selfie"}
          </Button>
        </DialogFooter>
        {ocupado && etapa === "lendo" && (
          <p className="text-center text-caption text-muted-foreground">
            Na primeira vez o reconhecimento é baixado (cerca de 7 MB). Depois fica mais rápido.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
