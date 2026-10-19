import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { rotuloFotos } from "@/lib/fotos";
import { CHAVE_GALERIAS, enviarFoto, type Autoria } from "./api";
import { TIPOS_ACEITOS, validarArquivo } from "./imagens";

/** Envios simultâneos: o canvas pesa na memória com fotos de 40 MP. */
const SIMULTANEOS = 3;

interface Andamento {
  total: number;
  concluidas: number;
  falhas: string[];
  rostos: number;
}

export function EnvioFotos({
  galeriaId,
  autoria,
  marca,
  proximaOrdem,
  indexarRostos,
}: {
  galeriaId: string;
  autoria: Autoria;
  marca: string;
  proximaOrdem: number;
  /** Galeria de evento com busca por selfie: procura rostos em cada foto. */
  indexarRostos: boolean;
}) {
  const qc = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const enviando = andamento !== null && andamento.concluidas < andamento.total;

  async function enviar(lista: FileList | null) {
    if (!lista || lista.length === 0 || enviando) return;
    const arquivos = Array.from(lista);
    const invalidos = arquivos.map(validarArquivo).filter((m): m is string => m !== null);
    const validos = arquivos.filter((a) => validarArquivo(a) === null);
    for (const m of invalidos.slice(0, 3)) toast.error(m);
    if (validos.length === 0) return;

    const estado: Andamento = { total: validos.length, concluidas: 0, falhas: [], rostos: 0 };
    setAndamento({ ...estado });

    const atualizarLista = () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS });
    let proximo = 0;
    async function trabalhador() {
      while (proximo < validos.length) {
        const indice = proximo++;
        const arquivo = validos[indice];
        if (!arquivo) continue;
        try {
          estado.rostos += await enviarFoto({
            arquivo,
            galeria: { id: galeriaId },
            autoria,
            marca,
            ordem: proximaOrdem + indice,
            indexarRostos,
          });
        } catch (e: unknown) {
          estado.falhas.push(e instanceof Error ? e.message : `${arquivo.name}: falhou.`);
        }
        estado.concluidas += 1;
        setAndamento({ ...estado, falhas: [...estado.falhas] });
        if (estado.concluidas % 6 === 0) void atualizarLista();
      }
    }

    await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, validos.length) }, trabalhador));
    await atualizarLista();

    const certas = estado.total - estado.falhas.length;
    if (certas > 0) {
      const enviadas = `${rotuloFotos(certas)} enviada${certas === 1 ? "" : "s"}`;
      toast.success(
        indexarRostos
          ? `${enviadas}, ${estado.rostos.toLocaleString("pt-BR")} rosto${estado.rostos === 1 ? "" : "s"} encontrado${estado.rostos === 1 ? "" : "s"}.`
          : `${enviadas}.`,
      );
    }
    for (const m of estado.falhas.slice(0, 3)) toast.error(m);
    if (entrada.current) entrada.current.value = "";
  }

  const porcentagem = andamento ? Math.round((andamento.concluidas / andamento.total) * 100) : 0;

  return (
    <Card
      className={cn(
        "border-dashed p-0 transition-colors",
        arrastando && "border-primary bg-primary/5",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        void enviar(e.dataTransfer.files);
      }}
    >
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 p-8 text-center",
          enviando && "cursor-progress",
        )}
      >
        <input
          ref={entrada}
          type="file"
          multiple
          accept={TIPOS_ACEITOS.join(",")}
          className="sr-only"
          disabled={enviando}
          onChange={(e) => void enviar(e.target.files)}
        />
        {enviando ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="text-label-md text-foreground">
          {enviando
            ? `Enviando ${andamento.concluidas} de ${andamento.total}…`
            : "Arraste as fotos aqui ou clique para escolher"}
        </span>
        <span className="text-caption text-muted-foreground">
          JPG, PNG ou WebP até 50 MB. A prévia com a marca d'água “{marca}” é gerada no seu
          navegador; o original fica guardado e só é liberado após o pagamento.
          {indexarRostos &&
            " Os rostos também são encontrados aqui, para a busca por selfie (a primeira foto demora um pouco mais: o reconhecimento é baixado uma vez)."}
        </span>
      </label>
      {enviando && (
        <div className="px-8 pb-6">
          <Progress value={porcentagem} aria-label="Andamento do envio" />
        </div>
      )}
    </Card>
  );
}
