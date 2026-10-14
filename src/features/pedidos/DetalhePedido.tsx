import { Check, Copy, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { brl, dataHoraBR } from "@/lib/format";
import { linkPedido, rotuloFotos, urlPrevia } from "@/lib/fotos";
import {
  ROTULO_STATUS_PEDIDO,
  VARIANTE_STATUS_PEDIDO,
  useItensPedido,
  useMudarStatusPedido,
  type PedidoComGaleria,
  type StatusPedido,
} from "./api";

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right text-foreground">{children}</span>
    </div>
  );
}

export function DetalhePedido({
  pedido,
  aoFechar,
}: {
  pedido: PedidoComGaleria | null;
  aoFechar: () => void;
}) {
  const itens = useItensPedido(pedido?.id ?? null);
  const mudar = useMudarStatusPedido();

  function alterar(status: StatusPedido, mensagem: string) {
    if (!pedido) return;
    mudar.mutate(
      { id: pedido.id, status },
      {
        onSuccess: () => {
          toast.success(mensagem);
          aoFechar();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  async function copiarLink() {
    if (!pedido) return;
    try {
      await navigator.clipboard.writeText(linkPedido(pedido.codigo));
      toast.success("Link do pedido copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  const fotos = itens.data ?? [];

  return (
    <Dialog open={pedido !== null} onOpenChange={(v) => !v && !mudar.isPending && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {pedido && (
          <>
            <DialogHeader>
              <DialogTitle>Pedido de {pedido.cliente_nome}</DialogTitle>
              <DialogDescription>
                {pedido.galeria?.titulo ?? "Galeria"} · {dataHoraBR(pedido.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="divide-y divide-border">
              <Linha rotulo="Situação">
                <Badge variant={VARIANTE_STATUS_PEDIDO[pedido.status]}>
                  {ROTULO_STATUS_PEDIDO[pedido.status]}
                </Badge>
              </Linha>
              <Linha rotulo="E-mail">
                <a className="hover:underline" href={`mailto:${pedido.cliente_email}`}>
                  {pedido.cliente_email}
                </a>
              </Linha>
              {pedido.cliente_telefone && (
                <Linha rotulo="Telefone">{pedido.cliente_telefone}</Linha>
              )}
              <Linha rotulo="Itens">
                {pedido.pacote_completo
                  ? `Pacote completo (${rotuloFotos(pedido.itens[0]?.count ?? 0)})`
                  : rotuloFotos(pedido.itens[0]?.count ?? 0)}
              </Linha>
              <Linha rotulo="Total">
                <span className="font-semibold tabular-nums">{brl(pedido.valor_total)}</span>
              </Linha>
              {pedido.pago_em && <Linha rotulo="Pago em">{dataHoraBR(pedido.pago_em)}</Linha>}
            </div>

            {itens.isPending ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : itens.isError ? (
              <p className="text-sm text-danger">{itens.error.message}</p>
            ) : (
              <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
                {fotos.map(
                  (item) =>
                    item.foto && (
                      <li key={item.foto.id}>
                        <img
                          src={urlPrevia(item.foto.caminho_miniatura)}
                          alt={item.foto.nome_arquivo}
                          title={item.foto.nome_arquivo}
                          loading="lazy"
                          className="aspect-square w-full rounded-md border border-border object-cover"
                        />
                      </li>
                    ),
                )}
              </ul>
            )}

            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => void copiarLink()}>
                <Copy className="size-4" />
                Link do cliente
              </Button>
              <div className="flex flex-wrap gap-2">
                {pedido.status !== "cancelado" && (
                  <Button
                    variant="outline"
                    disabled={mudar.isPending}
                    onClick={() => alterar("cancelado", "Pedido cancelado.")}
                  >
                    <X className="size-4" />
                    Cancelar pedido
                  </Button>
                )}
                {pedido.status !== "pago" && (
                  <Button
                    disabled={mudar.isPending}
                    onClick={() =>
                      alterar("pago", "Pagamento confirmado. O cliente já pode baixar as fotos.")
                    }
                  >
                    {mudar.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Confirmar pagamento
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
