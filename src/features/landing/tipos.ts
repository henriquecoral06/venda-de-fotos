import { z } from "zod";
import type { EventoPublico } from "@/features/vitrine/api";

/**
 * Landing pages para anúncios. Quatro modelos próprios, inspirados em estilos
 * comuns de sites de fotógrafo; textos, fotos e cores vêm do painel.
 */

export const MODELOS = ["editorial", "portfolio", "estudio", "classico"] as const;
export type ModeloLanding = (typeof MODELOS)[number];

const hex = z.string().regex(/^#[0-9a-f]{6}$/, "Cor inválida.");

export const esquemaCores = z.object({
  fundo: hex,
  texto: hex,
  primaria: hex,
  destaque: hex,
});
export type CoresLanding = z.infer<typeof esquemaCores>;

const texto = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);

export const esquemaConteudo = z.object({
  nome: texto(80),
  chamada: texto(120),
  titulo: texto(160),
  subtitulo: texto(400),
  sobre_titulo: texto(120),
  sobre_texto: texto(2_000),
  servicos: z
    .array(z.object({ titulo: texto(80), descricao: texto(400) }))
    .max(4, "Use no máximo 4 serviços."),
  cta_texto: texto(40),
  /** `whatsapp`: o botão abre o link (ou o WhatsApp da loja); `popup`: abre o formulário. */
  cta_tipo: z.enum(["whatsapp", "popup"]),
  /** Vazio = WhatsApp da loja. */
  cta_link: z.union([z.literal(""), z.string().trim().url("Link inválido.").max(500)]),
  formulario: z.object({
    titulo: texto(120),
    texto: texto(300),
    nome: z.boolean(),
    email: z.boolean(),
    telefone: z.boolean(),
    /** Rótulo do campo livre; vazio = sem o campo. */
    personalizado: texto(60),
    botao: texto(40),
    sucesso: texto(200),
  }),
  /** Faixa de chamada do modelo Clássico (entre o sobre e os serviços). */
  faixa_titulo: texto(120),
  faixa_texto: texto(300),
  frase_final: texto(160),
  instagram: texto(60),
  eventos_titulo: texto(120),
  eventos_texto: texto(300),
  imagens: z.object({
    capa: z.array(z.string().max(300)).max(5),
    galeria: z.array(z.string().max(300)).max(8),
    sobre: z.string().max(300),
  }),
});
export type ConteudoLanding = z.infer<typeof esquemaConteudo>;

export interface InfoModelo {
  nome: string;
  descricao: string;
  /** Quantas fotos de capa o modelo usa. */
  fotosCapa: number;
  cores: CoresLanding;
}

export const INFO_MODELO: Record<ModeloLanding, InfoModelo> = {
  editorial: {
    nome: "Editorial",
    descricao: "Preto e branco, título serifado fino e capa dividida em duas fotos.",
    fotosCapa: 2,
    cores: { fundo: "#ffffff", texto: "#111111", primaria: "#111111", destaque: "#8c8c8c" },
  },
  portfolio: {
    nome: "Portfólio",
    descricao: "Claro e arredondado, fotos em leque e uma cor de destaque.",
    fotosCapa: 3,
    cores: { fundo: "#efefec", texto: "#151515", primaria: "#151515", destaque: "#e8742c" },
  },
  estudio: {
    nome: "Estúdio",
    descricao: "Escuro e moderno, faixa de fotos verticais e cartões em blocos.",
    fotosCapa: 5,
    cores: { fundo: "#0b0b0b", texto: "#f4f4f2", primaria: "#f39a4b", destaque: "#1c1c1c" },
  },
  classico: {
    nome: "Clássico",
    descricao: "Casamento e ensaio: creme, serifa em maiúsculas e capa em tela cheia.",
    fotosCapa: 1,
    cores: { fundo: "#f7f2ec", texto: "#2b2321", primaria: "#4b1f25", destaque: "#b39470" },
  },
};

export function conteudoInicial(modelo: ModeloLanding, nome: string): ConteudoLanding {
  const base: ConteudoLanding = {
    nome,
    chamada: "Fotografia profissional",
    titulo: "Fotos que guardam o que você sentiu",
    subtitulo:
      "Cobertura de eventos, ensaios e momentos importantes, com entrega online e fotos em alta resolução.",
    sobre_titulo: "Sobre mim",
    sobre_texto:
      "Fotografo pessoas e histórias há anos. Meu trabalho é estar no lugar certo, na hora certa, sem atrapalhar o seu momento, e entregar fotos que você vai querer rever sempre.",
    servicos: [
      {
        titulo: "Eventos",
        descricao:
          "Festas, formaturas, corporativo e esporte, com galeria online para os convidados.",
      },
      {
        titulo: "Ensaios",
        descricao: "Retratos individuais, de casal e de família, em estúdio ou ao ar livre.",
      },
      {
        titulo: "Casamentos",
        descricao: "Do making of à festa, com álbum e galeria para compartilhar.",
      },
    ],
    cta_texto: "Fale comigo",
    cta_tipo: "whatsapp",
    cta_link: "",
    formulario: {
      titulo: "Vamos conversar",
      texto: "Deixe o seu contato e eu respondo ainda hoje.",
      nome: true,
      email: false,
      telefone: true,
      personalizado: "",
      botao: "Enviar",
      sucesso: "Recebi o seu contato. Em breve eu falo com você.",
    },
    faixa_titulo: "Formas de trabalharmos juntos",
    faixa_texto: "Ensaio, evento ou casamento: conte o que você imagina e eu monto a proposta.",
    frase_final: "Vamos registrar o seu próximo momento?",
    instagram: "",
    eventos_titulo: "Eventos recentes",
    eventos_texto: "Esteve em algum destes? Encontre as suas fotos e compre direto pelo site.",
    imagens: { capa: [], galeria: [], sobre: "" },
  };
  if (modelo === "estudio") {
    return {
      ...base,
      chamada: "Estúdio de fotografia",
      titulo: "Imagens feitas para serem lembradas",
    };
  }
  if (modelo === "classico") {
    return {
      ...base,
      chamada: "Fotografia de casamento",
      titulo: "A sua história, guardada para sempre",
      sobre_titulo: "Por trás das lentes",
      frase_final: "Uma vida de momentos, sempre por perto.",
    };
  }
  if (modelo === "portfolio") {
    return { ...base, titulo: "Boas histórias merecem boas imagens. É aí que eu entro." };
  }
  return base;
}

/**
 * Lê o JSON gravado no banco completando com os valores iniciais: landing
 * antiga ou campo novo nunca quebra a página.
 */
export function lerConteudo(bruto: unknown, modelo: ModeloLanding, nome: string): ConteudoLanding {
  const inicial = conteudoInicial(modelo, nome);
  // Blocos aninhados lidos à parte: um campo velho ou faltando dentro deles não
  // derruba o resto do conteúdo.
  const parcial = esquemaConteudo
    .extend({ imagens: z.unknown(), formulario: z.unknown() })
    .partial()
    .safeParse(bruto);
  if (!parcial.success) return inicial;
  const imagens = esquemaConteudo.shape.imagens.partial().safeParse(parcial.data.imagens ?? {});
  const formulario = esquemaConteudo.shape.formulario
    .partial()
    .safeParse(parcial.data.formulario ?? {});
  return {
    ...inicial,
    ...parcial.data,
    imagens: { ...inicial.imagens, ...(imagens.success ? imagens.data : {}) },
    formulario: { ...inicial.formulario, ...(formulario.success ? formulario.data : {}) },
  } as ConteudoLanding;
}

export function lerCores(bruto: unknown, modelo: ModeloLanding): CoresLanding {
  const r = esquemaCores.partial().safeParse(bruto);
  return { ...INFO_MODELO[modelo].cores, ...(r.success ? r.data : {}) } as CoresLanding;
}

export function ehModelo(valor: string): valor is ModeloLanding {
  return (MODELOS as readonly string[]).includes(valor);
}

/** Tudo o que um modelo precisa para desenhar a página. */
export interface DadosLanding {
  modelo: ModeloLanding;
  cores: CoresLanding;
  conteudo: ConteudoLanding;
  /** URLs já resolvidas (fotos enviadas ou, sem elas, capas dos eventos). */
  fotos: { capa: string[]; galeria: string[]; sobre: string | null };
  /** Logo da loja para fundo claro e para fundo escuro (URLs), quando houver. */
  logos: { claro: string | null; escuro: string | null };
  linkCta: string;
  eventos: EventoPublico[];
  aoClicarCta: () => void;
  aoClicarEvento: (slug: string) => void;
  /** Envia o formulário do popup; a prévia do painel só finge que enviou. */
  aoEnviarFormulario: (dados: DadosFormulario) => Promise<void>;
}

/** Respostas do formulário: só os campos que a landing pediu. */
export type DadosFormulario = Partial<
  Record<"nome" | "email" | "telefone" | "personalizado", string>
>;
