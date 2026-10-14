import * as React from "react";

import { cn } from "@/lib/utils";

// Padding e raio de `--ds-input-*`, com o raio limitado a `lg`: a pílula de
// fora do `.ds-app` não serve para texto em várias linhas.
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[calc(var(--ds-input-height)*2)] w-full rounded-[min(var(--ds-input-radius),var(--radius-lg))] border border-input bg-card px-[var(--ds-input-px)] py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
