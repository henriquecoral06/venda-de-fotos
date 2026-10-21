import type { z } from "zod";

/** Erro por campo: a primeira mensagem de cada caminho do zod. */
export type ErrosDeCampo<T> = Partial<Record<keyof T & string, string>>;

export function errosPorCampo<T>(erro: z.ZodError<T>): ErrosDeCampo<T> {
  const erros: Record<string, string> = {};
  for (const issue of erro.issues) {
    const campo = String(issue.path[0] ?? "");
    if (campo && !(campo in erros)) erros[campo] = issue.message;
  }
  return erros as ErrosDeCampo<T>;
}

/** Leva o foco ao primeiro campo com erro (na ordem da tela). */
export function focarPrimeiroErro(ids: string[]) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      return;
    }
  }
}

/** Atributos de acessibilidade do controle ligado a um `Campo` com erro. */
export function ariaErro(id: string, erro: string | undefined) {
  return erro ? { "aria-invalid": true as const, "aria-describedby": `${id}-erro` } : {};
}
