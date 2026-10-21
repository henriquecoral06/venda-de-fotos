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

type CamposMarca = Pick<
  DadosLoja,
  "logo_caminho" | "logo_escuro_caminho" | "cor_primaria" | "cor_secundaria"
>;

/**
 * Logo e cores da loja. A logo sobe na hora (o caminho entra no formulário e
 * só vale depois de Salvar); as cores saem da logo como sugestão e podem ser
 * trocadas à mão.
 */
export function CartaoMarca({
  valores,
  logoSalva,
  logoEscuroSalva,
  organizacaoId,
  podeEditar,
  aoMudar,
}: {
  valores: CamposMarca;
  /** Logos gravadas no banco: não são apagadas antes de Salvar. */
  logoSalva: string;
  logoEscuroSalva: string;
  organizacaoId: string | null;
  podeEditar: boolean;
  aoMudar: (parcial: Partial<CamposMarca>) => void;
}) {
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

  const desabilitado = !podeEditar;

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="text-heading-sm">Marca</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A logo aparece no topo da galeria e do pedido; as cores, nos botões e na seleção de fotos
          que o cliente vê.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <EnvioLogo
          titulo="Logo para fundo claro"
          dica="A principal: galeria, pedido e landing pages de fundo claro. Sugere as cores."
          fundo="claro"
          caminho={valores.logo_caminho}
          salvo={logoSalva}
          organizacaoId={organizacaoId}
          desabilitado={desabilitado}
          aoMudar={(caminho, cores) =>
            aoMudar({
              logo_caminho: caminho,
              ...(cores && cores.length > 0
                ? {
                    cor_primaria: cores[0] ?? valores.cor_primaria,
                    cor_secundaria: cores[1] ?? cores[0] ?? valores.cor_secundaria,
                  }
                : {}),
            })
          }
          aoSugerirCores={setSugestoes}
        />
        <EnvioLogo
          titulo="Logo para fundo escuro"
          dica="Versão clara da logo, para landing pages de fundo escuro e capas com foto. Sem ela, vale a de fundo claro."
          fundo="escuro"
          caminho={valores.logo_escuro_caminho}
          salvo={logoEscuroSalva}
          organizacaoId={organizacaoId}
          desabilitado={desabilitado}
          aoMudar={(caminho) => aoMudar({ logo_escuro_caminho: caminho })}
        />
        <p className="text-caption text-muted-foreground sm:col-span-2">
          SVG ou PNG com fundo transparente ficam melhor. JPG e WebP também servem.
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

/**
 * Uma logo: envia na hora (o caminho só vale depois de Salvar) e mostra sobre
 * o fundo em que ela vai aparecer. As cores fixas da caixa são de propósito:
 * a prévia é "fundo claro" e "fundo escuro" nos dois temas do painel.
 */
function EnvioLogo({
  titulo,
  dica,
  fundo,
  caminho,
  salvo,
  organizacaoId,
  desabilitado,
  aoMudar,
  aoSugerirCores,
}: {
  titulo: string;
  dica: string;
  fundo: "claro" | "escuro";
  caminho: string;
  salvo: string;
  organizacaoId: string | null;
  desabilitado: boolean;
  aoMudar: (caminho: string, cores?: string[]) => void;
  /** Só a logo principal sugere as cores da marca. */
  aoSugerirCores?: (cores: string[]) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo || !organizacaoId) return;
    const erro = validarLogo(arquivo);
    if (erro) {
      toast.error(erro);
      return;
    }
    setEnviando(true);
    try {
      const logo = await prepararLogo(arquivo);
      const [novo, cores] = await Promise.all([
        enviarLogo(logo, organizacaoId),
        aoSugerirCores ? extrairCores(logo) : Promise.resolve(undefined),
      ]);
      // Uma logo enviada e ainda não salva é trocada pela nova.
      if (caminho && caminho !== salvo) void removerLogo(caminho);
      if (cores) aoSugerirCores?.(cores);
      aoMudar(novo, cores);
      toast.success(
        aoSugerirCores
          ? "Logo enviada. Confira as cores e salve."
          : "Logo enviada. Salve para valer.",
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a logo.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-label-md text-foreground">{titulo}</p>
      <div
        className={cn(
          "flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-border p-2",
          fundo === "claro" ? "bg-white" : "bg-neutral-900",
        )}
      >
        {caminho ? (
          <img
            src={urlLogo(caminho)}
            alt={titulo}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <ImageIcon
            className={cn("size-6", fundo === "claro" ? "text-neutral-400" : "text-neutral-500")}
            aria-hidden="true"
          />
        )}
      </div>
      <p className="text-caption text-muted-foreground">{dica}</p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={entrada}
          type="file"
          accept={TIPOS_LOGO.join(",")}
          className="sr-only"
          disabled={desabilitado || enviando}
          onChange={(e) => void escolher(e.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={desabilitado || enviando || !organizacaoId}
          onClick={() => entrada.current?.click()}
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {caminho ? "Trocar" : "Enviar"}
        </Button>
        {caminho && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={desabilitado || enviando}
            onClick={() => aoMudar("")}
          >
            <Trash2 className="size-4" />
            Remover
          </Button>
        )}
      </div>
    </div>
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
