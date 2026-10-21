import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Campo } from "@/components/Campo";
import { brl } from "@/lib/format";
import { rotuloFotos, urlPrevia } from "@/lib/fotos";
import { CLASSE_BOTAO_MARCA } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { ariaErro, errosPorCampo, focarPrimeiroErro, type ErrosDeCampo } from "@/lib/validacao";
import {
  esquemaComprador,
  useCriarPedido,
  type DadosComprador,
  type FotoPublica,
  type GaleriaPublica,
} from "./api";
import { Miniatura } from "@/components/Miniatura";

export type ModoCompra = "selecao" | "pacote";

/** Seleção e dados do comprador numa gaveta lateral; o preço final sai do banco. */
export function Checkout({
  galeria,
  senha,
  modo,
  aoFechar,
  fotosSelecionadas,
  aoRemover,
  aoConcluir,
}: {
  galeria: GaleriaPublica;
  senha: string;
  modo: ModoCompra | null;
  aoFechar: () => void;
  fotosSelecionadas: FotoPublica[];
  aoRemover: (id: string) => void;
  aoConcluir: (codigo: string) => void;
}) {
  const criar = useCriarPedido();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erros, setErros] = useState<ErrosDeCampo<DadosComprador>>({});

  const precoFoto = galeria.preco_foto ?? 0;
  const pacote = modo === "pacote";
  const quantidade = pacote ? galeria.total_fotos : fotosSelecionadas.length;
  const total = pacote ? (galeria.preco_pacote ?? 0) : precoFoto * quantidade;
  const gratis = total === 0;

  function finalizar(e: React.FormEvent) {
    e.preventDefault();
    const conferido = esquemaComprador.safeParse({ nome, email, telefone });
    if (!conferido.success) {
      setErros(errosPorCampo(conferido.error));
      focarPrimeiroErro(
        [
          ["nome", "nome-comprador"],
          ["email", "email-comprador"],
          ["telefone", "telefone-comprador"],
        ]
          .filter(([campo]) => conferido.error.issues.some((i) => i.path[0] === campo))
          .map(([, id]) => id ?? ""),
      );
      return;
    }
    setErros({});
    criar.mutate(
      {
        slug: galeria.slug,
        senha,
        comprador: { nome, email, telefone },
        fotos: fotosSelecionadas.map((f) => f.id),
        pacoteCompleto: pacote,
      },
      {
        onSuccess: aoConcluir,
        onError: (erro: Error) => toast.error(erro.message),
      },
    );
  }

  return (
    <Sheet open={modo !== null} onOpenChange={(v) => !v && !criar.isPending && aoFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <form onSubmit={finalizar} noValidate className="flex min-h-full flex-col">
          <SheetHeader className="border-b border-border p-5 text-left">
            <SheetTitle>{pacote ? "Todas as fotos" : "Sua seleção"}</SheetTitle>
            <SheetDescription>
              {rotuloFotos(quantidade)} de “{galeria.titulo}”
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 p-5">
            {!pacote &&
              (fotosSelecionadas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma foto selecionada. Toque no círculo de uma foto para escolher.
                </p>
              ) : (
                <ul className="grid grid-cols-4 gap-2">
                  {fotosSelecionadas.map((f) => (
                    <li key={f.id} className="relative">
                      <Miniatura
                        src={urlPrevia(f.miniatura)}
                        alt={f.nome}
                        className="aspect-square w-full rounded-md border border-border object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Tirar ${f.nome} da seleção`}
                        onClick={() => aoRemover(f.id)}
                        className="absolute -right-1.5 -top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ))}

            <div className="flex items-baseline justify-between rounded-lg bg-muted p-4">
              <span className="text-sm text-muted-foreground">
                {pacote
                  ? "Pacote completo"
                  : `${rotuloFotos(quantidade)} × ${precoFoto > 0 ? brl(precoFoto) : "grátis"}`}
              </span>
              <span className="text-heading-sm tabular-nums">{gratis ? "Grátis" : brl(total)}</span>
            </div>

            <div className="space-y-4">
              <Campo rotulo="Seu nome" htmlFor="nome-comprador" erro={erros.nome}>
                <Input
                  id="nome-comprador"
                  maxLength={120}
                  autoComplete="name"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  {...ariaErro("nome-comprador", erros.nome)}
                />
              </Campo>
              <Campo
                rotulo="E-mail"
                htmlFor="email-comprador"
                dica="O fotógrafo usa este e-mail para falar com você sobre o pedido."
                erro={erros.email}
              >
                <Input
                  id="email-comprador"
                  type="email"
                  maxLength={200}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  {...ariaErro("email-comprador", erros.email)}
                />
              </Campo>
              <Campo
                rotulo="WhatsApp (opcional)"
                htmlFor="telefone-comprador"
                dica="Com DDD. Ajuda o fotógrafo a confirmar o pagamento mais rápido."
                erro={erros.telefone}
              >
                <Input
                  id="telefone-comprador"
                  type="tel"
                  inputMode="tel"
                  maxLength={30}
                  autoComplete="tel"
                  placeholder="11 91234-5678"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  {...ariaErro("telefone-comprador", erros.telefone)}
                />
              </Campo>
            </div>
          </div>

          <SheetFooter className="border-t border-border p-5">
            <Button
              type="submit"
              className={cn("w-full", CLASSE_BOTAO_MARCA)}
              disabled={criar.isPending || quantidade === 0}
            >
              {criar.isPending && <Loader2 className="size-4 animate-spin" />}
              {gratis ? "Receber as fotos" : `Fazer pedido · ${brl(total)}`}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
