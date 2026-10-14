import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/Campo";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonFormulario } from "@/components/Skeletons";
import { usePerfil } from "@/features/perfil/api";
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
        descricao="O que o cliente vê na galeria e no pedido: o seu nome, a marca d'água e como pagar."
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
        />
      )}
    </div>
  );
}

function FormularioLoja({
  config,
  podeEditar,
  nomeOrganizacao,
}: {
  config: ConfiguracoesLoja;
  podeEditar: boolean;
  nomeOrganizacao: string | undefined;
}) {
  const salvar = useSalvarLoja();
  const [dados, setDados] = useState<DadosLoja>({
    nome_exibicao: config.nome_exibicao,
    texto_marca_dagua: config.texto_marca_dagua,
    chave_pix: config.chave_pix,
    instrucoes_pagamento: config.instrucoes_pagamento,
    whatsapp: config.whatsapp,
  });
  const campo = (chave: keyof DadosLoja) => ({
    value: dados[chave],
    disabled: !podeEditar || salvar.isPending,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDados((d) => ({ ...d, [chave]: e.target.value })),
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    salvar.mutate(dados, {
      onSuccess: () => toast.success("Dados da loja salvos."),
      onError: (erro: Error) => toast.error(erro.message),
    });
  }

  const marcaAtual = textoMarcaDagua({ ...config, ...dados }, nomeOrganizacao);

  return (
    <form onSubmit={enviar} className="space-y-6">
      <Card className="space-y-5 p-5">
        <h2 className="text-heading-sm">Identidade</h2>
        <Campo
          rotulo="Nome exibido ao cliente"
          htmlFor="nome-loja"
          dica={`Em branco, aparece o nome da organização${nomeOrganizacao ? ` (${nomeOrganizacao})` : ""}.`}
        >
          <Input id="nome-loja" maxLength={120} {...campo("nome_exibicao")} />
        </Campo>
        <Campo
          rotulo="Texto da marca d'água"
          htmlFor="marca-loja"
          dica={`Vale para as próximas fotos enviadas. Agora: “${marcaAtual}”.`}
        >
          <Input id="marca-loja" maxLength={60} {...campo("texto_marca_dagua")} />
        </Campo>
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <h2 className="text-heading-sm">Pagamento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O cliente vê estes dados ao fechar o pedido. Depois de receber, confirme o pagamento em
            Pedidos para liberar o download.
          </p>
        </div>
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
