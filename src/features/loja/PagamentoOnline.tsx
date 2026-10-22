import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/Campo";
import { ControleSegmentado } from "@/components/ControleSegmentado";
import { EstadoVazio } from "@/components/PageHeader";
import { SkeletonFormulario } from "@/components/Skeletons";
import {
  useConfigurarEmail,
  useConfigurarPagamento,
  useDiagnosticoPagamento,
  ehEmailGratuito,
  useEmailTeste,
  type DiagnosticoPagamento,
  type Gateway,
} from "./api";

const OPCOES_GATEWAY = [
  { valor: "manual", rotulo: "Pix manual" },
  { valor: "asaas", rotulo: "Asaas" },
  { valor: "mercadopago", rotulo: "Mercado Pago" },
] as const;

const AJUDA_CHAVE: Record<Exclude<Gateway, "manual">, { rotulo: string; dica: string }> = {
  asaas: {
    rotulo: "Chave de API do Asaas",
    dica: "No Asaas: Integrações → Chaves de API. Uma chave de sandbox ($aact_hmlg_…) gera cobranças de teste.",
  },
  mercadopago: {
    rotulo: "Access token do Mercado Pago",
    dica: "No Mercado Pago: Suas integrações → Credenciais de produção → Access token. Um token TEST-… gera cobranças de teste.",
  },
};

/**
 * Pagamento online e e-mail automático. As chaves vão direto para o banco por
 * funções que nunca as devolvem; a tela só sabe se há chave gravada.
 */
export function PagamentoOnline() {
  const diagnostico = useDiagnosticoPagamento(true);

  if (diagnostico.isPending) return <SkeletonFormulario campos={3} />;
  if (diagnostico.isError) {
    return (
      <Card className="p-5">
        <EstadoVazio
          titulo="Não foi possível carregar o pagamento online"
          descricao={diagnostico.error.message}
          acao={
            <Button variant="outline" onClick={() => void diagnostico.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      </Card>
    );
  }
  return (
    <>
      <CartaoGateway diagnostico={diagnostico.data} />
      <CartaoEmail diagnostico={diagnostico.data} />
    </>
  );
}

function CartaoGateway({ diagnostico: d }: { diagnostico: DiagnosticoPagamento }) {
  const configurar = useConfigurarPagamento();
  const [gateway, setGateway] = useState<Gateway>(d.gateway);
  const [chave, setChave] = useState("");
  const [url, setUrl] = useState(d.url_publica || window.location.origin);
  const online = gateway !== "manual";
  const temChave =
    gateway === "asaas"
      ? d.asaas_configurado
      : gateway === "mercadopago"
        ? d.mercadopago_configurado
        : false;
  const ativo = d.gateway === gateway && online;

  function salvar(e?: React.FormEvent) {
    e?.preventDefault();
    configurar.mutate(
      { gateway, chave: chave.trim() ? chave.trim() : null, urlPublica: url },
      {
        onSuccess: (r) => {
          setChave("");
          toast.success(
            r.gateway === "manual"
              ? "Pagamento online desligado. O cliente volta a ver a chave Pix."
              : "Pagamento online ativo.",
          );
        },
        onError: (erro: Error) => toast.error(erro.message),
      },
    );
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="text-heading-sm">Pagamento online</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Com um gateway, o cliente paga por Pix ou cartão na página do pedido e o download é
          liberado sozinho assim que o pagamento cai. O dinheiro vai direto para a sua conta no
          gateway.
        </p>
      </div>

      <form onSubmit={salvar} className="space-y-5">
        <ControleSegmentado
          opcoes={OPCOES_GATEWAY}
          valor={gateway}
          aoMudar={(v) => {
            setGateway(v);
            setChave("");
          }}
          rotuloAria="Como você recebe"
        />

        {!online ? (
          <p className="text-sm text-muted-foreground">
            O cliente vê a chave Pix e as instruções de pagamento acima, e você confirma cada
            pagamento em Pedidos.
          </p>
        ) : (
          <>
            <Campo
              rotulo={AJUDA_CHAVE[gateway].rotulo}
              htmlFor="chave-gateway"
              dica={
                temChave
                  ? "Há uma chave gravada. Deixe em branco para manter ou cole outra para trocar."
                  : AJUDA_CHAVE[gateway].dica
              }
            >
              <Input
                id="chave-gateway"
                type="password"
                autoComplete="off"
                maxLength={500}
                placeholder={temChave ? "••••••••••••" : "Cole a chave aqui"}
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                disabled={configurar.isPending}
              />
            </Campo>
            <Campo
              rotulo="Endereço do site"
              htmlFor="url-publica"
              dica="O gateway avisa os pagamentos por este endereço, e o e-mail das fotos aponta para ele. Use o domínio publicado, com https."
            >
              <Input
                id="url-publica"
                inputMode="url"
                maxLength={200}
                placeholder="https://fotos.seusite.com.br"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={configurar.isPending}
              />
            </Campo>
            {ativo && (
              <EstadoGateway d={d} aoRegravar={() => salvar()} regravando={configurar.isPending} />
            )}
          </>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={configurar.isPending || (online && !temChave && !chave.trim())}
          >
            {configurar.isPending && <Loader2 className="size-4 animate-spin" />}
            {online ? "Salvar e conectar" : "Salvar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** O que o banco leu agora no gateway: conta, ambiente e o webhook. */
function EstadoGateway({
  d,
  aoRegravar,
  regravando,
}: {
  d: DiagnosticoPagamento;
  aoRegravar: () => void;
  regravando: boolean;
}) {
  const teste =
    (d.gateway === "asaas" && d.asaas_sandbox) ||
    (d.gateway === "mercadopago" && d.mercadopago_teste);

  if (d.erro) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-destructive-soft p-3 text-sm text-danger">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {d.erro}
      </div>
    );
  }

  const webhookOk = d.webhook ? d.webhook.existe && d.webhook.ativo && d.webhook.eventos_ok : true;
  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        <span className="text-foreground">Conectado{d.conta ? ` à conta ${d.conta}` : ""}</span>
        {teste && <Badge variant="warning">Ambiente de teste</Badge>}
      </div>
      {d.webhook &&
        (webhookOk ? (
          <p className="text-muted-foreground">Webhook do Asaas ativo em {d.webhook.url}.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning-soft p-2 text-warning">
            <span>
              {d.webhook.existe
                ? "O webhook do Asaas está pausado ou sem os eventos de pagamento."
                : "O webhook do Asaas não foi encontrado para este endereço."}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={regravando}
              onClick={aoRegravar}
            >
              <RefreshCw className="size-4" />
              Regravar webhook
            </Button>
          </div>
        ))}
      {d.gateway === "mercadopago" && !d.url_publica.startsWith("https://") && (
        <p className="text-warning">
          O Mercado Pago só avisa endereços com https. Sem ele, a página do pedido confere o
          pagamento sozinha enquanto o cliente está nela.
        </p>
      )}
    </div>
  );
}

function CartaoEmail({ diagnostico: d }: { diagnostico: DiagnosticoPagamento }) {
  const configurar = useConfigurarEmail();
  const teste = useEmailTeste();
  const [chave, setChave] = useState("");
  const [remetente, setRemetente] = useState(d.email_remetente);
  // Sem gateway, o endereço do site só é pedido aqui (o link do e-mail usa ele).
  const pedeUrl = !d.url_publica;
  const [url, setUrl] = useState(d.url_publica || window.location.origin);

  const gratuito = ehEmailGratuito(remetente);
  const ativo = d.email_configurado && d.email_testado;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (gratuito) {
      document.getElementById("remetente")?.focus();
      return;
    }
    configurar.mutate(
      { chave: chave.trim() ? chave.trim() : null, remetente, urlPublica: pedeUrl ? url : null },
      {
        onSuccess: (r) => {
          setChave("");
          toast.success(
            !r.email_configurado
              ? "E-mail automático salvo, mas incompleto."
              : r.email_testado
                ? "E-mail automático salvo."
                : "Salvo. Agora envie o e-mail de teste para ligar o envio.",
          );
        },
        onError: (erro: Error) => toast.error(erro.message),
      },
    );
  }

  function testar() {
    teste.mutate(undefined, {
      onSuccess: (para) =>
        toast.success(`E-mail de teste enviado para ${para}. O envio automático está ligado.`),
      onError: (erro: Error) => toast.error(erro.message),
    });
  }

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-heading-sm">E-mail automático</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando um pedido fica pago (pelo gateway ou confirmado por você em Pedidos), o comprador
            recebe o link das fotos por e-mail. O envio usa o Resend: crie a conta, verifique o seu
            domínio e gere uma chave de API.
          </p>
        </div>
        <Badge variant={ativo ? "success" : d.email_configurado ? "warning" : "secondary"}>
          {ativo ? "Ativo" : d.email_configurado ? "Falta testar" : "Desligado"}
        </Badge>
      </div>

      {d.email_configurado && !d.email_testado && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Envie o e-mail de teste. O envio para os compradores só liga depois que o Resend aceitar o
          teste.
        </div>
      )}

      <form onSubmit={salvar} className="space-y-5">
        <Campo
          rotulo="Chave de API do Resend"
          htmlFor="chave-resend"
          dica={
            d.email_configurado || chave
              ? "Deixe em branco para manter a chave gravada."
              : "No Resend: API Keys → Create API Key (permissão de envio basta)."
          }
        >
          <Input
            id="chave-resend"
            type="password"
            autoComplete="off"
            maxLength={500}
            placeholder={d.email_configurado ? "••••••••••••" : "re_…"}
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            disabled={configurar.isPending}
          />
        </Campo>
        <Campo
          rotulo="E-mail de envio"
          htmlFor="remetente"
          dica="Precisa ser de um domínio seu, verificado no Resend. O nome exibido é o da loja."
          erro={
            gratuito
              ? "Gmail, Hotmail e afins não podem ser remetente. Use um e-mail do seu domínio, como fotos@seudominio.com.br."
              : undefined
          }
        >
          <Input
            id="remetente"
            type="email"
            maxLength={200}
            placeholder="fotos@seudominio.com.br"
            value={remetente}
            onChange={(e) => setRemetente(e.target.value)}
            disabled={configurar.isPending}
            aria-invalid={gratuito ? true : undefined}
          />
        </Campo>
        {pedeUrl && (
          <Campo
            rotulo="Endereço do site"
            htmlFor="url-email"
            dica="O botão do e-mail leva para a página do pedido neste endereço."
          >
            <Input
              id="url-email"
              inputMode="url"
              maxLength={200}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={configurar.isPending}
            />
          </Campo>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {d.email_configurado && (
            <Button type="button" variant="outline" disabled={teste.isPending} onClick={testar}>
              {teste.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Enviar e-mail de teste
            </Button>
          )}
          <Button type="submit" disabled={configurar.isPending}>
            {configurar.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  );
}
