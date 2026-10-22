import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Archive, Eye, EyeOff, ExternalLink, Loader2, Plus, Search, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarraSelecao } from "@/components/BarraSelecao";
import { ControleSegmentado } from "@/components/ControleSegmentado";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonTabela } from "@/components/Skeletons";
import { usePerfil } from "@/features/perfil/api";
import {
  useExcluirGalerias,
  useGalerias,
  useMudarStatusGalerias,
  type Autoria,
  type ResultadoEmMassa,
  type StatusGaleria,
} from "@/features/galerias/api";
import { FormularioGaleria } from "@/features/galerias/FormularioGaleria";
import { TabelaGalerias } from "@/features/galerias/TabelaGalerias";
import { BRAND } from "@/config/brand";
import { combinaBusca } from "@/lib/busca";

export const Route = createFileRoute("/_authenticated/galerias")({
  head: () => ({ meta: [{ title: `Galerias | ${BRAND.name}` }] }),
  component: PaginaGalerias,
});

type Filtro = "ativas" | StatusGaleria;

const POR_PAGINA = 25;

/** "1 galeria" / "3 galerias", e o "s" do particípio que vem depois. */
function galerias(qtd: number): { texto: string; s: string } {
  return {
    texto: `${qtd.toLocaleString("pt-BR")} galeria${qtd === 1 ? "" : "s"}`,
    s: qtd === 1 ? "" : "s",
  };
}

const ACOES_STATUS = [
  {
    status: "publicada",
    rotulo: "Publicar",
    icone: Eye,
    mensagem: (n: number) => `${galerias(n).texto} publicada${galerias(n).s}.`,
  },
  {
    status: "rascunho",
    rotulo: "Voltar a rascunho",
    icone: EyeOff,
    mensagem: (n: number) => `${galerias(n).texto} em rascunho.`,
  },
  {
    status: "arquivada",
    rotulo: "Arquivar",
    icone: Archive,
    mensagem: (n: number) => `${galerias(n).texto} arquivada${galerias(n).s}.`,
  },
] as const;

const FILTROS = [
  { valor: "ativas", rotulo: "Ativas" },
  { valor: "publicada", rotulo: "Publicadas" },
  { valor: "rascunho", rotulo: "Rascunhos" },
  { valor: "arquivada", rotulo: "Arquivadas" },
] as const;

function PaginaGalerias() {
  const navigate = useNavigate();
  const { data: ctx } = usePerfil();
  const lista = useGalerias();
  const [criando, setCriando] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("ativas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const mudarStatus = useMudarStatusGalerias();
  const excluir = useExcluirGalerias();
  const ocupado = mudarStatus.isPending || excluir.isPending;

  const autoria: Autoria = {
    userId: ctx?.perfil?.id ?? "",
    organizacaoId: ctx?.organizacao?.id ?? null,
  };

  const filtradas = useMemo(() => {
    return (lista.data ?? []).filter(
      (g) =>
        (filtro === "ativas" ? g.status !== "arquivada" : g.status === filtro) &&
        combinaBusca(busca, [g.titulo, g.cliente_nome, g.categoria, g.local, g.slug]),
    );
  }, [lista.data, filtro, busca]);

  // Só conta o que está na tela: trocar o filtro não age sobre linha escondida.
  const ids = useMemo(
    () => filtradas.filter((g) => selecionadas.has(g.id)).map((g) => g.id),
    [filtradas, selecionadas],
  );

  function avisar(r: ResultadoEmMassa, sucesso: string) {
    if (r.feitas > 0) toast.success(sucesso);
    if (r.recusadas > 0) {
      toast.error(
        `${r.recusadas.toLocaleString("pt-BR")} não ${r.recusadas === 1 ? "pôde" : "puderam"}: ${r.motivo ?? "erro desconhecido"}`,
      );
    }
    setSelecionadas(new Set());
  }

  function aplicarStatus(status: StatusGaleria, mensagem: (n: number) => string) {
    mudarStatus.mutate(
      { ids, status },
      {
        onSuccess: (r) => avisar(r, mensagem(r.feitas)),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function confirmarExclusao() {
    excluir.mutate(ids, {
      onSuccess: (r) => {
        setConfirmandoExclusao(false);
        avisar(r, `${galerias(r.feitas).texto} excluída${galerias(r.feitas).s}.`);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  const botaoNova = (
    <Button onClick={() => setCriando(Date.now())}>
      <Plus className="size-4" />
      Nova galeria
    </Button>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo="Galerias"
        descricao="Galeria de cliente (com link e senha) ou evento aberto, que aparece na sua vitrine de eventos."
        acoes={
          <>
            <Button asChild variant="outline">
              <a href="/eventos" target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Vitrine de eventos
              </a>
            </Button>
            {botaoNova}
          </>
        }
      />

      {lista.isPending ? (
        <SkeletonTabela linhas={4} colunas={5} />
      ) : lista.isError ? (
        <EstadoVazio
          titulo="Não foi possível carregar as galerias"
          descricao={lista.error.message}
          acao={
            <Button variant="outline" onClick={() => void lista.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : lista.data.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma galeria ainda"
          descricao="Crie a primeira galeria, envie as fotos e mande o link para o cliente."
          acao={botaoNova}
        />
      ) : (
        <div className="space-y-4">
          {ids.length > 0 ? (
            <BarraSelecao
              quantidade={ids.length}
              singular="galeria selecionada"
              plural="galerias selecionadas"
              aoLimpar={() => setSelecionadas(new Set())}
            >
              {ACOES_STATUS.map((a) => (
                <Button
                  key={a.status}
                  size="sm"
                  variant="outline"
                  disabled={ocupado}
                  onClick={() => aplicarStatus(a.status, a.mensagem)}
                >
                  {mudarStatus.isPending && mudarStatus.variables?.status === a.status ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <a.icone className="size-4" />
                  )}
                  {a.rotulo}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={ocupado}
                onClick={() => setConfirmandoExclusao(true)}
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            </BarraSelecao>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <ControleSegmentado
                opcoes={FILTROS}
                valor={filtro}
                aoMudar={(v) => {
                  setFiltro(v);
                  setPagina(1);
                }}
                rotuloAria="Filtrar galerias"
              />
              <Input
                type="search"
                icone={<Search className="size-4" />}
                placeholder="Buscar por nome, cliente ou local"
                aria-label="Buscar galerias"
                className="md:w-80"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
              />
            </div>
          )}
          <TabelaGalerias
            galerias={filtradas}
            paginacao={{ pagina, porPagina: POR_PAGINA, aoMudar: setPagina }}
            vazio={busca.trim() ? `Nenhuma galeria encontrada para “${busca.trim()}”.` : undefined}
            selecao={{ selecionadas, aoMudar: setSelecionadas, rotulo: (g) => g.titulo }}
          />
        </div>
      )}

      <AlertDialog
        open={confirmandoExclusao}
        onOpenChange={(v) => !v && !excluir.isPending && setConfirmandoExclusao(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {ids.length === 1 ? "1 galeria" : `${ids.length} galerias`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              As galerias e as fotos delas serão apagadas. Galeria com pedidos não é excluída: ela
              fica de fora e pode ser arquivada.
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

      {criando !== null && (
        <FormularioGaleria
          key={criando}
          aberto
          aoMudarAberto={(v) => !v && setCriando(null)}
          galeria={null}
          autoria={autoria}
          aoCriar={(g) => void navigate({ to: "/galerias/$id", params: { id: g.id } })}
        />
      )}
    </div>
  );
}
