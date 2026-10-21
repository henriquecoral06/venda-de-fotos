import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { BUCKET_MARCA, urlLogo, type Marca } from "@/lib/marca";
import { urlPrevia } from "@/lib/fotos";
import type { EventoPublico } from "@/features/vitrine/api";
import {
  ehModelo,
  esquemaConteudo,
  esquemaCores,
  lerConteudo,
  lerCores,
  type ConteudoLanding,
  type CoresLanding,
  type DadosLanding,
  type ModeloLanding,
} from "./tipos";

export type LandingPage = Tables<"landing_pages">;

export const CHAVE_LANDING = ["landing"] as const;

export const esquemaRastreamento = z.object({
  meta_pixel_id: z
    .string()
    .trim()
    .regex(/^[0-9]{0,20}$/, "O ID do Pixel da Meta só tem números."),
  ga4_id: z
    .string()
    .trim()
    .regex(/^(G-[A-Z0-9]{4,16})?$/, "O ID do GA4 começa com G-."),
  google_ads_id: z
    .string()
    .trim()
    .regex(/^(AW-[0-9]{4,16})?$/, "O ID do Google Ads começa com AW-."),
  gtm_id: z
    .string()
    .trim()
    .regex(/^(GTM-[A-Z0-9]{4,12})?$/, "O ID do Tag Manager começa com GTM-."),
  tiktok_pixel_id: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{0,30}$/, "O ID do Pixel do TikTok tem só letras maiúsculas e números."),
  codigo_head: z.string().max(20_000, "Código longo demais."),
  codigo_body: z.string().max(20_000, "Código longo demais."),
  meta_capi_ativa: z.boolean(),
  meta_test_event_code: z.string().trim().max(40),
});
export type RastreamentoLanding = z.infer<typeof esquemaRastreamento>;

export interface EdicaoLanding {
  titulo: string;
  slug: string;
  modelo: ModeloLanding;
  publicada: boolean;
  cores: CoresLanding;
  conteudo: ConteudoLanding;
  rastreamento: RastreamentoLanding;
}

function erroLegivel(mensagem: string): Error {
  if (/landing_pages_slug_key/.test(mensagem)) {
    return new Error("Já existe uma landing page com este link. Escolha outro.");
  }
  if (/row-level security/i.test(mensagem)) {
    return new Error("Você não tem permissão para alterar esta landing page.");
  }
  return new Error(mensagem);
}

export function useLandings() {
  return useQuery({
    queryKey: [...CHAVE_LANDING, "lista"],
    queryFn: async (): Promise<LandingPage[]> => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw erroLegivel(error.message);
      return data ?? [];
    },
  });
}

export function useLanding(id: string) {
  return useQuery({
    queryKey: [...CHAVE_LANDING, "detalhe", id],
    queryFn: async () => {
      const [landing, token] = await Promise.all([
        supabase.from("landing_pages").select("*").eq("id", id).maybeSingle(),
        supabase.rpc("landing_tem_token_capi", { _landing: id }),
      ]);
      if (landing.error) throw erroLegivel(landing.error.message);
      return { landing: landing.data, temToken: token.data === true };
    },
  });
}

/** Lê a landing do banco no formato do editor. */
export function paraEdicao(l: LandingPage, nomeLoja: string): EdicaoLanding {
  const modelo: ModeloLanding = ehModelo(l.modelo) ? l.modelo : "editorial";
  return {
    titulo: l.titulo,
    slug: l.slug,
    modelo,
    publicada: l.publicada,
    cores: lerCores(l.cores, modelo),
    conteudo: lerConteudo(l.conteudo, modelo, nomeLoja),
    rastreamento: {
      meta_pixel_id: l.meta_pixel_id,
      ga4_id: l.ga4_id,
      google_ads_id: l.google_ads_id,
      gtm_id: l.gtm_id,
      tiktok_pixel_id: l.tiktok_pixel_id,
      codigo_head: l.codigo_head,
      codigo_body: l.codigo_body,
      meta_capi_ativa: l.meta_capi_ativa,
      meta_test_event_code: l.meta_test_event_code,
    },
  };
}

export function useCriarLanding(autoria: { userId: string; organizacaoId: string | null }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: {
      titulo: string;
      slug: string;
      modelo: ModeloLanding;
      cores: CoresLanding;
      conteudo: ConteudoLanding;
    }): Promise<LandingPage> => {
      const { data, error } = await supabase
        .from("landing_pages")
        .insert({
          user_id: autoria.userId,
          organizacao_id: autoria.organizacaoId,
          titulo: dados.titulo.trim(),
          slug: dados.slug,
          modelo: dados.modelo,
          cores: dados.cores as unknown as Json,
          conteudo: dados.conteudo as unknown as Json,
        })
        .select("*")
        .single();
      if (error) throw erroLegivel(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LANDING }),
  });
}

export function useSalvarLanding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dados,
      token,
    }: {
      id: string;
      dados: EdicaoLanding;
      token: string | null;
    }) => {
      const cores = esquemaCores.safeParse(dados.cores);
      const conteudo = esquemaConteudo.safeParse(dados.conteudo);
      const rastreamento = esquemaRastreamento.safeParse(dados.rastreamento);
      for (const r of [cores, conteudo, rastreamento]) {
        if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados inválidos.");
      }
      if (dados.titulo.trim().length < 2) throw new Error("Dê um nome para a landing page.");
      const { data, error } = await supabase
        .from("landing_pages")
        .update({
          titulo: dados.titulo.trim(),
          slug: dados.slug,
          modelo: dados.modelo,
          publicada: dados.publicada,
          cores: cores.data as unknown as Json,
          conteudo: conteudo.data as unknown as Json,
          ...rastreamento.data,
        })
        .eq("id", id)
        .select("id");
      if (error) throw erroLegivel(error.message);
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para alterar esta landing page.");
      }
      // Nulo = não mexer no token; texto (inclusive vazio, para apagar) = gravar.
      if (token !== null) {
        const r = await supabase.rpc("definir_token_capi", { _landing: id, _token: token });
        if (r.error) throw new Error(r.error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LANDING }),
  });
}

export function useExcluirLandings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase
        .from("landing_pages")
        .delete()
        .in("id", ids)
        .select("id");
      if (error) throw erroLegivel(error.message);
      return data?.length ?? 0;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LANDING }),
  });
}

/** Foto da landing: até 1920 px em JPG, na pasta da organização do bucket `marca`. */
export async function enviarImagemLanding(arquivo: File, organizacaoId: string): Promise<string> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu processar a imagem.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Não foi possível preparar a imagem.");
  const caminho = `${organizacaoId}/landing/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET_MARCA)
    .upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`);
  return caminho;
}

/** Link do botão principal: o configurado, o WhatsApp da loja ou a seção de eventos. */
export function linkDoCta(conteudo: ConteudoLanding, whatsapp: string): string {
  if (conteudo.cta_link) return conteudo.cta_link;
  if (whatsapp) {
    const texto = encodeURIComponent(`Olá! Vim pela página ${conteudo.nome} e quero saber mais.`);
    return `https://wa.me/${whatsapp}?text=${texto}`;
  }
  return "#eventos";
}

/**
 * Monta o que o modelo desenha. Sem fotos enviadas, a capa e a galeria usam as
 * capas dos eventos publicados, para a página nunca nascer vazia.
 */
export function montarDados({
  modelo,
  cores,
  conteudo,
  marca,
  whatsapp,
  eventos,
  aoClicarCta,
  aoClicarEvento,
}: {
  modelo: ModeloLanding;
  cores: CoresLanding;
  conteudo: ConteudoLanding;
  marca: Marca | null | undefined;
  whatsapp: string;
  eventos: EventoPublico[];
  aoClicarCta: () => void;
  aoClicarEvento: (slug: string) => void;
}): DadosLanding {
  const capasEventos = eventos
    .map((e) => e.capa)
    .filter((c): c is string => Boolean(c))
    .map(urlPrevia);
  const capa = conteudo.imagens.capa.map(urlLogo);
  const galeria = conteudo.imagens.galeria.map(urlLogo);
  return {
    modelo,
    cores,
    conteudo,
    fotos: {
      capa: capa.length > 0 ? capa : capasEventos,
      galeria: galeria.length > 0 ? galeria : capasEventos,
      sobre: conteudo.imagens.sobre ? urlLogo(conteudo.imagens.sobre) : null,
    },
    logo: marca?.logo ? urlLogo(marca.logo) : null,
    linkCta: linkDoCta(conteudo, whatsapp),
    eventos,
    aoClicarCta,
    aoClicarEvento,
  };
}
