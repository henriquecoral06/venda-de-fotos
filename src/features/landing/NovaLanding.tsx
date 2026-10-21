import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/Campo";
import { gerarSlug } from "@/lib/fotos";
import { cn } from "@/lib/utils";
import type { VitrinePublica } from "@/features/vitrine/api";
import { montarDados, useCriarLanding, type LandingPage } from "./api";
import { PreviaEscalada } from "./PreviaEscalada";
import { INFO_MODELO, MODELOS, conteudoInicial, type ModeloLanding } from "./tipos";

const nada = () => undefined;

/** Escolha do modelo (com prévia de cada um) e do nome e link da landing. */
export function NovaLanding({
  aberto,
  aoMudarAberto,
  autoria,
  vitrine,
  nomeLoja,
  whatsapp,
  aoCriar,
}: {
  aberto: boolean;
  aoMudarAberto: (v: boolean) => void;
  autoria: { userId: string; organizacaoId: string | null };
  vitrine: VitrinePublica | undefined;
  nomeLoja: string;
  whatsapp: string;
  aoCriar: (landing: LandingPage) => void;
}) {
  const criar = useCriarLanding(autoria);
  const [modelo, setModelo] = useState<ModeloLanding>("editorial");
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);

  const previas = useMemo(
    () =>
      Object.fromEntries(
        MODELOS.map((m) => [
          m,
          montarDados({
            modelo: m,
            cores: INFO_MODELO[m].cores,
            conteudo: conteudoInicial(m, nomeLoja),
            marca: vitrine?.marca,
            whatsapp,
            eventos: vitrine?.eventos ?? [],
            aoClicarCta: nada,
            aoClicarEvento: nada,
          }),
        ]),
      ) as Record<ModeloLanding, ReturnType<typeof montarDados>>,
    [vitrine, nomeLoja, whatsapp],
  );

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    criar.mutate(
      {
        titulo,
        slug,
        modelo,
        cores: INFO_MODELO[modelo].cores,
        conteudo: conteudoInicial(modelo, nomeLoja),
      },
      {
        onSuccess: (nova) => {
          toast.success("Landing page criada. Personalize e publique.");
          aoMudarAberto(false);
          aoCriar(nova);
        },
        onError: (erro: Error) => toast.error(erro.message),
      },
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !criar.isPending && aoMudarAberto(v)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <form onSubmit={confirmar} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nova landing page</DialogTitle>
            <DialogDescription>
              Escolha um modelo. Textos, fotos e cores você troca depois, no editor.
            </DialogDescription>
          </DialogHeader>

          <div role="radiogroup" aria-label="Modelo" className="grid gap-3 sm:grid-cols-2">
            {MODELOS.map((m) => {
              const marcado = m === modelo;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  onClick={() => setModelo(m)}
                  className={cn(
                    "cursor-pointer overflow-hidden rounded-xl border text-left transition-colors",
                    marcado
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <PreviaEscalada dados={previas[m]} altura={170} />
                  <div className="flex items-start justify-between gap-2 border-t border-border p-3">
                    <div>
                      <p className="text-label-md text-foreground">{INFO_MODELO[m].nome}</p>
                      <p className="text-caption text-muted-foreground">
                        {INFO_MODELO[m].descricao}
                      </p>
                    </div>
                    {marcado && (
                      <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome (só para você)" htmlFor="titulo-landing">
              <Input
                id="titulo-landing"
                required
                minLength={2}
                maxLength={120}
                placeholder="Anúncio casamentos outubro"
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  if (!slugManual) setSlug(gerarSlug(e.target.value));
                }}
              />
            </Campo>
            <Campo rotulo="Link" htmlFor="slug-landing" dica={`Endereço: /l/${slug || "seu-link"}`}>
              <Input
                id="slug-landing"
                required
                minLength={3}
                maxLength={80}
                value={slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setSlug(gerarSlug(e.target.value));
                }}
              />
            </Campo>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={criar.isPending}
              onClick={() => aoMudarAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending && <Loader2 className="size-4 animate-spin" />}
              Criar e editar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
