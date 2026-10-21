/**
 * Processamento das fotos no navegador: o servidor não tem API de imagem
 * (build para Workers), então a prévia e a miniatura com marca d'água saem de
 * um canvas antes do envio. O original sobe como veio. Prévia e miniatura saem
 * em WebP (cerca de 30% menores que JPEG na mesma qualidade); o navegador que
 * não gera WebP no canvas (Safari antigo) devolve PNG, e aí vale o JPEG.
 */

import { canvasParaAnalise, rostosDaImagem } from "@/lib/rostos";

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const TAMANHO_MAXIMO = 50 * 1024 * 1024;

const LADO_PREVIA = 1600;
const LADO_MINIATURA = 640;

export interface FotoProcessada {
  previa: Blob;
  miniatura: Blob;
  largura: number;
  altura: number;
  /**
   * Vetores dos rostos, só quando pedidos (galeria de evento com busca por
   * selfie). Nulo = a análise falhou: a foto sobe mesmo assim e fica pendente.
   */
  rostos: number[][] | null;
}

export function validarArquivo(arquivo: File): string | null {
  if (!(TIPOS_ACEITOS as readonly string[]).includes(arquivo.type)) {
    return `${arquivo.name}: envie JPG, PNG ou WebP.`;
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return `${arquivo.name}: o arquivo passa de 50 MB.`;
  }
  return null;
}

function gerarBlob(
  canvas: HTMLCanvasElement,
  tipo: string,
  qualidade: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade));
}

async function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  const webp = await gerarBlob(canvas, "image/webp", qualidade);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await gerarBlob(canvas, "image/jpeg", qualidade);
  if (!jpeg) throw new Error("Não foi possível gerar a prévia.");
  return jpeg;
}

/** Extensão do arquivo de prévia conforme o formato que o navegador gerou. */
export function extensaoDaPrevia(blob: Blob): string {
  return blob.type === "image/webp" ? "webp" : "jpg";
}

/**
 * Texto repetido na diagonal por toda a imagem, em branco translúcido com
 * contorno escuro: aparece em foto clara e escura e não sai com um recorte.
 * Fonte e opacidade baixas, com bastante espaço entre as linhas: protege sem
 * esconder a foto.
 */
function aplicarMarcaDagua(
  ctx: CanvasRenderingContext2D,
  largura: number,
  altura: number,
  texto: string,
) {
  const tamanhoFonte = Math.max(12, Math.round(Math.min(largura, altura) / 22));
  ctx.save();
  ctx.font = `600 ${tamanhoFonte}px Geist, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(1, tamanhoFonte / 18);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.34)";

  const passoX = ctx.measureText(texto).width + tamanhoFonte * 5;
  const passoY = tamanhoFonte * 7;
  const diagonal = Math.hypot(largura, altura);

  ctx.translate(largura / 2, altura / 2);
  ctx.rotate(-Math.PI / 6);
  for (let y = -diagonal / 2; y < diagonal / 2; y += passoY) {
    const deslocamento = (Math.round(y / passoY) % 2) * (passoX / 2);
    for (let x = -diagonal / 2 - passoX; x < diagonal / 2 + passoX; x += passoX) {
      ctx.strokeText(texto, x + deslocamento, y);
      ctx.fillText(texto, x + deslocamento, y);
    }
  }
  ctx.restore();
}

async function redimensionar(
  imagem: ImageBitmap,
  ladoMaximo: number,
  marca: string | null,
  qualidade: number,
): Promise<Blob> {
  const escala = Math.min(1, ladoMaximo / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu processar a imagem.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagem, 0, 0, largura, altura);
  if (marca) aplicarMarcaDagua(ctx, largura, altura, marca);
  return paraBlob(canvas, qualidade);
}

/** `marca` nula = prévia sem marca d'água (desligada em Loja e pagamento). */
export async function processarFoto(
  arquivo: File,
  marca: string | null,
  comRostos = false,
): Promise<FotoProcessada> {
  // `from-image` respeita a orientação EXIF (foto de celular em pé).
  const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const [previa, miniatura] = await Promise.all([
      redimensionar(imagem, LADO_PREVIA, marca, 0.82),
      redimensionar(imagem, LADO_MINIATURA, marca, 0.78),
    ]);
    // Rostos na imagem sem marca d'água: o texto por cima atrapalha a detecção.
    let rostos: number[][] | null = [];
    if (comRostos) {
      rostos = await rostosDaImagem(canvasParaAnalise(imagem), "precisao").catch(() => null);
    }
    return { previa, miniatura, largura: imagem.width, altura: imagem.height, rostos };
  } finally {
    imagem.close();
  }
}

export function extensaoDe(arquivo: File): string {
  if (arquivo.type === "image/png") return "png";
  if (arquivo.type === "image/webp") return "webp";
  return "jpg";
}
