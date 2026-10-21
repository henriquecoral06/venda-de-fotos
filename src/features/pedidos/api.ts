import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";

export type Pedido = Tables<"pedidos">;
export type StatusPedido = Enums<"status_pedido">;
export type PedidoComGaleria = Pedido & {
  galeria: { titulo: string; slug: string } | null;
  itens: { count: number }[];
};
export interface ItemPedido {
  preco: number;
  foto: { id: string; nome_arquivo: string; caminho_miniatura: string } | null;
}

export const CHAVE_PEDIDOS = ["pedidos"] as const;

export const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  aguardando_pagamento: "Aguardando",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const VARIANTE_STATUS_PEDIDO = {
  aguardando_pagamento: "warning",
  pago: "success",
  cancelado: "secondary",
} as const satisfies Record<StatusPedido, string>;

export function usePedidos() {
  return useQuery({
    queryKey: [...CHAVE_PEDIDOS, "lista"],
    queryFn: async (): Promise<PedidoComGaleria[]> => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*, galeria:galerias(titulo, slug), itens:pedido_itens(count)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useItensPedido(pedidoId: string | null) {
  return useQuery({
    queryKey: [...CHAVE_PEDIDOS, "itens", pedidoId],
    enabled: pedidoId !== null,
    queryFn: async (): Promise<ItemPedido[]> => {
      const { data, error } = await supabase
        .from("pedido_itens")
        .select("preco, foto:fotos(id, nome_arquivo, caminho_miniatura)")
        .eq("pedido_id", pedidoId ?? "");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export interface MetricasVendas {
  faturado: number;
  pedidosPagos: number;
  aguardando: number;
  valorAguardando: number;
  galeriasPublicadas: number;
  fotos: number;
}

/** Números do início. Os valores somam no cliente: a RLS já limita às linhas visíveis. */
export function useMetricasVendas() {
  return useQuery({
    queryKey: [...CHAVE_PEDIDOS, "metricas"],
    queryFn: async (): Promise<MetricasVendas> => {
      const [pedidos, galerias, fotos] = await Promise.all([
        supabase.from("pedidos").select("status, valor_total").neq("status", "cancelado"),
        supabase
          .from("galerias")
          .select("id", { count: "exact", head: true })
          .eq("status", "publicada"),
        supabase.from("fotos").select("id", { count: "exact", head: true }),
      ]);
      for (const r of [pedidos, galerias, fotos]) {
        if (r.error) throw new Error(r.error.message);
      }
      const linhas = pedidos.data ?? [];
      const pagos = linhas.filter((p) => p.status === "pago");
      const abertos = linhas.filter((p) => p.status === "aguardando_pagamento");
      const soma = (l: typeof linhas) => l.reduce((t, p) => t + Number(p.valor_total), 0);
      return {
        faturado: soma(pagos),
        pedidosPagos: pagos.length,
        aguardando: abertos.length,
        valorAguardando: soma(abertos),
        galeriasPublicadas: galerias.count ?? 0,
        fotos: fotos.count ?? 0,
      };
    },
  });
}

/** Troca a situação de vários pedidos de uma vez; devolve quantos mudaram. */
export function useMudarStatusPedidos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: StatusPedido }) => {
      const { data, error } = await supabase
        .from("pedidos")
        .update({ status })
        .in("id", ids)
        .select("id");
      if (error) throw new Error(error.message);
      // Fora da policy o update ignora a linha, sem erro.
      return { feitos: data?.length ?? 0, recusados: ids.length - (data?.length ?? 0) };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_PEDIDOS }),
  });
}

export function useMudarStatusPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusPedido }) => {
      const { data, error } = await supabase
        .from("pedidos")
        .update({ status })
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para alterar este pedido.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_PEDIDOS }),
  });
}
