import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Perfil = Tables<"perfis">;
export type MembroOrganizacao = Tables<"organizacao_membros">;
export type Organizacao = Tables<"organizacoes">;

export interface ContextoPerfil {
  perfil: Perfil | null;
  membro: MembroOrganizacao | null;
  organizacao: Organizacao | null;
  ehDono: boolean;
}

const VAZIO: ContextoPerfil = { perfil: null, membro: null, organizacao: null, ehDono: false };

/** Chave do contexto do usuário no React Query. */
export const CHAVE_PERFIL = ["perfil"] as const;

/**
 * Carrega, numa só função, tudo o que o app precisa saber do usuário logado.
 * Todo o resto do app lê daqui; nada refaz estas consultas.
 */
async function carregarContexto(): Promise<ContextoPerfil> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return VAZIO;

  const [perfilRes, membroRes] = await Promise.all([
    supabase.from("perfis").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("organizacao_membros").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (perfilRes.error) throw perfilRes.error;
  if (membroRes.error) throw membroRes.error;

  const membro = membroRes.data;
  let organizacao: Organizacao | null = null;
  if (membro) {
    const { data, error } = await supabase
      .from("organizacoes")
      .select("*")
      .eq("id", membro.organizacao_id)
      .maybeSingle();
    if (error) throw error;
    organizacao = data;
  }

  return {
    perfil: perfilRes.data,
    membro,
    organizacao,
    ehDono: membro?.papel === "dono",
  };
}

export function usePerfil() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CHAVE_PERFIL, queryFn: carregarContexto, retry: 1 });
  return { ...q, invalidar: () => qc.invalidateQueries({ queryKey: CHAVE_PERFIL }) };
}

/** Rótulo do usuário no rodapé da sidebar. */
export function rotuloUsuario(ctx: ContextoPerfil | undefined): string {
  if (!ctx?.organizacao) return "Sem organização";
  return `${ctx.ehDono ? "Dono" : "Membro"} · ${ctx.organizacao.nome}`;
}

/** "Ana Maria Souza" → "Ana". */
export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}
