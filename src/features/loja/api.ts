import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { normalizarTelefone } from "@/lib/format";

export type ConfiguracoesLoja = Tables<"configuracoes_loja">;

export const CHAVE_LOJA = ["loja"] as const;

export const esquemaLoja = z.object({
  nome_exibicao: z.string().trim().max(120, "O nome pode ter no máximo 120 caracteres."),
  texto_marca_dagua: z.string().trim().max(60, "A marca d'água pode ter no máximo 60 caracteres."),
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

/** Texto da marca d'água: o configurado, o nome da loja ou o da organização. */
export function textoMarcaDagua(
  config: ConfiguracoesLoja | null | undefined,
  nomeOrganizacao: string | undefined,
): string {
  return (
    config?.texto_marca_dagua.trim() ||
    config?.nome_exibicao.trim() ||
    nomeOrganizacao?.trim() ||
    "PRÉVIA"
  );
}

export function useSalvarLoja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: DadosLoja) => {
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
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_LOJA }),
  });
}
