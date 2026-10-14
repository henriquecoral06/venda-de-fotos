import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, ExternalLink, Loader2, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonCabecalho, SkeletonLista } from "@/components/Skeletons";
import { usePerfil } from "@/features/perfil/api";
import { textoMarcaDagua, useConfiguracoesLoja } from "@/features/loja/api";
import {
  ROTULO_STATUS_GALERIA,
  useDefinirCapa,
  useExcluirFoto,
  useExcluirGaleria,
  useFotos,
  useGaleria,
  type Autoria,
  type Foto,
} from "@/features/galerias/api";
import { EnvioFotos } from "@/features/galerias/EnvioFotos";
import { FormularioGaleria } from "@/features/galerias/FormularioGaleria";
import { GradeFotos } from "@/features/galerias/GradeFotos";
import { VARIANTE_STATUS_GALERIA } from "@/features/galerias/TabelaGalerias";
import { brl, dataBR } from "@/lib/format";
import { linkGaleria, rotuloFotos } from "@/lib/fotos";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/galerias_/$id")({
  head: () => ({ meta: [{ title: `Galeria | ${BRAND.name}` }] }),
  component: PaginaGaleria,
});

function PaginaGaleria() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: ctx } = usePerfil();
  const galeria = useGaleria(id);
  const fotos = useFotos(id);
  const loja = useConfiguracoesLoja();
  const definirCapa = useDefinirCapa();
  const excluirFoto = useExcluirFoto();
  const excluirGaleria = useExcluirGaleria();
  const [editando, setEditando] = useState<number | null>(null);
  const [fotoParaExcluir, setFotoParaExcluir] = useState<Foto | null>(null);
  const [excluindoGaleria, setExcluindoGaleria] = useState(false);

  const autoria: Autoria = {
    userId: ctx?.perfil?.id ?? "",
    organizacaoId: ctx?.organizacao?.id ?? null,
  };

  if (galeria.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <SkeletonCabecalho acoes={2} />
        <SkeletonLista itens={3} />
      </div>
    );
  }

  if (galeria.isError || !galeria.data) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <EstadoVazio
          titulo="Galeria não encontrada"
          descricao={
            galeria.error?.message ?? "Ela pode ter sido excluída ou você não tem acesso a ela."
          }
          acao={
            <Button asChild variant="outline">
              <Link to="/galerias">Voltar às galerias</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const g = galeria.data;
  const lista = fotos.data ?? [];
  const proximaOrdem = lista.reduce((m, f) => Math.max(m, f.ordem), 0) + 1;
  const marca = textoMarcaDagua(loja.data, ctx?.organizacao?.nome);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkGaleria(g.slug));
      toast.success(
        g.senha ? "Link copiado. Envie a senha junto para o cliente." : "Link copiado.",
      );
    } catch {
      toast.error("Não foi possível copiar. Copie o endereço manualmente.");
    }
  }

  function confirmarExclusaoFoto() {
    if (!fotoParaExcluir) return;
    excluirFoto.mutate(fotoParaExcluir, {
      onSuccess: () => {
        toast.success("Foto excluída.");
        setFotoParaExcluir(null);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  function confirmarExclusaoGaleria() {
    excluirGaleria.mutate(g.id, {
      onSuccess: () => {
        toast.success("Galeria excluída.");
        void navigate({ to: "/galerias" });
      },
      onError: (e: Error) => {
        toast.error(e.message);
        setExcluindoGaleria(false);
      },
    });
  }

  const resumo = [
    g.cliente_nome || null,
    g.data_evento ? dataBR(g.data_evento) : null,
    g.preco_foto > 0 ? `${brl(g.preco_foto)} por foto` : "Download grátis",
    g.preco_pacote !== null ? `todas por ${brl(g.preco_pacote)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo={g.titulo}
        descricao={resumo}
        acoes={
          <>
            <Button variant="outline" onClick={() => setEditando(Date.now())}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button variant="outline" onClick={() => void copiarLink()}>
              <Copy className="size-4" />
              Copiar link
            </Button>
            {g.status === "publicada" && (
              <Button asChild>
                <a href={`/g/${g.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Abrir galeria
                </a>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={VARIANTE_STATUS_GALERIA[g.status]}>{ROTULO_STATUS_GALERIA[g.status]}</Badge>
        {g.senha && (
          <Badge variant="outline" className="gap-1">
            <Lock className="size-3" aria-hidden="true" />
            Senha: {g.senha}
          </Badge>
        )}
        <span className="text-caption text-muted-foreground">
          {rotuloFotos(lista.length)} · /g/{g.slug}
        </span>
      </div>

      {g.status !== "publicada" && (
        <Card className="bg-warning-soft p-4 text-sm text-warning">
          {g.status === "rascunho"
            ? "Em rascunho, a galeria não abre para o cliente. Envie as fotos e publique em Editar."
            : "Arquivada, a galeria não abre para o cliente. Os pedidos continuam valendo."}
        </Card>
      )}

      <EnvioFotos galeriaId={g.id} autoria={autoria} marca={marca} proximaOrdem={proximaOrdem} />

      {fotos.isPending ? (
        <SkeletonLista itens={2} />
      ) : fotos.isError ? (
        <EstadoVazio titulo="Não foi possível carregar as fotos" descricao={fotos.error.message} />
      ) : lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma foto ainda"
          descricao="As fotos enviadas aparecem aqui. A primeira vira a capa até você escolher outra."
        />
      ) : (
        <GradeFotos
          fotos={lista}
          capaId={g.capa_foto_id ?? lista[0]?.id ?? null}
          aoDefinirCapa={(foto) =>
            definirCapa.mutate(
              { galeriaId: g.id, fotoId: foto.id },
              {
                onSuccess: () => toast.success("Capa atualizada."),
                onError: (e: Error) => toast.error(e.message),
              },
            )
          }
          aoExcluir={setFotoParaExcluir}
        />
      )}

      <div className="flex justify-end border-t border-border pt-6">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setExcluindoGaleria(true)}
        >
          <Trash2 className="size-4" />
          Excluir galeria
        </Button>
      </div>

      {editando !== null && (
        <FormularioGaleria
          key={editando}
          aberto
          aoMudarAberto={(v) => !v && setEditando(null)}
          galeria={g}
          autoria={autoria}
        />
      )}

      <AlertDialog
        open={fotoParaExcluir !== null}
        onOpenChange={(v) => !v && !excluirFoto.isPending && setFotoParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${fotoParaExcluir?.nome_arquivo ?? ""}" sai da galeria e o arquivo é apagado. Foto que já foi vendida não pode ser excluída.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirFoto.isPending}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={excluirFoto.isPending}
              onClick={confirmarExclusaoFoto}
            >
              {excluirFoto.isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={excluindoGaleria}
        onOpenChange={(v) => !v && !excluirGaleria.isPending && setExcluindoGaleria(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir galeria?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${g.titulo}" e as ${rotuloFotos(lista.length)} serão apagadas. Galeria com pedidos não pode ser excluída: arquive-a em Editar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirGaleria.isPending}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={excluirGaleria.isPending}
              onClick={confirmarExclusaoGaleria}
            >
              {excluirGaleria.isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
