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
import {
  ROTULO_STATUS_GALERIA,
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
  const [buscaRosto, setBuscaRosto] = useState(galeria?.busca_rosto ?? true);
  const evento = tipo === "evento";

  const criar = useCriarGaleria(autoria);
  const atualizar = useAtualizarGaleria();
  const salvando = criar.isPending || atualizar.isPending;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dados: DadosGaleria = {
      titulo,
      slug,
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
      busca_rosto: buscaRosto,
    };
    const aoErrar = (erro: Error) => toast.error(erro.message);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={salvar} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{galeria ? "Editar galeria" : "Nova galeria"}</DialogTitle>
            <DialogDescription>
              {evento
                ? "Evento aberto: aparece na sua vitrine de eventos e qualquer pessoa acha as próprias fotos com uma selfie."
                : "O cliente abre a galeria pelo link. Só galerias publicadas aparecem para ele."}
            </DialogDescription>
          </DialogHeader>

          <Campo rotulo="Tipo">
            <ControleSegmentado
              opcoes={OPCOES_TIPO}
              valor={tipo}
              aoMudar={setTipo}
              rotuloAria="Tipo de galeria"
            />
          </Campo>

          <Campo rotulo="Título" htmlFor="titulo-galeria">
            <Input
              id="titulo-galeria"
              required
              minLength={2}
              maxLength={200}
              autoFocus
              placeholder={evento ? "Copa Verão de Futebol 2026" : "Casamento Ana e João"}
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (!slugManual) setSlug(gerarSlug(e.target.value));
              }}
            />
          </Campo>

          <Campo
            rotulo="Link da galeria"
            htmlFor="slug-galeria"
            dica={`Endereço: /g/${slug || "seu-link"}`}
          >
            <Input
              id="slug-galeria"
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
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <label htmlFor="busca-rosto-galeria" className="text-label-md text-foreground">
                    Busca por selfie
                  </label>
                  <p className="text-caption text-muted-foreground">
                    Os rostos das fotos são indexados no envio, no seu navegador. O visitante manda
                    uma selfie e vê só as fotos em que aparece.
                  </p>
                </div>
                <Switch
                  id="busca-rosto-galeria"
                  checked={buscaRosto}
                  onCheckedChange={setBuscaRosto}
                />
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
              <Campo rotulo="E-mail do cliente" htmlFor="email-galeria">
                <Input
                  id="email-galeria"
                  type="email"
                  maxLength={200}
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
            >
              <Input
                id="preco-galeria"
                inputMode="decimal"
                required
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
                required={vendePacote}
                placeholder={vendePacote ? "" : "Desligado"}
                value={vendePacote ? precoPacote : ""}
                onChange={(e) => setPrecoPacote(e.target.value)}
              />
            </div>
          </div>

          <Campo rotulo="Situação">
            <ControleSegmentado
              opcoes={OPCOES_STATUS}
              valor={status}
              aoMudar={setStatus}
              rotuloAria="Situação da galeria"
            />
          </Campo>

          <DialogFooter>
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
