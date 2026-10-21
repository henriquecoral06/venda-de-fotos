import type { ReactNode } from "react";

// Caixa e tracking vêm do escopo: versalete fora do `.ds-app`, minúscula dentro.
export const CLASSE_ROTULO =
  "block text-xs font-medium text-muted-foreground [text-transform:var(--ds-label-transform)] [letter-spacing:var(--ds-label-tracking)]";

/**
 * Rótulo + campo, com dica opcional embaixo. Com `erro`, a mensagem toma o
 * lugar da dica; o controle aponta para ela com `ariaErro(id, erro)`
 * (`src/lib/validacao.ts`).
 */
export function Campo({
  rotulo,
  htmlFor,
  dica,
  erro,
  children,
}: {
  rotulo: string;
  htmlFor?: string;
  dica?: string;
  erro?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={CLASSE_ROTULO}>
          {rotulo}
        </label>
      ) : (
        <span className={CLASSE_ROTULO}>{rotulo}</span>
      )}
      {children}
      {erro ? (
        <p
          id={htmlFor ? `${htmlFor}-erro` : undefined}
          className="text-caption text-danger"
          role="alert"
        >
          {erro}
        </p>
      ) : (
        dica && <p className="text-caption text-muted-foreground">{dica}</p>
      )}
    </div>
  );
}
