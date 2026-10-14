import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutEntrada } from "@/components/layout/LayoutEntrada";
import { BRAND } from "@/config/brand";
import { ehContaInexistenteNoOtp, ehLimiteDeEnvio, traduzirErroAuth } from "@/lib/auth-errors";
import { conferirInstalacao } from "@/lib/instalacao";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Entrar | ${BRAND.name}` },
      { name: "description", content: BRAND.tagline },
      { property: "og:title", content: `Entrar | ${BRAND.name}` },
      { property: "og:description", content: BRAND.tagline },
    ],
  }),
  // Confere a instalação (trigger de cadastro e privilégios) antes da primeira
  // conta: no servidor, como visitante, no máximo a cada 10 minutos. Falha não
  // segura a tela.
  beforeLoad: async () => {
    await conferirInstalacao();
  },
  component: PaginaLogin,
});

type Aba = "entrar" | "cadastrar" | "magic";

const MSG_RECUPERACAO =
  "Se houver uma conta com este e-mail, enviamos o link para redefinir a senha.";
const MSG_MAGIC_LINK = "Se houver uma conta com este e-mail, enviamos o link de acesso.";

function PaginaLogin() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const indoParaPainel = useRef(false);

  const irParaPainel = useCallback(() => {
    if (indoParaPainel.current) return;
    indoParaPainel.current = true;
    void navigate({ to: "/dashboard", replace: true });
  }, [navigate]);

  // Logado que abre a tela de entrada vai direto para o painel. A volta do
  // magic link também passa por aqui: o cliente lê a sessão da URL e avisa.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (sessao && (evento === "INITIAL_SESSION" || evento === "SIGNED_IN")) irParaPainel();
    });
    return () => data.subscription.unsubscribe();
  }, [irParaPainel]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        toast.error("Erro ao entrar", { description: traduzirErroAuth(error) });
        return;
      }
      irParaPainel();
    } catch (err) {
      toast.error("Erro ao entrar", { description: traduzirErroAuth(err) });
    } finally {
      setCarregando(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) {
      toast.error("Informe o seu nome.");
      return;
    }
    setCarregando(true);
    try {
      // A primeira conta da instalação vira dona da organização; as
      // seguintes entram como membros (trigger `handle_new_user`).
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: window.location.origin,
          data: { nome: nome.trim() },
        },
      });
      if (error) {
        toast.error("Erro ao criar conta", { description: traduzirErroAuth(error) });
        return;
      }
      if (data.session) {
        irParaPainel();
      } else {
        toast.success("Conta criada", { description: "Confirme seu e-mail para entrar." });
        setSenha("");
        setAba("entrar");
      }
    } catch (err) {
      toast.error("Erro ao criar conta", { description: traduzirErroAuth(err) });
    } finally {
      setCarregando(false);
    }
  }

  async function enviarMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      // Nunca cria conta: conta nova só pela aba Cadastrar.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/` },
      });
      // E-mail sem conta responde igual a um envio, para não revelar quem tem conta.
      if (error && !ehContaInexistenteNoOtp(error)) {
        toast.error("Erro ao enviar o link", { description: traduzirErroAuth(error) });
        return;
      }
      setLinkEnviado(true);
      toast.success("Link enviado", { description: MSG_MAGIC_LINK });
    } catch (err) {
      toast.error("Erro ao enviar o link", { description: traduzirErroAuth(err) });
    } finally {
      setCarregando(false);
    }
  }

  async function esqueciSenha() {
    const alvo = email.trim();
    if (!alvo) {
      toast.error("Digite seu e-mail", {
        description: "Preencha o campo E-mail para receber o link de nova senha.",
      });
      return;
    }
    setEnviandoRecuperacao(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(alvo, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Resposta neutra: só o limite de envio aparece como erro.
      if (error && ehLimiteDeEnvio(error)) {
        toast.error("Erro ao enviar o e-mail", { description: traduzirErroAuth(error) });
        return;
      }
      toast.success("Verifique seu e-mail", { description: MSG_RECUPERACAO });
    } catch (err) {
      toast.error("Erro ao enviar o e-mail", { description: traduzirErroAuth(err) });
    } finally {
      setEnviandoRecuperacao(false);
    }
  }

  return (
    <LayoutEntrada titulo="Bem-vindo de volta" descricao={`Entre na sua conta do ${BRAND.name}`}>
      <Card className="border-border">
        <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
          <CardHeader className="pb-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
              <TabsTrigger value="magic">Magic Link</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="entrar" className="mt-0">
              <form onSubmit={entrar} className="space-y-4">
                <CampoEmail id="entrar-email" valor={email} onChange={setEmail} />
                <div className="space-y-2">
                  <Label htmlFor="entrar-senha">Senha</Label>
                  <Input
                    icone={<Lock />}
                    id="entrar-senha"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando && <Loader2 className="animate-spin" />}
                  {carregando ? "Entrando..." : "Entrar"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-primary"
                  disabled={carregando || enviandoRecuperacao}
                  onClick={() => void esqueciSenha()}
                >
                  {enviandoRecuperacao ? "Enviando..." : "Esqueceu a senha?"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="cadastrar" className="mt-0">
              <form onSubmit={cadastrar} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  A primeira conta criada vira dona da organização; as seguintes entram como
                  membros.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cadastrar-nome">Nome</Label>
                  <Input
                    icone={<User />}
                    id="cadastrar-nome"
                    name="name"
                    required
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <CampoEmail id="cadastrar-email" valor={email} onChange={setEmail} />
                <div className="space-y-2">
                  <Label htmlFor="cadastrar-senha">Senha</Label>
                  <Input
                    icone={<Lock />}
                    id="cadastrar-senha"
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
                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando && <Loader2 className="animate-spin" />}
                  {carregando ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="magic" className="mt-0">
              {linkEnviado ? (
                <div className="space-y-4 py-6 text-center">
                  <Mail className="mx-auto size-12 text-primary" strokeWidth={1.5} />
                  <div className="space-y-2">
                    <CardTitle>Verifique seu e-mail</CardTitle>
                    <CardDescription>
                      Se houver uma conta com <strong className="text-foreground">{email}</strong>,
                      enviamos o link de acesso.
                    </CardDescription>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setLinkEnviado(false)}>
                    Usar outro e-mail
                  </Button>
                </div>
              ) : (
                <form onSubmit={enviarMagicLink} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Receba no e-mail um link que entra sem senha.
                  </p>
                  <CampoEmail id="magic-email" valor={email} onChange={setEmail} />
                  <Button type="submit" className="w-full" disabled={carregando}>
                    {carregando && <Loader2 className="animate-spin" />}
                    {carregando ? "Enviando..." : "Enviar magic link"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </LayoutEntrada>
  );
}

function CampoEmail({
  id,
  valor,
  onChange,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>E-mail</Label>
      <Input
        icone={<Mail />}
        id={id}
        name="email"
        type="email"
        required
        autoComplete="email"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="voce@empresa.com.br"
      />
    </div>
  );
}
