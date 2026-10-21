import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { rotuloFotos } from "@/lib/fotos";
import { CHAVE_GALERIAS, enviarFoto, type Autoria } from "./api";
import { TIPOS_ACEITOS, validarArquivo } from "./imagens";

/** Envios simultâneos: o canvas pesa na memória com fotos de 40 MP. */
const SIMULTANEOS = 3;

interface Falha {
  arquivo: File;
  motivo: string;
}

interface Andamento {
  total: number;
  concluidas: number;
}

/** Mesmo nome e tamanho = a mesma foto: o reenvio de uma pasta continua de onde parou. */
const chaveDoArquivo = (nome: string, tamanho: number) => `${nome}:${tamanho}`;

/** Falha de rede passageira: tenta mais uma vez. */
async function comUmaNovaTentativa<T>(acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch {
    await new Promise((r) => setTimeout(r, 1500));
    return acao();
  }
}

export function EnvioFotos({
  galeriaId,
  autoria,
  marca,
  proximaOrdem,
  existentes,
}: {
  galeriaId: string;
  autoria: Autoria;
  /** Texto da marca d'água; nulo = prévias sem marca. */
  marca: string | null;
  proximaOrdem: number;
  /** Fotos que já estão na galeria, para não subir de novo. */
  existentes: { nome_arquivo: string; tamanho_bytes: number }[];
}) {
  const qc = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const [falhas, setFalhas] = useState<Falha[]>([]);
  const enviando = andamento !== null && andamento.concluidas < andamento.total;

  // Fechar ou recarregar a aba no meio interrompe o envio.
  useEffect(() => {
    if (!enviando) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [enviando]);

  async function enviar(lista: File[]) {
    if (lista.length === 0 || enviando) return;
    const jaEnviadas = new Set(
      existentes.map((f) => chaveDoArquivo(f.nome_arquivo, f.tamanho_bytes)),
    );
    const invalidas: Falha[] = [];
    const validos: File[] = [];
    let repetidas = 0;
    for (const arquivo of lista) {
      const motivo = validarArquivo(arquivo);
      if (motivo) invalidas.push({ arquivo, motivo });
      else if (jaEnviadas.has(chaveDoArquivo(arquivo.name, arquivo.size))) repetidas += 1;
      else validos.push(arquivo);
    }
    setFalhas(invalidas);
    if (repetidas > 0) {
      toast.info(
        `${rotuloFotos(repetidas)} já ${repetidas === 1 ? "estava" : "estavam"} na galeria e ${repetidas === 1 ? "ficou" : "ficaram"} de fora.`,
      );
    }
    if (validos.length === 0) {
      if (invalidas.length > 0) toast.error("Nenhuma foto pôde ser enviada. Veja a lista abaixo.");
      return;
    }

    const estado: Andamento = { total: validos.length, concluidas: 0 };
    const novasFalhas: Falha[] = [];
    setAndamento({ ...estado });

    const atualizarLista = () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS });
    let proximo = 0;
    async function trabalhador() {
      while (proximo < validos.length) {
        const indice = proximo++;
        const arquivo = validos[indice];
        if (!arquivo) continue;
        try {
          await comUmaNovaTentativa(() =>
            enviarFoto({
              arquivo,
              galeria: { id: galeriaId },
              autoria,
              marca,
              ordem: proximaOrdem + indice,
            }),
          );
        } catch (e: unknown) {
          novasFalhas.push({
            arquivo,
            motivo: e instanceof Error ? e.message : `${arquivo.name}: o envio falhou.`,
          });
          setFalhas([...invalidas, ...novasFalhas]);
        }
        estado.concluidas += 1;
        setAndamento({ ...estado });
        if (estado.concluidas % 6 === 0) void atualizarLista();
      }
    }

    await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, validos.length) }, trabalhador));
    await atualizarLista();

    const certas = estado.total - novasFalhas.length;
    if (certas > 0) {
      toast.success(`${rotuloFotos(certas)} enviada${certas === 1 ? "" : "s"}.`);
    }
    if (novasFalhas.length > 0) {
      toast.error(`${rotuloFotos(novasFalhas.length)} não subiram. Veja a lista e tente de novo.`);
    }
    if (entrada.current) entrada.current.value = "";
  }

  const porcentagem = andamento ? Math.round((andamento.concluidas / andamento.total) * 100) : 0;
  const repetiveis = falhas.filter((f) => validarArquivo(f.arquivo) === null);

  return (
    <div className="space-y-3">
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
          void enviar(Array.from(e.dataTransfer.files));
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
            onChange={(e) => void enviar(Array.from(e.target.files ?? []))}
          />
          {enviando ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="text-label-md text-foreground">
            {enviando
              ? `Enviando ${andamento.concluidas} de ${andamento.total}. Não feche esta aba.`
              : "Arraste as fotos aqui ou clique para escolher"}
          </span>
          <span className="max-w-2xl text-caption text-muted-foreground">
            JPG, PNG ou WebP, até 50 MB cada.{" "}
            {marca
              ? `O cliente vê uma prévia com a marca d'água “${marca}”; o original só é liberado depois do pagamento.`
              : "O cliente vê uma prévia sem marca d'água; o original só é liberado depois do pagamento."}{" "}
            Se o envio parar, escolha as mesmas fotos de novo: as que já subiram ficam de fora.
          </span>
        </label>
        {enviando && (
          <div className="px-8 pb-6">
            <Progress value={porcentagem} aria-label="Andamento do envio" />
          </div>
        )}
      </Card>

      {falhas.length > 0 && !enviando && (
        <Card className="space-y-3 p-4" role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-label-md text-foreground">
              <AlertCircle className="size-4 text-danger" aria-hidden="true" />
              {rotuloFotos(falhas.length)} não {falhas.length === 1 ? "subiu" : "subiram"}
            </p>
            <div className="flex gap-2">
              {repetiveis.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void enviar(repetiveis.map((f) => f.arquivo))}
                >
                  <RotateCcw className="size-4" />
                  Tentar de novo
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                aria-label="Fechar a lista de falhas"
                onClick={() => setFalhas([])}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-caption text-muted-foreground">
            {falhas.map((f) => (
              <li key={`${f.arquivo.name}:${f.arquivo.size}`}>{f.motivo}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
