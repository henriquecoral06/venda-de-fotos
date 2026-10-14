import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CHAVE_PERFIL, type Organizacao } from "@/features/perfil/api";

/**
 * Gestão da organização única. Toda escrita passa por função do banco
 * (`remover_membro`, `readmitir_membro`, `definir_cadastro_aberto`) ou pela
 * policy de update de `organizacoes`: as duas só aceitam o dono. A tela apenas
 * esconde o que o banco vai negar.
 */

export const CHAVE_MEMBROS = ["equipe", "membros"] as const;
export const CHAVE_CONTAS_FORA = ["equipe", "contas-fora"] as const;

export interface LinhaMembro {
  userId: string;
  nome: string;
  email: string;
  dono: boolean;
}

export function useMembros(organizacaoId: string) {
  return useQuery({
    queryKey: [...CHAVE_MEMBROS, organizacaoId],
    queryFn: async (): Promise<LinhaMembro[]> => {
      const { data: vinculos, error } = await supabase
        .from("organizacao_membros")
        .select("user_id,papel")
        .eq("organizacao_id", organizacaoId);
      if (error) throw new Error(error.message);

      const ids = (vinculos ?? []).map((v) => v.user_id);
      if (ids.length === 0) return [];

      const { data: perfis, error: erroPerfis } = await supabase
        .from("perfis")
        .select("id,nome,email")
        .in("id", ids);
      if (erroPerfis) throw new Error(erroPerfis.message);

      const linhas: LinhaMembro[] = (vinculos ?? []).map((v) => {
        const perfil = (perfis ?? []).find((p) => p.id === v.user_id);
        return {
          userId: v.user_id,
          nome: perfil?.nome ?? "—",
          email: perfil?.email ?? "",
          dono: v.papel === "dono",
        };
      });

      // Dono primeiro, depois os membros em ordem alfabética.
      return linhas.sort((a, b) => {
        if (a.dono !== b.dono) return a.dono ? -1 : 1;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
    },
  });
}

/** Só o dono consegue chamar; para os demais a query nem roda. */
export function useContasFora(habilitado: boolean) {
  return useQuery({
    queryKey: CHAVE_CONTAS_FORA,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("contas_fora_da_organizacao");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

function useInvalidarEquipe() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: CHAVE_PERFIL });
    void qc.invalidateQueries({ queryKey: ["equipe"] });
  };
}

export function useSalvarOrganizacao(organizacao: Organizacao) {
  const invalidar = useInvalidarEquipe();
  return useMutation({
    mutationFn: async (nome: string) => {
      const nomeLimpo = nome.trim();
      if (nomeLimpo.length < 2) throw new Error("Informe o nome da organização.");
      const { data, error } = await supabase
        .from("organizacoes")
        .update({ nome: nomeLimpo })
        .eq("id", organizacao.id)
        .select("id");
      if (error) throw new Error(error.message);
      // RLS: fora do dono o update não afeta linha nenhuma, sem erro.
      if (!data || data.length === 0) {
        throw new Error("Só o dono da organização pode editar estes dados.");
      }
    },
    onSuccess: invalidar,
  });
}

export function useDefinirCadastro() {
  const invalidar = useInvalidarEquipe();
  return useMutation({
    mutationFn: async (aberto: boolean) => {
      const { data, error } = await supabase.rpc("definir_cadastro_aberto", { _aberto: aberto });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useRemoverMembro() {
  const invalidar = useInvalidarEquipe();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remover_membro", { _user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidar,
  });
}

export function useReadmitirMembro() {
  const invalidar = useInvalidarEquipe();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("readmitir_membro", { _user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidar,
  });
}
