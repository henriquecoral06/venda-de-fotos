import { ArrowRight } from "lucide-react";
import {
  ANO,
  FONTE_SEM_SERIFA,
  Foto,
  LinkCta,
  LinkEvento,
  LinkTodosEventos,
  MenuMobile,
  TIPOGRAFIA_LP,
  capaEvento,
  detalheEvento,
  ehFundoEscuro,
  fotoDa,
  logoPara,
  variaveisCores,
} from "../comum";
import type { DadosLanding } from "../tipos";

/** Portfólio: claro e arredondado, fotos em leque, etiquetas na cor de destaque. */
export function ModeloPortfolio({ d }: { d: DadosLanding }) {
  const { conteudo: c, fotos } = d;
  const galeria = fotos.galeria.length > 0 ? fotos.galeria : fotos.capa;
  const cartao =
    "rounded-[28px] bg-[color-mix(in_srgb,var(--lp-fundo)_35%,white)] shadow-[0_1px_0_rgba(0,0,0,0.04)]";
  const etiqueta =
    "inline-flex rounded-full border border-[var(--lp-destaque)] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[var(--lp-destaque)]";
  const botao =
    "inline-flex items-center gap-2 rounded-full bg-[var(--lp-primaria)] px-6 py-3 text-sm font-medium text-[var(--lp-sobre-primaria)] transition-opacity hover:opacity-85";
  const logo = logoPara(d, ehFundoEscuro(d.cores.fundo) ? "escuro" : "claro");
  const links = [
    { href: "#sobre", rotulo: "Sobre" },
    { href: "#trabalhos", rotulo: "Trabalhos" },
    ...(c.servicos.length > 0 ? [{ href: "#servicos", rotulo: "Serviços" }] : []),
    { href: "#eventos", rotulo: "Eventos" },
  ];

  return (
    <div
      style={{ ...variaveisCores(d.cores), ...FONTE_SEM_SERIFA }}
      className={`min-h-screen bg-[var(--lp-fundo)] p-2 text-[var(--lp-texto)] md:p-4 ${TIPOGRAFIA_LP}`}
    >
      <header className="flex items-center justify-between px-3 py-3 md:px-6">
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt={c.nome} className="h-9 max-w-36 object-contain" />
          ) : (
            <span className="text-lg font-semibold tracking-tight">{c.nome}</span>
          )}
        </div>
        <nav className="hidden items-center gap-5 text-sm md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.rotulo}
            </a>
          ))}
          <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={`${botao} px-4 py-2`}>
            {c.cta_texto}
          </LinkCta>
        </nav>
        <MenuMobile links={links} d={d} classeCta={botao} estiloTitulo={FONTE_SEM_SERIFA} />
      </header>

      <section
        className={`${cartao} overflow-hidden px-5 pb-16 pt-14 text-center md:px-10 md:pt-20`}
      >
        {c.chamada && <span className={etiqueta}>{c.chamada}</span>}
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          {c.titulo}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base opacity-70">{c.subtitulo}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={botao}>
            {c.cta_texto} <ArrowRight className="size-4" />
          </LinkCta>
          <a
            href="#eventos"
            className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--lp-texto)_25%,transparent)] px-6 py-3 text-sm font-medium"
          >
            Ver eventos
          </a>
        </div>
        {/* Três fotos em leque, como polaroides sobre a mesa. */}
        <div className="mx-auto mt-12 flex max-w-3xl items-end justify-center">
          {[-7, 0, 7].map((giro, i) => (
            <div
              key={giro}
              style={{ transform: `rotate(${giro}deg) translateY(${i === 1 ? -12 : 8}px)` }}
              className={`w-1/3 max-w-[240px] rounded-lg bg-white p-2 shadow-xl ${i === 1 ? "z-10" : "-mx-4"}`}
            >
              <Foto src={fotoDa(fotos.capa, i)} className="aspect-[3/4] w-full rounded" />
            </div>
          ))}
        </div>
      </section>

      <section id="sobre" className="px-3 pt-16 md:px-6">
        <div
          className={`${cartao} grid items-center gap-10 px-5 py-12 md:grid-cols-[1fr_1.3fr] md:px-12`}
        >
          {/* Retrato em moldura de polaroide, como as fotos da capa. */}
          <div className="mx-auto w-full max-w-xs -rotate-2 rounded-lg bg-white p-2.5 shadow-xl">
            <Foto src={fotos.sobre ?? fotoDa(galeria, 2)} className="aspect-[4/5] w-full rounded" />
          </div>
          <div className="space-y-5">
            <span className={etiqueta}>Sobre</span>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{c.sobre_titulo}</h2>
            <p className="max-w-xl whitespace-pre-line leading-relaxed opacity-75">
              {c.sobre_texto}
            </p>
            <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={botao}>
              {c.cta_texto} <ArrowRight className="size-4" />
            </LinkCta>
          </div>
        </div>
      </section>

      <section id="trabalhos" className="px-3 py-16 md:px-6">
        <div className="mb-8">
          <span className={etiqueta}>Trabalhos</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Alguns trabalhos
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Foto
              key={i}
              src={fotoDa(galeria, i)}
              className="aspect-[16/10] w-full rounded-[22px]"
            />
          ))}
        </div>
      </section>

      {c.servicos.length > 0 && (
        <section id="servicos" className={`${cartao} px-5 py-14 md:px-10`}>
          <span className={etiqueta}>Serviços</span>
          <div className="mt-8 divide-y divide-[color-mix(in_srgb,var(--lp-texto)_12%,transparent)]">
            {c.servicos.map((s, i) => (
              <div key={i} className="grid gap-2 py-6 md:grid-cols-[80px_1fr_2fr] md:gap-6">
                <span className="text-sm text-[var(--lp-destaque)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-semibold uppercase tracking-wide">{s.titulo}</h3>
                <p className="text-sm leading-relaxed opacity-70">{s.descricao}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="eventos" className="px-3 py-16 md:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className={etiqueta}>Eventos</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              {c.eventos_titulo}
            </h2>
            <p className="mt-2 max-w-xl text-sm opacity-70">{c.eventos_texto}</p>
          </div>
          <LinkTodosEventos className={botao}>
            Ver todos <ArrowRight className="size-4" />
          </LinkTodosEventos>
        </div>
        {d.eventos.length === 0 ? (
          <p className="text-sm opacity-60">Em breve, novos eventos por aqui.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.eventos.slice(0, 6).map((e) => (
              <li key={e.slug}>
                <LinkEvento
                  evento={e}
                  aoClicar={d.aoClicarEvento}
                  className={`${cartao} group block overflow-hidden p-2`}
                >
                  <Foto src={capaEvento(e)} className="aspect-[4/3] w-full rounded-[20px]" />
                  <div className="space-y-2 p-3">
                    <p className="font-semibold group-hover:underline">{e.titulo}</p>
                    <p className="text-xs opacity-60">{detalheEvento(e)}</p>
                  </div>
                </LinkEvento>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[28px] bg-[var(--lp-primaria)] px-5 py-16 text-center text-[var(--lp-sobre-primaria)] md:py-24">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
          {c.frase_final}
        </h2>
        <LinkCta
          href={d.linkCta}
          aoClicar={d.aoClicarCta}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--lp-destaque)] px-7 py-3 text-sm font-medium text-[var(--lp-sobre-destaque)]"
        >
          {c.cta_texto} <ArrowRight className="size-4" />
        </LinkCta>
      </section>

      <footer className="flex flex-wrap justify-between gap-2 px-3 py-6 text-xs opacity-60 md:px-6">
        <span>{c.nome}</span>
        <span>
          {c.instagram && <span className="mr-4">@{c.instagram.replace(/^@/, "")}</span>}© {ANO}
        </span>
      </footer>
    </div>
  );
}
