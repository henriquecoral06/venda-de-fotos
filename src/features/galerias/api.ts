import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { BUCKET_ORIGINAIS, BUCKET_PREVIAS } from "@/lib/fotos";
import { extensaoDe, processarFoto } from "./imagens";

export type Galeria = Tables<"galerias">;
export type Foto = Tables<"fotos">;
export type StatusGaleria = Enums<"status_galeria">;
export type GaleriaComContagem = Galeria & {
  capa: { caminho_miniatura: string } | null;
  fotos: { count: number }[];
  pedidos: { count: number }[];
};

/** Raiz das chaves: galerias, fotos e contagens recarregam juntas. */
export const CHAVE_GALERIAS = ["galerias"] as const;

export const ROTULO_STATUS_GALERIA: Record<StatusGaleria, string> = {
  rascunho: "Rascunho",
  publicada: "Publicada",
  arquivada: "Arquivada",
};

/** Quem cria: o id do perfil e a organização atual (nula para quem foi removido). */
export interface Autoria {
  userId: string;
  organizacaoId: string | null;
}

const preco = z
  .number({ invalid_type_error: "Informe um preço válido." })
  .min(0, "O preço não pode ser negativo.")
  .max(100_000, "O preço pode ser no máximo R$ 100.000.");

export const esquemaGaleria = z.object({
  titulo: z
    .string()
    .trim()
    .min(2, "Informe um título com pelo menos 2 caracteres.")
    .max(200, "O título pode ter no máximo 200 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "O link precisa de pelo menos 3 caracteres.")
    .max(80, "O link pode ter no máximo 80 caracteres.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífens no link."),
  descricao: z.string().trim().max(2_000, "A descrição pode ter no máximo 2.000 caracteres."),
  data_evento: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Data inválida."),
  cliente_nome: z.string().trim().max(120, "O nome pode ter no máximo 120 caracteres."),
  cliente_email: z.union([z.literal(""), z.string().trim().email("Informe um e-mail válido.")]),
  status: z.enum(["rascunho", "publicada", "arquivada"]),
  senha: z.string().trim().max(60, "A senha pode ter no máximo 60 caracteres."),
  preco_foto: preco,
  preco_pacote: preco.nullable(),
});

export type DadosGaleria = z.infer<typeof esquemaGaleria>;

function validar(dados: DadosGaleria): DadosGaleria {
  const r = esquemaGaleria.safeParse(dados);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data;
}

function paraBanco(d: DadosGaleria) {
  return {
    titulo: d.titulo,
    slug: d.slug,
    descricao: d.descricao,
    data_evento: d.data_evento || null,
    cliente_nome: d.cliente_nome,
    cliente_email: d.cliente_email,
    status: d.status,
    senha: d.senha,
    preco_foto: d.preco_foto,
    preco_pacote: d.preco_pacote,
  };
}

function erroLegivel(mensagem: string): Error {
  if (/galerias_slug_key/.test(mensagem)) {
    return new Error("Já existe uma galeria com este link. Escolha outro.");
  }
  if (/pedidos_galeria_id_fkey/.test(mensagem)) {
    return new Error("Esta galeria tem pedidos e não pode ser excluída. Arquive-a.");
  }
  if (/pedido_itens_foto_id_fkey/.test(mensagem)) {
    return new Error("Esta foto faz parte de um pedido e não pode ser excluída.");
  }
  if (/row-level security/i.test(mensagem)) {
    return new Error("Você não tem permissão para alterar esta galeria.");
  }
  return new Error(mensagem);
}

export function useGalerias() {
  return useQuery({
    queryKey: [...CHAVE_GALERIAS, "lista"],
    queryFn: async (): Promise<GaleriaComContagem[]> => {
      const { data, error } = await supabase
        .from("galerias")
        .select(
          "*, capa:fotos!galerias_capa_foto_id_fkey(caminho_miniatura), fotos!fotos_galeria_id_fkey(count), pedidos(count)",
        )
        .order("created_at", { ascending: false });
      if (error) throw erroLegivel(error.message);
      return data ?? [];
    },
  });
}

export function useGaleria(id: string) {
  return useQuery({
    queryKey: [...CHAVE_GALERIAS, "detalhe", id],
    queryFn: async (): Promise<Galeria | null> => {
      const { data, error } = await supabase
        .from("galerias")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw erroLegivel(error.message);
      return data;
    },
  });
}

export function useFotos(galeriaId: string) {
  return useQuery({
    queryKey: [...CHAVE_GALERIAS, "fotos", galeriaId],
    queryFn: async (): Promise<Foto[]> => {
      const { data, error } = await supabase
        .from("fotos")
        .select("*")
        .eq("galeria_id", galeriaId)
        .order("ordem")
        .order("created_at");
      if (error) throw erroLegivel(error.message);
      return data ?? [];
    },
  });
}

export function useCriarGaleria(autoria: Autoria) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: DadosGaleria): Promise<Galeria> => {
      const { data, error } = await supabase
        .from("galerias")
        .insert({
          ...paraBanco(validar(dados)),
          user_id: autoria.userId,
          organizacao_id: autoria.organizacaoId,
        })
        .select("*")
        .single();
      if (error) throw erroLegivel(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS }),
  });
}

export function useAtualizarGaleria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosGaleria }) => {
      const { data, error } = await supabase
        .from("galerias")
        .update(paraBanco(validar(dados)))
        .eq("id", id)
        .select("id");
      if (error) throw erroLegivel(error.message);
      // Fora da policy o update não afeta linha nenhuma, sem erro.
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para alterar esta galeria.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS }),
  });
}

export function useDefinirCapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ galeriaId, fotoId }: { galeriaId: string; fotoId: string | null }) => {
      const { data, error } = await supabase
        .from("galerias")
        .update({ capa_foto_id: fotoId })
        .eq("id", galeriaId)
        .select("id");
      if (error) throw erroLegivel(error.message);
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para alterar esta galeria.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS }),
  });
}

async function removerArquivos(
  fotos: Pick<Foto, "caminho_original" | "caminho_previa" | "caminho_miniatura">[],
) {
  if (fotos.length === 0) return;
  // Arquivo que sobra no Storage não quebra nada: o erro aqui não desfaz a exclusão.
  await Promise.allSettled([
    supabase.storage.from(BUCKET_ORIGINAIS).remove(fotos.map((f) => f.caminho_original)),
    supabase.storage
      .from(BUCKET_PREVIAS)
      .remove(fotos.flatMap((f) => [f.caminho_previa, f.caminho_miniatura])),
  ]);
}

export function useExcluirGaleria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const fotos = await supabase
        .from("fotos")
        .select("caminho_original, caminho_previa, caminho_miniatura")
        .eq("galeria_id", id);
      if (fotos.error) throw erroLegivel(fotos.error.message);

      // Primeiro a linha: com pedido, o banco recusa e os arquivos ficam.
      const { data, error } = await supabase.from("galerias").delete().eq("id", id).select("id");
      if (error) throw erroLegivel(error.message);
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para excluir esta galeria.");
      }
      await removerArquivos(fotos.data ?? []);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS }),
  });
}

export function useExcluirFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (foto: Foto) => {
      const { data, error } = await supabase.from("fotos").delete().eq("id", foto.id).select("id");
      if (error) throw erroLegivel(error.message);
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para excluir esta foto.");
      }
      await removerArquivos([foto]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS }),
  });
}

/**
 * Processa (prévia e miniatura com marca d'água), envia os três arquivos e
 * grava a linha. Se algo falhar no meio, apaga o que já subiu.
 */
export async function enviarFoto({
  arquivo,
  galeria,
  autoria,
  marca,
  ordem,
}: {
  arquivo: File;
  galeria: Pick<Galeria, "id">;
  autoria: Autoria;
  marca: string;
  ordem: number;
}): Promise<void> {
  const { previa, miniatura, largura, altura } = await processarFoto(arquivo, marca);

  // A primeira pasta decide quem envia e apaga (policies do Storage).
  const pasta = `${autoria.organizacaoId ?? autoria.userId}/${galeria.id}`;
  const id = crypto.randomUUID();
  const caminhos = {
    caminho_original: `${pasta}/${id}.${extensaoDe(arquivo)}`,
    caminho_previa: `${pasta}/${id}-previa.jpg`,
    caminho_miniatura: `${pasta}/${id}-mini.jpg`,
  };

  const envios = await Promise.all([
    supabase.storage
      .from(BUCKET_ORIGINAIS)
      .upload(caminhos.caminho_original, arquivo, { contentType: arquivo.type }),
    supabase.storage.from(BUCKET_PREVIAS).upload(caminhos.caminho_previa, previa, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    }),
    supabase.storage.from(BUCKET_PREVIAS).upload(caminhos.caminho_miniatura, miniatura, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    }),
  ]);
  const falha = envios.find((r) => r.error);
  if (falha?.error) {
    await removerArquivos([caminhos]);
    throw new Error(`${arquivo.name}: ${falha.error.message}`);
  }

  const { error } = await supabase.from("fotos").insert({
    galeria_id: galeria.id,
    user_id: autoria.userId,
    organizacao_id: autoria.organizacaoId,
    nome_arquivo: arquivo.name,
    ...caminhos,
    largura,
    altura,
    tamanho_bytes: arquivo.size,
    ordem,
  });
  if (error) {
    await removerArquivos([caminhos]);
    throw erroLegivel(`${arquivo.name}: ${error.message}`);
  }
}
