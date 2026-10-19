import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControleSegmentado } from "@/components/ControleSegmentado";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonTabela } from "@/components/Skeletons";
import { usePerfil } from "@/features/perfil/api";
import { useGalerias, type Autoria, type StatusGaleria } from "@/features/galerias/api";
import { FormularioGaleria } from "@/features/galerias/FormularioGaleria";
import { TabelaGalerias } from "@/features/galerias/TabelaGalerias";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/galerias")({
  head: () => ({ meta: [{ title: `Galerias | ${BRAND.name}` }] }),
  component: PaginaGalerias,
});

type Filtro = "ativas" | StatusGaleria;

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

  const autoria: Autoria = {
    userId: ctx?.perfil?.id ?? "",
    organizacaoId: ctx?.organizacao?.id ?? null,
  };

  const filtradas = useMemo(() => {
    const todas = lista.data ?? [];
    if (filtro === "ativas") return todas.filter((g) => g.status !== "arquivada");
    return todas.filter((g) => g.status === filtro);
  }, [lista.data, filtro]);

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
          <ControleSegmentado
            opcoes={FILTROS}
            valor={filtro}
            aoMudar={setFiltro}
            rotuloAria="Filtrar galerias"
          />
          <TabelaGalerias galerias={filtradas} />
        </div>
      )}

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
