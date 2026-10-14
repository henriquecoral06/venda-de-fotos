import { useEffect, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { DotGrid } from "@/components/layout/DotGrid";

/**
 * Casca da área logada. `.ds-app` (densidade de aplicação do DS) fica na raiz,
 * cobrindo sidebar, header e conteúdo, e também no `body` enquanto o layout
 * está montado: Dialog, Sheet, Popover e Select abrem em portal fora da raiz.
 */
export function AppLayout({ email, children }: { email: string; children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add("ds-app");
    return () => document.body.classList.remove("ds-app");
  }, []);

  return (
    <SidebarProvider className="ds-app">
      <AppSidebar email={email} />
      {/* bg-transparent: o body já pinta o canvas — deixa a dotgrid aparecer */}
      <SidebarInset className="min-w-0 bg-transparent">
        <AppHeader />
        {/* O padding é de cada página */}
        <main className="flex-1">
          <DotGrid />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
