import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Evento da landing para a API de Conversões da Meta. Server function sem
 * login de propósito: o visitante do anúncio não tem conta, e o que só o
 * servidor sabe é o IP e o user agent de quem acessou (a Meta usa para casar o
 * evento com a pessoa). O token fica no banco: a chamada usa a chave pública e
 * `enviar_evento_meta` faz o resto. Sem service role.
 */
export const enviarEventoConversao = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().max(80),
      evento: z.enum(["PageView", "ViewContent", "Contact", "Lead"]),
      eventId: z.string().max(100),
      url: z.string().max(1000),
      fbp: z.string().max(200),
      fbc: z.string().max(500),
    }),
  )
  .handler(async ({ data }) => {
    const requisicao = getRequest();
    const cabecalhos = requisicao?.headers;
    const ip =
      cabecalhos?.get("cf-connecting-ip") ??
      cabecalhos?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";
    const agente = cabecalhos?.get("user-agent") ?? "";
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: enviado, error } = await supabase.rpc("enviar_evento_meta", {
      _slug: data.slug,
      _evento: data.evento,
      _event_id: data.eventId,
      _url: data.url,
      _user_agent: agente,
      _ip: ip,
      _fbp: data.fbp,
      _fbc: data.fbc,
    });
    if (error) throw new Error(error.message);
    return { enviado: enviado === true };
  });
