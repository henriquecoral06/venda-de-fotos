import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { Campo } from "@/components/Campo";
import { SkeletonTabela } from "@/components/Skeletons";
import { usePerfil, type Organizacao } from "@/features/perfil/api";
import {
  useContasFora,
  useDefinirCadastro,
  useMembros,
  useReadmitirMembro,
  useRemoverMembro,
  useSalvarOrganizacao,
} from "@/features/equipe/api";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({ meta: [{ title: `Equipe | ${BRAND.name}` }] }),
  component: PaginaEquipe,
});

/**
 * 1 instalação = 1 organização: toda conta criada entra nela sozinha enquanto
 * o cadastro estiver aberto (trigger `handle_new_user`). O dono edita o nome,
 * abre/fecha o cadastro, remove e readmite membros. Sem vínculo = removido.
 */
function PaginaEquipe() {
  const { data: ctx } = usePerfil();
  return ctx?.organizacao ? (
    <ComOrganizacao organizacao={ctx.organizacao} />
  ) : (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader titulo="Equipe" />
      <EstadoVazio
        titulo="Você não faz parte da organização"
        descricao="O dono removeu o seu acesso aos dados compartilhados. Peça a ele para readmitir você em Equipe. Os seus próprios registros continuam disponíveis."
      />
    </div>
  );
}

function ComOrganizacao({ organizacao }: { organizacao: Organizacao }) {
  const { data: ctx } = usePerfil();
  const ehDono = ctx?.ehDono ?? false;
  const meuId = ctx?.perfil?.id ?? "";
  const membros = useMembros(organizacao.id);
  const remover = useRemoverMembro();

  function removerMembro(userId: string) {
    remover.mutate(userId, {
      onSuccess: () => toast.success("Membro removido da organização."),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  const lista = membros.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo="Equipe"
        descricao="Toda conta criada nesta instalação entra na organização enquanto o cadastro estiver aberto."
      />

      <CartaoOrganizacao
        key={`${organizacao.id}:${organizacao.nome}`}
        organizacao={organizacao}
        editavel={ehDono}
      />

      <CartaoCadastro organizacao={organizacao} editavel={ehDono} />

      <section className="space-y-3">
        <span className="text-eyebrow uppercase text-muted-foreground">
          {membros.isPending ? "Membros" : `Membros (${lista.length})`}
        </span>
        {membros.isPending ? (
          <SkeletonTabela linhas={3} colunas={3} />
        ) : membros.isError ? (
          <EstadoVazio
            titulo="Não foi possível carregar os membros"
            descricao={membros.error.message}
          />
        ) : (
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell className="font-medium">
                      {m.nome}
                      {m.userId === meuId && <span className="text-muted-foreground"> (você)</span>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {m.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.dono ? "default" : "secondary"}>
                        {m.dono ? "Dono" : "Membro"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {ehDono && m.userId !== meuId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={remover.isPending}
                          onClick={() => removerMembro(m.userId)}
                        >
                          Remover
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      {ehDono && <ContasFora />}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Dados da organização: o dono edita o nome; o membro só vê.
   ────────────────────────────────────────────────────────────────────────── */

function CartaoOrganizacao({
  organizacao,
  editavel,
}: {
  organizacao: Organizacao;
  editavel: boolean;
}) {
  const [nome, setNome] = useState(organizacao.nome);
  const salvar = useSalvarOrganizacao(organizacao);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="space-y-1">
        <h2 className="text-heading-sm text-foreground">Organização</h2>
        <p className="text-body-sm text-muted-foreground">
          {editavel
            ? "O nome aparece no menu e no painel de todos os membros."
            : "Só o dono da organização altera estes dados."}
        </p>
      </div>

      {editavel ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate(nome, {
              onSuccess: () => toast.success("Nome da organização salvo."),
              onError: (erro: Error) => toast.error(erro.message),
            });
          }}
        >
          <div className="flex-1">
            <Campo rotulo="Nome da organização" htmlFor="nome-organizacao">
              <Input
                id="nome-organizacao"
                required
                minLength={2}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Campo>
          </div>
          <Button type="submit" disabled={salvar.isPending || nome.trim() === organizacao.nome}>
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      ) : (
        <dl className="space-y-1">
          <dt className="text-label-md text-muted-foreground">Nome da organização</dt>
          <dd className="text-body-md text-foreground">{organizacao.nome}</dd>
        </dl>
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Cadastro aberto/fechado: fechado, o banco recusa contas novas.
   ────────────────────────────────────────────────────────────────────────── */

function CartaoCadastro({
  organizacao,
  editavel,
}: {
  organizacao: Organizacao;
  editavel: boolean;
}) {
  const definir = useDefinirCadastro();
  const aberto = organizacao.cadastro_aberto;

  function alternar(valor: boolean) {
    definir.mutate(valor, {
      onSuccess: () =>
        toast.success(valor ? "Cadastro liberado." : "Cadastro fechado para contas novas."),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <Card className="flex flex-row items-start justify-between gap-4 p-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-heading-sm text-foreground">Cadastro de contas novas</h2>
          <Badge variant={aberto ? "success" : "warning"}>{aberto ? "Aberto" : "Fechado"}</Badge>
        </div>
        <p className="text-body-sm text-muted-foreground">
          {aberto
            ? "Quem se cadastrar na tela de entrada entra na organização como membro."
            : "A tela de entrada recusa cadastros novos. Quem já tem conta continua entrando."}
        </p>
      </div>
      {editavel && (
        <Switch
          aria-label="Cadastro aberto"
          checked={aberto}
          disabled={definir.isPending}
          onCheckedChange={alternar}
        />
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Contas fora da organização (removidas pelo dono): readmitir.
   ────────────────────────────────────────────────────────────────────────── */

function ContasFora() {
  const contas = useContasFora(true);
  const readmitir = useReadmitirMembro();

  const lista = contas.data ?? [];
  if (lista.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <span className="text-eyebrow uppercase text-muted-foreground">
          {`Contas fora da organização (${lista.length})`}
        </span>
        <p className="text-body-sm text-muted-foreground">
          Contas desta instalação que foram removidas. Elas continuam entrando no app, mas só
          enxergam o que é delas até serem readmitidas.
        </p>
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">E-mail</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((c) => (
              <TableRow key={c.user_id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {c.email}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={readmitir.isPending}
                    onClick={() =>
                      readmitir.mutate(c.user_id, {
                        onSuccess: () => toast.success("Conta readmitida na organização."),
                        onError: (e: Error) => toast.error(e.message),
                      })
                    }
                  >
                    Readmitir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
