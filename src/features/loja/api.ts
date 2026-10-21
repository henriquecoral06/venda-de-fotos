import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { normalizarTelefone } from "@/lib/format";
import { BUCKET_MARCA } from "@/lib/marca";

export type ConfiguracoesLoja = Tables<"configuracoes_loja">;

export const CHAVE_LOJA = ["loja"] as const;

export const esquemaLoja = z.object({
  nome_exibicao: z.string().trim().max(120, "O nome pode ter no máximo 120 caracteres."),
  texto_marca_dagua: z.string().trim().max(60, "A marca d'água pode ter no máximo 60 caracteres."),
  marca_dagua_ativa: z.boolean(),
  chave_pix: z.string().trim().max(140, "A chave Pix pode ter no máximo 140 caracteres."),
  instrucoes_pagamento: z
    .string()
    .trim()
    .max(2_000, "As instruções podem ter no máximo 2.000 caracteres."),
  whatsapp: z
    .string()
    .trim()
    .max(30, "Telefone inválido.")
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Informe o DDD e o número."),
  logo_caminho: z.string().max(300),
  logo_escuro_caminho: z.string().max(300),
  cor_primaria: z.string().regex(/^(#[0-9a-f]{6})?$/, "Cor principal inválida."),
  cor_secundaria: z.string().regex(/^(#[0-9a-f]{6})?$/, "Cor de apoio inválida."),
});

export type DadosLoja = z.infer<typeof esquemaLoja>;

/** Linha única (id = 1), recriada pelo `garantir_instalacao` se faltar. */
export function useConfiguracoesLoja() {
  return useQuery({
    queryKey: CHAVE_LOJA,
    queryFn: async (): Promise<ConfiguracoesLoja | null> => {
      const { data, error } = await supabase
        .from("configuracoes_loja")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/**
 * Texto da marca d'água nas prévias: o configurado, o nome da loja ou o da
 * organização. Nulo quando o dono desligou a marca d'água.
 */
export function textoMarcaDagua(
  config:
    | Pick<ConfiguracoesLoja, "marca_dagua_ativa" | "texto_marca_dagua" | "nome_exibicao">
    | null
    | undefined,
  nomeOrganizacao: string | undefined,
): string | null {
  if (config && !config.marca_dagua_ativa) return null;
  return (
    config?.texto_marca_dagua.trim() ||
    config?.nome_exibicao.trim() ||
    nomeOrganizacao?.trim() ||
    "PRÉVIA"
  );
}

/** Envia a logo já preparada para a pasta da organização; devolve o caminho. */
export async function enviarLogo(logo: Blob, organizacaoId: string): Promise<string> {
  const caminho = `${organizacaoId}/logo-${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from(BUCKET_MARCA)
    .upload(caminho, logo, { contentType: "image/png", cacheControl: "31536000" });
  if (error) throw new Error(`Não foi possível enviar a logo: ${error.message}`);
  return caminho;
}

/** Arquivo de logo que deixou de ser usado; falha aqui não atrapalha a tela. */
export async function removerLogo(caminho: string): Promise<void> {
  if (!caminho) return;
  await supabase.storage.from(BUCKET_MARCA).remove([caminho]);
}

export function useSalvarLoja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dados,
      logoAnterior,
      logoEscuroAnterior,
    }: {
      dados: DadosLoja;
      logoAnterior: string;
      logoEscuroAnterior: string;
    }) => {
      const r = esquemaLoja.safeParse(dados);
      if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados inválidos.");
      const { data, error } = await supabase
        .from("configuracoes_loja")
        .update({ ...r.data, whatsapp: normalizarTelefone(r.data.whatsapp) })
        .eq("id", 1)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Só o dono da organização altera os dados da loja.");
      }
      if (logoAnterior && logoAnterior !== r.data.logo_caminho) await removerLogo(logoAnterior);
      if (logoEscuroAnterior && logoEscuroAnterior !== r.data.logo_escuro_caminho) {
        await removerLogo(logoEscuroAnterior);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LOJA }),
  });
}
