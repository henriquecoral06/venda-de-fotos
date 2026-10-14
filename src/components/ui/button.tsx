import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// `secondary` e `outline` compartilham a mesma receita (outline é alias visual).
const secundario =
  "ds-btn-secondary relative overflow-hidden bg-linear-to-b from-white to-neutral-50 text-neutral-900 ring-1 ring-inset ring-black/5 shadow-[inset_0_1px_1px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.02),0_8px_20px_-4px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transform-gpu hover:shadow-[inset_0_1px_1px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.03),0_12px_24px_-4px_rgba(0,0,0,0.16)] dark:bg-none dark:bg-transparent dark:text-ink dark:shadow-none dark:ring-hairline-strong dark:hover:translate-y-0 dark:hover:shadow-none dark:hover:bg-white dark:hover:text-neutral-900 dark:hover:ring-transparent";

const buttonVariants = cva(
  "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium leading-none tracking-tight cursor-pointer select-none ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-inverse text-on-inverse hover:bg-inverse/85",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary: secundario,
        outline: secundario,
        ghost: "bg-transparent text-ink hover:bg-ink/10",
        link: "text-primary underline-offset-4 hover:underline",
        shiny: "shiny-cta hover:-translate-y-0.5 transform-gpu",
        "shiny-brand": "shiny-brand hover:-translate-y-0.5 transform-gpu",
      },
      size: {
        // Mesma altura do campo no escopo: 44px fora do `.ds-app`, 36px dentro.
        default: "h-[var(--ds-input-height)] px-5",
        field: "h-[var(--ds-input-height)] px-5",
        sm: "h-8 px-4 text-[13px]",
        lg: "h-12 px-8 text-base",
        icon: "h-[var(--ds-input-height)] w-[var(--ds-input-height)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const shiny = variant === "shiny" || variant === "shiny-brand";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {shiny && <span className="shiny-dots" aria-hidden="true" />}
        {shiny && !asChild ? (
          <span className="shiny-cta-content">{children}</span>
        ) : (
          <Slottable>{children}</Slottable>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
