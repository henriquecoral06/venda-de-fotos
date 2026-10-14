import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { normalizarTelefone } from "@/lib/format";
import { BUCKET_ORIGINAIS } from "@/lib/fotos";

/**
 * Lado do cliente final (sem conta). Nada aqui lê tabela: as funções
 * `galeria_publica`, `criar_pedido` e `pedido_publico` conferem status e senha
 * no banco, e o Storage só assina o original de pedido pago.
 */

const fotoPublica = z.object({
  id: z.string(),
  nome: z.string(),
  previa: z.string(),
  miniatura: z.string(),
  largura: z.number(),
  altura: z.number(),
});

// Opcional: banco ainda sem a migration `marca_da_loja` devolve sem ela.
const marca = z
  .object({
    logo: z.string().nullable(),
    cor_primaria: z.string().nullable(),
    cor_secundaria: z.string().nullable(),
  })
  .nullable()
  .optional();

const galeriaPublica = z.object({
  slug: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  data_evento: z.string().nullable(),
  fotografo: z.string(),
  marca,
  protegida: z.boolean(),
  capa: z.string().nullable(),
  total_fotos: z.number(),
  liberada: z.boolean(),
  preco_foto: z.number().optional(),
  preco_pacote: z.number().nullable().optional(),
  fotos: z.array(fotoPublica).optional(),
});

const statusPedido = z.enum(["aguardando_pagamento", "pago", "cancelado"]);

const pedidoPublico = z.object({
  codigo: z.string(),
  status: statusPedido,
  cliente_nome: z.string(),
  cliente_email: z.string(),
  pacote_completo: z.boolean(),
  valor_total: z.number(),
  created_at: z.string(),
  pago_em: z.string().nullable(),
  galeria: z.object({ titulo: z.string(), slug: z.string() }),
  fotografo: z.string(),
  marca,
  pagamento: z.object({ chave_pix: z.string(), instrucoes: z.string(), whatsapp: z.string() }),
  itens: z.array(
    z.object({
      foto_id: z.string(),
      nome: z.string(),
      previa: z.string(),
      miniatura: z.string(),
      preco: z.number(),
      original: z.string().nullable(),
    }),
  ),
});

export type FotoPublica = z.infer<typeof fotoPublica>;
export type GaleriaPublica = z.infer<typeof galeriaPublica>;
export type PedidoPublico = z.infer<typeof pedidoPublico>;

export const CHAVE_VITRINE = ["vitrine"] as const;

function ler<T>(esquema: z.ZodType<T>, dado: unknown): T | null {
  if (dado === null) return null;
  const r = esquema.safeParse(dado);
  if (!r.success) throw new Error("Resposta inesperada do servidor. Recarregue a página.");
  return r.data;
}

/** Nulo = não existe ou não está publicada. */
export function useGaleriaPublica(slug: string, senha: string) {
  return useQuery({
    queryKey: [...CHAVE_VITRINE, "galeria", slug, senha],
    placeholderData: (anterior) => anterior,
    queryFn: async (): Promise<GaleriaPublica | null> => {
      const { data, error } = await supabase.rpc("galeria_publica", { _slug: slug, _senha: senha });
      if (error) throw new Error(error.message);
      return ler(galeriaPublica, data);
    },
  });
}

export const esquemaComprador = z.object({
  nome: z.string().trim().min(2, "Informe o seu nome.").max(120, "Nome longo demais."),
  email: z.string().trim().email("Informe um e-mail válido."),
  telefone: z.string().trim().max(30, "Telefone inválido."),
});

export type DadosComprador = z.infer<typeof esquemaComprador>;

export function useCriarPedido() {
  return useMutation({
    mutationFn: async ({
      slug,
      senha,
      comprador,
      fotos,
      pacoteCompleto,
    }: {
      slug: string;
      senha: string;
      comprador: DadosComprador;
      fotos: string[];
      pacoteCompleto: boolean;
    }): Promise<string> => {
      const r = esquemaComprador.safeParse(comprador);
      if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados inválidos.");
      const { data, error } = await supabase.rpc("criar_pedido", {
        _slug: slug,
        _senha: senha,
        _nome: r.data.nome,
        _email: r.data.email,
        _telefone: normalizarTelefone(r.data.telefone),
        _fotos: pacoteCompleto ? null : fotos,
        _pacote_completo: pacoteCompleto,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** Enquanto aguarda pagamento, confere de novo a cada 15 s (o fotógrafo confirma à mão). */
export function usePedidoPublico(codigo: string) {
  return useQuery({
    queryKey: [...CHAVE_VITRINE, "pedido", codigo],
    queryFn: async (): Promise<PedidoPublico | null> => {
      const { data, error } = await supabase.rpc("pedido_publico", { _codigo: codigo });
      if (error) throw new Error(error.message);
      return ler(pedidoPublico, data);
    },
    refetchInterval: (q) => (q.state.data?.status === "aguardando_pagamento" ? 15_000 : false),
    refetchOnWindowFocus: true,
  });
}

/** Link assinado de 1 hora que já baixa com o nome original do arquivo. */
export async function linkDownload(caminho: string, nome: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ORIGINAIS)
    .createSignedUrl(caminho, 3600, { download: nome });
  if (error || !data) throw new Error(`${nome}: não foi possível gerar o download.`);
  return data.signedUrl;
}

/** Preferências do visitante neste navegador (seleção e senha digitada). */
export const armazenamento = {
  lerSelecao(slug: string): string[] {
    try {
      const bruto = localStorage.getItem(`selecao:${slug}`);
      const lido: unknown = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lido) ? lido.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  },
  gravarSelecao(slug: string, ids: string[]) {
    try {
      if (ids.length === 0) localStorage.removeItem(`selecao:${slug}`);
      else localStorage.setItem(`selecao:${slug}`, JSON.stringify(ids));
    } catch {
      // Sem armazenamento (aba anônima, bloqueio): a seleção vale só nesta visita.
    }
  },
  lerSenha(slug: string): string {
    try {
      return sessionStorage.getItem(`senha:${slug}`) ?? "";
    } catch {
      return "";
    }
  },
  gravarSenha(slug: string, senha: string) {
    try {
      sessionStorage.setItem(`senha:${slug}`, senha);
    } catch {
      // idem
    }
  },
};
