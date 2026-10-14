import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * A tela de entrada mora em `/`. `/auth` só existe para não quebrar links
 * antigos: redireciona permanentemente para lá.
 */
export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true, statusCode: 301 });
  },
});
