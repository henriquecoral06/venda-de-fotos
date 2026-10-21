import {
  Home,
  Images,
  LayoutTemplate,
  Receipt,
  Store,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Menu lateral e trilha de navegação saem desta única estrutura. Tela nova da
 * área logada = uma entrada aqui (e a rota em `RotaNavEstatica`).
 */

/** Rotas fixas da área logada: as únicas que viram link (menu e trilha). */
export type RotaNavEstatica =
  "/dashboard" | "/galerias" | "/pedidos" | "/landing-pages" | "/loja" | "/equipe" | "/perfil";

/** Rotas com id no caminho: só aparecem na trilha, e nunca como link. */
export type RotaNavDinamica = "/galerias/$id" | "/landing-pages/$id";

/** Rotas da área logada que aparecem no menu ou na trilha. */
export type RotaNav = RotaNavEstatica | RotaNavDinamica;

/** Uma rota com `$segmento` nunca vira link (faltariam os params). */
export function ehRotaDinamica(href: RotaNav): href is RotaNavDinamica {
  return href.includes("$");
}

export interface EntradaNav {
  href: RotaNav;
  rotulo: string;
  icone?: LucideIcon;
  /** Grupo do menu lateral. Também vira o primeiro item (sem link) da trilha. */
  grupo?: string;
  /** Página-mãe na trilha (href de outra entrada). */
  pai?: RotaNavEstatica;
  /** Só aparece na trilha, não no menu lateral. */
  soTrilha?: boolean;
}

export const NAV: EntradaNav[] = [
  { href: "/dashboard", rotulo: "Início", icone: Home },

  { href: "/galerias", rotulo: "Galerias", icone: Images, grupo: "Vendas" },
  { href: "/galerias/$id", rotulo: "Galeria", pai: "/galerias", soTrilha: true },
  { href: "/pedidos", rotulo: "Pedidos", icone: Receipt, grupo: "Vendas" },
  { href: "/landing-pages", rotulo: "Landing pages", icone: LayoutTemplate, grupo: "Vendas" },
  { href: "/landing-pages/$id", rotulo: "Landing page", pai: "/landing-pages", soTrilha: true },
  { href: "/loja", rotulo: "Loja e pagamento", icone: Store, grupo: "Vendas" },

  { href: "/equipe", rotulo: "Equipe", icone: Users, grupo: "Conta" },
  { href: "/perfil", rotulo: "Meu perfil", icone: UserCircle, grupo: "Conta" },
];

export interface GrupoNav {
  /** `null` no primeiro grupo (Início), que não tem título. */
  titulo: string | null;
  itens: (EntradaNav & { icone: LucideIcon })[];
}

/** Grupos do menu lateral, na ordem. Ignora entradas só de trilha ou sem ícone. */
export function montarGruposNav(): GrupoNav[] {
  const grupos: GrupoNav[] = [];
  for (const entrada of NAV) {
    if (entrada.soTrilha || !entrada.icone) continue;
    const titulo = entrada.grupo ?? null;
    let grupo = grupos.find((g) => g.titulo === titulo);
    if (!grupo) {
      grupo = { titulo, itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push({ ...entrada, icone: entrada.icone });
  }
  return grupos;
}

/**
 * `/galerias/abc` casa com `/galerias`; `/galeriasx` não. Num href com
 * `$segmento`, esse pedaço casa com qualquer valor não vazio.
 */
export function casaRota(href: string, pathname: string): boolean {
  if (!href.includes("$")) return pathname === href || pathname.startsWith(`${href}/`);
  const partesHref = href.split("/");
  const partesCaminho = pathname.split("/");
  if (partesCaminho.length !== partesHref.length) return false;
  return partesHref.every((parte, i) =>
    parte.startsWith("$") ? (partesCaminho[i] ?? "") !== "" : parte === partesCaminho[i],
  );
}

/** A entrada mais específica (maior href) que casa com a rota atual. */
export function acharEntrada(pathname: string): EntradaNav | undefined {
  let melhor: EntradaNav | undefined;
  for (const entrada of NAV) {
    if (!casaRota(entrada.href, pathname)) continue;
    if (!melhor || entrada.href.length > melhor.href.length) melhor = entrada;
  }
  return melhor;
}

/**
 * Item do menu lateral a destacar: a entrada visível mais específica que casa
 * com a rota. Uma entrada só de trilha acende o item da página-mãe.
 */
export function hrefAtivoSidebar(pathname: string): RotaNavEstatica | null {
  let melhor: EntradaNav | undefined;
  for (const entrada of NAV) {
    if (entrada.soTrilha || !entrada.icone) continue;
    if (!casaRota(entrada.href, pathname)) continue;
    if (!melhor || entrada.href.length > melhor.href.length) melhor = entrada;
  }
  // As entradas do menu nunca são dinâmicas (o filtro acima já as tirou).
  const href = melhor?.href;
  return href && !ehRotaDinamica(href) ? href : null;
}

export interface ItemTrilha {
  rotulo: string;
  /** A página atual, o nome do grupo e as rotas com id nunca são links. */
  href?: RotaNavEstatica;
}

export function montarTrilha(pathname: string): ItemTrilha[] {
  const entrada = acharEntrada(pathname);
  if (!entrada) return [];

  // Sobe pela cadeia de `pai` até a raiz do grupo.
  const cadeia: EntradaNav[] = [entrada];
  let atual = entrada;
  while (atual.pai) {
    const pai = NAV.find((e) => e.href === atual.pai);
    if (!pai) break;
    cadeia.unshift(pai);
    atual = pai;
  }

  const trilha: ItemTrilha[] = [];
  const grupo = cadeia[0]?.grupo;
  if (grupo) trilha.push({ rotulo: grupo });
  for (const item of cadeia) {
    if (ehRotaDinamica(item.href)) trilha.push({ rotulo: item.rotulo });
    else trilha.push({ rotulo: item.rotulo, href: item.href });
  }

  // Rota com id sem entrada própria: a entrada casou pelo prefixo, não inteira.
  if (!ehRotaDinamica(entrada.href) && entrada.href !== pathname) {
    trilha.push({ rotulo: "Detalhes" });
  }

  const ultimo = trilha[trilha.length - 1];
  if (ultimo) delete ultimo.href;
  return trilha;
}
