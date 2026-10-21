import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ImageIcon, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/PageHeader";
import { LayoutPublico } from "@/components/layout/LayoutPublico";
import { useVitrine, type EventoPublico } from "@/features/vitrine/api";
import { brl, dataBR } from "@/lib/format";
import { rotuloFotos, urlPrevia } from "@/lib/fotos";
import { BRAND } from "@/config/brand";
import { Miniatura } from "@/components/Miniatura";

export const Route = createFileRoute("/eventos")({
  ssr: false,
  head: () => ({ meta: [{ title: `Eventos | ${BRAND.name}` }] }),
  component: PaginaEventos,
});

const TODAS = "todas";

/** Tira acento e caixa, para a busca achar "Copa Sao" em "Copa São". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function PaginaEventos() {
  const vitrine = useVitrine();
  const [categoria, setCategoria] = useState(TODAS);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (vitrine.data?.fotografo) document.title = `Eventos | ${vitrine.data.fotografo}`;
  }, [vitrine.data?.fotografo]);

  const eventos = useMemo(() => vitrine.data?.eventos ?? [], [vitrine.data]);
  const categorias = useMemo(
    () =>
      [...new Set(eventos.map((e) => e.categoria.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [eventos],
  );
  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return eventos.filter(
      (e) =>
        (categoria === TODAS || e.categoria.trim() === categoria) &&
        (!termo || normalizar(`${e.titulo} ${e.local} ${e.categoria}`).includes(termo)),
    );
  }, [eventos, categoria, busca]);

  const fotografo = vitrine.data?.fotografo ?? "";

  return (
    <LayoutPublico fotografo={fotografo} marca={vitrine.data?.marca}>
      <section>
        <div className="mx-auto max-w-[96rem] space-y-3 px-4 py-12 md:px-8 md:py-20">
          <h1 className="text-heading-xl font-light md:text-display-xl md:font-light">
            Encontre as suas fotos
          </h1>
          <p className="max-w-2xl text-body-md text-muted-foreground">
            Escolha o evento em que você esteve, ache as suas fotos e compre direto por aqui.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[96rem] space-y-6 px-4 pb-16 md:px-8">
        {vitrine.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        ) : vitrine.isError ? (
          <EstadoVazio
            titulo="Não foi possível carregar os eventos"
            descricao={vitrine.error.message}
          />
        ) : eventos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum evento publicado ainda"
            descricao="Assim que o fotógrafo publicar as fotos de um evento, ele aparece aqui."
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="sm:w-80">
                <Input
                  icone={<Search />}
                  placeholder="Buscar evento ou local"
                  aria-label="Buscar evento ou local"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              {categorias.length > 0 && (
                <div className="sm:w-56">
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger aria-label="Categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODAS}>Todas as categorias</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {filtrados.length === 0 ? (
              <EstadoVazio
                titulo="Nenhum evento neste filtro"
                descricao="Tente outro nome, local ou categoria."
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtrados.map((e) => (
                  <li key={e.slug}>
                    <CartaoEvento evento={e} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </LayoutPublico>
  );
}

function CartaoEvento({ evento }: { evento: EventoPublico }) {
  return (
    <Link to="/g/$slug" params={{ slug: evento.slug }} className="group block h-full">
      <Card className="h-full overflow-hidden p-0 transition-colors group-hover:border-primary">
        <div className="relative aspect-[4/3] bg-muted">
          {evento.capa ? (
            <Miniatura
              src={urlPrevia(evento.capa)}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          {evento.categoria && (
            <Badge variant="secondary" className="absolute left-3 top-3">
              {evento.categoria}
            </Badge>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h2 className="text-heading-sm text-foreground group-hover:underline">{evento.titulo}</h2>
          <div className="space-y-1 text-sm text-muted-foreground">
            {evento.data_evento && (
              <p className="flex items-center gap-1.5">
                <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                {dataBR(evento.data_evento)}
              </p>
            )}
            {evento.local && (
              <p className="flex items-center gap-1.5">
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{evento.local}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-caption text-muted-foreground">
              {rotuloFotos(evento.total_fotos)} ·{" "}
              {evento.preco_foto > 0 ? `${brl(evento.preco_foto)} cada` : "grátis"}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
