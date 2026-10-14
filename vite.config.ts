import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// A config base já traz tanstackStart, React, Tailwind, tsconfig paths, o alias `@`
// e o build para Workers: não adicionar esses plugins de novo aqui.
export default defineConfig({
  tanstackStart: {
    // Entrada de servidor em src/server.ts (página de erro de SSR).
    server: { entry: "server" },
  },
});
