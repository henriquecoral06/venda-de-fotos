import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Ícone à esquerda, dentro do campo; o padding cresce para o texto não passar por baixo. */
  icone?: React.ReactNode;
}

// Altura, raio e padding saem de `--ds-input-*`: pílula de 44px fora do
// `.ds-app`, 36px com canto `md` dentro. `rounded-full` compilaria para um
// literal que o escopo não alcança.
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icone, ...props }, ref) => {
    const campo = (
      <input
        type={type}
        className={cn(
          "flex h-[var(--ds-input-height)] w-full rounded-[var(--ds-input-radius)] border border-input bg-card px-[var(--ds-input-px)] py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          icone != null && "pl-[calc(var(--ds-input-px)+1.5rem)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    if (icone == null) return campo;

    return (
      <span className="relative block w-full">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[var(--ds-input-px)] top-1/2 flex -translate-y-1/2 items-center text-muted-foreground [&_svg]:size-4"
        >
          {icone}
        </span>
        {campo}
      </span>
    );
  },
);
Input.displayName = "Input";

export { Input };
