import { Link } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabela, type ColunaTabela } from "@/components/Tabela";
import { brl, dataBR } from "@/lib/format";
import { urlPrevia } from "@/lib/fotos";
import { ROTULO_STATUS_GALERIA, type GaleriaComContagem, type StatusGaleria } from "./api";

export const VARIANTE_STATUS_GALERIA = {
  rascunho: "secondary",
  publicada: "success",
  arquivada: "outline",
} as const satisfies Record<StatusGaleria, string>;

const contar = (l: { count: number }[]) => l[0]?.count ?? 0;

export function TabelaGalerias({ galerias }: { galerias: GaleriaComContagem[] }) {
  const colunas: ColunaTabela<GaleriaComContagem>[] = [
    {
      chave: "titulo",
      titulo: "Galeria",
      ordenavel: true,
      classe: "max-w-[18rem] sm:max-w-md",
      renderizar: (g) => (
        <Link
          to="/galerias/$id"
          params={{ id: g.id }}
          className="flex items-center gap-3 hover:underline"
        >
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {g.capa ? (
              <img
                src={urlPrevia(g.capa.caminho_miniatura)}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{g.titulo}</span>
            {g.cliente_nome && (
              <span className="block truncate text-caption font-normal text-muted-foreground">
                {g.cliente_nome}
              </span>
            )}
          </span>
        </Link>
      ),
    },
    {
      chave: "status",
      titulo: "Situação",
      renderizar: (g) => (
        <Badge variant={VARIANTE_STATUS_GALERIA[g.status]}>{ROTULO_STATUS_GALERIA[g.status]}</Badge>
      ),
    },
    {
      chave: "fotos",
      titulo: "Fotos",
      numerica: true,
      ordenavel: true,
      classe: "hidden sm:table-cell",
      valorOrdenacao: (g) => contar(g.fotos),
      renderizar: (g) => contar(g.fotos) || <span className="text-faint">–</span>,
    },
    {
      chave: "pedidos",
      titulo: "Pedidos",
      numerica: true,
      ordenavel: true,
      classe: "hidden md:table-cell",
      valorOrdenacao: (g) => contar(g.pedidos),
      renderizar: (g) => contar(g.pedidos) || <span className="text-faint">–</span>,
    },
    {
      chave: "preco_foto",
      titulo: "Por foto",
      numerica: true,
      ordenavel: true,
      classe: "hidden md:table-cell",
      renderizar: (g) => (g.preco_foto > 0 ? brl(g.preco_foto) : "Grátis"),
    },
    {
      chave: "data_evento",
      titulo: "Evento",
      ordenavel: true,
      classe: "hidden whitespace-nowrap text-muted-foreground lg:table-cell",
      renderizar: (g) =>
        g.data_evento ? dataBR(g.data_evento) : <span className="text-faint">–</span>,
    },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <Tabela
        colunas={colunas}
        linhas={galerias}
        chaveLinha={(g) => g.id}
        ordenacaoInicial={{ chave: "data_evento", direcao: "desc" }}
        vazio="Nenhuma galeria neste filtro."
      />
    </Card>
  );
}
