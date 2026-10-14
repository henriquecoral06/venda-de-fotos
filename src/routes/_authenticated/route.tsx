import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { EstadoVazio } from "@/components/PageHeader";
import { SkeletonPagina } from "@/components/Skeletons";
import { CHAVE_PERFIL, usePerfil } from "@/features/perfil/api";
import { garantirInstalacao } from "@/lib/instalacao";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Roda a cada navegação dentro da área logada, então precisa ser barato:
  // getSession lê a sessão persistida (sem ir ao servidor, salvo token vencido).
  // O RLS do banco continua sendo a barreira real; aqui é só o redirecionamento.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  // O layout (sidebar + header) nunca é trocado por esqueleto durante a
  // navegação entre páginas internas; o esqueleto aparece só no Outlet.
  pendingMs: 1000,
  pendingMinMs: 0,
  component: LayoutAutenticado,
});

function LayoutAutenticado() {
  const { user } = Route.useRouteContext();
  return (
    <AppLayout email={user.email ?? ""}>
      <GarantirPerfil>
        <Outlet />
      </GarantirPerfil>
    </AppLayout>
  );
}

/**
 * O perfil existe sempre: o trigger `handle_new_user` cria um por conta. Se
 * mesmo assim não vier, mostra o erro em vez de ficar em laço de carregamento.
 *
 * Aqui também rodam os reparos, uma vez por carregamento da área logada:
 * 1. `garantir_instalacao`, só quando a conta chega sem perfil ou sem
 *    organização (banco copiado sem o trigger de cadastro): recria o trigger,
 *    cria perfil e vínculo das contas que nasceram sem ele e refaz os privilégios;
 * 2. `garantir_organizacao`: cria a organização quando ainda não existe
 *    nenhuma. Quem foi removido pelo dono continua fora: nenhum dos dois readmite.
 */
function GarantirPerfil({ children }: { children: ReactNode }) {
  const { data, isPending, isError, error } = usePerfil();
  const qc = useQueryClient();
  const [reparando, setReparando] = useState(true);
  const reparoIniciado = useRef(false);

  useEffect(() => {
    if (isPending || reparoIniciado.current) return;
    reparoIniciado.current = true;
    const semPerfilOuOrganizacao = isError || !data?.perfil || !data.membro;

    async function reparar() {
      let mudou = false;
      try {
        if (semPerfilOuOrganizacao) mudou = await garantirInstalacao();
        const { data: passouATerVinculo, error: erro } = await supabase.rpc("garantir_organizacao");
        if (erro) throw new Error(erro.message);
        mudou ||= passouATerVinculo === true;
      } catch (e: unknown) {
        const motivo = e instanceof Error ? e.message : "erro desconhecido";
        toast.error(`Não foi possível verificar a organização: ${motivo}`);
      } finally {
        if (mudou) await qc.invalidateQueries({ queryKey: CHAVE_PERFIL });
        setReparando(false);
      }
    }
    void reparar();
  }, [isPending, isError, data, qc]);

  if (isPending || reparando) return <SkeletonPagina />;

  if (isError || !data.perfil) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <EstadoVazio
          titulo="Não foi possível carregar o seu perfil"
          descricao={
            error instanceof Error
              ? error.message
              : "Recarregue a página. Se continuar assim, saia e entre de novo."
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
