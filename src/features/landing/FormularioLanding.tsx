import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { mascararTelefone } from "@/lib/format";
import type { DadosFormulario, DadosLanding } from "./tipos";

type Campo = keyof DadosFormulario;

/** Validação simples no navegador; o banco confere de novo o e-mail e o tamanho. */
function validar(campo: Campo, valor: string): string | null {
  const v = valor.trim();
  if (campo === "personalizado") return null;
  if (v === "") return "Preencha este campo.";
  if (campo === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
    return "Informe um e-mail válido.";
  if (campo === "telefone" && v.replace(/\D/g, "").length < 10) {
    return "Informe o telefone com DDD.";
  }
  return null;
}

/**
 * Formulário que o CTA abre quando a landing usa o popup. Os campos são os que
 * o fotógrafo marcou no painel; as cores são as da landing (`--lp-*`).
 */
export function FormularioLanding({
  d,
  aberto,
  aoFechar,
  classeBotao,
}: {
  d: DadosLanding;
  aberto: boolean;
  aoFechar: () => void;
  classeBotao: string;
}) {
  const f = d.conteudo.formulario;
  const campos: { chave: Campo; rotulo: string; tipo: string; auto: string }[] = [
    ...(f.nome ? [{ chave: "nome" as const, rotulo: "Nome", tipo: "text", auto: "name" }] : []),
    ...(f.email
      ? [{ chave: "email" as const, rotulo: "E-mail", tipo: "email", auto: "email" }]
      : []),
    ...(f.telefone
      ? [{ chave: "telefone" as const, rotulo: "Telefone (WhatsApp)", tipo: "tel", auto: "tel" }]
      : []),
    ...(f.personalizado.trim()
      ? [
          {
            chave: "personalizado" as const,
            rotulo: f.personalizado.trim(),
            tipo: "textarea",
            auto: "off",
          },
        ]
      : []),
  ];
  const [valores, setValores] = useState<DadosFormulario>({});
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [falha, setFalha] = useState<string | null>(null);
  const primeiro = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setEstado("editando");
    setFalha(null);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    setTimeout(() => primeiro.current?.focus(), 50);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const novos: Partial<Record<Campo, string>> = {};
    for (const c of campos) {
      const erro = validar(c.chave, valores[c.chave] ?? "");
      if (erro) novos[c.chave] = erro;
    }
    setErros(novos);
    const primeiroErro = campos.find((c) => novos[c.chave]);
    if (primeiroErro) {
      document.getElementById(`lp-form-${primeiroErro.chave}`)?.focus();
      return;
    }
    setEstado("enviando");
    setFalha(null);
    try {
      const dados: DadosFormulario = {};
      for (const c of campos) dados[c.chave] = (valores[c.chave] ?? "").trim();
      await d.aoEnviarFormulario(dados);
      setEstado("enviado");
      setValores({});
    } catch (erro: unknown) {
      setEstado("editando");
      setFalha(erro instanceof Error ? erro.message : "Não foi possível enviar. Tente de novo.");
    }
  }

  const campoBase =
    "w-full rounded-none border border-[color-mix(in_srgb,var(--lp-texto)_25%,transparent)] bg-transparent px-3 py-2.5 text-base text-[var(--lp-texto)] outline-none placeholder:opacity-50 focus:border-[var(--lp-texto)]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && aoFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-form-titulo"
        className="relative max-h-[92dvh] w-full overflow-y-auto bg-[var(--lp-fundo)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[var(--lp-texto)] shadow-2xl sm:max-w-md sm:p-8"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={aoFechar}
          className="absolute right-3 top-3 flex size-10 items-center justify-center opacity-70 hover:opacity-100"
        >
          <X className="size-5" />
        </button>

        {estado === "enviado" ? (
          <div className="space-y-4 py-6 text-center">
            <CheckCircle2
              className="mx-auto size-10 text-[var(--lp-primaria)]"
              aria-hidden="true"
            />
            <p id="lp-form-titulo" className="text-xl font-medium">
              {f.sucesso}
            </p>
            <button type="button" onClick={aoFechar} className={`${classeBotao} justify-center`}>
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-5">
            <div className="space-y-2 pr-8">
              <h2 id="lp-form-titulo" className="text-2xl font-medium">
                {f.titulo}
              </h2>
              {f.texto && <p className="text-sm opacity-75">{f.texto}</p>}
            </div>
            {campos.map((c, i) => (
              <div key={c.chave} className="space-y-1.5">
                <label htmlFor={`lp-form-${c.chave}`} className="block text-sm">
                  {c.rotulo}
                  {c.chave === "personalizado" && <span className="opacity-60"> (opcional)</span>}
                </label>
                {c.tipo === "textarea" ? (
                  <textarea
                    id={`lp-form-${c.chave}`}
                    ref={i === 0 ? (el) => void (primeiro.current = el) : undefined}
                    rows={3}
                    maxLength={1000}
                    value={valores[c.chave] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                    className={campoBase}
                  />
                ) : (
                  <input
                    id={`lp-form-${c.chave}`}
                    ref={i === 0 ? (el) => void (primeiro.current = el) : undefined}
                    type={c.tipo}
                    autoComplete={c.auto}
                    inputMode={c.tipo === "tel" ? "tel" : undefined}
                    maxLength={c.chave === "email" ? 200 : c.chave === "telefone" ? undefined : 120}
                    placeholder={c.chave === "telefone" ? "(11) 98765-4321" : undefined}
                    value={valores[c.chave] ?? ""}
                    onChange={(e) => {
                      const valor =
                        c.chave === "telefone" ? mascararTelefone(e.target.value) : e.target.value;
                      setValores((v) => ({ ...v, [c.chave]: valor }));
                    }}
                    aria-invalid={erros[c.chave] ? true : undefined}
                    aria-describedby={erros[c.chave] ? `lp-form-${c.chave}-erro` : undefined}
                    className={`${campoBase} ${erros[c.chave] ? "border-red-600" : ""}`}
                  />
                )}
                {erros[c.chave] && (
                  <p id={`lp-form-${c.chave}-erro`} role="alert" className="text-sm text-red-600">
                    {erros[c.chave]}
                  </p>
                )}
              </div>
            ))}
            {falha && (
              <p role="alert" className="text-sm text-red-600">
                {falha}
              </p>
            )}
            <button
              type="submit"
              disabled={estado === "enviando"}
              className={`${classeBotao} w-full justify-center disabled:opacity-70`}
            >
              {estado === "enviando" && <Loader2 className="mr-2 size-4 animate-spin" />}
              {f.botao}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
