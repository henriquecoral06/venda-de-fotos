import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Loader2,
  MessageCircle,
  QrCode,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/PageHeader";
import { LayoutPublico } from "@/components/layout/LayoutPublico";
import { Campo } from "@/components/Campo";
import {
  conferirPagamento,
  linkDownload,
  useGerarCobranca,
  usePedidoPublico,
  type MetodoPagamento,
  type PedidoPublico,
} from "@/features/vitrine/api";
import { baixarZip } from "@/features/vitrine/zip";
import { brl, dataHoraBR, mascararCpf } from "@/lib/format";
import { CLASSE_BOTAO_MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { rotuloFotos, urlPrevia } from "@/lib/fotos";
import { BRAND } from "@/config/brand";
import { Miniatura } from "@/components/Miniatura";

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
    <LayoutPublico fotografo={p.fotografo} marca={p.marca}>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link to="/g/$slug" params={{ slug: p.galeria.slug }} className="hover:underline">
              {p.galeria.titulo}
            </Link>
          </p>
          <h1 className="text-heading-lg font-light md:text-heading-xl">
            Pedido de {p.cliente_nome}
          </h1>
          <p className="text-sm text-muted-foreground">
            {p.pacote_completo ? "Pacote completo" : rotuloFotos(p.itens.length)} ·{" "}
            {p.valor_total > 0 ? brl(p.valor_total) : "grátis"} · feito em{" "}
            {dataHoraBR(p.created_at)}
          </p>
        </div>

        {p.status === "aguardando_pagamento" &&
          (p.pagamento.gateway && p.pagamento.gateway !== "manual" ? (
            <PagamentoOnline pedido={p} />
          ) : (
            <Pagamento pedido={p} />
          ))}
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
                <Miniatura
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => void copiar(chave_pix, "Chave Pix copiada.")}
          >
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

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(aviso);
  } catch {
    toast.error("Não foi possível copiar. Selecione o código e copie.");
  }
}

/**
 * Pix ou cartão pelo gateway do fotógrafo. O pedido vira pago quando o banco
 * confirma no gateway; a página só pergunta de tempos em tempos.
 */
function PagamentoOnline({ pedido }: { pedido: PedidoPublico }) {
  const gerar = useGerarCobranca(pedido.codigo);
  const cobranca = pedido.pagamento.cobranca ?? null;
  const pedeCpf = pedido.pagamento.gateway === "asaas";
  const [escolhendo, setEscolhendo] = useState(false);
  const [cpf, setCpf] = useState("");
  const [erroCpf, setErroCpf] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const { whatsapp } = pedido.pagamento;

  // Sem webhook (site em http, aviso atrasado), a página confere sozinha a
  // cada 20 s enquanto há cobrança em aberto e ao voltar para a aba.
  useEffect(() => {
    if (!cobranca) return;
    const conferir = () => void conferirPagamento(pedido.codigo);
    const intervalo = window.setInterval(conferir, 20_000);
    const aoVoltar = () => document.visibilityState === "visible" && conferir();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [cobranca, pedido.codigo]);

  function pagar(metodo: MetodoPagamento) {
    if (pedeCpf && cpf.replace(/\D/g, "").length !== 11) {
      setErroCpf("Informe o CPF de quem paga (11 dígitos).");
      document.getElementById("cpf-pagador")?.focus();
      return;
    }
    setErroCpf(null);
    gerar.mutate(
      { metodo, cpf },
      {
        onSuccess: (c) => {
          setEscolhendo(false);
          // Na mesma aba: aba nova aberta depois da resposta do servidor cai no
          // bloqueador de pop-up. O gateway devolve o comprador para cá.
          if (c.metodo === "cartao") window.location.assign(c.link);
        },
        onError: (erro: Error) => toast.error(erro.message),
      },
    );
  }

  async function jaPaguei() {
    setConferindo(true);
    await conferirPagamento(pedido.codigo).catch(() => undefined);
    setConferindo(false);
  }

  const mostrarCobranca = cobranca && !escolhendo;

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
            Assim que o pagamento for confirmado, os downloads aparecem nesta página
            automaticamente. Guarde este link.
          </p>
        </div>
      </div>

      {mostrarCobranca && cobranca.metodo === "pix" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-muted p-4 sm:flex-row sm:items-start">
            {cobranca.pix_qrcode && (
              <img
                src={`data:image/png;base64,${cobranca.pix_qrcode}`}
                alt="QR Code do Pix"
                className="size-48 shrink-0 rounded-md"
              />
            )}
            <div className="min-w-0 space-y-3">
              <p className="text-sm text-foreground">
                Abra o app do banco, escolha pagar com Pix e leia o QR Code ou cole o código.
              </p>
              <p className="line-clamp-3 break-all font-mono text-caption text-muted-foreground">
                {cobranca.pix_copia_cola}
              </p>
              <Button
                className={cn("w-full sm:w-auto", CLASSE_BOTAO_MARCA)}
                onClick={() => void copiar(cobranca.pix_copia_cola, "Código Pix copiado.")}
              >
                <Copy className="size-4" />
                Copiar código Pix
              </Button>
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Esperando a confirmação do pagamento…
          </p>
        </div>
      )}

      {mostrarCobranca && cobranca.metodo === "cartao" && (
        <div className="space-y-3 rounded-lg bg-muted p-4">
          <p className="text-sm text-foreground">
            O pagamento com cartão é feito numa página segura do{" "}
            {pedido.pagamento.gateway === "asaas" ? "Asaas" : "Mercado Pago"}.{" "}
            {pedido.pagamento.gateway === "asaas"
              ? "Depois de pagar, volte para este link do pedido."
              : "Depois de pagar, você volta para esta página."}
          </p>
          <Button asChild className={cn("w-full sm:w-auto", CLASSE_BOTAO_MARCA)}>
            <a href={cobranca.link} rel="noreferrer">
              <CreditCard className="size-4" />
              Pagar com cartão
            </a>
          </Button>
        </div>
      )}

      {!mostrarCobranca && (
        <div className="space-y-4">
          {pedeCpf && (
            <Campo
              rotulo="CPF de quem paga"
              htmlFor="cpf-pagador"
              dica="O sistema de pagamento pede o CPF para emitir a cobrança."
              erro={erroCpf ?? undefined}
            >
              <Input
                id="cpf-pagador"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(mascararCpf(e.target.value))}
                aria-invalid={erroCpf ? true : undefined}
              />
            </Campo>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className={CLASSE_BOTAO_MARCA}
              disabled={gerar.isPending}
              onClick={() => pagar("pix")}
            >
              {gerar.isPending && gerar.variables.metodo === "pix" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <QrCode className="size-4" />
              )}
              Pagar com Pix
            </Button>
            <Button variant="outline" disabled={gerar.isPending} onClick={() => pagar("cartao")}>
              {gerar.isPending && gerar.variables.metodo === "cartao" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CreditCard className="size-4" />
              )}
              Pagar com cartão
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {mostrarCobranca && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={conferindo}
              onClick={() => void jaPaguei()}
            >
              {conferindo && <Loader2 className="size-4 animate-spin" />}
              Já paguei
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEscolhendo(true)}>
              {cobranca.metodo === "pix" ? "Pagar com cartão" : "Pagar com Pix"}
            </Button>
          </>
        )}
        {escolhendo && cobranca && (
          <Button variant="ghost" size="sm" onClick={() => setEscolhendo(false)}>
            Voltar
          </Button>
        )}
        {whatsapp && (
          <Button asChild variant="ghost" size="sm">
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o pagamento do pedido: ${window.location.href}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-4" />
              Falar com o fotógrafo
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}

function Downloads({ pedido }: { pedido: PedidoPublico }) {
  const [baixando, setBaixando] = useState<string | null>(null);
  const [zip, setZip] = useState<{ feitas: number; total: number } | null>(null);
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

  async function baixarTodas() {
    try {
      await baixarZip(
        itens.map((i) => ({ caminho: i.original, nome: i.nome, tamanho: i.tamanho ?? 0 })),
        pedido.galeria.titulo,
        (feitas, total) => setZip({ feitas, total }),
      );
      toast.success("ZIP pronto. Confira a pasta de downloads.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível montar o ZIP.");
    } finally {
      setZip(null);
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
              {pedido.email_enviado
                ? ` Também enviamos este link para ${pedido.cliente_email}.`
                : ""}
            </p>
          </div>
        </div>
        {itens.length > 1 && (
          <Button
            className={CLASSE_BOTAO_MARCA}
            onClick={() => void baixarTodas()}
            disabled={zip !== null}
          >
            {zip ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {zip
              ? `Preparando ${zip.feitas} de ${zip.total}`
              : `Baixar todas em ZIP (${itens.length})`}
          </Button>
        )}
      </Card>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {itens.map((item) => (
          <li
            key={item.foto_id}
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            <Miniatura
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
