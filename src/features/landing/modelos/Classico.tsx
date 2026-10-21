import {
  ANO,
  FONTE_SERIFA,
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

/** Clássico: creme, serifa em maiúsculas, capa em tela cheia e faixa na cor principal. */
export function ModeloClassico({ d }: { d: DadosLanding }) {
  const { conteudo: c, fotos } = d;
  const galeria = fotos.galeria.length > 0 ? fotos.galeria : fotos.capa;
  const titulo = "uppercase tracking-[0.06em]";
  const botaoEscuro =
    "inline-flex items-center justify-center border border-[var(--lp-texto)] px-7 py-3 text-xs uppercase tracking-[0.2em] transition-colors hover:bg-[var(--lp-texto)] hover:text-[var(--lp-fundo)]";
  const botaoClaro =
    "inline-flex items-center justify-center bg-white px-7 py-3 text-xs uppercase tracking-[0.2em] text-black transition-opacity hover:opacity-85";
  const logo = logoPara(d, ehFundoEscuro(d.cores.fundo) ? "escuro" : "claro");
  const links = [
    { href: "#sobre", rotulo: "Sobre" },
    { href: "#servicos", rotulo: "Serviços" },
    { href: "#eventos", rotulo: "Eventos" },
  ];

  return (
    <div
      style={{ ...variaveisCores(d.cores), ...FONTE_SEM_SERIFA }}
      className={`min-h-screen bg-[var(--lp-fundo)] text-[var(--lp-texto)] ${TIPOGRAFIA_LP}`}
    >
      {/* Mesmo arranjo do Estúdio: marca à esquerda, links e CTA à direita (menu no celular). */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
        {logo ? (
          <img src={logo} alt={c.nome} className="h-10 max-w-44 object-contain" />
        ) : (
          <span style={FONTE_SERIFA} className={`text-xl ${titulo}`}>
            {c.nome}
          </span>
        )}
        <nav className="hidden items-center gap-7 text-xs uppercase tracking-[0.2em] md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="opacity-80 hover:opacity-100">
              {l.rotulo}
            </a>
          ))}
          <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={botaoEscuro}>
            {c.cta_texto}
          </LinkCta>
        </nav>
        <MenuMobile
          links={links}
          d={d}
          classeCta={botaoEscuro}
          estiloTitulo={{ ...FONTE_SERIFA, textTransform: "uppercase", letterSpacing: "0.06em" }}
        />
      </header>

      {/* Capa em tela cheia com o título por cima. */}
      <section className="relative h-[85vh] min-h-[460px] overflow-hidden bg-black">
        <Foto src={fotoDa(fotos.capa, 0)} className="absolute inset-0 size-full opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/10" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-white">
          <h1
            style={FONTE_SERIFA}
            className={`max-w-4xl text-4xl leading-tight md:text-6xl ${titulo}`}
          >
            {c.titulo}
          </h1>
          <p className="mt-5 text-xs uppercase tracking-[0.35em] text-white/85">{c.chamada}</p>
          <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={`${botaoClaro} mt-8`}>
            {c.cta_texto}
          </LinkCta>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20 text-center md:py-28">
        <Foto src={fotoDa(galeria, 1)} className="mx-auto mb-10 aspect-[16/9] w-full grayscale" />
        <p className="leading-relaxed opacity-80">{c.subtitulo}</p>
        <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={`${botaoEscuro} mt-8`}>
          {c.cta_texto}
        </LinkCta>
      </section>

      <section id="sobre" className="bg-[var(--lp-primaria)] text-[var(--lp-sobre-primaria)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-[1.3fr_1fr] md:px-10 md:py-28">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] opacity-70">Prazer, {c.nome}</p>
            <h2 style={FONTE_SERIFA} className={`text-4xl md:text-6xl ${titulo}`}>
              {c.sobre_titulo}
            </h2>
            <p className="max-w-xl whitespace-pre-line leading-relaxed opacity-85">
              {c.sobre_texto}
            </p>
          </div>
          <Foto
            src={fotos.sobre ?? fotoDa(galeria, 2)}
            className="mx-auto aspect-square w-full max-w-sm"
          />
        </div>
      </section>

      <section id="servicos">
        {/* Faixa de chamada colada no sobre: foto ao fundo, título, texto e CTA. */}
        <div className="relative overflow-hidden">
          <Foto src={fotoDa(galeria, 3)} className="absolute inset-0 size-full" />
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center text-white md:py-28">
            <h2 style={FONTE_SERIFA} className={`text-3xl md:text-5xl ${titulo}`}>
              {c.faixa_titulo}
            </h2>
            {c.faixa_texto && (
              <p className="mt-5 max-w-xl leading-relaxed text-white/85">{c.faixa_texto}</p>
            )}
            <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={`${botaoClaro} mt-8`}>
              {c.cta_texto}
            </LinkCta>
          </div>
        </div>
        {c.servicos.length > 0 && (
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-20 md:grid-cols-3 md:px-10 md:py-28">
            {c.servicos.map((s, i) => (
              <div key={i} className="space-y-4 text-center">
                <Foto src={fotoDa(galeria, i + 4)} className="aspect-[3/4] w-full" />
                <h3 style={FONTE_SERIFA} className={`text-2xl ${titulo}`}>
                  {s.titulo}
                </h3>
                <p className="text-sm leading-relaxed opacity-75">{s.descricao}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        id="eventos"
        className="border-t border-[color-mix(in_srgb,var(--lp-texto)_15%,transparent)] px-5 py-20 md:px-10 md:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--lp-destaque)]">
              Galerias abertas
            </p>
            <h2 style={FONTE_SERIFA} className={`mt-3 text-3xl md:text-5xl ${titulo}`}>
              {c.eventos_titulo}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm opacity-70">{c.eventos_texto}</p>
          </div>
          {d.eventos.length === 0 ? (
            <p className="text-center text-sm opacity-60">Em breve, novos eventos por aqui.</p>
          ) : (
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {d.eventos.slice(0, 6).map((e) => (
                <li key={e.slug}>
                  <LinkEvento
                    evento={e}
                    aoClicar={d.aoClicarEvento}
                    className="group block space-y-3 text-center"
                  >
                    <Foto
                      src={capaEvento(e)}
                      className="aspect-[4/5] w-full transition-opacity group-hover:opacity-85"
                    />
                    <p style={FONTE_SERIFA} className={`text-xl ${titulo}`}>
                      {e.titulo}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] opacity-60">
                      {detalheEvento(e)}
                    </p>
                  </LinkEvento>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-12 text-center">
            <LinkTodosEventos className={botaoEscuro}>Ver todos os eventos</LinkTodosEventos>
          </div>
        </div>
      </section>

      <section className="bg-[color-mix(in_srgb,var(--lp-destaque)_18%,var(--lp-fundo))] px-5 py-20 text-center md:py-28">
        <h2 style={FONTE_SERIFA} className={`mx-auto max-w-3xl text-3xl md:text-5xl ${titulo}`}>
          {c.frase_final}
        </h2>
        <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={`${botaoEscuro} mt-8`}>
          {c.cta_texto}
        </LinkCta>
      </section>

      <footer className="flex flex-col items-center gap-1 py-8 text-xs opacity-70">
        <span style={FONTE_SERIFA} className={`text-base ${titulo}`}>
          {c.nome}
        </span>
        <span>
          {c.instagram && <span className="mr-3">@{c.instagram.replace(/^@/, "")}</span>}© {ANO}
        </span>
      </footer>
    </div>
  );
}
