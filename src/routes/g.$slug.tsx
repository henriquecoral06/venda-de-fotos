import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Download, Loader2, Lock, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Campo } from "@/components/Campo";
import { EstadoVazio } from "@/components/PageHeader";
import { LayoutPublico } from "@/components/layout/LayoutPublico";
import {
  armazenamento,
  useGaleriaPublica,
  type FotoPublica,
  type GaleriaPublica,
} from "@/features/vitrine/api";
import { Checkout, type ModoCompra } from "@/features/vitrine/Checkout";
import { GradeJustificada } from "@/features/vitrine/GradeJustificada";
import { Lightbox } from "@/features/vitrine/Lightbox";
import { baixarZip } from "@/features/vitrine/zip";
import { brl, dataBR } from "@/lib/format";
import { rotuloFotos, urlPrevia } from "@/lib/fotos";
import { CLASSE_BOTAO_MARCA } from "@/lib/marca";
import { ariaErro } from "@/lib/validacao";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";
import { Miniatura } from "@/components/Miniatura";

export const Route = createFileRoute("/g/$slug")({
  // Senha e seleção ficam no navegador do visitante.
  ssr: false,
  head: () => ({ meta: [{ title: `Galeria | ${BRAND.name}` }] }),
  component: PaginaGaleriaPublica,
});

function PaginaGaleriaPublica() {
  const { slug } = Route.useParams();
  const [senha, setSenha] = useState(() => armazenamento.lerSenha(slug));
  const galeria = useGaleriaPublica(slug, senha);

  useEffect(() => {
    if (galeria.data)
      document.title = `${galeria.data.titulo} | ${galeria.data.fotografo || BRAND.name}`;
  }, [galeria.data]);

  function trocarSenha(s: string) {
    armazenamento.gravarSenha(slug, s);
    setSenha(s);
  }

  if (galeria.isPending) {
    return (
      <LayoutPublico fotografo="">
        <Skeleton className="h-[58vh] w-full rounded-none" />
        <div className="mx-auto max-w-[96rem] space-y-3 px-4 py-10 md:px-8">
          <Skeleton className="h-12 w-2/3 max-w-xl" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-1 px-1 md:grid-cols-4 md:px-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-none" />
          ))}
        </div>
      </LayoutPublico>
    );
  }

  if (galeria.isError || !galeria.data) {
    const bloqueada = galeria.error?.message.startsWith("Muitas tentativas") ?? false;
    return (
      <LayoutPublico fotografo="">
        <div className="mx-auto max-w-xl p-4 py-20">
          <EstadoVazio
            titulo={
              bloqueada
                ? "Muitas senhas erradas"
                : galeria.isError
                  ? "Não foi possível abrir a galeria"
                  : "Galeria não encontrada"
            }
            descricao={
              bloqueada
                ? "Por segurança, a galeria fica fechada por alguns minutos. Confira a senha com o fotógrafo e tente de novo."
                : galeria.isError
                  ? galeria.error.message
                  : "Confira se o link está completo, do jeito que o fotógrafo enviou. A galeria pode ter sido encerrada."
            }
            acao={
              galeria.isError ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    trocarSenha("");
                    void galeria.refetch();
                  }}
                >
                  Tentar de novo
                </Button>
              ) : undefined
            }
          />
        </div>
      </LayoutPublico>
    );
  }

  if (!galeria.data.liberada) {
    return (
      <PedidoSenha
        galeria={galeria.data}
        errada={galeria.data.senha_incorreta ?? senha !== ""}
        conferindo={galeria.isFetching}
        aoEnviar={trocarSenha}
      />
    );
  }

  return <Vitrine galeria={galeria.data} senha={senha} />;
}

function PedidoSenha({
  galeria,
  errada,
  conferindo,
  aoEnviar,
}: {
  galeria: GaleriaPublica;
  errada: boolean;
  conferindo: boolean;
  aoEnviar: (senha: string) => void;
}) {
  const [valor, setValor] = useState("");
  const [vazia, setVazia] = useState(false);
  const erro = vazia
    ? "Digite a senha."
    : errada && !conferindo
      ? "Senha incorreta. Confira com o fotógrafo."
      : undefined;

  return (
    <LayoutPublico fotografo={galeria.fotografo} marca={galeria.marca}>
      <div className="grid min-h-[calc(100dvh-3.5rem)] md:grid-cols-[3fr_2fr]">
        <div className="relative h-[42vh] bg-muted md:h-auto">
          {galeria.capa && (
            <img
              src={urlPrevia(galeria.capa)}
              alt=""
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </div>
        <div className="flex items-center px-6 py-10 md:px-12">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-3">
              <h1 className="text-heading-lg font-light md:text-heading-xl">{galeria.titulo}</h1>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Galeria protegida. Digite a senha que o fotógrafo enviou junto com o link.
              </p>
            </div>
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                const s = valor.trim();
                setVazia(s === "");
                if (s) aoEnviar(s);
              }}
            >
              <Campo rotulo="Senha" htmlFor="senha-galeria-publica" erro={erro}>
                <Input
                  id="senha-galeria-publica"
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="none"
                  value={valor}
                  onChange={(e) => {
                    setValor(e.target.value);
                    setVazia(false);
                  }}
                  {...ariaErro("senha-galeria-publica", erro)}
                />
              </Campo>
              <Button
                type="submit"
                className={cn("w-full", CLASSE_BOTAO_MARCA)}
                disabled={conferindo}
              >
                {conferindo && <Loader2 className="size-4 animate-spin" />}
                {conferindo ? "Conferindo..." : "Ver as fotos"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </LayoutPublico>
  );
}

function Vitrine({ galeria, senha }: { galeria: GaleriaPublica; senha: string }) {
  const navigate = Route.useNavigate();
  const fotos = useMemo(() => galeria.fotos ?? [], [galeria.fotos]);
  const precoFoto = galeria.preco_foto ?? 0;
  const precoPacote = galeria.preco_pacote ?? null;
  const liberada = galeria.download_liberado ?? false;
  const evento = galeria.tipo === "evento";
  // Com o download liberado não há compra: a galeria é só para ver e baixar.
  const vende = !liberada;

  // A seleção guardada pode ter foto que saiu da galeria: fica só a que existe.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => {
    const ids = new Set(fotos.map((f) => f.id));
    return new Set(armazenamento.lerSelecao(galeria.slug).filter((id) => ids.has(id)));
  });
  const [indice, setIndice] = useState<number | null>(null);
  const [modo, setModo] = useState<ModoCompra | null>(null);
  const [zip, setZip] = useState<{ feitas: number; total: number } | null>(null);

  useEffect(() => {
    armazenamento.gravarSelecao(galeria.slug, [...selecionadas]);
  }, [galeria.slug, selecionadas]);

  // Fechar a aba no meio do ZIP perde o que já foi baixado.
  useEffect(() => {
    if (!zip) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [zip]);

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  async function baixarTodas() {
    const arquivos = fotos
      .filter((f): f is FotoPublica & { original: string } => typeof f.original === "string")
      .map((f) => ({ caminho: f.original, nome: f.nome, tamanho: f.tamanho ?? 0 }));
    if (arquivos.length === 0) return;
    try {
      await baixarZip(arquivos, galeria.titulo, (feitas, total) => setZip({ feitas, total }));
      toast.success(`${rotuloFotos(arquivos.length)} no ZIP. Confira a pasta de downloads.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível montar o ZIP.");
    } finally {
      setZip(null);
    }
  }

  const fotosSelecionadas: FotoPublica[] = fotos.filter((f) => selecionadas.has(f.id));
  const qtd = fotosSelecionadas.length;
  const meta = [
    galeria.data_evento ? dataBR(galeria.data_evento) : null,
    evento ? galeria.local || null : null,
    rotuloFotos(fotos.length),
  ].filter(Boolean);

  const acoesTopo = liberada ? (
    fotos.length > 0 && (
      <Button
        size="sm"
        className={CLASSE_BOTAO_MARCA}
        disabled={zip !== null}
        onClick={() => void baixarTodas()}
      >
        {zip ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {zip ? `${zip.feitas} de ${zip.total}` : "Baixar todas"}
      </Button>
    )
  ) : (
    <Button
      size="sm"
      variant={qtd > 0 ? "default" : "ghost"}
      className={cn(qtd > 0 && CLASSE_BOTAO_MARCA)}
      onClick={() => setModo("selecao")}
      aria-label={qtd > 0 ? `Ver seleção com ${rotuloFotos(qtd)}` : "Ver seleção"}
    >
      <ShoppingBag className="size-4" />
      {qtd > 0 ? rotuloFotos(qtd) : "Seleção"}
    </Button>
  );

  return (
    <LayoutPublico fotografo={galeria.fotografo} marca={galeria.marca} acoes={acoesTopo}>
      {/* Folha de rosto: a capa inteira e o título embaixo, como num livro de fotos. */}
      <section>
        <div className="relative h-[58vh] min-h-72 w-full bg-muted md:h-[72vh]">
          {galeria.capa && (
            <img
              src={urlPrevia(galeria.capa)}
              alt=""
              fetchPriority="high"
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </div>
        <div className="mx-auto grid max-w-[96rem] gap-6 px-4 pb-10 pt-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-16 md:px-8 md:pb-14 md:pt-12">
          <div className="space-y-3">
            {evento && galeria.categoria && (
              <Link to="/eventos" className="text-sm text-muted-foreground hover:text-foreground">
                {galeria.categoria}
              </Link>
            )}
            <h1 className="text-heading-xl font-light md:text-display-xl md:font-light">
              {galeria.titulo}
            </h1>
            <p className="text-sm text-muted-foreground">{meta.join("  ·  ")}</p>
          </div>
          <div className="space-y-5 md:pt-3">
            {galeria.descricao && (
              <p className="max-w-prose whitespace-pre-line text-body-md text-foreground">
                {galeria.descricao}
              </p>
            )}
            <p className="max-w-prose text-sm text-muted-foreground">
              {liberada
                ? "As fotos estão liberadas em alta resolução, sem marca d'água. Baixe uma a uma na foto ampliada ou todas de uma vez."
                : precoFoto > 0
                  ? `Cada foto sai por ${brl(precoFoto)}. Toque no círculo para escolher. O download em alta resolução é liberado depois do pagamento.`
                  : "Download gratuito. Escolha as fotos e receba os arquivos em alta resolução."}
            </p>
            <div className="flex flex-wrap gap-2">
              {vende && precoPacote !== null && fotos.length > 0 && (
                <Button className={CLASSE_BOTAO_MARCA} onClick={() => setModo("pacote")}>
                  Todas as {fotos.length} fotos por {brl(precoPacote)}
                </Button>
              )}
              {evento && (
                <Button asChild variant="ghost">
                  <Link to="/eventos">Outros eventos</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="px-1 pb-16 md:px-2">
        {fotos.length === 0 ? (
          <div className="mx-auto max-w-xl px-4">
            <EstadoVazio
              titulo="As fotos ainda não chegaram"
              descricao="O fotógrafo ainda está preparando esta galeria. Volte mais tarde pelo mesmo link."
            />
          </div>
        ) : (
          <GradeJustificada
            itens={fotos}
            renderizar={(f, i) => {
              const marcada = selecionadas.has(f.id);
              return (
                <div className="group size-full">
                  <button
                    type="button"
                    className="block size-full cursor-zoom-in overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() => setIndice(i)}
                    aria-label={`Ampliar ${f.nome}`}
                  >
                    <Miniatura
                      src={urlPrevia(f.miniatura)}
                      alt={f.nome}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      className="size-full select-none object-cover"
                    />
                  </button>
                  {vende && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={marcada}
                      aria-label={`${marcada ? "Tirar" : "Escolher"} ${f.nome}`}
                      onClick={() => alternar(f.id)}
                      className={cn(
                        "absolute right-2 top-2 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 transition-opacity focus-visible:opacity-100",
                        marcada
                          ? "border-primary bg-primary text-primary-foreground opacity-100"
                          : "border-white bg-black/20 text-transparent opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
                      )}
                    >
                      <Check className="size-4" strokeWidth={2.5} />
                    </button>
                  )}
                  {marcada && (
                    <span className="pointer-events-none absolute inset-0 ring-4 ring-primary ring-inset" />
                  )}
                </div>
              );
            }}
          />
        )}
      </div>

      {vende && qtd > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-20 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-card p-1.5 pl-5 shadow-lg">
            <span className="text-sm tabular-nums text-foreground">
              {rotuloFotos(qtd)} · {precoFoto > 0 ? brl(precoFoto * qtd) : "grátis"}
            </span>
            <Button size="sm" className={CLASSE_BOTAO_MARCA} onClick={() => setModo("selecao")}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      <Lightbox
        fotos={fotos}
        indice={indice}
        aoMudarIndice={setIndice}
        aoFechar={() => setIndice(null)}
        selecionadas={selecionadas}
        aoAlternar={alternar}
        podeSelecionar={vende}
        whatsappRemocao={evento ? (galeria.contato_whatsapp ?? "") : ""}
      />

      {vende && (
        <Checkout
          galeria={galeria}
          senha={senha}
          modo={modo}
          aoFechar={() => setModo(null)}
          fotosSelecionadas={fotosSelecionadas}
          aoRemover={alternar}
          aoConcluir={(codigo) => {
            setSelecionadas(new Set());
            armazenamento.gravarSelecao(galeria.slug, []);
            void navigate({ to: "/pedido/$codigo", params: { codigo } });
          }}
        />
      )}
    </LayoutPublico>
  );
}
