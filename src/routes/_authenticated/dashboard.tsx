import { useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleCheck, Clock, ImageUp, KeyRound, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { Miniatura } from "@/components/Miniatura";
import { SkeletonTabela } from "@/components/Skeletons";
import { primeiroNome, usePerfil } from "@/features/perfil/api";
import { useConfiguracoesLoja } from "@/features/loja/api";
import {
  useGalerias,
  ROTULO_STATUS_GALERIA,
  type GaleriaComContagem,
} from "@/features/galerias/api";
import { FormularioGaleria } from "@/features/galerias/FormularioGaleria";
import { VARIANTE_STATUS_GALERIA } from "@/features/galerias/TabelaGalerias";
import { useMetricasVendas, usePedidos } from "@/features/pedidos/api";
import { DetalhePedido } from "@/features/pedidos/DetalhePedido";
import { TabelaPedidos } from "@/features/pedidos/TabelaPedidos";
import { brl } from "@/lib/format";
import { rotuloFotos, urlPrevia } from "@/lib/fotos";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: `Início | ${BRAND.name}` }] }),
  component: PaginaDashboard,
});

const contar = (l: { count: number }[]) => l[0]?.count ?? 0;
const capaDa = (g: GaleriaComContagem) =>
  g.capa?.caminho_miniatura ?? g.primeira[0]?.caminho_miniatura ?? null;

function PaginaDashboard() {
  const navigate = useNavigate();
  const { data: ctx } = usePerfil();
  const metricas = useMetricasVendas();
  const pedidos = usePedidos();
  const galerias = useGalerias();
  const loja = useConfiguracoesLoja();
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [criando, setCriando] = useState<number | null>(null);

  const nome = primeiroNome(ctx?.perfil?.nome);
  const aguardando = (pedidos.data ?? []).filter((p) => p.status === "aguardando_pagamento");
  const aberto = pedidos.data?.find((p) => p.id === abertoId) ?? null;
  const ativas = (galerias.data ?? []).filter((g) => g.status !== "arquivada");
  const prontas = ativas.filter((g) => g.status === "rascunho" && contar(g.fotos) > 0);
  const semFotos = ativas.filter((g) => g.status === "rascunho" && contar(g.fotos) === 0);
  const semPix = ctx?.ehDono === true && loja.data != null && loja.data.chave_pix.trim() === "";
  const carregando = pedidos.isPending || galerias.isPending;

  const tarefas: ReactNode[] = [];
  if (aguardando.length > 0) {
    const total = aguardando.reduce((t, p) => t + Number(p.valor_total), 0);
    tarefas.push(
      <Tarefa
        key="pagamentos"
        icone={<Clock className="size-4 text-warning" aria-hidden="true" />}
        titulo={`${aguardando.length === 1 ? "1 pedido espera" : `${aguardando.length} pedidos esperam`} a confirmação do pagamento`}
        detalhe={`${brl(total)} no total. Confira o Pix e confirme para liberar os downloads.`}
        acao={
          <Button asChild size="sm">
            <Link to="/pedidos">Conferir pedidos</Link>
          </Button>
        }
      />,
    );
  }
  for (const g of prontas.slice(0, 3)) {
    tarefas.push(
      <Tarefa
        key={`publicar-${g.id}`}
        icone={<Send className="size-4 text-info" aria-hidden="true" />}
        titulo={`“${g.titulo}” está pronta para publicar`}
        detalhe={`${rotuloFotos(contar(g.fotos))} enviadas. Em rascunho, o cliente ainda não abre o link.`}
        acao={
          <Button asChild size="sm" variant="outline">
            <Link to="/galerias/$id" params={{ id: g.id }}>
              Abrir galeria
            </Link>
          </Button>
        }
      />,
    );
  }
  for (const g of semFotos.slice(0, 2)) {
    tarefas.push(
      <Tarefa
        key={`enviar-${g.id}`}
        icone={<ImageUp className="size-4 text-muted-foreground" aria-hidden="true" />}
        titulo={`“${g.titulo}” ainda não tem fotos`}
        detalhe="Envie as fotos e publique para mandar o link ao cliente."
        acao={
          <Button asChild size="sm" variant="outline">
            <Link to="/galerias/$id" params={{ id: g.id }}>
              Enviar fotos
            </Link>
          </Button>
        }
      />,
    );
  }
  if (semPix) {
    tarefas.push(
      <Tarefa
        key="pix"
        icone={<KeyRound className="size-4 text-danger" aria-hidden="true" />}
        titulo="Cadastre a sua chave Pix"
        detalhe="Sem ela, o cliente faz o pedido e não vê como pagar."
        acao={
          <Button asChild size="sm" variant="outline">
            <Link to="/loja">Configurar pagamento</Link>
          </Button>
        }
      />,
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <PageHeader
        titulo={nome ? `Olá, ${nome}` : "Início"}
        descricao={
          ctx?.organizacao
            ? "O que precisa de você hoje e como estão as vendas."
            : "Você não faz parte da organização no momento: aqui aparece só o que é seu."
        }
        acoes={
          <Button onClick={() => setCriando(Date.now())}>
            <Plus className="size-4" />
            Nova galeria
          </Button>
        }
      />

      <section className="space-y-3" aria-labelledby="titulo-tarefas">
        <h2 id="titulo-tarefas" className="text-heading-sm">
          Para fazer agora
        </h2>
        {carregando ? (
          <Skeleton className="h-28 w-full" />
        ) : tarefas.length === 0 ? (
          <Card className="flex items-center gap-3 p-4">
            <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
            <p className="text-sm text-foreground">
              Tudo em dia. Nenhum pagamento para conferir e nenhuma galeria parada.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border p-0">{tarefas}</Card>
        )}
      </section>

      <section aria-label="Números das vendas">
        {metricas.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : metricas.isError ? (
          <EstadoVazio
            titulo="Não foi possível carregar os números"
            descricao={metricas.error.message}
            acao={
              <Button variant="outline" onClick={() => void metricas.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            {/* Divisórias de 1 px: o fundo da grade aparece no espaço entre as células. */}
            <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
              <Numero rotulo="Vendido" valor={brl(metricas.data.faturado)} />
              <Numero rotulo="A receber" valor={brl(metricas.data.valorAguardando)} />
              <Numero rotulo="Galerias publicadas" valor={metricas.data.galeriasPublicadas} />
              <Numero rotulo="Fotos enviadas" valor={metricas.data.fotos.toLocaleString("pt-BR")} />
            </div>
          </Card>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="titulo-galerias">
        <div className="flex items-end justify-between gap-3">
          <h2 id="titulo-galerias" className="text-heading-sm">
            Galerias recentes
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/galerias">Ver todas</Link>
          </Button>
        </div>
        {galerias.isPending ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3]" />
            ))}
          </div>
        ) : galerias.isError ? (
          <EstadoVazio
            titulo="Não foi possível carregar as galerias"
            descricao={galerias.error.message}
          />
        ) : ativas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma galeria ainda"
            descricao="Crie a primeira, envie as fotos e mande o link para o cliente escolher e comprar."
            acao={
              <Button onClick={() => setCriando(Date.now())}>
                <Plus className="size-4" />
                Nova galeria
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {ativas.slice(0, 4).map((g) => {
              const capa = capaDa(g);
              return (
                <li key={g.id}>
                  <Link
                    to="/galerias/$id"
                    params={{ id: g.id }}
                    className="group block space-y-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
                      {capa ? (
                        <Miniatura
                          src={urlPrevia(capa)}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition-opacity group-hover:opacity-90"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-caption text-muted-foreground">
                          Sem fotos
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-label-md text-foreground group-hover:underline">
                        {g.titulo}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                        <Badge variant={VARIANTE_STATUS_GALERIA[g.status]}>
                          {ROTULO_STATUS_GALERIA[g.status]}
                        </Badge>
                        <span>{rotuloFotos(contar(g.fotos))}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="titulo-pedidos">
        <div className="flex items-end justify-between gap-3">
          <h2 id="titulo-pedidos" className="text-heading-sm">
            Pedidos recentes
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/pedidos">Ver todos</Link>
          </Button>
        </div>
        {pedidos.isPending ? (
          <SkeletonTabela linhas={3} colunas={4} />
        ) : pedidos.isError ? (
          <EstadoVazio
            titulo="Não foi possível carregar os pedidos"
            descricao={pedidos.error.message}
          />
        ) : (pedidos.data ?? []).length === 0 ? (
          <EstadoVazio
            titulo="Nenhum pedido ainda"
            descricao="Quando um cliente escolher fotos numa galeria publicada, o pedido aparece aqui."
          />
        ) : (
          <TabelaPedidos
            pedidos={(pedidos.data ?? []).slice(0, 5)}
            aoAbrir={(p) => setAbertoId(p.id)}
            compacta
          />
        )}
      </section>

      <DetalhePedido pedido={aberto} aoFechar={() => setAbertoId(null)} />

      {criando !== null && (
        <FormularioGaleria
          key={criando}
          aberto
          aoMudarAberto={(v) => !v && setCriando(null)}
          galeria={null}
          autoria={{ userId: ctx?.perfil?.id ?? "", organizacaoId: ctx?.organizacao?.id ?? null }}
          aoCriar={(g) => void navigate({ to: "/galerias/$id", params: { id: g.id } })}
        />
      )}
    </div>
  );
}

function Tarefa({
  icone,
  titulo,
  detalhe,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  detalhe: string;
  acao: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0">{icone}</span>
        <div className="min-w-0">
          <p className="text-label-md text-foreground">{titulo}</p>
          <p className="text-caption text-muted-foreground">{detalhe}</p>
        </div>
      </div>
      <div className="shrink-0 pl-7 sm:pl-0">{acao}</div>
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="space-y-1 bg-card p-4 md:p-5">
      <p className="text-caption text-muted-foreground">{rotulo}</p>
      <p className="text-heading-md tabular-nums text-foreground">{valor}</p>
    </div>
  );
}
