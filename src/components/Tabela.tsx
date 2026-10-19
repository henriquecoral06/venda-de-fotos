import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type Alinhamento = "esquerda" | "direita" | "centro";
export type DirecaoOrdenacao = "asc" | "desc";
export interface Ordenacao {
  chave: string;
  direcao: DirecaoOrdenacao;
}
export type ValorOrdenavel = string | number | Date | null | undefined;
export type LinhaRodape = Record<string, ReactNode>;

/**
 * Seleção de linhas por caixinha (ações em massa). As chaves são as de
 * `chaveLinha`; o cabeçalho marca ou desmarca todas as linhas exibidas.
 */
export interface SelecaoTabela<L> {
  selecionadas: ReadonlySet<string>;
  aoMudar: (selecionadas: Set<string>) => void;
  /** Nome da linha para leitor de tela ("Selecionar <rótulo>"). */
  rotulo: (linha: L) => string;
}

export interface ColunaTabela<L> {
  chave: string;
  titulo: ReactNode;
  alinhar?: Alinhamento;
  /** Liga `tabular-nums`, alinha à direita por padrão e ordena do maior para o menor no 1º clique. */
  numerica?: boolean;
  /** Classes extras no `th` e nos `td` da coluna (ex.: `hidden md:table-cell`). */
  classe?: string;
  largura?: string;
  renderizar?: (linha: L) => ReactNode;
  renderizarRodape?: (rodape: LinhaRodape) => ReactNode;
  ordenavel?: boolean;
  /** Valor comparado na ordenação. Obrigatório quando `renderizar` monta a célula de outro campo. */
  valorOrdenacao?: (linha: L) => ValorOrdenavel;
}

const ALINHAMENTO: Record<Alinhamento, string> = {
  esquerda: "text-left",
  direita: "text-right",
  centro: "text-center",
};

// `numeric` põe "item 10" depois de "item 9"; `base` ignora acento e caixa.
const colacao = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function ehVazio(v: ValorOrdenavel): boolean {
  return v == null || v === "";
}

function comparar(a: NonNullable<ValorOrdenavel>, b: NonNullable<ValorOrdenavel>): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return colacao.compare(String(a), String(b));
}

function valorBruto<L>(linha: L, chave: string): unknown {
  return (linha as Record<string, unknown>)[chave];
}

function celulaPadrao(valor: unknown): ReactNode {
  if (valor === 0 || valor == null || valor === "") {
    return <span className="text-faint">–</span>;
  }
  if (typeof valor === "string" || typeof valor === "number") return valor;
  if (valor instanceof Date) return valor.toLocaleDateString("pt-BR");
  return String(valor);
}

function alinhamentoDe<L>(c: ColunaTabela<L>): Alinhamento {
  return c.alinhar ?? (c.numerica ? "direita" : "esquerda");
}

function IconeOrdenacao({ direcao }: { direcao: DirecaoOrdenacao | null }) {
  const Icone = direcao === "asc" ? ChevronUp : direcao === "desc" ? ChevronDown : ChevronsUpDown;
  return (
    <Icone
      aria-hidden="true"
      strokeWidth={2}
      className={cn(
        "size-3 shrink-0 transition-opacity",
        direcao
          ? "opacity-100"
          : "opacity-0 group-hover/ordem:opacity-60 group-focus-visible/ordem:opacity-60",
      )}
    />
  );
}

/**
 * Tabela dirigida por dados. Ordenação interna por clique no cabeçalho
 * (`ordenavel`) ou controlada (`ordenacao` + `aoOrdenar`); `rodape` vai em
 * `<tfoot>` e não se move quando a ordem muda. Com `selecao`, cada linha ganha
 * uma caixinha à esquerda.
 */
export function Tabela<L>({
  colunas,
  linhas,
  chaveLinha,
  rodape,
  ordenacao,
  aoOrdenar,
  ordenacaoInicial = null,
  vazio: mensagemVazia = "Nada por aqui ainda.",
  className,
  selecao,
}: {
  colunas: ColunaTabela<L>[];
  linhas: L[];
  chaveLinha: (linha: L, indice: number) => string;
  rodape?: LinhaRodape;
  ordenacao?: Ordenacao | null;
  aoOrdenar?: (ordenacao: Ordenacao) => void;
  ordenacaoInicial?: Ordenacao | null;
  vazio?: ReactNode;
  className?: string;
  selecao?: SelecaoTabela<L>;
}) {
  const [interna, setInterna] = useState<Ordenacao | null>(ordenacaoInicial);
  const controlada = ordenacao !== undefined;
  const atual = controlada ? ordenacao : interna;

  function alternar(coluna: ColunaTabela<L>) {
    const proxima: Ordenacao =
      atual?.chave === coluna.chave
        ? { chave: coluna.chave, direcao: atual.direcao === "asc" ? "desc" : "asc" }
        : { chave: coluna.chave, direcao: coluna.numerica ? "desc" : "asc" };
    if (controlada) aoOrdenar?.(proxima);
    else setInterna(proxima);
  }

  const ordenadas = useMemo(() => {
    if (!atual) return linhas;
    const coluna = colunas.find((c) => c.chave === atual.chave);
    if (!coluna) return linhas;
    const valor =
      coluna.valorOrdenacao ?? ((l: L) => valorBruto(l, coluna.chave) as ValorOrdenavel);
    const sinal = atual.direcao === "asc" ? 1 : -1;
    return [...linhas].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      // Vazio fica no fim nas duas direções.
      if (ehVazio(va) || ehVazio(vb)) return Number(ehVazio(va)) - Number(ehVazio(vb));
      return sinal * comparar(va as NonNullable<ValorOrdenavel>, vb as NonNullable<ValorOrdenavel>);
    });
  }, [linhas, colunas, atual]);

  const chaves = ordenadas.map((l, i) => chaveLinha(l, i));
  const marcadasVisiveis = selecao ? chaves.filter((k) => selecao.selecionadas.has(k)).length : 0;
  const todasMarcadas = chaves.length > 0 && marcadasVisiveis === chaves.length;

  function marcarTodas(marcar: boolean) {
    if (!selecao) return;
    const nova = new Set(selecao.selecionadas);
    for (const k of chaves) {
      if (marcar) nova.add(k);
      else nova.delete(k);
    }
    selecao.aoMudar(nova);
  }

  function marcarLinha(chave: string, marcar: boolean) {
    if (!selecao) return;
    const nova = new Set(selecao.selecionadas);
    if (marcar) nova.add(chave);
    else nova.delete(chave);
    selecao.aoMudar(nova);
  }

  const colunasTotais = colunas.length + (selecao ? 1 : 0);

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow className="border-hairline-soft hover:bg-transparent">
          {selecao && (
            <TableHead scope="col" className="h-auto w-10 py-3 pl-5 pr-0">
              <Checkbox
                aria-label="Selecionar todas as linhas exibidas"
                disabled={chaves.length === 0}
                checked={todasMarcadas ? true : marcadasVisiveis > 0 ? "indeterminate" : false}
                onCheckedChange={(v) => marcarTodas(v === true)}
              />
            </TableHead>
          )}
          {colunas.map((c) => {
            const alinhar = alinhamentoDe(c);
            const direcao = atual?.chave === c.chave ? atual.direcao : null;
            return (
              <TableHead
                key={c.chave}
                scope="col"
                style={c.largura ? { width: c.largura } : undefined}
                aria-sort={
                  !c.ordenavel
                    ? undefined
                    : direcao === "asc"
                      ? "ascending"
                      : direcao === "desc"
                        ? "descending"
                        : "none"
                }
                className={cn(
                  "h-auto px-5 py-3 text-sm font-semibold text-mute",
                  ALINHAMENTO[alinhar],
                  c.classe,
                )}
              >
                {c.ordenavel ? (
                  <button
                    type="button"
                    onClick={() => alternar(c)}
                    className={cn(
                      "group/ordem -mx-1.5 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors hover:text-ink",
                      direcao && "text-ink",
                      alinhar === "direita" && "flex-row-reverse",
                    )}
                  >
                    <span className="truncate">{c.titulo}</span>
                    <IconeOrdenacao direcao={direcao} />
                  </button>
                ) : (
                  c.titulo
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>

      <TableBody>
        {ordenadas.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={colunasTotais} className="px-5 py-10 text-center text-mute">
              {mensagemVazia}
            </TableCell>
          </TableRow>
        )}
        {ordenadas.map((linha, i) => {
          const chave = chaves[i] ?? chaveLinha(linha, i);
          const marcada = selecao?.selecionadas.has(chave) ?? false;
          return (
            <TableRow
              key={chave}
              data-state={marcada ? "selected" : undefined}
              className="border-hairline-soft hover:bg-elevated data-[state=selected]:bg-elevated"
            >
              {selecao && (
                <TableCell className="w-10 py-3.5 pl-5 pr-0">
                  <Checkbox
                    aria-label={`Selecionar ${selecao.rotulo(linha)}`}
                    checked={marcada}
                    onCheckedChange={(v) => marcarLinha(chave, v === true)}
                  />
                </TableCell>
              )}
              {colunas.map((c) => (
                <TableCell
                  key={c.chave}
                  className={cn(
                    "px-5 py-3.5 font-medium text-body",
                    ALINHAMENTO[alinhamentoDe(c)],
                    c.numerica && "tabular-nums",
                    c.classe,
                  )}
                >
                  {c.renderizar ? c.renderizar(linha) : celulaPadrao(valorBruto(linha, c.chave))}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>

      {rodape && ordenadas.length > 0 && (
        <TableFooter className="border-hairline bg-transparent">
          <TableRow className="hover:bg-transparent">
            {selecao && <TableCell className="w-10 pl-5 pr-0" />}
            {colunas.map((c) => (
              <TableCell
                key={c.chave}
                className={cn(
                  "px-5 py-3.5 font-semibold text-ink",
                  ALINHAMENTO[alinhamentoDe(c)],
                  c.numerica && "tabular-nums",
                  c.classe,
                )}
              >
                {c.renderizarRodape ? c.renderizarRodape(rodape) : rodape[c.chave]}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
