import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * `<input type="date">` nativo com a casca do `Input` (mesma altura, raio e
 * padding). O valor trafega em ISO (`AAAA-MM-DD`); o formato exibido é o do
 * navegador, e o `color-scheme` do tema abre o calendário no tema certo.
 */
export const CampoData = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    type="date"
    className={cn("w-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer", className)}
    {...props}
  />
));
CampoData.displayName = "CampoData";
