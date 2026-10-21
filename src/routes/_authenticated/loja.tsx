import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/Campo";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonFormulario } from "@/components/Skeletons";
import { usePerfil } from "@/features/perfil/api";
import { CartaoMarca } from "@/features/loja/CartaoMarca";
import {
  textoMarcaDagua,
  useConfiguracoesLoja,
  useSalvarLoja,
  type ConfiguracoesLoja,
  type DadosLoja,
} from "@/features/loja/api";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/loja")({
  head: () => ({ meta: [{ title: `Loja e pagamento | ${BRAND.name}` }] }),
  component: PaginaLoja,
});

function PaginaLoja() {
  const { data: ctx } = usePerfil();
  const config = useConfiguracoesLoja();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo="Loja e pagamento"
        descricao="O que o cliente vê na galeria e no pedido: a sua marca, o nome, a marca d'água e como pagar."
      />
      {config.isPending ? (
        <SkeletonFormulario campos={5} />
      ) : config.isError || !config.data ? (
        <EstadoVazio
          titulo="Não foi possível carregar a loja"
          descricao={config.error?.message ?? "Recarregue a página para recriar a configuração."}
          acao={
            <Button variant="outline" onClick={() => void config.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : (
        <FormularioLoja
          key={config.data.updated_at}
          config={config.data}
          podeEditar={ctx?.ehDono ?? false}
          nomeOrganizacao={ctx?.organizacao?.nome}
          organizacaoId={ctx?.organizacao?.id ?? null}
        />
      )}
    </div>
  );
}

function FormularioLoja({
  config,
  podeEditar,
  nomeOrganizacao,
  organizacaoId,
}: {
  config: ConfiguracoesLoja;
  podeEditar: boolean;
  nomeOrganizacao: string | undefined;
  organizacaoId: string | null;
}) {
  const salvar = useSalvarLoja();
  const [dados, setDados] = useState<DadosLoja>({
    nome_exibicao: config.nome_exibicao,
    texto_marca_dagua: config.texto_marca_dagua,
    marca_dagua_ativa: config.marca_dagua_ativa,
    chave_pix: config.chave_pix,
    instrucoes_pagamento: config.instrucoes_pagamento,
    whatsapp: config.whatsapp,
    logo_caminho: config.logo_caminho,
    logo_escuro_caminho: config.logo_escuro_caminho,
    cor_primaria: config.cor_primaria,
    cor_secundaria: config.cor_secundaria,
  });
  const campo = (chave: Exclude<keyof DadosLoja, "marca_dagua_ativa">) => ({
    value: dados[chave],
    disabled: !podeEditar || salvar.isPending,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDados((d) => ({ ...d, [chave]: e.target.value })),
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    salvar.mutate(
      {
        dados,
        logoAnterior: config.logo_caminho,
        logoEscuroAnterior: config.logo_escuro_caminho,
      },
      {
        onSuccess: () => toast.success("Dados da loja salvos."),
        onError: (erro: Error) => toast.error(erro.message),
      },
    );
  }

  const marcaAtual = textoMarcaDagua({ ...config, ...dados }, nomeOrganizacao);

  return (
    <form onSubmit={enviar} className="space-y-6">
      <CartaoMarca
        valores={dados}
        logoSalva={config.logo_caminho}
        logoEscuroSalva={config.logo_escuro_caminho}
        organizacaoId={organizacaoId}
        podeEditar={podeEditar}
        aoMudar={(parcial) => setDados((d) => ({ ...d, ...parcial }))}
      />

      <Card className="space-y-5 p-5">
        <h2 className="text-heading-sm">Identidade</h2>
        <Campo
          rotulo="Nome exibido ao cliente"
          htmlFor="nome-loja"
          dica={`Em branco, aparece o nome da organização${nomeOrganizacao ? ` (${nomeOrganizacao})` : ""}.`}
        >
          <Input id="nome-loja" maxLength={120} {...campo("nome_exibicao")} />
        </Campo>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <label htmlFor="marca-ativa-loja" className="text-label-md text-foreground">
              Marca d'água nas prévias
            </label>
            <p className="text-caption text-muted-foreground">
              Protege as fotos que o cliente ainda não comprou. Vale para as próximas fotos
              enviadas; as que já estão na galeria continuam como estão.
            </p>
          </div>
          <Switch
            id="marca-ativa-loja"
            checked={dados.marca_dagua_ativa}
            disabled={!podeEditar || salvar.isPending}
            onCheckedChange={(v) => setDados((d) => ({ ...d, marca_dagua_ativa: v }))}
          />
        </div>
        {dados.marca_dagua_ativa && (
          <Campo
            rotulo="Texto da marca d'água"
            htmlFor="marca-loja"
            dica={`Em branco, vale o nome exibido. Agora: “${marcaAtual ?? ""}”.`}
          >
            <Input id="marca-loja" maxLength={60} {...campo("texto_marca_dagua")} />
          </Campo>
        )}
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <h2 className="text-heading-sm">Pagamento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O cliente vê estes dados ao fechar o pedido. Depois de receber, confirme o pagamento em
            Pedidos para liberar o download.
          </p>
        </div>
        {!dados.chave_pix.trim() && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Sem chave Pix, o cliente faz o pedido mas não vê como pagar: ele recebe só o aviso de
            que você vai entrar em contato.
          </div>
        )}
        <Campo rotulo="Chave Pix" htmlFor="pix-loja">
          <Input id="pix-loja" maxLength={140} {...campo("chave_pix")} />
        </Campo>
        <Campo
          rotulo="WhatsApp para comprovantes"
          htmlFor="whatsapp-loja"
          dica="Com DDD. O cliente recebe um botão para mandar o comprovante."
        >
          <Input
            id="whatsapp-loja"
            inputMode="tel"
            maxLength={30}
            placeholder="(11) 91234-5678"
            {...campo("whatsapp")}
          />
        </Campo>
        <Campo rotulo="Instruções de pagamento" htmlFor="instrucoes-loja">
          <Textarea
            id="instrucoes-loja"
            rows={4}
            maxLength={2_000}
            placeholder="Ex.: Pix em nome de Ana Fotografia. Envie o comprovante pelo WhatsApp."
            {...campo("instrucoes_pagamento")}
          />
        </Campo>
      </Card>

      {podeEditar ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Só o dono da organização altera os dados da loja.
        </p>
      )}
    </form>
  );
}
