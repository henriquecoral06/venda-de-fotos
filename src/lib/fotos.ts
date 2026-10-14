import { supabase } from "@/integrations/supabase/client";

/** Miniatura e prévia com marca d'água: bucket público. */
export const BUCKET_PREVIAS = "previas";
/** Arquivo enviado pelo fotógrafo: bucket privado, liberado só por pedido pago. */
export const BUCKET_ORIGINAIS = "originais";

/** URL pública de um arquivo do bucket de prévias. */
export function urlPrevia(caminho: string): string {
  return supabase.storage.from(BUCKET_PREVIAS).getPublicUrl(caminho).data.publicUrl;
}

/** "Casamento Ana & João — 2026" → "casamento-ana-joao-2026". */
export function gerarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Link da galeria que o fotógrafo manda para o cliente. */
export function linkGaleria(slug: string): string {
  return `${window.location.origin}/g/${slug}`;
}

export function linkPedido(codigo: string): string {
  return `${window.location.origin}/pedido/${codigo}`;
}

/** "1 foto", "12 fotos". */
export function rotuloFotos(qtd: number): string {
  return `${qtd.toLocaleString("pt-BR")} ${qtd === 1 ? "foto" : "fotos"}`;
}
