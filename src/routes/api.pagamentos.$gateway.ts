import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

/**
 * Aviso de pagamento do Asaas e do Mercado Pago. A rota só repassa ao banco:
 * `receber_webhook_pagamento` confere o segredo, consulta o pagamento no
 * gateway com a chave do fotógrafo e grava o log. O segredo vem no cabeçalho
 * `asaas-access-token` (Asaas) ou em `?secret=` (Mercado Pago, que não
 * repassa cabeçalho). Sem service role: a chamada usa a chave pública.
 */
export const Route = createFileRoute("/api/pagamentos/$gateway")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const url = new URL(request.url);
        const segredo =
          request.headers.get("asaas-access-token") ?? url.searchParams.get("secret") ?? "";

        let corpo: { [chave: string]: Json | undefined } = {};
        try {
          const lido = (await request.json()) as Json;
          if (lido && typeof lido === "object" && !Array.isArray(lido)) corpo = { ...lido };
        } catch {
          // O Mercado Pago também avisa só pela URL (`?topic=payment&id=…`).
        }
        // Parâmetros da URL entram no corpo sem sobrescrever o que veio nele.
        for (const [chave, valor] of url.searchParams) {
          if (chave !== "secret" && !(chave in corpo)) corpo[chave] = valor;
        }

        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.rpc("receber_webhook_pagamento", {
          _gateway: params.gateway,
          _segredo: segredo,
          _corpo: corpo,
        });
        if (error) return new Response("erro", { status: 500 });
        if (data === "recusado") return new Response("recusado", { status: 401 });
        return new Response("ok", { status: 200 });
      },
    },
  },
});
