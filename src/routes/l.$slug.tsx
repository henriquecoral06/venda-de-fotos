import { useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { montarDados } from "@/features/landing/api";
import { RenderLanding } from "@/features/landing/RenderLanding";
import { instalarRastreamento, rastrear } from "@/features/landing/rastreamento";
import { ehModelo, lerConteudo, lerCores } from "@/features/landing/tipos";
import type { EventoPublico } from "@/features/vitrine/api";
import type { Marca } from "@/lib/marca";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/l/$slug")({
  // Pixels e tags rodam no navegador; a página é montada lá também.
  ssr: false,
  head: () => ({ meta: [{ title: BRAND.name }] }),
  component: PaginaLanding,
});

const esquemaPublica = z.object({
  slug: z.string(),
  modelo: z.string(),
  cores: z.unknown(),
  conteudo: z.unknown(),
  fotografo: z.string().nullable().optional(),
  marca: z.unknown().optional(),
  whatsapp: z.string().nullable().optional(),
  eventos: z.array(z.unknown()),
  rastreamento: z.object({
    meta_pixel_id: z.string(),
    ga4_id: z.string(),
    google_ads_id: z.string(),
    gtm_id: z.string(),
    tiktok_pixel_id: z.string(),
    codigo_head: z.string(),
    codigo_body: z.string(),
    meta_capi: z.boolean(),
  }),
});

function PaginaLanding() {
  const { slug } = Route.useParams();
  const consulta = useQuery({
    queryKey: ["landing-publica", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("landing_publica", { _slug: slug });
      if (error) throw new Error(error.message);
      if (data === null) return null;
      const r = esquemaPublica.safeParse(data);
      if (!r.success) throw new Error("Resposta inesperada do servidor.");
      return r.data;
    },
  });

  const pagina = consulta.data;

  useEffect(() => {
    if (pagina) instalarRastreamento(pagina.slug, pagina.rastreamento);
  }, [pagina]);

  const dados = useMemo(() => {
    if (!pagina) return null;
    const modelo = ehModelo(pagina.modelo) ? pagina.modelo : "editorial";
    const nome = pagina.fotografo || BRAND.name;
    const conteudo = lerConteudo(pagina.conteudo, modelo, nome);
    return montarDados({
      modelo,
      cores: lerCores(pagina.cores, modelo),
      conteudo,
      marca: (pagina.marca ?? null) as Marca | null,
      whatsapp: pagina.whatsapp ?? "",
      eventos: pagina.eventos as EventoPublico[],
      aoClicarCta: () => rastrear("Contact", { content_name: conteudo.cta_texto }),
      aoClicarEvento: (s) => rastrear("ViewContent", { content_ids: [s], content_type: "evento" }),
    });
  }, [pagina]);

  useEffect(() => {
    if (dados) document.title = `${dados.conteudo.nome} | ${dados.conteudo.titulo}`;
  }, [dados]);

  if (consulta.isPending) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-[70vh] w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (consulta.isError || !dados) {
    return (
      <div className="mx-auto max-w-xl p-4 py-24">
        <EstadoVazio
          titulo={consulta.isError ? "Não foi possível abrir a página" : "Página não encontrada"}
          descricao={
            consulta.isError
              ? consulta.error.message
              : "Este link não existe ou a página ainda não foi publicada."
          }
        />
      </div>
    );
  }
  return <RenderLanding dados={dados} />;
}
