import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Campo } from "@/components/Campo";
import { usePerfil, type Perfil } from "@/features/perfil/api";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: `Meu perfil | ${BRAND.name}` }] }),
  component: PaginaPerfil,
});

function PaginaPerfil() {
  const { data: ctx } = usePerfil();
  const perfil = ctx?.perfil ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-8">
      <PageHeader titulo="Meu perfil" descricao="Seus dados de identificação na equipe." />
      {/* `key`: o formulário recomeça do banco quando o perfil salvo muda. */}
      {perfil && <FormularioPerfil key={`${perfil.id}:${perfil.nome}`} perfil={perfil} />}
    </div>
  );
}

function FormularioPerfil({ perfil }: { perfil: Perfil }) {
  const { invalidar } = usePerfil();
  const [nome, setNome] = useState(perfil.nome);

  const salvar = useMutation({
    mutationFn: async () => {
      const nomeLimpo = nome.trim();
      if (nomeLimpo.length < 2) throw new Error("Informe o seu nome.");
      const { error } = await supabase
        .from("perfis")
        .update({ nome: nomeLimpo })
        .eq("id", perfil.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Perfil salvo.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-5">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <Campo rotulo="Nome" htmlFor="nome">
          <Input
            id="nome"
            required
            minLength={2}
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </Campo>

        <Campo
          rotulo="E-mail"
          htmlFor="email"
          dica="Usado para entrar na conta. Não pode ser alterado por aqui."
        >
          <Input id="email" type="email" value={perfil.email} disabled readOnly />
        </Campo>

        <div className="flex justify-end">
          <Button type="submit" disabled={salvar.isPending || nome.trim() === perfil.nome}>
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
