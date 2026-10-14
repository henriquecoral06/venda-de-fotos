import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ControleSegmentado } from "@/components/ControleSegmentado";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonTabela } from "@/components/Skeletons";
import { usePedidos, type PedidoComGaleria, type StatusPedido } from "@/features/pedidos/api";
import { DetalhePedido } from "@/features/pedidos/DetalhePedido";
import { TabelaPedidos } from "@/features/pedidos/TabelaPedidos";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: `Pedidos | ${BRAND.name}` }] }),
  component: PaginaPedidos,
});

type Filtro = "todos" | StatusPedido;

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

  const filtrados = useMemo(() => {
    const todos = lista.data ?? [];
    return filtro === "todos" ? todos : todos.filter((p) => p.status === filtro);
  }, [lista.data, filtro]);

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
          <ControleSegmentado
            opcoes={FILTROS}
            valor={filtro}
            aoMudar={setFiltro}
            rotuloAria="Filtrar pedidos"
          />
          <TabelaPedidos pedidos={filtrados} aoAbrir={(p) => setAbertoId(p.id)} />
        </div>
      )}

      <DetalhePedido pedido={aberto} aoFechar={() => setAbertoId(null)} />
    </div>
  );
}
