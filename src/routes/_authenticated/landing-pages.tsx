import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarraSelecao } from "@/components/BarraSelecao";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonTabela } from "@/components/Skeletons";
import { Tabela, type ColunaTabela } from "@/components/Tabela";
import { usePerfil } from "@/features/perfil/api";
import { useConfiguracoesLoja } from "@/features/loja/api";
import { useVitrine } from "@/features/vitrine/api";
import { useExcluirLandings, useLandings, type LandingPage } from "@/features/landing/api";
import { NovaLanding } from "@/features/landing/NovaLanding";
import { INFO_MODELO, ehModelo } from "@/features/landing/tipos";
import { dataHoraBR } from "@/lib/format";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/landing-pages")({
  head: () => ({ meta: [{ title: `Landing pages | ${BRAND.name}` }] }),
  component: PaginaLandingPages,
});

function PaginaLandingPages() {
  const navigate = useNavigate();
  const { data: ctx } = usePerfil();
  const loja = useConfiguracoesLoja();
  const vitrine = useVitrine();
  const lista = useLandings();
  const excluir = useExcluirLandings();
  const [criando, setCriando] = useState<number | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);

  const nomeLoja = loja.data?.nome_exibicao || ctx?.organizacao?.nome || BRAND.name;
  const ids = (lista.data ?? []).filter((l) => selecionadas.has(l.id)).map((l) => l.id);

  const colunas: ColunaTabela<LandingPage>[] = [
    {
      chave: "titulo",
      titulo: "Landing page",
      ordenavel: true,
      renderizar: (l) => (
        <Link to="/landing-pages/$id" params={{ id: l.id }} className="hover:underline">
          <span className="block">{l.titulo}</span>
          <span className="block text-caption font-normal text-muted-foreground">/l/{l.slug}</span>
        </Link>
      ),
    },
    {
      chave: "modelo",
      titulo: "Modelo",
      classe: "hidden sm:table-cell",
      renderizar: (l) => (
        <Badge variant="outline">
          {ehModelo(l.modelo) ? INFO_MODELO[l.modelo].nome : l.modelo}
        </Badge>
      ),
    },
    {
      chave: "publicada",
      titulo: "Situação",
      renderizar: (l) => (
        <Badge variant={l.publicada ? "success" : "secondary"}>
          {l.publicada ? "Publicada" : "Rascunho"}
        </Badge>
      ),
    },
    {
      chave: "rastreio",
      titulo: "Rastreamento",
      classe: "hidden md:table-cell text-muted-foreground",
      renderizar: (l) =>
        [
          l.meta_pixel_id && "Meta",
          (l.ga4_id || l.google_ads_id) && "Google",
          l.gtm_id && "GTM",
          l.tiktok_pixel_id && "TikTok",
        ]
          .filter(Boolean)
          .join(", ") || <span className="text-faint">–</span>,
    },
    {
      chave: "updated_at",
      titulo: "Alterada em",
      ordenavel: true,
      valorOrdenacao: (l) => new Date(l.updated_at).getTime(),
      classe: "hidden whitespace-nowrap text-muted-foreground lg:table-cell",
      renderizar: (l) => dataHoraBR(l.updated_at),
    },
    {
      chave: "abrir",
      titulo: <span className="sr-only">Abrir</span>,
      alinhar: "direita",
      renderizar: (l) =>
        l.publicada ? (
          <Button asChild variant="ghost" size="icon" className="size-8">
            <a
              href={`/l/${l.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Abrir ${l.titulo}`}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : null,
    },
  ];

  function confirmarExclusao() {
    excluir.mutate(ids, {
      onSuccess: (n) => {
        toast.success(`${n} landing page${n === 1 ? "" : "s"} excluída${n === 1 ? "" : "s"}.`);
        setSelecionadas(new Set());
        setConfirmando(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  const botaoNova = (
    <Button onClick={() => setCriando(Date.now())}>
      <Plus className="size-4" />
      Nova landing page
    </Button>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo="Landing pages"
        descricao="Páginas para anúncios, com o seu pixel e as suas tags. Todas mostram os eventos da sua vitrine."
        acoes={botaoNova}
      />

      {lista.isPending ? (
        <SkeletonTabela linhas={3} colunas={4} />
      ) : lista.isError ? (
        <EstadoVazio
          titulo="Não foi possível carregar as landing pages"
          descricao={lista.error.message}
          acao={
            <Button variant="outline" onClick={() => void lista.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : lista.data.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma landing page ainda"
          descricao="Escolha um dos quatro modelos, troque textos, fotos e cores, instale o seu pixel e use o link nos anúncios."
          acao={botaoNova}
        />
      ) : (
        <div className="space-y-4">
          {ids.length > 0 && (
            <BarraSelecao
              quantidade={ids.length}
              singular="landing page selecionada"
              plural="landing pages selecionadas"
              aoLimpar={() => setSelecionadas(new Set())}
            >
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmando(true)}
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            </BarraSelecao>
          )}
          <Card className="overflow-hidden p-0">
            <Tabela
              colunas={colunas}
              linhas={lista.data}
              chaveLinha={(l) => l.id}
              ordenacaoInicial={{ chave: "updated_at", direcao: "desc" }}
              selecao={{ selecionadas, aoMudar: setSelecionadas, rotulo: (l) => l.titulo }}
            />
          </Card>
        </div>
      )}

      {criando !== null && (
        <NovaLanding
          key={criando}
          aberto
          aoMudarAberto={(v) => !v && setCriando(null)}
          autoria={{ userId: ctx?.perfil?.id ?? "", organizacaoId: ctx?.organizacao?.id ?? null }}
          vitrine={vitrine.data}
          nomeLoja={nomeLoja}
          whatsapp={loja.data?.whatsapp ?? ""}
          aoCriar={(l) => void navigate({ to: "/landing-pages/$id", params: { id: l.id } })}
        />
      )}

      <AlertDialog
        open={confirmando}
        onOpenChange={(v) => !v && !excluir.isPending && setConfirmando(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {ids.length === 1 ? "1 landing page" : `${ids.length} landing pages`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O link para de funcionar. Anúncios que apontam para ele vão abrir uma página não
              encontrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={excluir.isPending} onClick={confirmarExclusao}>
              {excluir.isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
