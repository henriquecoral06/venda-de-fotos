import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Copy, Download, Loader2, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/PageHeader";
import { LayoutPublico } from "@/components/layout/LayoutPublico";
import { linkDownload, usePedidoPublico, type PedidoPublico } from "@/features/vitrine/api";
import { brl, dataHoraBR } from "@/lib/format";
import { rotuloFotos, urlPrevia } from "@/lib/fotos";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/pedido/$codigo")({
  ssr: false,
  head: () => ({ meta: [{ title: `Seu pedido | ${BRAND.name}` }] }),
  component: PaginaPedido,
});

function PaginaPedido() {
  const { codigo } = Route.useParams();
  const pedido = usePedidoPublico(codigo);

  if (pedido.isPending) {
    return (
      <LayoutPublico fotografo="">
        <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </LayoutPublico>
    );
  }

  if (pedido.isError || !pedido.data) {
    return (
      <LayoutPublico fotografo="">
        <div className="mx-auto max-w-xl p-4 py-16">
          <EstadoVazio
            titulo={pedido.isError ? "Não foi possível abrir o pedido" : "Pedido não encontrado"}
            descricao={
              pedido.isError ? pedido.error.message : "Confira se o link do pedido está completo."
            }
          />
        </div>
      </LayoutPublico>
    );
  }

  const p = pedido.data;
  return (
    <LayoutPublico fotografo={p.fotografo}>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link to="/g/$slug" params={{ slug: p.galeria.slug }} className="hover:underline">
              {p.galeria.titulo}
            </Link>
          </p>
          <h1 className="text-heading-lg">Pedido de {p.cliente_nome}</h1>
          <p className="text-sm text-muted-foreground">
            {p.pacote_completo ? "Pacote completo" : rotuloFotos(p.itens.length)} ·{" "}
            {p.valor_total > 0 ? brl(p.valor_total) : "grátis"} · feito em{" "}
            {dataHoraBR(p.created_at)}
          </p>
        </div>

        {p.status === "aguardando_pagamento" && <Pagamento pedido={p} />}
        {p.status === "cancelado" && (
          <Card className="flex items-start gap-3 p-5">
            <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="font-medium">Pedido cancelado</p>
              <p className="text-sm text-muted-foreground">
                Fale com o fotógrafo se quiser refazer o pedido.
              </p>
            </div>
          </Card>
        )}
        {p.status === "pago" && <Downloads pedido={p} />}

        {p.status !== "pago" && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {p.itens.map((item) => (
              <li key={item.foto_id}>
                <img
                  src={urlPrevia(item.miniatura)}
                  alt={item.nome}
                  loading="lazy"
                  className="aspect-square w-full rounded-md border border-border object-cover"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </LayoutPublico>
  );
}

function Pagamento({ pedido }: { pedido: PedidoPublico }) {
  const { chave_pix, instrucoes, whatsapp } = pedido.pagamento;

  async function copiarPix() {
    try {
      await navigator.clipboard.writeText(chave_pix);
      toast.success("Chave Pix copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione a chave e copie.");
    }
  }

  const mensagem = encodeURIComponent(
    `Olá! Fiz o pedido de ${brl(pedido.valor_total)} na galeria "${pedido.galeria.titulo}". Segue o comprovante. Link do pedido: ${window.location.href}`,
  );

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Aguardando pagamento</p>
            <Badge variant="warning">{brl(pedido.valor_total)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Assim que o fotógrafo confirmar o pagamento, os downloads aparecem nesta página. Guarde
            este link.
          </p>
        </div>
      </div>

      {chave_pix && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">Chave Pix</p>
            <p className="break-all font-mono text-sm text-foreground">{chave_pix}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void copiarPix()}>
            <Copy className="size-4" />
            Copiar
          </Button>
        </div>
      )}

      {instrucoes && <p className="whitespace-pre-line text-sm text-foreground">{instrucoes}</p>}

      {whatsapp && (
        <Button asChild variant="outline">
          <a href={`https://wa.me/${whatsapp}?text=${mensagem}`} target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" />
            Enviar comprovante pelo WhatsApp
          </a>
        </Button>
      )}

      {!chave_pix && !instrucoes && !whatsapp && (
        <p className="text-sm text-muted-foreground">
          O fotógrafo vai entrar em contato pelo e-mail {pedido.cliente_email} para combinar o
          pagamento.
        </p>
      )}
    </Card>
  );
}

function Downloads({ pedido }: { pedido: PedidoPublico }) {
  const [baixando, setBaixando] = useState<string | null>(null);
  const [baixandoTodas, setBaixandoTodas] = useState(false);
  const itens = pedido.itens.filter(
    (i): i is typeof i & { original: string } => i.original !== null,
  );

  function abrir(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function baixar(caminho: string, nome: string) {
    setBaixando(caminho);
    try {
      abrir(await linkDownload(caminho, nome));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível baixar.");
    } finally {
      setBaixando(null);
    }
  }

  // Um arquivo por vez, com intervalo: o navegador pede uma única permissão
  // para downloads múltiplos e não descarta os seguintes.
  async function baixarTodas() {
    setBaixandoTodas(true);
    try {
      for (const item of itens) {
        abrir(await linkDownload(item.original, item.nome));
        await new Promise((r) => setTimeout(r, 700));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível baixar.");
    } finally {
      setBaixandoTodas(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-medium">Fotos liberadas</p>
            <p className="text-sm text-muted-foreground">
              Arquivos em alta resolução, sem marca d'água.
              {pedido.pago_em ? ` Pagamento confirmado em ${dataHoraBR(pedido.pago_em)}.` : ""}
            </p>
          </div>
        </div>
        {itens.length > 1 && (
          <Button onClick={() => void baixarTodas()} disabled={baixandoTodas}>
            {baixandoTodas ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Baixar todas ({itens.length})
          </Button>
        )}
      </Card>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {itens.map((item) => (
          <li
            key={item.foto_id}
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            <img
              src={urlPrevia(item.miniatura)}
              alt={item.nome}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="flex items-center justify-between gap-2 p-2 pl-3">
              <span className="truncate text-caption text-muted-foreground">{item.nome}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={`Baixar ${item.nome}`}
                disabled={baixando === item.original}
                onClick={() => void baixar(item.original, item.nome)}
              >
                {baixando === item.original ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
