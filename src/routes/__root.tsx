import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportarErro } from "../lib/error-reporting";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/config/brand";

const TITULO = BRAND.name;
const DESCRICAO = BRAND.tagline;

// Telas públicas (entrada, nova senha, galeria e pedido do cliente) são sempre
// claras: o tema salvo só vale na área logada. Tela pública nova entra numa
// destas listas (caminho exato ou prefixo).
const ROTAS_SEMPRE_CLARAS = ["/", "/redefinir-senha", "/eventos"];
const PREFIXOS_SEMPRE_CLAROS = ["/g/", "/pedido/", "/l/"];

function ehSempreClara(pathname: string): boolean {
  return (
    ROTAS_SEMPRE_CLARAS.includes(pathname) ||
    PREFIXOS_SEMPRE_CLAROS.some((prefixo) => pathname.startsWith(prefixo))
  );
}

// Anti-FOUC: aplica a classe .dark antes do primeiro paint. A chave do
// localStorage DEVE casar com THEME_KEY do ThemeContext ("painel-tema").
// As `ROTAS_SEMPRE_CLARAS` pulam o tema salvo (mesma regra em `ThemeProvider`,
// via `forcarClaro`).
const THEME_BOOT_SCRIPT = `(function(){try{var p=location.pathname;if(${JSON.stringify(ROTAS_SEMPRE_CLARAS)}.indexOf(p)>=0||${JSON.stringify(PREFIXOS_SEMPRE_CLAROS)}.some(function(x){return p.indexOf(x)===0;})){document.documentElement.classList.remove("dark");return;}var t=localStorage.getItem("painel-tema")||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportarErro(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Tente de novo ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { name: "author", content: BRAND.company },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@300..800&family=Geist+Mono:wght@400..600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Ícone padrão: símbolo da marca em gradiente esmeralda
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", href: "/favicon-512.png", type: "image/png", sizes: "512x512" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [{ children: THEME_BOOT_SCRIPT }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: o script anti-FOUC muda a classe do <html>
    // antes da hidratação (tema dark) — divergência esperada e intencional
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* Definição global do gradiente da marca, usada por `fill-brand-gradient` */}
        <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
          <defs>
            <linearGradient id="brand-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "var(--brand-from)" }} />
              <stop offset="100%" style={{ stopColor: "var(--brand-to)" }} />
            </linearGradient>
          </defs>
        </svg>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // As telas públicas não acompanham o tema claro/escuro do usuário.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const forcarClaro = ehSempreClara(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider forcarClaro={forcarClaro}>
        {/* As rotas filhas renderizam aqui: sem o <Outlet /> nenhuma página aparece. */}
        <Outlet />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
