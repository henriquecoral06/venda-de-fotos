import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { corDoTexto } from "@/lib/marca";
import { dataBR } from "@/lib/format";
import { urlPrevia } from "@/lib/fotos";
import type { EventoPublico } from "@/features/vitrine/api";
import type { CoresLanding } from "./tipos";

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
}: {
  src: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={`bg-[color-mix(in_srgb,var(--lp-texto)_10%,var(--lp-fundo))] ${className ?? ""}`}
      />
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className ?? ""}`} />;
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
  children,
}: {
  href: string;
  aoClicar: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const externo = href.startsWith("http");
  return (
    <a
      href={href}
      onClick={aoClicar}
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
