import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { SkeletonPagina } from "./components/Skeletons";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Baixa o chunk da próxima rota ao passar o mouse/focar no link, antes do clique.
    defaultPreload: "intent",
    // Troca de tela na hora do clique: mostra o esqueleto imediatamente enquanto a
    // rota carrega (chunk + guard), sem tempo mínimo segurando o esqueleto na tela.
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultPendingComponent: SkeletonPagina,
  });

  return router;
};
