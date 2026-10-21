import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmação de ação que não se desfaz (excluir, cancelar, remover). O botão
 * de confirmar diz o que acontece; enquanto roda, o diálogo não fecha.
 */
export function ConfirmarAcao({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  rotuloVoltar = "Voltar",
  carregando = false,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  rotuloConfirmar: string;
  rotuloVoltar?: string;
  carregando?: boolean;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && !carregando && aoFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={carregando}>{rotuloVoltar}</AlertDialogCancel>
          <Button variant="destructive" disabled={carregando} onClick={aoConfirmar}>
            {carregando && <Loader2 className="size-4 animate-spin" />}
            {rotuloConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
