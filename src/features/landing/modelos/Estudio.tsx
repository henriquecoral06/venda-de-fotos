import { ArrowUpRight } from "lucide-react";
import {
  ANO,
  FONTE_ITALICA,
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

// Inclinação de cada foto da faixa da capa (efeito de curva em perspectiva).
const GIROS = [28, 14, 0, -14, -28];

/** Estúdio: escuro, título com itálico serifado, faixa curva de fotos e blocos. */
export function ModeloEstudio({ d }: { d: DadosLanding }) {
  const { conteudo: c, fotos } = d;
  const galeria = fotos.galeria.length > 0 ? fotos.galeria : fotos.capa;
  const [primeira, ...resto] = c.titulo.split(" ");
  const meio = Math.ceil(resto.length / 2);
  const linha1 = [primeira, ...resto.slice(0, meio)].join(" ");
  const linha2 = resto.slice(meio).join(" ");
  const pilula =
    "inline-flex items-center gap-2 rounded-full bg-[var(--lp-primaria)] px-5 py-2.5 text-sm font-medium text-[var(--lp-sobre-primaria)] transition-opacity hover:opacity-85";
  const bloco = "rounded-3xl bg-[var(--lp-destaque)] text-[var(--lp-sobre-destaque)]";
  const logo = logoPara(d, ehFundoEscuro(d.cores.fundo) ? "escuro" : "claro");
  const links = [
    { href: "#sobre", rotulo: "Sobre" },
    ...(c.servicos.length > 0 ? [{ href: "#servicos", rotulo: "Serviços" }] : []),
    { href: "#eventos", rotulo: "Eventos" },
  ];
  const chip =
    "rounded-full border border-[color-mix(in_srgb,var(--lp-texto)_20%,transparent)] px-3 py-1 text-xs opacity-80";

  return (
    <div
      style={{ ...variaveisCores(d.cores), ...FONTE_SEM_SERIFA }}
      className={`min-h-screen overflow-hidden bg-[var(--lp-fundo)] text-[var(--lp-texto)] ${TIPOGRAFIA_LP}`}
    >
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
        {logo ? (
          <img src={logo} alt={c.nome} className="h-8 max-w-36 object-contain" />
        ) : (
          <span className="text-lg font-semibold">{c.nome}</span>
        )}
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="opacity-80 hover:opacity-100">
              {l.rotulo}
            </a>
          ))}
          <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={pilula}>
            {c.cta_texto}
          </LinkCta>
        </nav>
        <MenuMobile links={links} d={d} classeCta={pilula} estiloTitulo={FONTE_SEM_SERIFA} />
      </header>

      <section className="px-5 pt-14 text-center md:pt-20">
        {c.chamada && (
          <p className="mb-5 text-xs uppercase tracking-[0.25em] opacity-60">{c.chamada}</p>
        )}
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          {/* Cada parte é um bloco equilibrado: com <br>, o navegador não equilibra. */}
          <span className="block text-balance">{linha1}</span>
          {linha2 && (
            <span style={FONTE_ITALICA} className="block text-balance font-normal opacity-60">
              {linha2}
            </span>
          )}
        </h1>
        <p className="mx-auto mt-6 max-w-xl opacity-70">{c.subtitulo}</p>
        <div className="mt-8 flex justify-center gap-3">
          <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={pilula}>
            {c.cta_texto} <ArrowUpRight className="size-4" />
          </LinkCta>
          <a
            href="#eventos"
            className="rounded-full border border-[color-mix(in_srgb,var(--lp-texto)_25%,transparent)] px-5 py-2.5 text-sm"
          >
            Ver eventos
          </a>
        </div>

        {/* Faixa de fotos verticais em curva; no celular, rola para o lado. */}
        <div className="mx-auto mt-14 flex max-w-6xl snap-x gap-3 overflow-x-auto pb-4 [perspective:1200px] md:justify-center md:overflow-visible">
          {GIROS.map((giro, i) => (
            <div
              key={giro}
              style={{ transform: `rotateY(${giro}deg)` }}
              className="w-40 shrink-0 snap-center md:w-52"
            >
              <Foto src={fotoDa(fotos.capa, i)} className="aspect-[3/5] w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </section>

      <section id="sobre" className="mx-auto max-w-7xl px-5 pt-24 md:px-8">
        <div
          className={`${bloco} grid items-center gap-8 p-5 md:grid-cols-[1fr_1.15fr] md:gap-12 md:p-8`}
        >
          <Foto
            src={fotos.sobre ?? fotoDa(galeria, 2)}
            className="aspect-[4/5] w-full rounded-2xl"
          />
          <div className="space-y-5 md:pr-6">
            <span className={chip}>Prazer, {c.nome}</span>
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">{c.sobre_titulo}</h2>
            <p className="max-w-xl whitespace-pre-line leading-relaxed opacity-75">
              {c.sobre_texto}
            </p>
            <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={pilula}>
              {c.cta_texto} <ArrowUpRight className="size-4" />
            </LinkCta>
          </div>
        </div>
      </section>

      {c.servicos.length > 0 && (
        <section id="servicos" className="mx-auto max-w-7xl px-5 py-24 md:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Serviços{" "}
              <span style={FONTE_ITALICA} className="font-normal opacity-60">
                e o que eu faço
              </span>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {c.servicos.map((s, i) => (
              <div
                key={i}
                className={`${bloco} flex flex-col justify-between gap-6 p-7 ${i === 0 ? "md:row-span-2" : ""}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    {i === 0 && <span className={chip}>Mais procurado</span>}
                    <span className="ml-auto text-xs opacity-50">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-3xl font-medium md:text-4xl">{s.titulo}</h3>
                  <p className="max-w-md text-sm opacity-70">{s.descricao}</p>
                </div>
                {i === 0 && (
                  <div className="space-y-4">
                    <Foto src={fotoDa(galeria, 0)} className="aspect-[16/9] w-full rounded-2xl" />
                    <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={pilula}>
                      {c.cta_texto} <ArrowUpRight className="size-4" />
                    </LinkCta>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section
        id="eventos"
        className={`mx-auto max-w-7xl px-5 pb-24 md:px-8 ${c.servicos.length === 0 ? "pt-24" : ""}`}
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
              {c.eventos_titulo}
            </h2>
            <p className="mt-3 max-w-xl text-sm opacity-70">{c.eventos_texto}</p>
          </div>
          <LinkTodosEventos className={pilula}>
            Todos os eventos <ArrowUpRight className="size-4" />
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
                  className={`${bloco} group block overflow-hidden`}
                >
                  <Foto
                    src={capaEvento(e)}
                    className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="space-y-2 p-5">
                    {e.categoria && (
                      <span className="inline-flex rounded-full bg-[var(--lp-primaria)] px-3 py-1 text-xs text-[var(--lp-sobre-primaria)]">
                        {e.categoria}
                      </span>
                    )}
                    <p className="text-lg font-medium">{e.titulo}</p>
                    <p className="text-xs opacity-60">{detalheEvento(e)}</p>
                  </div>
                </LinkEvento>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 md:px-8">
        <div className={`${bloco} px-6 py-16 text-center md:py-24`}>
          <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            {c.frase_final}
          </h2>
          <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={`${pilula} mt-8`}>
            {c.cta_texto} <ArrowUpRight className="size-4" />
          </LinkCta>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-5 pb-8 text-xs opacity-50 md:px-8">
        <span>{c.nome}</span>
        <span>
          {c.instagram && <span className="mr-4">@{c.instagram.replace(/^@/, "")}</span>}© {ANO}
        </span>
      </footer>
    </div>
  );
}
