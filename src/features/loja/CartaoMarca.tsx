import { useEffect, useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/Campo";
import { cn } from "@/lib/utils";
import {
  TIPOS_LOGO,
  corDoTexto,
  ehHex,
  extrairCores,
  prepararLogo,
  urlLogo,
  validarLogo,
} from "@/lib/marca";
import { enviarLogo, removerLogo, type DadosLoja } from "./api";

type CamposMarca = Pick<DadosLoja, "logo_caminho" | "cor_primaria" | "cor_secundaria">;

/**
 * Logo e cores da loja. A logo sobe na hora (o caminho entra no formulário e
 * só vale depois de Salvar); as cores saem da logo como sugestão e podem ser
 * trocadas à mão.
 */
export function CartaoMarca({
  valores,
  logoSalva,
  organizacaoId,
  podeEditar,
  aoMudar,
}: {
  valores: CamposMarca;
  /** Logo gravada no banco: não é apagada antes de Salvar. */
  logoSalva: string;
  organizacaoId: string | null;
  podeEditar: boolean;
  aoMudar: (parcial: Partial<CamposMarca>) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [sugestoes, setSugestoes] = useState<string[]>([]);

  // Com uma logo já salva, as sugestões vêm dela ao abrir a tela.
  useEffect(() => {
    if (!logoSalva) return;
    let ativo = true;
    fetch(urlLogo(logoSalva))
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => extrairCores(blob))
      .then((cores) => ativo && setSugestoes(cores))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [logoSalva]);

  async function escolherLogo(arquivo: File | undefined) {
    if (!arquivo || !organizacaoId) return;
    const erro = validarLogo(arquivo);
    if (erro) {
      toast.error(erro);
      return;
    }
    setEnviando(true);
    try {
      const logo = await prepararLogo(arquivo);
      const [caminho, cores] = await Promise.all([
        enviarLogo(logo, organizacaoId),
        extrairCores(logo),
      ]);
      // Uma logo enviada e ainda não salva é trocada pela nova.
      if (valores.logo_caminho && valores.logo_caminho !== logoSalva) {
        void removerLogo(valores.logo_caminho);
      }
      setSugestoes(cores);
      aoMudar({
        logo_caminho: caminho,
        cor_primaria: cores[0] ?? valores.cor_primaria,
        cor_secundaria: cores[1] ?? cores[0] ?? valores.cor_secundaria,
      });
      toast.success("Logo enviada. Confira as cores e salve.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a logo.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  const desabilitado = !podeEditar || enviando;

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="text-heading-sm">Marca</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A logo aparece no topo da galeria e do pedido; as cores, nos botões e na seleção de fotos
          que o cliente vê.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted p-2">
          {valores.logo_caminho ? (
            <img
              src={urlLogo(valores.logo_caminho)}
              alt="Logo da loja"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={entrada}
            type="file"
            accept={TIPOS_LOGO.join(",")}
            className="sr-only"
            disabled={desabilitado}
            onChange={(e) => void escolherLogo(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={desabilitado || !organizacaoId}
            onClick={() => entrada.current?.click()}
          >
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {valores.logo_caminho ? "Trocar logo" : "Enviar logo"}
          </Button>
          {valores.logo_caminho && (
            <Button
              type="button"
              variant="ghost"
              disabled={desabilitado}
              onClick={() => aoMudar({ logo_caminho: "" })}
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          )}
        </div>
        <p className="w-full text-caption text-muted-foreground">
          PNG com fundo transparente fica melhor. JPG e WebP também servem.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SeletorCor
          id="cor-primaria"
          rotulo="Cor principal"
          dica="Botões e seleção de fotos."
          valor={valores.cor_primaria}
          sugestoes={sugestoes}
          desabilitado={desabilitado}
          aoMudar={(cor) => aoMudar({ cor_primaria: cor })}
        />
        <SeletorCor
          id="cor-secundaria"
          rotulo="Cor de apoio"
          dica="Detalhes e degradê."
          valor={valores.cor_secundaria}
          sugestoes={sugestoes}
          desabilitado={desabilitado}
          aoMudar={(cor) => aoMudar({ cor_secundaria: cor })}
        />
      </div>

      <PreviaMarca valores={valores} />
    </Card>
  );
}

function SeletorCor({
  id,
  rotulo,
  dica,
  valor,
  sugestoes,
  desabilitado,
  aoMudar,
}: {
  id: string;
  rotulo: string;
  dica: string;
  valor: string;
  sugestoes: string[];
  desabilitado: boolean;
  aoMudar: (cor: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);

  return (
    <Campo rotulo={rotulo} htmlFor={id} dica={dica}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${rotulo}: escolher no seletor`}
          value={ehHex(valor) ? valor : "#000000"}
          disabled={desabilitado}
          onChange={(e) => aoMudar(e.target.value.toLowerCase())}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1 disabled:cursor-not-allowed"
        />
        <Input
          id={id}
          placeholder="Padrão do sistema"
          maxLength={7}
          value={texto}
          disabled={desabilitado}
          onChange={(e) => {
            const v = e.target.value.trim().toLowerCase();
            setTexto(v);
            if (v === "" || ehHex(v)) aoMudar(v);
          }}
        />
      </div>
      {sugestoes.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 pt-1"
          role="group"
          aria-label={`Sugestões para ${rotulo}`}
        >
          {sugestoes.map((cor) => (
            <button
              key={cor}
              type="button"
              disabled={desabilitado}
              title={cor}
              aria-label={`Usar ${cor}`}
              onClick={() => aoMudar(cor)}
              style={{ backgroundColor: cor, color: corDoTexto(cor) }}
              className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-full border border-border disabled:cursor-not-allowed",
                cor === valor && "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
            >
              {cor === valor && <Check className="size-3.5" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </Campo>
  );
}

/** Miniatura do topo da galeria com a marca, para conferir antes de salvar. */
function PreviaMarca({ valores }: { valores: CamposMarca }) {
  const primaria = ehHex(valores.cor_primaria) ? valores.cor_primaria : null;
  const secundaria = ehHex(valores.cor_secundaria) ? valores.cor_secundaria : primaria;
  return (
    <div className="space-y-2">
      <p className="text-caption text-muted-foreground">Prévia na tela do cliente</p>
      {/* A prévia é sempre clara, como a galeria do cliente. */}
      <div className="overflow-hidden rounded-lg border border-border bg-white text-neutral-900">
        <div className="flex h-12 items-center justify-between border-b border-neutral-200 px-4">
          {valores.logo_caminho ? (
            <img
              src={urlLogo(valores.logo_caminho)}
              alt=""
              className="h-7 max-w-32 object-contain"
            />
          ) : (
            <span className="text-sm font-medium">Sua loja</span>
          )}
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={
              primaria
                ? { backgroundColor: primaria, color: corDoTexto(primaria) }
                : { backgroundColor: "#171717", color: "#ffffff" }
            }
          >
            2 fotos · R$ 30,00
          </span>
        </div>
        <div
          className="h-2"
          style={{
            background:
              primaria && secundaria
                ? `linear-gradient(to right, ${primaria}, ${secundaria})`
                : "var(--muted)",
          }}
        />
      </div>
    </div>
  );
}
