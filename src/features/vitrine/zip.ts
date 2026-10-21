import { downloadZip } from "client-zip";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET_ORIGINAIS } from "@/lib/fotos";

/**
 * Download em ZIP montado no navegador: cada original é baixado pelo link
 * assinado e entra no arquivo em fluxo, sem passar pelo servidor (o Worker não
 * guarda arquivo). O ZIP é dividido em partes para caber na memória: no
 * celular o navegador segura o arquivo inteiro antes de salvar.
 */

export interface ArquivoZip {
  caminho: string;
  nome: string;
  /** Bytes do original; 0 quando o banco não informou. */
  tamanho: number;
}

const ehCelular = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function limiteDaParte(): number {
  return (ehCelular() ? 400 : 1500) * 1024 * 1024;
}

/** Partes em ordem, cada uma até o limite (uma foto maior que ele fica sozinha). */
export function dividirEmPartes(arquivos: ArquivoZip[]): ArquivoZip[][] {
  const limite = limiteDaParte();
  const partes: ArquivoZip[][] = [];
  let atual: ArquivoZip[] = [];
  let soma = 0;
  for (const a of arquivos) {
    if (atual.length > 0 && soma + a.tamanho > limite) {
      partes.push(atual);
      atual = [];
      soma = 0;
    }
    atual.push(a);
    soma += a.tamanho;
  }
  if (atual.length > 0) partes.push(atual);
  return partes;
}

/** "foto.jpg" repetido vira "foto (2).jpg": o ZIP não aceita dois nomes iguais. */
function nomesUnicos(arquivos: ArquivoZip[]): string[] {
  const vistos = new Map<string, number>();
  return arquivos.map((a) => {
    const n = (vistos.get(a.nome) ?? 0) + 1;
    vistos.set(a.nome, n);
    if (n === 1) return a.nome;
    const ponto = a.nome.lastIndexOf(".");
    return ponto > 0
      ? `${a.nome.slice(0, ponto)} (${n})${a.nome.slice(ponto)}`
      : `${a.nome} (${n})`;
  });
}

async function baixarOriginal(caminho: string, nome: string): Promise<Response> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ORIGINAIS)
    .createSignedUrl(caminho, 3600);
  if (error || !data) throw new Error(`${nome}: o download não foi liberado.`);
  const resposta = await fetch(data.signedUrl);
  if (!resposta.ok) throw new Error(`${nome}: não foi possível baixar (erro ${resposta.status}).`);
  return resposta;
}

function salvarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Nome de arquivo seguro a partir do título da galeria. */
export function nomeDoZip(titulo: string): string {
  return (
    titulo
      .replace(/[\\/:*?"<>|]+/g, "")
      .trim()
      .slice(0, 80) || "fotos"
  );
}

/**
 * Baixa as partes em sequência. `aoAvancar` recebe quantas fotos já entraram
 * no ZIP; erro numa foto interrompe e levanta a mensagem dela.
 */
export async function baixarZip(
  arquivos: ArquivoZip[],
  titulo: string,
  aoAvancar: (feitas: number, total: number) => void,
): Promise<void> {
  const partes = dividirEmPartes(arquivos);
  const base = nomeDoZip(titulo);
  let feitas = 0;
  aoAvancar(0, arquivos.length);

  for (const [i, parte] of partes.entries()) {
    const nomes = nomesUnicos(parte);
    async function* entradas() {
      for (const [j, arquivo] of parte.entries()) {
        const resposta = await baixarOriginal(arquivo.caminho, arquivo.nome);
        yield { input: resposta, name: nomes[j] ?? arquivo.nome };
        feitas += 1;
        aoAvancar(feitas, arquivos.length);
      }
    }
    const nome =
      partes.length > 1 ? `${base} (parte ${i + 1} de ${partes.length}).zip` : `${base}.zip`;
    salvarBlob(await downloadZip(entradas()).blob(), nome);
  }
}
