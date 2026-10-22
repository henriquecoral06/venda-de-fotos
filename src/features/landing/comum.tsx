import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { corDoTexto } from "@/lib/marca";
import { dataBR } from "@/lib/format";
import { urlPrevia } from "@/lib/fotos";
import type { EventoPublico } from "@/features/vitrine/api";
import type { CoresLanding, DadosLanding } from "./tipos";

/*
 * Peças comuns aos modelos. As landing pages são o site do fotógrafo, com as
 * cores dele: os modelos usam variáveis próprias (`--lp-*`), não os tokens do
 * painel.
 */

export const FONTE_SERIFA: CSSProperties = {
  fontFamily: "'Cormorant Garamond', 'Times New Roman', Georgia, serif",
};
export const FONTE_ITALICA: CSSProperties = {
  fontFamily: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
  fontStyle: "italic",
};
export const FONTE_SEM_SERIFA: CSSProperties = {
  fontFamily: "Geist, 'Helvetica Neue', Arial, sans-serif",
};

/**
 * Quebra de linha equilibrada nos títulos e sem palavra sozinha na última
 * linha dos parágrafos. Vai na raiz de cada modelo.
 */
export const TIPOGRAFIA_LP =
  "[&_h1]:text-balance [&_h2]:text-balance [&_h3]:text-balance [&_p]:text-pretty [&_li]:text-pretty";

/** Âncora do CTA quando ele abre o formulário em vez de um link. */
export const ANCORA_FORMULARIO = "#formulario";

/** Fundo escuro = o texto que contrasta com ele é branco. */
export function ehFundoEscuro(cor: string): boolean {
  return corDoTexto(cor) === "#ffffff";
}

/** Logo que contrasta com o fundo; sem a versão certa, a outra. */
export function logoPara(d: DadosLanding, fundo: "claro" | "escuro"): string | null {
  return fundo === "escuro" ? (d.logos.escuro ?? d.logos.claro) : (d.logos.claro ?? d.logos.escuro);
}

export const URL_FONTES =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Instrument+Serif:ital@0;1&display=swap";

export function variaveisCores(cores: CoresLanding): CSSProperties {
  return {
    "--lp-fundo": cores.fundo,
    "--lp-texto": cores.texto,
    "--lp-primaria": cores.primaria,
    "--lp-sobre-primaria": corDoTexto(cores.primaria),
    "--lp-destaque": cores.destaque,
    "--lp-sobre-destaque": corDoTexto(cores.destaque),
  } as CSSProperties;
}

/** Foto ou, sem ela, um bloco neutro do tamanho certo. */
export function Foto({
  src,
  className,
  alt = "",
  style,
}: {
  src: string | null | undefined;
  className?: string;
  alt?: string;
  style?: CSSProperties;
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={`bg-[color-mix(in_srgb,var(--lp-texto)_10%,var(--lp-fundo))] ${className ?? ""}`}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      style={style}
      className={`object-cover ${className ?? ""}`}
    />
  );
}

/** `object-position` da capa: centro na horizontal, `capa_foco` na vertical. */
export function enquadramentoCapa(foco: number): CSSProperties {
  return { objectPosition: `50% ${foco}%` };
}

/** Foto número `i` da lista, repetindo do começo quando faltam. */
export function fotoDa(lista: string[], i: number): string | null {
  if (lista.length === 0) return null;
  return lista[i % lista.length] ?? null;
}

export function LinkCta({
  href,
  aoClicar,
  className,
  style,
  observado = true,
  children,
}: {
  href: string;
  aoClicar: () => void;
  className?: string;
  style?: CSSProperties;
  /** Conta como CTA na tela para o botão fixo do celular (o próprio fixo não conta). */
  observado?: boolean;
  children: ReactNode;
}) {
  const externo = href.startsWith("http");
  return (
    <a
      href={href}
      {...(observado ? { "data-cta": "" } : {})}
      onClick={(e) => {
        // Com o formulário, o clique abre o popup em vez de pular para a âncora.
        if (href === ANCORA_FORMULARIO) e.preventDefault();
        aoClicar();
      }}
      {...(externo ? { target: "_blank", rel: "noreferrer" } : {})}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}

export function detalheEvento(e: EventoPublico): string {
  return [e.categoria, e.data_evento ? dataBR(e.data_evento) : null, e.local]
    .filter(Boolean)
    .join(" · ");
}

export function capaEvento(e: EventoPublico): string | null {
  return e.capa ? urlPrevia(e.capa) : null;
}

/** Link para a galeria do evento (registra o clique antes de navegar). */
export function LinkEvento({
  evento,
  aoClicar,
  className,
  children,
}: {
  evento: EventoPublico;
  aoClicar: (slug: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="/g/$slug"
      params={{ slug: evento.slug }}
      onClick={() => aoClicar(evento.slug)}
      className={className}
    >
      {children}
    </Link>
  );
}

export function LinkTodosEventos({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to="/eventos" className={className}>
      {children}
    </Link>
  );
}

export const ANO = new Date().getFullYear();

export interface LinkMenu {
  href: string;
  rotulo: string;
}

/**
 * Menu do celular: o botão fica no cabeçalho (some do `md` para cima, onde o
 * menu é a lista de links) e abre a página inteira com os links e o CTA, nas
 * cores da landing.
 */
export function MenuMobile({
  links,
  d,
  classeBotao,
  classeCta,
  estiloTitulo,
}: {
  links: LinkMenu[];
  d: DadosLanding;
  /** Cor e tamanho do ícone do menu sobre o cabeçalho do modelo. */
  classeBotao?: string;
  classeCta: string;
  estiloTitulo?: CSSProperties;
}) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Abrir o menu"
        aria-expanded={aberto}
        onClick={() => setAberto(true)}
        className={`flex size-10 items-center justify-center ${classeBotao ?? ""}`}
      >
        <Menu className="size-6" strokeWidth={1.5} />
      </button>
      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          data-menu-aberto=""
          className="fixed inset-0 z-50 flex flex-col bg-[var(--lp-fundo)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-[var(--lp-texto)]"
        >
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Fechar o menu"
              onClick={() => setAberto(false)}
              className="flex size-10 items-center justify-center"
            >
              <X className="size-6" strokeWidth={1.5} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col justify-center gap-6">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setAberto(false)}
                style={estiloTitulo}
                className="text-3xl"
              >
                {l.rotulo}
              </a>
            ))}
          </nav>
          <LinkCta
            href={d.linkCta}
            aoClicar={() => {
              setAberto(false);
              d.aoClicarCta();
            }}
            className={`${classeCta} w-full justify-center`}
          >
            {d.conteudo.cta_texto}
          </LinkCta>
        </div>
      )}
    </div>
  );
}

/**
 * Botão de contato preso embaixo, só no celular e só enquanto nenhum outro CTA
 * da página está na tela (nem o menu aberto). `raiz` é o elemento da landing,
 * onde ficam os CTAs observados.
 */
export function CtaFixoMobile({
  raiz,
  d,
  classe,
}: {
  raiz: HTMLElement | null;
  d: DadosLanding;
  classe: string;
}) {
  const [ctasNaTela, setCtasNaTela] = useState(1);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!raiz) return;
    const visiveis = new Set<Element>();
    const observador = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting && e.intersectionRect.height > 0) visiveis.add(e.target);
        else visiveis.delete(e.target);
      }
      setCtasNaTela(visiveis.size);
    });
    const observar = () => {
      for (const el of raiz.querySelectorAll("[data-cta]")) {
        observador.observe(el);
      }
    };
    observar();
    // O menu aberto cobre a página: o botão fixo sai da frente.
    const mutacoes = new MutationObserver(() => {
      setMenuAberto(raiz.querySelector("[data-menu-aberto]") !== null);
      observar();
    });
    mutacoes.observe(raiz, { childList: true, subtree: true });
    return () => {
      observador.disconnect();
      mutacoes.disconnect();
    };
  }, [raiz]);

  if (ctasNaTela > 0 || menuAberto) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <LinkCta
        href={d.linkCta}
        aoClicar={d.aoClicarCta}
        observado={false}
        className={`pointer-events-auto flex w-full items-center justify-center shadow-lg ${classe}`}
      >
        {d.conteudo.cta_texto}
      </LinkCta>
    </div>
  );
}
