import { Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { urlPrevia } from "@/lib/fotos";
import type { Foto } from "./api";

/** Grade das fotos enviadas, com as ações de capa e exclusão no canto. */
export function GradeFotos({
  fotos,
  capaId,
  aoDefinirCapa,
  aoExcluir,
}: {
  fotos: Foto[];
  capaId: string | null;
  aoDefinirCapa: (foto: Foto) => void;
  aoExcluir: (foto: Foto) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {fotos.map((foto) => {
        const ehCapa = foto.id === capaId;
        return (
          <li
            key={foto.id}
            className="group relative overflow-hidden rounded-lg border border-border bg-muted"
          >
            <img
              src={urlPrevia(foto.caminho_miniatura)}
              alt={foto.nome_arquivo}
              loading="lazy"
              width={foto.largura}
              height={foto.altura}
              className="aspect-square size-full object-cover"
            />
            {ehCapa && (
              <Badge variant="info" className="absolute left-2 top-2">
                Capa
              </Badge>
            )}
            {/* Faixa sobre a foto: escura nos dois temas, para o texto ler em cima da imagem. */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <span className="truncate text-caption text-white">{foto.nome_arquivo}</span>
              <div className="flex shrink-0 gap-1">
                {!ehCapa && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-white hover:bg-white/20 hover:text-white"
                    aria-label={`Usar ${foto.nome_arquivo} como capa`}
                    onClick={() => aoDefinirCapa(foto)}
                  >
                    <Star className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-white hover:bg-white/20 hover:text-white"
                  aria-label={`Excluir ${foto.nome_arquivo}`}
                  onClick={() => aoExcluir(foto)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
