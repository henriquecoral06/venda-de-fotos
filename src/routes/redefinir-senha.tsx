import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutEntrada } from "@/components/layout/LayoutEntrada";
import { BRAND } from "@/config/brand";
import { traduzirErroAuth } from "@/lib/auth-errors";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [{ title: `Nova senha | ${BRAND.name}` }],
  }),
  component: PaginaRedefinirSenha,
});

type Estado = "verificando" | "pronto" | "expirado";

/**
 * O link de "Esqueceu a senha?" chega aqui com o token na URL (`#…type=recovery`
 * no fluxo implícito, `?code=` no PKCE). O cliente Supabase troca o token por
 * sessão ao ser criado (`detectSessionInUrl`, padrão) e limpa a URL, então a
 * origem é lida antes do primeiro acesso ao cliente. Sem sessão de recuperação
 * (link vencido, já usado ou página aberta direto) mostra o aviso.
 */
function lerOrigemDoLink(): { veioDoLink: boolean; erroNoLink: boolean } {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  return {
    veioDoLink:
      hash.get("type") === "recovery" || query.get("type") === "recovery" || query.has("code"),
    erroNoLink: hash.has("error") || query.has("error") || hash.has("error_code"),
  };
}

function PaginaRedefinirSenha() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Lida uma vez só: na segunda execução do efeito (StrictMode) a URL já foi limpa.
  const origem = useRef<ReturnType<typeof lerOrigemDoLink> | null>(null);

  useEffect(() => {
    origem.current ??= lerOrigemDoLink();
    const { veioDoLink, erroNoLink } = origem.current;
    let vivo = true;

    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (vivo && evento === "PASSWORD_RECOVERY" && sessao) setEstado("pronto");
    });

    // getSession espera o cliente terminar de ler a URL.
    void supabase.auth.getSession().then(({ data: sessao }) => {
      if (!vivo) return;
      const pronto = Boolean(sessao.session) && veioDoLink && !erroNoLink;
      setEstado((atual) => (atual === "pronto" || pronto ? "pronto" : "expirado"));
    });

    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        toast.error("Erro ao redefinir a senha", { description: traduzirErroAuth(error) });
        return;
      }
      toast.success("Senha redefinida");
      void navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error("Erro ao redefinir a senha", { description: traduzirErroAuth(err) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <LayoutEntrada titulo="Nova senha" descricao="Escolha uma nova senha para a sua conta.">
      <Card className="border-border">
        <CardContent className="pt-6">
          {estado === "verificando" && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Conferindo o link...
            </div>
          )}

          {estado === "expirado" && (
            <div className="space-y-4 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Este link expirou. Peça outro na tela de login.
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/">Voltar para o login</Link>
              </Button>
            </div>
          )}

          {estado === "pronto" && (
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <Input
                  icone={<Lock />}
                  id="nova-senha"
                  name="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar senha</Label>
                <Input
                  icone={<Lock />}
                  id="confirmar-senha"
                  name="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
              <Button type="submit" className="w-full" disabled={salvando}>
                {salvando && <Loader2 className="animate-spin" />}
                {salvando ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </LayoutEntrada>
  );
}
