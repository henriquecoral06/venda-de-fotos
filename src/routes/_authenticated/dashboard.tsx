import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { CartaoMetrica, SkeletonMetricas } from "@/components/CartaoMetrica";
import { SkeletonTabela } from "@/components/Skeletons";
import { primeiroNome, usePerfil } from "@/features/perfil/api";
import { useMetricasVendas, usePedidos } from "@/features/pedidos/api";
import { DetalhePedido } from "@/features/pedidos/DetalhePedido";
import { TabelaPedidos } from "@/features/pedidos/TabelaPedidos";
import { brl } from "@/lib/format";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: `Início | ${BRAND.name}` }] }),
  component: PaginaDashboard,
});

function PaginaDashboard() {
  const { data: ctx } = usePerfil();
  const metricas = useMetricasVendas();
  const pedidos = usePedidos();
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const nome = primeiroNome(ctx?.perfil?.nome);
  const aguardando = (pedidos.data ?? []).filter((p) => p.status === "aguardando_pagamento");
  const recentes =
    aguardando.length > 0 ? aguardando.slice(0, 5) : (pedidos.data ?? []).slice(0, 5);
  const aberto = pedidos.data?.find((p) => p.id === abertoId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo={nome ? `Olá, ${nome}` : "Início"}
        descricao={
          ctx?.organizacao
            ? `Vendas de ${ctx.organizacao.nome}.`
            : "Você não faz parte da organização no momento: aqui aparece só o que é seu."
        }
        acoes={
          <Button asChild>
            <Link to="/galerias">
              <Plus className="size-4" />
              Nova galeria
            </Link>
          </Button>
        }
      />

      {metricas.isPending ? (
        <SkeletonMetricas quantidade={4} />
      ) : metricas.isError ? (
        <EstadoVazio
          titulo="Não foi possível carregar os números"
          descricao={metricas.error.message}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CartaoMetrica rotulo="Vendido" valor={brl(metricas.data.faturado)} />
          <CartaoMetrica rotulo="A receber" valor={brl(metricas.data.valorAguardando)} />
          <CartaoMetrica rotulo="Galerias publicadas" valor={metricas.data.galeriasPublicadas} />
          <CartaoMetrica rotulo="Fotos enviadas" valor={metricas.data.fotos} />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-heading-sm">
            {aguardando.length > 0 ? "Aguardando pagamento" : "Pedidos recentes"}
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/pedidos">Ver todos</Link>
          </Button>
        </div>
        {pedidos.isPending ? (
          <SkeletonTabela linhas={3} colunas={4} />
        ) : pedidos.isError ? (
          <EstadoVazio
            titulo="Não foi possível carregar os pedidos"
            descricao={pedidos.error.message}
          />
        ) : recentes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum pedido ainda"
            descricao="Crie uma galeria, envie as fotos, publique e mande o link para o cliente. Os pedidos aparecem aqui."
            acao={
              <Button asChild variant="outline">
                <Link to="/galerias">Ver galerias</Link>
              </Button>
            }
          />
        ) : (
          <TabelaPedidos pedidos={recentes} aoAbrir={(p) => setAbertoId(p.id)} compacta />
        )}
      </section>

      <DetalhePedido pedido={aberto} aoFechar={() => setAbertoId(null)} />
    </div>
  );
}
