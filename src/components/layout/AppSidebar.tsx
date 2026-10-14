import { useMemo } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { LogoSimbolo } from "@/components/ui/logo-simbolo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { rotuloUsuario, usePerfil } from "@/features/perfil/api";
import { hrefAtivoSidebar, montarGruposNav } from "@/lib/navegacao";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

/* Item de nav do DS: pílula, ativo = primary diluído + dot gradiente */
const navItemClass = (ativo: boolean) =>
  cn(
    "flex h-9 w-full items-center gap-3 rounded-full px-3 py-2 text-[13px] font-medium transition-colors duration-150 [&>svg]:size-[18px]",
    ativo
      ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
  );

function DotAtivo() {
  return (
    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-brand-from to-brand-to group-data-[collapsible=icon]:hidden" />
  );
}

export function AppSidebar({ email }: { email: string }) {
  const navigate = useNavigate();
  const { data: ctx } = usePerfil();
  const grupos = useMemo(() => montarGruposNav(), []);
  const { setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ativo = hrefAtivoSidebar(pathname);
  const iniciais = (ctx?.perfil?.nome || email || "?").slice(0, 2).toUpperCase();
  const fechar = () => setOpenMobile(false);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarHeader className="p-4">
        <Link to="/dashboard" aria-label={`${BRAND.name} — início`} onClick={fechar}>
          <div className="flex items-center gap-2">
            <LogoSimbolo className="size-8 shrink-0" title="" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-base font-semibold leading-tight tracking-tight">
                {BRAND.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {ctx?.organizacao?.nome ?? BRAND.company}
              </p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 pb-4">
        {grupos.map((grupo) => (
          <SidebarGroup key={grupo.titulo ?? "inicio"} className="p-0">
            {grupo.titulo && (
              <SidebarGroupLabel className="px-3 text-[11px] font-medium uppercase tracking-label text-muted-foreground group-data-[collapsible=icon]:hidden">
                {grupo.titulo}
              </SidebarGroupLabel>
            )}
            <SidebarMenu className="space-y-0.5">
              {grupo.itens.map((item) => {
                const selecionado = ativo === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.rotulo}
                      className={navItemClass(selecionado)}
                    >
                      <Link to={item.href} onClick={fechar}>
                        <item.icone strokeWidth={selecionado ? 2 : 1.5} />
                        <span className="truncate">{item.rotulo}</span>
                        {selecionado && <DotAtivo />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {iniciais}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-mono text-[10px] text-muted-foreground">{email}</p>
            <p className="truncate text-[11px] text-foreground">{rotuloUsuario(ctx)}</p>
          </div>
          <button
            type="button"
            onClick={() => void sair()}
            title="Sair"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4" strokeWidth={1.5} />
            <span className="sr-only">Sair</span>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
