/** Texto sem acento e em minúsculas, para a busca achar "joao" em "João". */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Todas as palavras da busca aparecem em algum dos campos. */
export function combinaBusca(busca: string, campos: (string | null | undefined)[]): boolean {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;
  const alvo = normalizarBusca(campos.filter(Boolean).join(" "));
  return termos.every((t) => alvo.includes(t));
}

/** O PostgREST devolve no máximo 1.000 linhas por consulta: busca em blocos até acabar. */
export async function buscarTodas<T>(
  bloco: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const TAMANHO = 1000;
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO) {
    const { data, error } = await bloco(de, de + TAMANHO - 1);
    if (error) throw new Error(error.message);
    todas.push(...(data ?? []));
    if (!data || data.length < TAMANHO) return todas;
  }
}
