import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BarraSelecao } from "@/components/BarraSelecao";
import { ControleSegmentado } from "@/components/ControleSegmentado";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonTabela } from "@/components/Skeletons";
import {
  useMudarStatusPedidos,
  usePedidos,
  type PedidoComGaleria,
  type StatusPedido,
} from "@/features/pedidos/api";
import { DetalhePedido } from "@/features/pedidos/DetalhePedido";
import { TabelaPedidos } from "@/features/pedidos/TabelaPedidos";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: `Pedidos | ${BRAND.name}` }] }),
  component: PaginaPedidos,
});

type Filtro = "todos" | StatusPedido;

/** "1 pedido" / "3 pedidos", e o "s" do particípio que vem depois. */
function pedidos(qtd: number): { texto: string; s: string } {
  return {
    texto: `${qtd.toLocaleString("pt-BR")} pedido${qtd === 1 ? "" : "s"}`,
    s: qtd === 1 ? "" : "s",
  };
}

// Pedido não é excluído (é registro de venda): o fim de um pedido é cancelar.
const ACOES_STATUS = [
  {
    status: "pago",
    rotulo: "Confirmar pagamento",
    icone: Check,
    mensagem: (n: number) =>
      `${pedidos(n).texto} pago${pedidos(n).s}. Os clientes já podem baixar as fotos.`,
  },
  {
    status: "aguardando_pagamento",
    rotulo: "Voltar para aguardando",
    icone: Clock,
    mensagem: (n: number) => `${pedidos(n).texto} aguardando pagamento.`,
  },
  {
    status: "cancelado",
    rotulo: "Cancelar",
    icone: X,
    mensagem: (n: number) => `${pedidos(n).texto} cancelado${pedidos(n).s}.`,
  },
] as const;

const FILTROS = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "aguardando_pagamento", rotulo: "Aguardando" },
  { valor: "pago", rotulo: "Pagos" },
  { valor: "cancelado", rotulo: "Cancelados" },
] as const;

function PaginaPedidos() {
  const lista = usePedidos();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const mudarStatus = useMudarStatusPedidos();

  const filtrados = useMemo(() => {
    const todos = lista.data ?? [];
    return filtro === "todos" ? todos : todos.filter((p) => p.status === filtro);
  }, [lista.data, filtro]);

  // Só conta o que está na tela: trocar o filtro não age sobre linha escondida.
  const marcados = useMemo(
    () => filtrados.filter((p) => selecionados.has(p.id)),
    [filtrados, selecionados],
  );

  function aplicarStatus(status: StatusPedido, mensagem: (n: number) => string) {
    // Só os que mudam de fato (pedido já pago não "paga de novo").
    const ids = marcados.filter((p) => p.status !== status).map((p) => p.id);
    if (ids.length === 0) {
      toast.info("Os pedidos selecionados já estão nessa situação.");
      return;
    }
    mudarStatus.mutate(
      { ids, status },
      {
        onSuccess: (r) => {
          if (r.feitos > 0) toast.success(mensagem(r.feitos));
          if (r.recusados > 0) {
            toast.error(`Sem permissão para alterar ${pedidos(r.recusados).texto}.`);
          }
          setSelecionados(new Set());
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  // Pelo id: depois de mudar o status, o Dialog mostra a linha recarregada.
  const aberto: PedidoComGaleria | null = lista.data?.find((p) => p.id === abertoId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo="Pedidos"
        descricao="Pedidos feitos pelos clientes nas galerias. Confirme o pagamento para liberar o download."
      />

      {lista.isPending ? (
        <SkeletonTabela linhas={5} colunas={5} />
      ) : lista.isError ? (
        <EstadoVazio
          titulo="Não foi possível carregar os pedidos"
          descricao={lista.error.message}
          acao={
            <Button variant="outline" onClick={() => void lista.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : lista.data.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum pedido ainda"
          descricao="Quando um cliente escolher fotos numa galeria publicada, o pedido aparece aqui."
          acao={
            <Button asChild variant="outline">
              <Link to="/galerias">Ver galerias</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {marcados.length > 0 ? (
            <BarraSelecao
              quantidade={marcados.length}
              singular="pedido selecionado"
              plural="pedidos selecionados"
              aoLimpar={() => setSelecionados(new Set())}
            >
              {ACOES_STATUS.map((a) => (
                <Button
                  key={a.status}
                  size="sm"
                  variant={a.status === "cancelado" ? "ghost" : "outline"}
                  className={
                    a.status === "cancelado" ? "text-destructive hover:text-destructive" : undefined
                  }
                  disabled={mudarStatus.isPending}
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
            </BarraSelecao>
          ) : (
            <ControleSegmentado
              opcoes={FILTROS}
              valor={filtro}
              aoMudar={setFiltro}
              rotuloAria="Filtrar pedidos"
            />
          )}
          <TabelaPedidos
            pedidos={filtrados}
            aoAbrir={(p) => setAbertoId(p.id)}
            selecao={{
              selecionadas: selecionados,
              aoMudar: setSelecionados,
              rotulo: (p) => `pedido de ${p.cliente_nome}`,
            }}
          />
        </div>
      )}

      <DetalhePedido pedido={aberto} aoFechar={() => setAbertoId(null)} />
    </div>
  );
}
