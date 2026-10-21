import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Campo, CLASSE_ROTULO } from "@/components/Campo";
import { CampoData } from "@/components/CampoData";
import { ControleSegmentado } from "@/components/ControleSegmentado";
import { gerarSlug } from "@/lib/fotos";
import { ariaErro, errosPorCampo, focarPrimeiroErro, type ErrosDeCampo } from "@/lib/validacao";
import {
  ROTULO_STATUS_GALERIA,
  esquemaGaleria,
  useAtualizarGaleria,
  useCriarGaleria,
  type Autoria,
  type DadosGaleria,
  type Galeria,
  type StatusGaleria,
  type TipoGaleria,
} from "./api";

const OPCOES_TIPO = [
  { valor: "privada", rotulo: "Cliente" },
  { valor: "evento", rotulo: "Evento aberto" },
] as const;

const CATEGORIAS_SUGERIDAS = [
  "Futebol",
  "Corrida",
  "Ciclismo",
  "Vôlei",
  "Basquete",
  "Lutas",
  "Natação",
  "Formatura",
  "Festa",
  "Show",
  "Corporativo",
];

const OPCOES_STATUS = (["rascunho", "publicada", "arquivada"] as const).map((valor) => ({
  valor,
  rotulo: ROTULO_STATUS_GALERIA[valor],
}));

/** "12,5" ou "12.50" → 12.5. Vazio ou inválido → NaN (o zod recusa). */
function lerPreco(texto: string): number {
  const limpo = texto
    .trim()
    .replace(/\s|R\$/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  return limpo === "" ? Number.NaN : Number(limpo);
}

function mostrarPreco(valor: number | null | undefined): string {
  if (valor == null) return "";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Campo da tela de cada chave do esquema, na ordem em que aparecem. */
const ID_DO_CAMPO: [keyof DadosGaleria, string][] = [
  ["titulo", "titulo-galeria"],
  ["slug", "slug-galeria"],
  ["categoria", "categoria-galeria"],
  ["local", "local-galeria"],
  ["cliente_nome", "cliente-galeria"],
  ["cliente_email", "email-galeria"],
  ["data_evento", "data-galeria"],
  ["senha", "senha-galeria"],
  ["descricao", "descricao-galeria"],
  ["preco_foto", "preco-galeria"],
  ["preco_pacote", "pacote-galeria"],
];

/** Sufixo curto que evita colisão do nome interno entre galerias de mesmo título. */
function sufixoAleatorio(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Criar e editar no mesmo Dialog. `galeria` nula = criação. O pai monta com
 * `key` nova a cada abertura, então o estado parte sempre do registro certo.
 */
export function FormularioGaleria({
  aberto,
  aoMudarAberto,
  galeria,
  autoria,
  aoCriar,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  galeria: Galeria | null;
  autoria: Autoria;
  aoCriar?: (galeria: Galeria) => void;
}) {
  const [titulo, setTitulo] = useState(galeria?.titulo ?? "");
  const [slug, setSlug] = useState(galeria?.slug ?? "");
  // Na criação o link acompanha o título até a pessoa editá-lo.
  const [slugManual, setSlugManual] = useState(galeria !== null);
  const [descricao, setDescricao] = useState(galeria?.descricao ?? "");
  const [dataEvento, setDataEvento] = useState(galeria?.data_evento ?? "");
  const [clienteNome, setClienteNome] = useState(galeria?.cliente_nome ?? "");
  const [clienteEmail, setClienteEmail] = useState(galeria?.cliente_email ?? "");
  const [status, setStatus] = useState<StatusGaleria>(galeria?.status ?? "rascunho");
  const [senha, setSenha] = useState(galeria?.senha ?? "");
  const [precoFoto, setPrecoFoto] = useState(mostrarPreco(galeria?.preco_foto ?? 0));
  const [vendePacote, setVendePacote] = useState(galeria ? galeria.preco_pacote !== null : false);
  const [precoPacote, setPrecoPacote] = useState(mostrarPreco(galeria?.preco_pacote));
  const [tipo, setTipo] = useState<TipoGaleria>(galeria?.tipo ?? "privada");
  const [categoria, setCategoria] = useState(galeria?.categoria ?? "");
  const [local, setLocal] = useState(galeria?.local ?? "");
  const [downloadLiberado, setDownloadLiberado] = useState(galeria?.download_liberado ?? false);
  const [sufixo] = useState(sufixoAleatorio);
  const [erros, setErros] = useState<ErrosDeCampo<DadosGaleria>>({});
  const evento = tipo === "evento";

  const criar = useCriarGaleria(autoria);
  const atualizar = useAtualizarGaleria();
  const salvando = criar.isPending || atualizar.isPending;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    // Galeria de cliente abre pela chave secreta; o slug fica só como nome
    // interno, gerado do título na criação.
    const slugFinal =
      evento || galeria ? slug : `${gerarSlug(titulo).slice(0, 70) || "galeria"}-${sufixo}`;
    const dados: DadosGaleria = {
      titulo,
      slug: slugFinal,
      descricao,
      data_evento: dataEvento,
      cliente_nome: clienteNome,
      cliente_email: clienteEmail,
      status,
      senha,
      preco_foto: lerPreco(precoFoto),
      preco_pacote: vendePacote ? lerPreco(precoPacote) : null,
      tipo,
      categoria,
      local,
      download_liberado: downloadLiberado,
    };
    const conferido = esquemaGaleria.safeParse(dados);
    if (!conferido.success) {
      const porCampo = errosPorCampo(conferido.error);
      setErros(porCampo);
      focarPrimeiroErro(ID_DO_CAMPO.filter(([c]) => porCampo[c]).map(([, id]) => id));
      return;
    }
    setErros({});
    const aoErrar = (erro: Error) => {
      if (erro.message.startsWith("Já existe uma galeria com este link")) {
        setErros({ slug: erro.message });
        focarPrimeiroErro(["slug-galeria"]);
      } else {
        toast.error(erro.message);
      }
    };
    if (galeria) {
      atualizar.mutate(
        { id: galeria.id, dados },
        {
          onSuccess: () => {
            toast.success("Galeria atualizada.");
            aoMudarAberto(false);
          },
          onError: aoErrar,
        },
      );
    } else {
      criar.mutate(dados, {
        onSuccess: (nova) => {
          toast.success("Galeria criada. Agora envie as fotos.");
          aoMudarAberto(false);
          aoCriar?.(nova);
        },
        onError: aoErrar,
      });
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !salvando && aoMudarAberto(v)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <form onSubmit={salvar} noValidate className="flex min-h-0 flex-col">
          <DialogHeader className="border-b border-border p-5 pr-12 text-left">
            <DialogTitle>{galeria ? "Editar galeria" : "Nova galeria"}</DialogTitle>
            <DialogDescription>
              {evento
                ? "Evento aberto: aparece na sua vitrine de eventos para quem esteve lá achar e comprar as próprias fotos."
                : "O cliente abre a galeria pelo link. Só galerias publicadas aparecem para ele."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <Campo rotulo="Tipo">
              <ControleSegmentado
                opcoes={OPCOES_TIPO}
                valor={tipo}
                aoMudar={setTipo}
                rotuloAria="Tipo de galeria"
              />
            </Campo>

            <Campo rotulo="Título" htmlFor="titulo-galeria" erro={erros.titulo}>
              <Input
                id="titulo-galeria"
                maxLength={200}
                {...ariaErro("titulo-galeria", erros.titulo)}
                autoFocus
                placeholder={evento ? "Copa Verão de Futebol 2026" : "Casamento Ana e João"}
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  if (!slugManual) setSlug(gerarSlug(e.target.value));
                }}
              />
            </Campo>

            {evento && (
              <Campo
                rotulo="Endereço na vitrine"
                htmlFor="slug-galeria"
                dica={`/g/${slug || "nome-do-evento"}. Com senha, o evento sai da vitrine e abre só pelo link secreto.`}
                erro={erros.slug}
              >
                <Input
                  id="slug-galeria"
                  maxLength={80}
                  {...ariaErro("slug-galeria", erros.slug)}
                  value={slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setSlug(gerarSlug(e.target.value));
                  }}
                />
              </Campo>
            )}

            {evento ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Campo
                    rotulo="Categoria"
                    htmlFor="categoria-galeria"
                    dica="Agrupa os eventos na vitrine."
                  >
                    <Input
                      id="categoria-galeria"
                      list="categorias-sugeridas"
                      maxLength={60}
                      placeholder="Futebol"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                    />
                    <datalist id="categorias-sugeridas">
                      {CATEGORIAS_SUGERIDAS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Campo>
                  <Campo rotulo="Local" htmlFor="local-galeria">
                    <Input
                      id="local-galeria"
                      maxLength={120}
                      placeholder="Ginásio Municipal, Campinas"
                      value={local}
                      onChange={(e) => setLocal(e.target.value)}
                    />
                  </Campo>
                </div>
              </>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo rotulo="Cliente" htmlFor="cliente-galeria">
                  <Input
                    id="cliente-galeria"
                    maxLength={120}
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                  />
                </Campo>
                <Campo
                  rotulo="E-mail do cliente"
                  htmlFor="email-galeria"
                  erro={erros.cliente_email}
                >
                  <Input
                    id="email-galeria"
                    type="email"
                    maxLength={200}
                    {...ariaErro("email-galeria", erros.cliente_email)}
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                  />
                </Campo>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Campo rotulo="Data do evento" htmlFor="data-galeria">
                <CampoData
                  id="data-galeria"
                  className="w-full"
                  value={dataEvento}
                  onChange={(e) => setDataEvento(e.target.value)}
                />
              </Campo>
              <Campo
                rotulo="Senha de acesso"
                htmlFor="senha-galeria"
                dica={
                  evento
                    ? "Deixe em branco para o evento aparecer na vitrine."
                    : "Em branco, qualquer pessoa com o link abre."
                }
              >
                <Input
                  id="senha-galeria"
                  maxLength={60}
                  autoComplete="off"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </Campo>
            </div>

            <Campo
              rotulo={evento ? "Descrição do evento" : "Mensagem para o cliente"}
              htmlFor="descricao-galeria"
            >
              <Textarea
                id="descricao-galeria"
                rows={3}
                maxLength={2_000}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </Campo>

            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                rotulo="Preço por foto (R$)"
                htmlFor="preco-galeria"
                dica="Zero libera o download sem pagamento."
                erro={erros.preco_foto}
              >
                <Input
                  id="preco-galeria"
                  inputMode="decimal"
                  {...ariaErro("preco-galeria", erros.preco_foto)}
                  value={precoFoto}
                  onChange={(e) => setPrecoFoto(e.target.value)}
                />
              </Campo>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="pacote-galeria" className={CLASSE_ROTULO}>
                    Vender todas as fotos (R$)
                  </label>
                  <Switch
                    id="vende-pacote-galeria"
                    aria-label="Vender o pacote com todas as fotos"
                    checked={vendePacote}
                    onCheckedChange={setVendePacote}
                  />
                </div>
                <Input
                  id="pacote-galeria"
                  inputMode="decimal"
                  disabled={!vendePacote}
                  {...ariaErro("pacote-galeria", erros.preco_pacote)}
                  placeholder={vendePacote ? "" : "Desligado"}
                  value={vendePacote ? precoPacote : ""}
                  onChange={(e) => setPrecoPacote(e.target.value)}
                />
                {erros.preco_pacote && (
                  <p id="pacote-galeria-erro" className="text-caption text-danger" role="alert">
                    {erros.preco_pacote}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <label
                  htmlFor="download-liberado-galeria"
                  className="text-label-md text-foreground"
                >
                  Liberar download de todas as fotos
                </label>
                <p className="text-caption text-muted-foreground">
                  Quem abre o link baixa os originais sem marca d'água, sem fazer pedido. Use para
                  ensaio já pago.
                </p>
              </div>
              <Switch
                id="download-liberado-galeria"
                checked={downloadLiberado}
                onCheckedChange={setDownloadLiberado}
              />
            </div>

            <Campo rotulo="Situação">
              <ControleSegmentado
                opcoes={OPCOES_STATUS}
                valor={status}
                aoMudar={setStatus}
                rotuloAria="Situação da galeria"
              />
            </Campo>
          </div>

          <DialogFooter className="border-t border-border p-4">
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => aoMudarAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="size-4 animate-spin" />}
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
