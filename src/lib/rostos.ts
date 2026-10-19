/**
 * Reconhecimento facial no navegador (face-api, licença MIT). A biblioteca e
 * os modelos ficam em `public/rostos` e são baixados só quando alguém usa a
 * busca ou envia fotos de evento: fora do bundle do app e do Worker.
 *
 * Cada rosto vira um vetor de 128 números; dois vetores a menos de 0,5 de
 * distância (euclidiana) são, na prática, a mesma pessoa. É o que
 * `buscar_fotos_por_rosto` compara no banco.
 */

const BASE = "/rostos";
const LADO_ANALISE = 1280;
/** Rosto menor que isto (em px, na imagem analisada) dá vetor pouco confiável. */
const LADO_MINIMO_ROSTO = 36;

type Entrada = HTMLCanvasElement | HTMLImageElement;

interface Rede {
  loadFromUri(uri: string): Promise<void>;
  isLoaded: boolean;
}

interface RostoDetectado {
  descriptor: Float32Array;
  detection: { box: { width: number; height: number }; score: number };
}

/** O pedaço do face-api que o app usa (o arquivo não tem tipos no projeto). */
interface FaceApi {
  nets: {
    tinyFaceDetector: Rede;
    ssdMobilenetv1: Rede;
    faceLandmark68Net: Rede;
    faceRecognitionNet: Rede;
  };
  TinyFaceDetectorOptions: new (o: { inputSize: number; scoreThreshold: number }) => unknown;
  SsdMobilenetv1Options: new (o: { minConfidence: number; maxResults: number }) => unknown;
  detectAllFaces(
    entrada: Entrada,
    opcoes: unknown,
  ): { withFaceLandmarks(): { withFaceDescriptors(): Promise<RostoDetectado[]> } };
}

/**
 * `precisao` (painel, fotos do evento): detector SSD, acha rosto pequeno e de
 * lado no meio da multidão. `rapido` (selfie do visitante): detector leve.
 */
export type ModoRostos = "precisao" | "rapido";

let biblioteca: Promise<FaceApi> | null = null;
const modosCarregados = new Map<ModoRostos, Promise<void>>();

function carregarBiblioteca(): Promise<FaceApi> {
  if (!biblioteca) {
    // URL completa: com caminho relativo o Vite (dev) acrescenta `?import`, e
    // arquivo de `public` não pode ser importado assim.
    const caminho = `${window.location.origin}${BASE}/face-api.esm.js`;
    biblioteca = (import(/* @vite-ignore */ caminho) as Promise<FaceApi>).catch((e: unknown) => {
      biblioteca = null;
      throw e instanceof Error
        ? e
        : new Error("Não foi possível carregar o reconhecimento facial.");
    });
  }
  return biblioteca;
}

async function preparar(modo: ModoRostos): Promise<FaceApi> {
  const api = await carregarBiblioteca();
  let pronto = modosCarregados.get(modo);
  if (!pronto) {
    const uri = `${BASE}/modelos`;
    const detector = modo === "precisao" ? api.nets.ssdMobilenetv1 : api.nets.tinyFaceDetector;
    pronto = Promise.all(
      [detector, api.nets.faceLandmark68Net, api.nets.faceRecognitionNet]
        .filter((rede) => !rede.isLoaded)
        .map((rede) => rede.loadFromUri(uri)),
    ).then(() => undefined);
    pronto.catch(() => modosCarregados.delete(modo));
    modosCarregados.set(modo, pronto);
  }
  await pronto;
  return api;
}

function opcoes(api: FaceApi, modo: ModoRostos): unknown {
  return modo === "precisao"
    ? new api.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 60 })
    : new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
}

/** Desenha a imagem num canvas de até 1280 px, sem marca d'água, para analisar. */
export function canvasParaAnalise(imagem: ImageBitmap | HTMLImageElement): HTMLCanvasElement {
  const largura = imagem.width;
  const altura = imagem.height;
  const escala = Math.min(1, LADO_ANALISE / Math.max(largura, altura));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largura * escala));
  canvas.height = Math.max(1, Math.round(altura * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu processar a imagem.");
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Vetores de todos os rostos com tamanho suficiente na imagem. */
export async function rostosDaImagem(entrada: Entrada, modo: ModoRostos): Promise<number[][]> {
  const api = await preparar(modo);
  const achados = await api
    .detectAllFaces(entrada, opcoes(api, modo))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return achados
    .filter((r) => Math.min(r.detection.box.width, r.detection.box.height) >= LADO_MINIMO_ROSTO)
    .map((r) => Array.from(r.descriptor));
}

/**
 * Vetor do rosto da selfie (o maior da foto). A imagem fica só no navegador:
 * quem chama manda adiante apenas o vetor.
 */
export async function rostoDaSelfie(arquivo: File): Promise<number[]> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  let canvas: HTMLCanvasElement;
  try {
    canvas = canvasParaAnalise(bitmap);
  } finally {
    bitmap.close();
  }
  // Detector leve primeiro (baixa menos); rosto inclinado ou pequeno que ele
  // não pega vai para o preciso antes de desistir.
  let achados: RostoDetectado[] = [];
  for (const modo of ["rapido", "precisao"] as const) {
    const api = await preparar(modo);
    achados = await api
      .detectAllFaces(canvas, opcoes(api, modo))
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (achados.length > 0) break;
  }
  const maior = achados.sort(
    (a, b) =>
      b.detection.box.width * b.detection.box.height -
      a.detection.box.width * a.detection.box.height,
  )[0];
  if (!maior) {
    throw new Error(
      "Não achamos um rosto na selfie. Tente de frente, com boa luz e sem óculos escuros.",
    );
  }
  return Array.from(maior.descriptor);
}

/** Formato que o pgvector aceita na gravação: "[0.1,0.2,…]". */
export function vetorParaBanco(vetor: number[]): string {
  return `[${vetor.map((n) => n.toFixed(6)).join(",")}]`;
}
