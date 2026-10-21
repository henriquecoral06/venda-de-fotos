import { supabase } from "@/integrations/supabase/client";

/**
 * Marca da loja (logo e cores) nas telas do cliente. As cores são sugeridas a
 * partir da logo no navegador e gravadas em `configuracoes_loja`.
 */

export const BUCKET_MARCA = "marca";
/**
 * Formatos aceitos no envio. SVG é convertido em PNG no navegador antes de
 * subir: o bucket só guarda imagem rasterizada, porque um SVG servido pelo
 * Storage pode carregar script.
 */
export const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export const TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024;

const LADO_LOGO = 512;
const REGEX_HEX = /^#[0-9a-f]{6}$/;

/** Botão de ação principal nas telas do cliente: segue a cor da marca. */
export const CLASSE_BOTAO_MARCA = "bg-primary text-primary-foreground hover:bg-primary/90";

export interface Marca {
  /** Logo para fundo claro (a principal). */
  logo: string | null;
  /** Logo para fundo escuro; banco antigo devolve sem ela. */
  logo_escuro?: string | null | undefined;
  cor_primaria: string | null;
  cor_secundaria: string | null;
}

export function urlLogo(caminho: string): string {
  return supabase.storage.from(BUCKET_MARCA).getPublicUrl(caminho).data.publicUrl;
}

export function ehHex(valor: string): boolean {
  return REGEX_HEX.test(valor);
}

function paraRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paraHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Luminância relativa (WCAG), de 0 (preto) a 1 (branco). */
function luminancia(hex: string): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = paraRgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Texto sobre a cor: branco ou tinta escura, o que tiver mais contraste. */
export function corDoTexto(fundo: string): string {
  const l = luminancia(fundo);
  const contrasteBranco = 1.05 / (l + 0.05);
  const contrasteEscuro = (l + 0.05) / (luminancia("#171717") + 0.05);
  return contrasteBranco >= contrasteEscuro ? "#ffffff" : "#171717";
}

/**
 * Variáveis do design system reapontadas para a marca. Vão no `<html>` (e não
 * num contêiner) para alcançar Sheet e Dialog, que abrem em portal.
 */
export function variaveisDaMarca(marca: Marca | null | undefined): Record<string, string> {
  const primaria = marca?.cor_primaria && ehHex(marca.cor_primaria) ? marca.cor_primaria : null;
  if (!primaria) return {};
  const secundaria =
    marca?.cor_secundaria && ehHex(marca.cor_secundaria) ? marca.cor_secundaria : primaria;
  return {
    "--primary": primaria,
    "--primary-foreground": corDoTexto(primaria),
    "--ring": primaria,
    "--brand-from": primaria,
    "--brand-to": secundaria,
  };
}

/**
 * Cores dominantes da logo, da mais marcante para a menos. Ignora o
 * transparente e o fundo quase branco ou quase preto; agrupa tons parecidos.
 * Logo só em preto e branco devolve os neutros que encontrar.
 */
export async function extrairCores(imagem: Blob, quantidade = 6): Promise<string[]> {
  const bitmap = await createImageBitmap(imagem);
  const escala = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("O navegador não conseguiu ler a logo.");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, largura, altura);

  interface Grupo {
    r: number;
    g: number;
    b: number;
    n: number;
    saturacao: number;
  }
  const coloridos = new Map<number, Grupo>();
  const neutros = new Map<number, Grupo>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luz = (max + min) / 510;
    const saturacao = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    const chave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const alvo = saturacao > 0.18 && luz > 0.08 && luz < 0.94 ? coloridos : neutros;
    const grupo = alvo.get(chave) ?? { r: 0, g: 0, b: 0, n: 0, saturacao: 0 };
    grupo.r += r;
    grupo.g += g;
    grupo.b += b;
    grupo.n += 1;
    grupo.saturacao += saturacao;
    alvo.set(chave, grupo);
  }

  const fonte = coloridos.size > 0 ? coloridos : neutros;
  const ordenados = [...fonte.values()]
    .map((gr) => ({
      hex: paraHex(gr.r / gr.n, gr.g / gr.n, gr.b / gr.n),
      peso: gr.n * (0.4 + gr.saturacao / gr.n),
    }))
    .sort((x, y) => y.peso - x.peso);

  const escolhidas: string[] = [];
  for (const { hex } of ordenados) {
    const [r, g, b] = paraRgb(hex);
    const parecida = escolhidas.some((e) => {
      const [er, eg, eb] = paraRgb(e);
      return Math.hypot(r - er, g - eg, b - eb) < 48;
    });
    if (!parecida) escolhidas.push(hex);
    if (escolhidas.length >= quantidade) break;
  }
  return escolhidas;
}

function ehSvg(arquivo: File): boolean {
  return arquivo.type === "image/svg+xml" || arquivo.name.toLowerCase().endsWith(".svg");
}

export function validarLogo(arquivo: File): string | null {
  if (!(TIPOS_LOGO as readonly string[]).includes(arquivo.type) && !ehSvg(arquivo)) {
    return "Envie a logo em PNG, JPG, WebP ou SVG.";
  }
  if (arquivo.size > 10 * 1024 * 1024) return "A logo passa de 10 MB.";
  return null;
}

/**
 * Tamanho de desenho do SVG: `width`/`height` em px ou, sem eles, o
 * `viewBox`. Sem nenhum dos dois, quadrado.
 */
function proporcaoSvg(texto: string): { largura: number; altura: number } {
  const raiz = /<svg\b[^>]*>/i.exec(texto)?.[0] ?? "";
  const atributo = (nome: string) =>
    Number.parseFloat(
      new RegExp(`\\s${nome}\\s*=\\s*["']([\\d.]+)(px)?["']`, "i").exec(raiz)?.[1] ?? "",
    );
  const largura = atributo("width");
  const altura = atributo("height");
  if (largura > 0 && altura > 0) return { largura, altura };
  const caixa = /viewBox\s*=\s*["']([^"']+)["']/i
    .exec(raiz)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , vl, va] = caixa ?? [];
  if (vl && va && vl > 0 && va > 0) return { largura: vl, altura: va };
  return { largura: LADO_LOGO, altura: LADO_LOGO };
}

/** SVG desenhado já em 512 px no lado maior (vetor: aumenta sem perder nitidez). */
async function desenharSvg(arquivo: File): Promise<HTMLCanvasElement> {
  const { largura, altura } = proporcaoSvg(await arquivo.text());
  const escala = LADO_LOGO / Math.max(largura, altura);
  const url = URL.createObjectURL(new Blob([arquivo], { type: "image/svg+xml" }));
  try {
    const imagem = new Image();
    imagem.decoding = "async";
    imagem.src = url;
    await imagem.decode().catch(() => {
      throw new Error("Não foi possível ler o SVG. Exporte a logo de novo ou envie em PNG.");
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(largura * escala));
    canvas.height = Math.max(1, Math.round(altura * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("O navegador não conseguiu processar a logo.");
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function desenharImagem(arquivo: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_LOGO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu processar a logo.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Logo em PNG com até 512 px no lado maior (mantém a transparência). */
export async function prepararLogo(arquivo: File): Promise<Blob> {
  const canvas = ehSvg(arquivo) ? await desenharSvg(arquivo) : await desenharImagem(arquivo);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Não foi possível preparar a logo.");
  if (blob.size > TAMANHO_MAXIMO_LOGO) throw new Error("A logo ficou maior que 2 MB.");
  return blob;
}
