import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Campo } from "@/components/Campo";
import { ControleSegmentado } from "@/components/ControleSegmentado";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonFormulario } from "@/components/Skeletons";
import { usePerfil } from "@/features/perfil/api";
import { useConfiguracoesLoja } from "@/features/loja/api";
import { useVitrine } from "@/features/vitrine/api";
import {
  montarDados,
  paraEdicao,
  useLanding,
  useSalvarLanding,
  type EdicaoLanding,
  type LandingPage,
} from "@/features/landing/api";
import { AbaConteudo, AbaCores, AbaFotos, AbaRastreamento } from "@/features/landing/PainelEdicao";
import { ContatosLanding } from "@/features/landing/ContatosLanding";
import { PreviaEscalada } from "@/features/landing/PreviaEscalada";
import { INFO_MODELO, MODELOS, type ModeloLanding } from "@/features/landing/tipos";
import { gerarSlug } from "@/lib/fotos";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/landing-pages_/$id")({
  head: () => ({ meta: [{ title: `Landing page | ${BRAND.name}` }] }),
  component: PaginaEditorLanding,
});

const OPCOES_MODELO = MODELOS.map((m) => ({ valor: m, rotulo: INFO_MODELO[m].nome }));
const nada = () => undefined;

function PaginaEditorLanding() {
  const { id } = Route.useParams();
  const consulta = useLanding(id);

  if (consulta.isPending) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <SkeletonFormulario campos={6} />
      </div>
    );
  }
  if (consulta.isError || !consulta.data.landing) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <EstadoVazio
          titulo="Landing page não encontrada"
          descricao={consulta.error?.message ?? "Ela pode ter sido excluída."}
          acao={
            <Button asChild variant="outline">
              <Link to="/landing-pages">Voltar às landing pages</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <Editor
      key={consulta.data.landing.updated_at}
      landing={consulta.data.landing}
      temToken={consulta.data.temToken}
    />
  );
}

function Editor({ landing, temToken }: { landing: LandingPage; temToken: boolean }) {
  const { data: ctx } = usePerfil();
  const loja = useConfiguracoesLoja();
  const vitrine = useVitrine();
  const salvar = useSalvarLanding();
  const nomeLoja = loja.data?.nome_exibicao || ctx?.organizacao?.nome || BRAND.name;
  const [edicao, setEdicao] = useState<EdicaoLanding>(() => paraEdicao(landing, nomeLoja));
  const [token, setToken] = useState<string | null>(null);
  const [alterado, setAlterado] = useState(false);

  const mudar = (parcial: Partial<EdicaoLanding>) => {
    setEdicao((e) => ({ ...e, ...parcial }));
    setAlterado(true);
  };

  // Sair com alteração não salva pede confirmação do navegador.
  useEffect(() => {
    if (!alterado) return;
    const aviso = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  const dados = useMemo(
    () =>
      montarDados({
        modelo: edicao.modelo,
        cores: edicao.cores,
        conteudo: edicao.conteudo,
        marca: vitrine.data?.marca,
        whatsapp: loja.data?.whatsapp ?? "",
        eventos: vitrine.data?.eventos ?? [],
        aoClicarCta: nada,
        aoClicarEvento: nada,
      }),
    [edicao, vitrine.data, loja.data],
  );

  function gravar() {
    salvar.mutate(
      { id: landing.id, dados: edicao, token },
      {
        onSuccess: () => {
          toast.success(edicao.publicada ? "Salva e publicada." : "Salva como rascunho.");
          setAlterado(false);
          setToken(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  const link = `${typeof window === "undefined" ? "" : window.location.origin}/l/${edicao.slug}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado. Use nos seus anúncios.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo={edicao.titulo || "Landing page"}
        descricao={`Modelo ${INFO_MODELO[edicao.modelo].nome} · /l/${edicao.slug}`}
        acoes={
          <>
            <Button variant="outline" onClick={() => void copiar()}>
              <Copy className="size-4" />
              Copiar link
            </Button>
            {landing.publicada && (
              <Button asChild variant="outline">
                <a href={`/l/${landing.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Abrir
                </a>
              </Button>
            )}
            <Button onClick={gravar} disabled={salvar.isPending}>
              {salvar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-label-md text-foreground">Publicada</p>
                <p className="text-caption text-muted-foreground">
                  {edicao.publicada
                    ? "O link abre para qualquer pessoa."
                    : "Rascunho: o link ainda não abre."}
                </p>
              </div>
              <Switch
                aria-label="Publicar landing page"
                checked={edicao.publicada}
                onCheckedChange={(v) => mudar({ publicada: v })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" htmlFor="lp-titulo-interno">
                <Input
                  id="lp-titulo-interno"
                  maxLength={120}
                  value={edicao.titulo}
                  onChange={(e) => mudar({ titulo: e.target.value })}
                />
              </Campo>
              <Campo rotulo="Link" htmlFor="lp-slug">
                <Input
                  id="lp-slug"
                  maxLength={80}
                  value={edicao.slug}
                  onChange={(e) => mudar({ slug: gerarSlug(e.target.value) })}
                />
              </Campo>
            </div>
            <Campo rotulo="Modelo">
              <ControleSegmentado
                opcoes={OPCOES_MODELO}
                valor={edicao.modelo}
                aoMudar={(m: ModeloLanding) => mudar({ modelo: m, cores: INFO_MODELO[m].cores })}
                rotuloAria="Modelo da landing page"
              />
            </Campo>
          </Card>

          <Tabs defaultValue="conteudo">
            <TabsList className="grid h-auto w-full grid-cols-5">
              <TabsTrigger value="conteudo" className="px-1 text-xs sm:text-sm">
                Conteúdo
              </TabsTrigger>
              <TabsTrigger value="fotos" className="px-1 text-xs sm:text-sm">
                Fotos
              </TabsTrigger>
              <TabsTrigger value="cores" className="px-1 text-xs sm:text-sm">
                Cores
              </TabsTrigger>
              <TabsTrigger value="rastreamento" className="px-1 text-xs sm:text-sm">
                Rastreio
              </TabsTrigger>
              <TabsTrigger value="contatos" className="px-1 text-xs sm:text-sm">
                Contatos
              </TabsTrigger>
            </TabsList>
            <Card className="mt-3 p-4">
              <TabsContent value="conteudo" className="mt-0">
                <AbaConteudo e={edicao} mudar={mudar} />
              </TabsContent>
              <TabsContent value="fotos" className="mt-0">
                <AbaFotos e={edicao} mudar={mudar} organizacaoId={ctx?.organizacao?.id ?? null} />
              </TabsContent>
              <TabsContent value="cores" className="mt-0">
                <AbaCores e={edicao} mudar={mudar} loja={loja.data} />
              </TabsContent>
              <TabsContent value="rastreamento" className="mt-0">
                <AbaRastreamento
                  e={edicao}
                  mudar={mudar}
                  temToken={temToken}
                  token={token}
                  aoMudarToken={(t) => {
                    setToken(t);
                    setAlterado(true);
                  }}
                />
              </TabsContent>
              <TabsContent value="contatos" className="mt-0">
                <ContatosLanding
                  landingId={landing.id}
                  rotuloPersonalizado={edicao.conteudo.formulario.personalizado}
                  usaFormulario={edicao.conteudo.cta_tipo === "popup"}
                />
              </TabsContent>
            </Card>
          </Tabs>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-caption text-muted-foreground">Prévia</span>
              {alterado && <span className="text-caption text-warning">Alterações não salvas</span>}
            </div>
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto">
              <PreviaEscalada dados={dados} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
