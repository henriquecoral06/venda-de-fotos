import { Fragment } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { isEffectiveDark, useTheme } from "@/contexts/ThemeContext";
import { montarTrilha } from "@/lib/navegacao";
import { BRAND } from "@/config/brand";

function AlternarTema() {
  const { theme, setTheme } = useTheme();
  const escuro = isEffectiveDark(theme);
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={() => setTheme(escuro ? "light" : "dark")}
    >
      {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const trilha = montarTrilha(pathname);
  const titulo = trilha[trilha.length - 1]?.rotulo ?? BRAND.name;

  return (
    <header
      className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-sm sm:gap-4 sm:px-4"
      role="banner"
    >
      <SidebarTrigger className="-ml-1" aria-label="Alternar sidebar" />
      <Separator orientation="vertical" className="h-5" />

      {/* Trilha (desktop) / título (mobile) */}
      <Breadcrumb className="hidden min-w-0 flex-1 sm:flex">
        <BreadcrumbList>
          {trilha.map((item, i) => (
            <Fragment key={`${item.rotulo}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {item.href ? (
                  <Link to={item.href} className="transition-colors hover:text-foreground">
                    {item.rotulo}
                  </Link>
                ) : i === trilha.length - 1 ? (
                  <BreadcrumbPage>{item.rotulo}</BreadcrumbPage>
                ) : (
                  item.rotulo
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <span className="flex-1 truncate text-sm font-medium sm:hidden">{titulo}</span>

      <AlternarTema />
    </header>
  );
}
