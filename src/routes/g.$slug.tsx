import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, Lock, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Lightbox } from "@/features/vitrine/Lightbox";
import { brl, dataBR } from "@/lib/format";
import { rotuloFotos, urlPrevia } from "@/lib/fotos";
import { CLASSE_BOTAO_MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";

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

  if (galeria.isPending) {
    return (
      <LayoutPublico fotografo="">
        <Skeleton className="h-[45vh] w-full rounded-none" />
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 p-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3]" />
          ))}
        </div>
      </LayoutPublico>
    );
  }

  if (galeria.isError || !galeria.data) {
    return (
      <LayoutPublico fotografo="">
        <div className="mx-auto max-w-xl p-4 py-16">
          <EstadoVazio
            titulo={galeria.isError ? "Não foi possível abrir a galeria" : "Galeria não encontrada"}
            descricao={
              galeria.isError
                ? galeria.error.message
                : "Confira o link com o fotógrafo. A galeria pode ter sido encerrada."
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
        tentou={senha !== ""}
        conferindo={galeria.isFetching}
        aoEnviar={(s) => {
          armazenamento.gravarSenha(slug, s);
          setSenha(s);
        }}
      />
    );
  }

  return <Vitrine galeria={galeria.data} senha={senha} />;
}

function PedidoSenha({
  galeria,
  tentou,
  conferindo,
  aoEnviar,
}: {
  galeria: GaleriaPublica;
  tentou: boolean;
  conferindo: boolean;
  aoEnviar: (senha: string) => void;
}) {
  const [valor, setValor] = useState("");
  return (
    <LayoutPublico fotografo={galeria.fotografo} marca={galeria.marca}>
      <div className="mx-auto flex max-w-md flex-col gap-6 p-4 py-12">
        {galeria.capa && (
          <img
            src={urlPrevia(galeria.capa)}
            alt=""
            className="aspect-[3/2] w-full rounded-xl border border-border object-cover"
          />
        )}
        <Card className="space-y-5 p-6">
          <div className="space-y-1">
            <h1 className="text-heading-md">{galeria.titulo}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden="true" />
              Galeria protegida. Digite a senha que o fotógrafo enviou.
            </p>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              aoEnviar(valor.trim());
            }}
          >
            <Campo rotulo="Senha" htmlFor="senha-galeria-publica">
              <Input
                id="senha-galeria-publica"
                required
                autoFocus
                autoComplete="off"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </Campo>
            {tentou && !conferindo && (
              <p className="text-sm text-danger" role="alert">
                Senha incorreta. Confira com o fotógrafo.
              </p>
            )}
            <Button
              type="submit"
              className={cn("w-full", CLASSE_BOTAO_MARCA)}
              disabled={conferindo}
            >
              {conferindo && <Loader2 className="size-4 animate-spin" />}
              Abrir galeria
            </Button>
          </form>
        </Card>
      </div>
    </LayoutPublico>
  );
}

function Vitrine({ galeria, senha }: { galeria: GaleriaPublica; senha: string }) {
  const navigate = Route.useNavigate();
  const fotos = useMemo(() => galeria.fotos ?? [], [galeria.fotos]);
  const precoFoto = galeria.preco_foto ?? 0;
  const precoPacote = galeria.preco_pacote ?? null;

  // A seleção guardada pode ter foto que saiu da galeria: fica só a que existe.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => {
    const ids = new Set(fotos.map((f) => f.id));
    return new Set(armazenamento.lerSelecao(galeria.slug).filter((id) => ids.has(id)));
  });
  const [indice, setIndice] = useState<number | null>(null);
  const [modo, setModo] = useState<ModoCompra | null>(null);

  useEffect(() => {
    armazenamento.gravarSelecao(galeria.slug, [...selecionadas]);
  }, [galeria.slug, selecionadas]);

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  const fotosSelecionadas: FotoPublica[] = fotos.filter((f) => selecionadas.has(f.id));
  const qtd = fotosSelecionadas.length;

  const botaoSelecao = (
    <Button
      size="sm"
      variant={qtd > 0 ? "default" : "outline"}
      className={cn(qtd > 0 && CLASSE_BOTAO_MARCA)}
      onClick={() => setModo("selecao")}
    >
      <ShoppingBag className="size-4" />
      {qtd > 0 ? `${qtd} · ${precoFoto > 0 ? brl(precoFoto * qtd) : "grátis"}` : "Seleção"}
    </Button>
  );

  return (
    <LayoutPublico fotografo={galeria.fotografo} marca={galeria.marca} acoes={botaoSelecao}>
      {/* Capa: escurecida embaixo para o título ler sobre a foto. */}
      <section className="relative h-[45vh] min-h-64 w-full overflow-hidden bg-muted">
        {galeria.capa && (
          <img
            src={urlPrevia(galeria.capa)}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onContextMenu={(e) => e.preventDefault()}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl p-4 pb-8 text-white md:p-8">
          <h1 className="text-heading-xl md:text-display-lg">{galeria.titulo}</h1>
          <p className="mt-2 text-sm text-white/80">
            {[
              galeria.data_evento ? dataBR(galeria.data_evento) : null,
              rotuloFotos(fotos.length),
              galeria.fotografo || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl space-y-1">
            {galeria.descricao && (
              <p className="whitespace-pre-line text-body-md text-foreground">
                {galeria.descricao}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {precoFoto > 0
                ? `Cada foto sai por ${brl(precoFoto)}. Toque no círculo para escolher; o download em alta resolução é liberado após o pagamento.`
                : "Download gratuito. Escolha as fotos e receba os arquivos em alta resolução."}
            </p>
          </div>
          {precoPacote !== null && fotos.length > 0 && (
            <Button className={CLASSE_BOTAO_MARCA} onClick={() => setModo("pacote")}>
              Todas as {fotos.length} fotos por {brl(precoPacote)}
            </Button>
          )}
        </div>

        {fotos.length === 0 ? (
          <EstadoVazio
            titulo="As fotos ainda não chegaram"
            descricao="O fotógrafo ainda está preparando esta galeria. Volte mais tarde."
          />
        ) : (
          <ul className="columns-2 gap-3 md:columns-3 lg:columns-4 [&>li]:mb-3">
            {fotos.map((f, i) => {
              const marcada = selecionadas.has(f.id);
              return (
                <li key={f.id} className="group relative break-inside-avoid">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted"
                    onClick={() => setIndice(i)}
                    aria-label={`Ampliar ${f.nome}`}
                  >
                    <img
                      src={urlPrevia(f.miniatura)}
                      alt={f.nome}
                      loading="lazy"
                      width={f.largura}
                      height={f.altura}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      className={cn(
                        "h-auto w-full select-none transition-transform duration-300 group-hover:scale-[1.02]",
                        marcada && "opacity-90",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcada}
                    aria-label={`${marcada ? "Tirar" : "Escolher"} ${f.nome}`}
                    onClick={() => alternar(f.id)}
                    className={cn(
                      "absolute right-2 top-2 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 transition-colors",
                      marcada
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/90 bg-black/25 text-transparent hover:bg-black/40",
                    )}
                  >
                    <Check className="size-4" strokeWidth={2.5} />
                  </button>
                  {marcada && (
                    <span className="pointer-events-none absolute inset-0 rounded-lg ring-4 ring-primary ring-inset" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {qtd > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border border-border bg-card p-1.5 pl-5 shadow-lg">
          <span className="text-sm text-foreground">
            {rotuloFotos(qtd)} · {precoFoto > 0 ? brl(precoFoto * qtd) : "grátis"}
          </span>
          <Button size="sm" className={CLASSE_BOTAO_MARCA} onClick={() => setModo("selecao")}>
            Continuar
          </Button>
        </div>
      )}

      <Lightbox
        fotos={fotos}
        indice={indice}
        aoMudarIndice={setIndice}
        aoFechar={() => setIndice(null)}
        selecionadas={selecionadas}
        aoAlternar={alternar}
        podeSelecionar
      />

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
    </LayoutPublico>
  );
}
