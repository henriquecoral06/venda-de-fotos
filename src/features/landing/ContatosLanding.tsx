import { useState } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EstadoVazio } from "@/components/PageHeader";
import { dataHoraBR, normalizarTelefone } from "@/lib/format";
import { useContatosLanding, useExcluirContato, type ContatoLanding } from "./api";

/** Respostas que chegaram pelo formulário (popup) da landing. */
export function ContatosLanding({
  landingId,
  rotuloPersonalizado,
  usaFormulario,
}: {
  landingId: string;
  /** Pergunta do campo personalizado, para rotular a resposta. */
  rotuloPersonalizado: string;
  usaFormulario: boolean;
}) {
  const contatos = useContatosLanding(landingId);
  const excluir = useExcluirContato();
  const [excluindo, setExcluindo] = useState<ContatoLanding | null>(null);

  if (contatos.isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (contatos.isError) {
    return (
      <EstadoVazio
        titulo="Não foi possível carregar os contatos"
        descricao={contatos.error.message}
        acao={
          <Button variant="outline" onClick={() => void contatos.refetch()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }
  if (contatos.data.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum contato ainda"
        descricao={
          usaFormulario
            ? "Quando alguém enviar o formulário da landing, o contato aparece aqui."
            : "Para receber contatos aqui, escolha “Formulário (popup)” no botão de contato, na aba Conteúdo."
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {contatos.data.map((c) => {
          const telefone = c.dados.telefone ? normalizarTelefone(c.dados.telefone) : "";
          return (
            <li key={c.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0 space-y-0.5 text-sm">
                <p className="text-label-md text-foreground">{c.dados.nome || "Sem nome"}</p>
                {c.dados.email && (
                  <a
                    href={`mailto:${c.dados.email}`}
                    className="block truncate text-muted-foreground hover:underline"
                  >
                    {c.dados.email}
                  </a>
                )}
                {c.dados.telefone && <p className="text-muted-foreground">{c.dados.telefone}</p>}
                {c.dados.personalizado && (
                  <p className="whitespace-pre-line text-foreground">
                    <span className="text-muted-foreground">
                      {rotuloPersonalizado || "Resposta"}:{" "}
                    </span>
                    {c.dados.personalizado}
                  </p>
                )}
                <p className="text-caption text-muted-foreground">{dataHoraBR(c.created_at)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {telefone && (
                  <Button asChild size="icon" variant="ghost" className="size-8">
                    <a
                      href={`https://wa.me/${telefone}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir o WhatsApp de ${c.dados.nome || "contato"}`}
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive hover:text-destructive"
                  aria-label={`Excluir o contato de ${c.dados.nome || "sem nome"}`}
                  onClick={() => setExcluindo(c)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmarAcao
        aberto={excluindo !== null}
        titulo="Excluir este contato?"
        descricao="O contato sai da lista e não dá para recuperar."
        rotuloConfirmar="Excluir contato"
        carregando={excluir.isPending}
        aoConfirmar={() =>
          excluindo &&
          excluir.mutate(excluindo.id, {
            onSuccess: () => {
              toast.success("Contato excluído.");
              setExcluindo(null);
            },
            onError: (e: Error) => toast.error(e.message),
          })
        }
        aoFechar={() => setExcluindo(null)}
      />
    </div>
  );
}
