import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabela, type ColunaTabela } from "@/components/Tabela";
import { brl, dataHoraBR } from "@/lib/format";
import { ROTULO_STATUS_PEDIDO, VARIANTE_STATUS_PEDIDO, type PedidoComGaleria } from "./api";

export function TabelaPedidos({
  pedidos,
  aoAbrir,
  compacta = false,
}: {
  pedidos: PedidoComGaleria[];
  aoAbrir: (pedido: PedidoComGaleria) => void;
  /** Sem rodapé de total e sem a coluna de galeria (lista curta do início). */
  compacta?: boolean;
}) {
  const colunas: ColunaTabela<PedidoComGaleria>[] = [
    {
      chave: "cliente_nome",
      titulo: "Cliente",
      ordenavel: true,
      classe: "max-w-[14rem] sm:max-w-xs",
      renderizar: (p) => (
        <Button
          variant="link"
          className="h-auto max-w-full justify-start p-0 text-left text-foreground"
          onClick={() => aoAbrir(p)}
        >
          <span className="truncate">{p.cliente_nome}</span>
        </Button>
      ),
    },
    ...(compacta
      ? []
      : [
          {
            chave: "galeria",
            titulo: "Galeria",
            classe: "hidden max-w-[14rem] truncate text-muted-foreground md:table-cell",
            valorOrdenacao: (p: PedidoComGaleria) => p.galeria?.titulo ?? "",
            ordenavel: true,
            renderizar: (p: PedidoComGaleria) => p.galeria?.titulo ?? "–",
          },
        ]),
    {
      chave: "itens",
      titulo: "Fotos",
      numerica: true,
      classe: "hidden sm:table-cell",
      valorOrdenacao: (p) => p.itens[0]?.count ?? 0,
      renderizar: (p) => (p.pacote_completo ? "Todas" : (p.itens[0]?.count ?? 0)),
    },
    {
      chave: "valor_total",
      titulo: "Valor",
      numerica: true,
      ordenavel: true,
      renderizar: (p) => brl(p.valor_total),
    },
    {
      chave: "status",
      titulo: "Situação",
      renderizar: (p) => (
        <Badge variant={VARIANTE_STATUS_PEDIDO[p.status]}>{ROTULO_STATUS_PEDIDO[p.status]}</Badge>
      ),
    },
    {
      chave: "created_at",
      titulo: "Data",
      ordenavel: true,
      valorOrdenacao: (p) => new Date(p.created_at).getTime(),
      classe: "hidden whitespace-nowrap text-muted-foreground lg:table-cell",
      renderizar: (p) => dataHoraBR(p.created_at),
    },
  ];

  const totalPago = pedidos
    .filter((p) => p.status === "pago")
    .reduce((t, p) => t + Number(p.valor_total), 0);

  return (
    <Card className="overflow-hidden p-0">
      <Tabela
        colunas={colunas}
        linhas={pedidos}
        chaveLinha={(p) => p.id}
        ordenacaoInicial={{ chave: "created_at", direcao: "desc" }}
        vazio="Nenhum pedido neste filtro."
        {...(compacta
          ? {}
          : { rodape: { cliente_nome: "Total pago", valor_total: brl(totalPago) } })}
      />
    </Card>
  );
}
