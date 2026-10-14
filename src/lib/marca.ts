import { supabase } from "@/integrations/supabase/client";

/**
 * Marca da loja (logo e cores) nas telas do cliente. As cores são sugeridas a
 * partir da logo no navegador e gravadas em `configuracoes_loja`.
 */

export const BUCKET_MARCA = "marca";
export const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp"] as const;
export const TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024;

const LADO_LOGO = 512;
const REGEX_HEX = /^#[0-9a-f]{6}$/;

/** Botão de ação principal nas telas do cliente: segue a cor da marca. */
export const CLASSE_BOTAO_MARCA = "bg-primary text-primary-foreground hover:bg-primary/90";

export interface Marca {
  logo: string | null;
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

export function validarLogo(arquivo: File): string | null {
  if (!(TIPOS_LOGO as readonly string[]).includes(arquivo.type)) {
    return "Envie a logo em PNG, JPG ou WebP.";
  }
  if (arquivo.size > 10 * 1024 * 1024) return "A logo passa de 10 MB.";
  return null;
}

/** Logo reduzida para 512 px no lado maior, em PNG (mantém a transparência). */
export async function prepararLogo(arquivo: File): Promise<Blob> {
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
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Não foi possível preparar a logo.");
  if (blob.size > TAMANHO_MAXIMO_LOGO) throw new Error("A logo ficou maior que 2 MB.");
  return blob;
}
