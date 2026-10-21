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
  // Opcionais: banco sem a migration `revisao_seguranca` devolve sem eles.
  tamanho: z.number().optional(),
  /** Caminho do original: só vem quando o fotógrafo liberou o download. */
  original: z.string().nullable().optional(),
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
  // Opcionais: banco sem a migration `eventos_abertos` devolve sem eles.
  tipo: z.enum(["privada", "evento"]).optional(),
  categoria: z.string().optional(),
  local: z.string().optional(),
  busca_rosto: z.boolean().optional(),
  contato_whatsapp: z.string().nullable().optional(),
  protegida: z.boolean(),
  capa: z.string().nullable(),
  total_fotos: z.number(),
  liberada: z.boolean(),
  senha_incorreta: z.boolean().optional(),
  download_liberado: z.boolean().optional(),
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
      tamanho: z.number().optional(),
      original: z.string().nullable(),
    }),
  ),
});

const eventoPublico = z.object({
  slug: z.string(),
  titulo: z.string(),
  categoria: z.string(),
  local: z.string(),
  data_evento: z.string().nullable(),
  preco_foto: z.number(),
  busca_rosto: z.boolean(),
  total_fotos: z.number(),
  capa: z.string().nullable(),
});

const vitrinePublica = z.object({
  fotografo: z.string(),
  marca,
  eventos: z.array(eventoPublico),
});

const resultadoBusca = z.array(z.object({ id: z.string(), distancia: z.number() }));

export type EventoPublico = z.infer<typeof eventoPublico>;
export type VitrinePublica = z.infer<typeof vitrinePublica>;
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

const SENHA_INCORRETA = "Senha da galeria incorreta.";

/**
 * Nulo = não existe ou não está publicada. Cada senha errada conta no limite
 * de tentativas do banco: a consulta não se refaz sozinha ao voltar à aba.
 */
export function useGaleriaPublica(slug: string, senha: string) {
  return useQuery({
    queryKey: [...CHAVE_VITRINE, "galeria", slug, senha],
    placeholderData: (anterior) => anterior,
    refetchOnWindowFocus: false,
    retry: (falhas, erro) => falhas < 1 && !erro.message.startsWith("Muitas tentativas"),
    queryFn: async (): Promise<GaleriaPublica | null> => {
      const { data, error } = await supabase.rpc("galeria_publica", { _slug: slug, _senha: senha });
      if (error) throw new Error(error.message);
      return ler(galeriaPublica, data);
    },
  });
}

/** Eventos abertos e publicados do estúdio, para a vitrine `/eventos`. */
export function useVitrine() {
  return useQuery({
    queryKey: [...CHAVE_VITRINE, "eventos"],
    queryFn: async (): Promise<VitrinePublica> => {
      const { data, error } = await supabase.rpc("eventos_publicos");
      if (error) throw new Error(error.message);
      const vitrine = ler(vitrinePublica, data);
      if (!vitrine) throw new Error("Vitrine indisponível.");
      return vitrine;
    },
  });
}

/** Acima disto (até o corte de 0,5 do banco) o rosto é parecido, mas pode ser outra pessoa. */
const DISTANCIA_PROVAVEL = 0.4;

export interface FotoEncontrada {
  id: string;
  /** Muito provável que seja a pessoa; falso = "talvez seja você". */
  provavel: boolean;
}

/**
 * Fotos da galeria em que o rosto aparece, da mais parecida para a menos.
 * Só o vetor (128 números) sai do navegador.
 */
export async function buscarFotosPorRosto(
  slug: string,
  senha: string,
  rosto: number[],
): Promise<FotoEncontrada[]> {
  const { data, error } = await supabase.rpc("buscar_fotos_por_rosto", {
    _slug: slug,
    _senha: senha,
    _rosto: rosto,
  });
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(SENHA_INCORRETA);
  return (ler(resultadoBusca, data) ?? []).map((r) => ({
    id: r.id,
    provavel: r.distancia < DISTANCIA_PROVAVEL,
  }));
}

export const esquemaComprador = z.object({
  nome: z.string().trim().min(2, "Informe o seu nome.").max(120, "Nome longo demais."),
  email: z.string().trim().email("Informe um e-mail válido."),
  telefone: z
    .string()
    .trim()
    .refine(
      (t) => t === "" || (/^[\d()+\s.-]+$/.test(t) && t.replace(/\D/g, "").length >= 10),
      "Informe o WhatsApp com DDD (ex.: 11 91234-5678) ou deixe em branco.",
    ),
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
      if (data === null) throw new Error(SENHA_INCORRETA);
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
