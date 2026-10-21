import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `<img>` que, se o arquivo faltar (envio interrompido, arquivo apagado), vira
 * um bloco neutro com ícone em vez do ícone quebrado do navegador. As classes
 * de tamanho valem para os dois.
 */
export function Miniatura({ className, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return (
      <span
        role="img"
        aria-label={alt ? `${alt} (arquivo indisponível)` : "Arquivo indisponível"}
        className={cn("flex items-center justify-center bg-muted text-faint", className)}
      >
        <ImageOff className="size-5" aria-hidden="true" />
      </span>
    );
  }
  return <img alt={alt} className={className} onError={() => setFalhou(true)} {...props} />;
}
