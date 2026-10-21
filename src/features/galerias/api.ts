import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { BUCKET_ORIGINAIS, BUCKET_PREVIAS } from "@/lib/fotos";
import { canvasParaAnalise, rostosDaImagem, vetorParaBanco } from "@/lib/rostos";
import { extensaoDaPrevia, extensaoDe, processarFoto } from "./imagens";

export type Galeria = Tables<"galerias">;
export type Foto = Tables<"fotos">;
export type StatusGaleria = Enums<"status_galeria">;
export type TipoGaleria = Enums<"tipo_galeria">;
export type GaleriaComContagem = Galeria & {
  capa: { caminho_miniatura: string } | null;
  /** Primeira foto da galeria: a capa enquanto o fotógrafo não escolhe outra. */
  primeira: { caminho_miniatura: string }[];
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
  tipo: z.enum(["privada", "evento"]),
  categoria: z.string().trim().max(60, "A categoria pode ter no máximo 60 caracteres."),
  local: z.string().trim().max(120, "O local pode ter no máximo 120 caracteres."),
  busca_rosto: z.boolean(),
  download_liberado: z.boolean(),
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
    tipo: d.tipo,
    categoria: d.tipo === "evento" ? d.categoria : "",
    local: d.local,
    busca_rosto: d.busca_rosto,
    download_liberado: d.download_liberado,
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
          "*, capa:fotos!galerias_capa_foto_id_fkey(caminho_miniatura), primeira:fotos!fotos_galeria_id_fkey(caminho_miniatura), fotos!fotos_galeria_id_fkey(count), pedidos(count)",
        )
        .order("created_at", { ascending: false })
        .order("ordem", { referencedTable: "primeira" })
        .limit(1, { referencedTable: "primeira" });
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

/** Chave nova do link (16 caracteres hex): o link antigo para de abrir. */
function novaChave(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useGerarNovoLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (galeriaId: string) => {
      const { data, error } = await supabase
        .from("galerias")
        .update({ chave: novaChave() })
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

async function excluirGaleria(id: string): Promise<void> {
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
}

export function useExcluirGaleria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: excluirGaleria,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS }),
  });
}

/** Resultado de uma ação em massa: o que deu certo e o que o banco recusou. */
export interface ResultadoEmMassa {
  feitas: number;
  recusadas: number;
  /** Primeira mensagem de recusa, para o toast. */
  motivo: string | null;
}

/** Troca a situação de várias galerias de uma vez. */
export function useMudarStatusGalerias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      status,
    }: {
      ids: string[];
      status: StatusGaleria;
    }): Promise<ResultadoEmMassa> => {
      const { data, error } = await supabase
        .from("galerias")
        .update({ status })
        .in("id", ids)
        .select("id");
      if (error) throw erroLegivel(error.message);
      // Fora da policy o update ignora a linha, sem erro.
      const feitas = data?.length ?? 0;
      return {
        feitas,
        recusadas: ids.length - feitas,
        motivo: feitas < ids.length ? "Sem permissão para alterar algumas galerias." : null,
      };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS }),
  });
}

/**
 * Exclui várias galerias, uma a uma: a que tem pedido é recusada pelo banco e
 * as outras seguem.
 */
export function useExcluirGalerias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<ResultadoEmMassa> => {
      let feitas = 0;
      let motivo: string | null = null;
      for (const id of ids) {
        try {
          await excluirGaleria(id);
          feitas += 1;
        } catch (e: unknown) {
          motivo ??= e instanceof Error ? e.message : "Não foi possível excluir.";
        }
      }
      return { feitas, recusadas: ids.length - feitas, motivo };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_GALERIAS }),
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
  indexarRostos,
}: {
  arquivo: File;
  galeria: Pick<Galeria, "id">;
  autoria: Autoria;
  /** Texto da marca d'água; nulo = prévia sem marca. */
  marca: string | null;
  ordem: number;
  /** Galeria de evento com busca por selfie: grava os rostos da foto. */
  indexarRostos: boolean;
}): Promise<number> {
  const { previa, miniatura, largura, altura, rostos } = await processarFoto(
    arquivo,
    marca,
    indexarRostos,
  );

  // A primeira pasta decide quem envia e apaga (policies do Storage).
  const pasta = `${autoria.organizacaoId ?? autoria.userId}/${galeria.id}`;
  const id = crypto.randomUUID();
  const caminhos = {
    caminho_original: `${pasta}/${id}.${extensaoDe(arquivo)}`,
    caminho_previa: `${pasta}/${id}-previa.${extensaoDaPrevia(previa)}`,
    caminho_miniatura: `${pasta}/${id}-mini.${extensaoDaPrevia(miniatura)}`,
  };

  const envios = await Promise.all([
    supabase.storage
      .from(BUCKET_ORIGINAIS)
      .upload(caminhos.caminho_original, arquivo, { contentType: arquivo.type }),
    supabase.storage.from(BUCKET_PREVIAS).upload(caminhos.caminho_previa, previa, {
      contentType: previa.type,
      cacheControl: "31536000",
    }),
    supabase.storage.from(BUCKET_PREVIAS).upload(caminhos.caminho_miniatura, miniatura, {
      contentType: miniatura.type,
      cacheControl: "31536000",
    }),
  ]);
  const falha = envios.find((r) => r.error);
  if (falha?.error) {
    await removerArquivos([caminhos]);
    throw new Error(`${arquivo.name}: ${falha.error.message}`);
  }

  const { data: foto, error } = await supabase
    .from("fotos")
    .insert({
      galeria_id: galeria.id,
      user_id: autoria.userId,
      organizacao_id: autoria.organizacaoId,
      nome_arquivo: arquivo.name,
      ...caminhos,
      largura,
      altura,
      tamanho_bytes: arquivo.size,
      ordem,
      rostos_analisados_em: indexarRostos && rostos ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    await removerArquivos([caminhos]);
    throw erroLegivel(`${arquivo.name}: ${error.message}`);
  }
  if (rostos && rostos.length > 0) await gravarRostos(foto.id, galeria.id, rostos, autoria);
  return rostos?.length ?? 0;
}

async function gravarRostos(
  fotoId: string,
  galeriaId: string,
  vetores: number[][],
  autoria: Autoria,
): Promise<void> {
  const { error } = await supabase.from("rostos").insert(
    vetores.map((v) => ({
      foto_id: fotoId,
      galeria_id: galeriaId,
      user_id: autoria.userId,
      organizacao_id: autoria.organizacaoId,
      embedding: vetorParaBanco(v),
    })),
  );
  if (error) throw new Error(`Não foi possível gravar os rostos da foto: ${error.message}`);
}

export interface ResumoRostos {
  totalFotos: number;
  analisadas: number;
  rostos: number;
}

export function useResumoRostos(galeriaId: string, ativo: boolean) {
  return useQuery({
    queryKey: [...CHAVE_GALERIAS, "rostos", galeriaId],
    enabled: ativo,
    queryFn: async (): Promise<ResumoRostos> => {
      const contarFotos = () =>
        supabase
          .from("fotos")
          .select("id", { count: "exact", head: true })
          .eq("galeria_id", galeriaId);
      const [total, analisadas, rostos] = await Promise.all([
        contarFotos(),
        contarFotos().not("rostos_analisados_em", "is", null),
        supabase
          .from("rostos")
          .select("id", { count: "exact", head: true })
          .eq("galeria_id", galeriaId),
      ]);
      for (const r of [total, analisadas, rostos]) {
        if (r.error) throw new Error(r.error.message);
      }
      return {
        totalFotos: total.count ?? 0,
        analisadas: analisadas.count ?? 0,
        rostos: rostos.count ?? 0,
      };
    },
  });
}

/**
 * Procura rostos nas fotos da galeria que ainda não foram analisadas (enviadas
 * antes de virar evento). Lê o original pelo Storage, de 50 em 50 fotos.
 */
export async function analisarFotosPendentes(
  galeriaId: string,
  autoria: Autoria,
  aoAvancar: (feitas: number, total: number) => void,
): Promise<{ fotos: number; rostos: number }> {
  const pendentes = await supabase
    .from("fotos")
    .select("id", { count: "exact", head: true })
    .eq("galeria_id", galeriaId)
    .is("rostos_analisados_em", null);
  if (pendentes.error) throw new Error(pendentes.error.message);
  const total = pendentes.count ?? 0;
  let feitas = 0;
  let rostos = 0;
  aoAvancar(0, total);

  for (;;) {
    const { data, error } = await supabase
      .from("fotos")
      .select("id, caminho_original")
      .eq("galeria_id", galeriaId)
      .is("rostos_analisados_em", null)
      .order("ordem")
      .limit(50);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const foto of data) {
      const baixado = await supabase.storage.from(BUCKET_ORIGINAIS).download(foto.caminho_original);
      if (baixado.error) throw new Error(`Não foi possível ler a foto: ${baixado.error.message}`);
      const bitmap = await createImageBitmap(baixado.data, { imageOrientation: "from-image" });
      let vetores: number[][];
      try {
        vetores = await rostosDaImagem(canvasParaAnalise(bitmap), "precisao");
      } finally {
        bitmap.close();
      }
      if (vetores.length > 0) await gravarRostos(foto.id, galeriaId, vetores, autoria);
      const marcada = await supabase
        .from("fotos")
        .update({ rostos_analisados_em: new Date().toISOString() })
        .eq("id", foto.id);
      if (marcada.error) throw new Error(marcada.error.message);
      rostos += vetores.length;
      feitas += 1;
      aoAvancar(feitas, total);
    }
  }
  return { fotos: feitas, rostos };
}
