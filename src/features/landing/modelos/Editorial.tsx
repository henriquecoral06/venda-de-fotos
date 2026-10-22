import { ArrowUpRight } from "lucide-react";
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
  enquadramentoCapa,
  fotoDa,
  logoPara,
  variaveisCores,
} from "../comum";
import type { DadosLanding } from "../tipos";

const LINKS = [
  { href: "#sobre", rotulo: "Sobre" },
  { href: "#trabalhos", rotulo: "Trabalhos" },
  { href: "#eventos", rotulo: "Eventos" },
  { href: "#contato", rotulo: "Contato" },
];

/** Editorial: preto e branco, serifa fina, capa com duas fotos lado a lado e mosaico. */
export function ModeloEditorial({ d }: { d: DadosLanding }) {
  const { conteudo: c, fotos } = d;
  const galeria = fotos.galeria.length > 0 ? fotos.galeria : fotos.capa;
  const botao =
    "inline-flex items-center justify-center border border-[var(--lp-texto)] px-8 py-3 text-sm tracking-wide transition-colors hover:bg-[var(--lp-primaria)] hover:text-[var(--lp-sobre-primaria)]";

  return (
    <div
      style={{ ...variaveisCores(d.cores), ...FONTE_SEM_SERIFA }}
      className={`min-h-screen bg-[var(--lp-fundo)] text-[var(--lp-texto)] ${TIPOGRAFIA_LP}`}
    >
      {/* O cabeçalho fica sobre a capa escura: vale a logo para fundo escuro. */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-5 text-white md:px-10">
        {logoPara(d, "escuro") ? (
          <img
            src={logoPara(d, "escuro") ?? ""}
            alt={c.nome}
            className="h-9 max-w-40 object-contain"
          />
        ) : (
          <span style={FONTE_SERIFA} className="text-2xl italic">
            {c.nome}
          </span>
        )}
        <nav className="hidden gap-6 text-sm md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.rotulo}
            </a>
          ))}
        </nav>
        <MenuMobile
          links={LINKS}
          d={d}
          classeBotao="text-white"
          classeCta={`${botao} border-[var(--lp-texto)]`}
          estiloTitulo={FONTE_SERIFA}
        />
      </header>

      {/* Capa: duas fotos em tela cheia, metade cada uma, mostrando o centro de
          cada imagem; no celular, só a primeira. Título por cima em branco. */}
      <section className="relative h-[88vh] min-h-[480px] overflow-hidden bg-black">
        {/* `grid-rows-1` prende a linha na altura da capa: sem ela, a foto vertical
            cresce até o tamanho natural, a capa corta embaixo e o enquadramento não age. */}
        <div className="grid size-full grid-cols-1 grid-rows-1 md:grid-cols-2">
          <Foto
            src={fotoDa(fotos.capa, 0)}
            style={enquadramentoCapa(c.capa_foco)}
            className="size-full opacity-85"
          />
          <Foto
            src={fotoDa(fotos.capa, 1)}
            style={enquadramentoCapa(c.capa_foco)}
            className="hidden size-full opacity-85 md:block"
          />
        </div>
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-white">
          {c.chamada && (
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/80">{c.chamada}</p>
          )}
          <h1
            style={FONTE_SERIFA}
            className="max-w-4xl text-5xl font-light leading-[1.05] md:text-8xl"
          >
            {c.titulo}
          </h1>
          <LinkCta
            href={d.linkCta}
            aoClicar={d.aoClicarCta}
            className="mt-10 inline-flex items-center justify-center border border-white px-8 py-3 text-sm tracking-wide text-white transition-colors hover:bg-white hover:text-black"
          >
            {c.cta_texto}
          </LinkCta>
        </div>
      </section>

      <section
        id="sobre"
        className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1.2fr_1fr] md:px-10 md:py-28"
      >
        <div className="space-y-6">
          <h2 style={FONTE_SERIFA} className="text-4xl font-light md:text-6xl">
            {c.sobre_titulo}
          </h2>
          <p className="max-w-xl whitespace-pre-line text-base leading-relaxed opacity-80">
            {c.sobre_texto}
          </p>
          {c.subtitulo && (
            <p className="max-w-xl text-sm leading-relaxed opacity-60">{c.subtitulo}</p>
          )}
        </div>
        <Foto src={fotos.sobre ?? fotoDa(galeria, 2)} className="aspect-[4/5] w-full grayscale" />
      </section>

      <section id="trabalhos" className="mx-auto max-w-6xl px-5 pb-20 md:px-10">
        <h2 style={FONTE_SERIFA} className="mb-8 text-4xl font-light md:text-5xl">
          Alguns trabalhos
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Foto
              key={i}
              src={fotoDa(galeria, i)}
              className={
                i === 2
                  ? "row-span-2 h-full w-full"
                  : i === 3
                    ? "col-span-2 aspect-[2/1] w-full"
                    : "aspect-[4/3] w-full"
              }
            />
          ))}
        </div>
      </section>

      {c.servicos.length > 0 && (
        <section className="border-y border-[color-mix(in_srgb,var(--lp-texto)_20%,transparent)]">
          <div className="mx-auto grid max-w-6xl divide-y divide-[color-mix(in_srgb,var(--lp-texto)_20%,transparent)] md:grid-cols-3 md:divide-x md:divide-y-0">
            {c.servicos.map((s, i) => (
              <div key={i} className="flex flex-col gap-4 px-5 py-10 md:px-8">
                <h3 style={FONTE_SERIFA} className="text-3xl">
                  {s.titulo}
                </h3>
                <p className="flex-1 text-sm leading-relaxed opacity-75">{s.descricao}</p>
                <LinkCta
                  href={d.linkCta}
                  aoClicar={d.aoClicarCta}
                  className={`${botao} self-start`}
                >
                  {c.cta_texto}
                </LinkCta>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="eventos" className="mx-auto max-w-6xl px-5 py-20 md:px-10 md:py-28">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <h2 style={FONTE_SERIFA} className="text-4xl font-light md:text-6xl">
              {c.eventos_titulo}
            </h2>
            <p className="max-w-xl text-sm opacity-70">{c.eventos_texto}</p>
          </div>
          <LinkTodosEventos className="text-sm underline underline-offset-4">
            Ver todos os eventos
          </LinkTodosEventos>
        </div>
        {d.eventos.length === 0 ? (
          <p className="text-sm opacity-60">Em breve, novos eventos por aqui.</p>
        ) : (
          <ul className="divide-y divide-[color-mix(in_srgb,var(--lp-texto)_20%,transparent)] border-y border-[color-mix(in_srgb,var(--lp-texto)_20%,transparent)]">
            {d.eventos.slice(0, 6).map((e) => (
              <li key={e.slug}>
                <LinkEvento
                  evento={e}
                  aoClicar={d.aoClicarEvento}
                  className="group flex items-center gap-5 py-5"
                >
                  <Foto
                    src={capaEvento(e)}
                    className="size-20 shrink-0 grayscale group-hover:grayscale-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p style={FONTE_SERIFA} className="truncate text-2xl md:text-3xl">
                      {e.titulo}
                    </p>
                    <p className="text-xs uppercase tracking-widest opacity-60">
                      {detalheEvento(e)}
                    </p>
                  </div>
                  <ArrowUpRight className="size-6 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                </LinkEvento>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="contato" className="px-5 py-24 text-center md:py-32">
        <h2 style={FONTE_SERIFA} className="mx-auto max-w-3xl text-4xl font-light md:text-7xl">
          {c.frase_final}
        </h2>
        <LinkCta href={d.linkCta} aoClicar={d.aoClicarCta} className={`${botao} mt-10`}>
          {c.cta_texto}
        </LinkCta>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[color-mix(in_srgb,var(--lp-texto)_20%,transparent)] px-5 py-6 text-xs opacity-70 md:px-10">
        <span style={FONTE_SERIFA} className="text-lg italic">
          {c.nome}
        </span>
        <span>
          {c.instagram && (
            <a
              href={`https://instagram.com/${c.instagram.replace(/^@/, "")}`}
              className="mr-4 underline"
            >
              @{c.instagram.replace(/^@/, "")}
            </a>
          )}
          © {ANO}
        </span>
      </footer>
    </div>
  );
}
