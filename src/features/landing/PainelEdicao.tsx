import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/Campo";
import { ControleSegmentado } from "@/components/ControleSegmentado";
import { ehHex, urlLogo } from "@/lib/marca";
import type { ConfiguracoesLoja } from "@/features/loja/api";
import { enviarImagemLanding, type EdicaoLanding, type RastreamentoLanding } from "./api";
import { INFO_MODELO, type ConteudoLanding, type CoresLanding } from "./tipos";

type Mudar = (parcial: Partial<EdicaoLanding>) => void;

/* ───────────────────────────── Conteúdo ───────────────────────────── */

export function AbaConteudo({ e, mudar }: { e: EdicaoLanding; mudar: Mudar }) {
  const c = e.conteudo;
  const campo = (
    chave: keyof Omit<ConteudoLanding, "servicos" | "imagens" | "formulario" | "cta_tipo">,
  ) => ({
    value: c[chave],
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      mudar({ conteudo: { ...c, [chave]: ev.target.value } }),
  });
  const mudarServico = (i: number, parcial: Partial<ConteudoLanding["servicos"][number]>) =>
    mudar({
      conteudo: {
        ...c,
        servicos: c.servicos.map((s, j) => (j === i ? { ...s, ...parcial } : s)),
      },
    });

  return (
    <div className="space-y-5">
      <Campo rotulo="Nome no topo" htmlFor="lp-nome" dica="Some quando a loja tem logo.">
        <Input id="lp-nome" maxLength={80} {...campo("nome")} />
      </Campo>
      <Campo rotulo="Chamada" htmlFor="lp-chamada">
        <Input id="lp-chamada" maxLength={120} {...campo("chamada")} />
      </Campo>
      <Campo rotulo="Título principal" htmlFor="lp-titulo">
        <Textarea id="lp-titulo" rows={2} maxLength={160} {...campo("titulo")} />
      </Campo>
      <Campo rotulo="Texto de apoio" htmlFor="lp-subtitulo">
        <Textarea id="lp-subtitulo" rows={3} maxLength={400} {...campo("subtitulo")} />
      </Campo>
      <div className="space-y-4 rounded-lg border border-border p-3">
        <Campo rotulo="O botão de contato abre">
          <ControleSegmentado
            opcoes={OPCOES_CTA}
            valor={c.cta_tipo}
            aoMudar={(cta_tipo) => mudar({ conteudo: { ...c, cta_tipo } })}
            rotuloAria="O que o botão de contato abre"
          />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Texto do botão" htmlFor="lp-cta">
            <Input id="lp-cta" maxLength={40} {...campo("cta_texto")} />
          </Campo>
          {c.cta_tipo === "whatsapp" && (
            <Campo
              rotulo="Link do botão"
              htmlFor="lp-cta-link"
              dica="Em branco, abre o WhatsApp da loja."
            >
              <Input
                id="lp-cta-link"
                type="url"
                placeholder="https://"
                maxLength={500}
                {...campo("cta_link")}
              />
            </Campo>
          )}
        </div>
        {c.cta_tipo === "popup" && <CamposFormulario c={c} mudar={mudar} />}
      </div>
      <Campo rotulo="Título do “sobre”" htmlFor="lp-sobre-titulo">
        <Input id="lp-sobre-titulo" maxLength={120} {...campo("sobre_titulo")} />
      </Campo>
      <Campo rotulo="Texto do “sobre”" htmlFor="lp-sobre">
        <Textarea id="lp-sobre" rows={5} maxLength={2_000} {...campo("sobre_texto")} />
      </Campo>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-label-md text-foreground">Serviços</span>
          {c.servicos.length < 4 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                mudar({
                  conteudo: { ...c, servicos: [...c.servicos, { titulo: "", descricao: "" }] },
                })
              }
            >
              <Plus className="size-4" />
              Adicionar
            </Button>
          )}
        </div>
        {c.servicos.map((s, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex gap-2">
              <Input
                aria-label={`Título do serviço ${i + 1}`}
                placeholder="Título"
                maxLength={80}
                value={s.titulo}
                onChange={(ev) => mudarServico(i, { titulo: ev.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={`Remover serviço ${i + 1}`}
                onClick={() =>
                  mudar({ conteudo: { ...c, servicos: c.servicos.filter((_, j) => j !== i) } })
                }
              >
                <X className="size-4" />
              </Button>
            </div>
            <Textarea
              aria-label={`Descrição do serviço ${i + 1}`}
              placeholder="Descrição"
              rows={2}
              maxLength={400}
              value={s.descricao}
              onChange={(ev) => mudarServico(i, { descricao: ev.target.value })}
            />
          </div>
        ))}
      </div>

      {e.modelo === "classico" && (
        <>
          <Campo
            rotulo="Título da faixa de chamada"
            htmlFor="lp-faixa-titulo"
            dica="A faixa com foto de fundo e botão, logo depois do “sobre”."
          >
            <Input id="lp-faixa-titulo" maxLength={120} {...campo("faixa_titulo")} />
          </Campo>
          <Campo rotulo="Texto da faixa de chamada" htmlFor="lp-faixa-texto">
            <Textarea id="lp-faixa-texto" rows={2} maxLength={300} {...campo("faixa_texto")} />
          </Campo>
        </>
      )}

      <Campo rotulo="Título da seção de eventos" htmlFor="lp-ev-titulo">
        <Input id="lp-ev-titulo" maxLength={120} {...campo("eventos_titulo")} />
      </Campo>
      <Campo rotulo="Texto da seção de eventos" htmlFor="lp-ev-texto">
        <Textarea id="lp-ev-texto" rows={2} maxLength={300} {...campo("eventos_texto")} />
      </Campo>
      <Campo rotulo="Frase final" htmlFor="lp-final">
        <Input id="lp-final" maxLength={160} {...campo("frase_final")} />
      </Campo>
      <Campo rotulo="Instagram" htmlFor="lp-insta">
        <Input id="lp-insta" placeholder="@seuestudio" maxLength={60} {...campo("instagram")} />
      </Campo>
    </div>
  );
}

const OPCOES_CTA = [
  { valor: "whatsapp", rotulo: "WhatsApp ou link" },
  { valor: "popup", rotulo: "Formulário (popup)" },
] as const;

const CAMPOS_FIXOS = [
  { chave: "nome", rotulo: "Nome" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "telefone", rotulo: "Telefone" },
] as const;

/** Campos que o popup pede; as respostas chegam na aba Contatos. */
function CamposFormulario({ c, mudar }: { c: ConteudoLanding; mudar: Mudar }) {
  const f = c.formulario;
  const mudarForm = (parcial: Partial<ConteudoLanding["formulario"]>) =>
    mudar({ conteudo: { ...c, formulario: { ...f, ...parcial } } });
  const nenhum = !f.nome && !f.email && !f.telefone && !f.personalizado.trim();
  return (
    <div className="space-y-4">
      <Campo rotulo="Título do formulário" htmlFor="lp-form-titulo">
        <Input
          id="lp-form-titulo"
          maxLength={120}
          value={f.titulo}
          onChange={(ev) => mudarForm({ titulo: ev.target.value })}
        />
      </Campo>
      <Campo rotulo="Texto do formulário" htmlFor="lp-form-texto">
        <Textarea
          id="lp-form-texto"
          rows={2}
          maxLength={300}
          value={f.texto}
          onChange={(ev) => mudarForm({ texto: ev.target.value })}
        />
      </Campo>
      <fieldset className="space-y-2">
        <legend className="text-label-md text-foreground">Campos</legend>
        {CAMPOS_FIXOS.map((cf) => (
          <label key={cf.chave} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={f[cf.chave]}
              onCheckedChange={(v) => mudarForm({ [cf.chave]: v === true })}
            />
            {cf.rotulo}
          </label>
        ))}
      </fieldset>
      <Campo
        rotulo="Campo personalizado"
        htmlFor="lp-form-personalizado"
        dica="Escreva a pergunta, por exemplo “Data do evento” ou “Conte o que você imagina”. Em branco, o campo não aparece."
      >
        <Input
          id="lp-form-personalizado"
          maxLength={60}
          value={f.personalizado}
          onChange={(ev) => mudarForm({ personalizado: ev.target.value })}
        />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Texto do botão de envio" htmlFor="lp-form-botao">
          <Input
            id="lp-form-botao"
            maxLength={40}
            value={f.botao}
            onChange={(ev) => mudarForm({ botao: ev.target.value })}
          />
        </Campo>
        <Campo rotulo="Mensagem depois do envio" htmlFor="lp-form-sucesso">
          <Input
            id="lp-form-sucesso"
            maxLength={200}
            value={f.sucesso}
            onChange={(ev) => mudarForm({ sucesso: ev.target.value })}
          />
        </Campo>
      </div>
      {nenhum && (
        <p className="text-caption text-danger" role="alert">
          Marque pelo menos um campo para o formulário funcionar.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────── Fotos ─────────────────────────────── */

function GrupoFotos({
  titulo,
  dica,
  caminhos,
  limite,
  organizacaoId,
  aoMudar,
}: {
  titulo: string;
  dica: string;
  caminhos: string[];
  limite: number;
  organizacaoId: string | null;
  aoMudar: (caminhos: string[]) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(lista: FileList | null) {
    if (!lista || !organizacaoId) return;
    const arquivos = Array.from(lista).slice(0, limite - caminhos.length);
    setEnviando(true);
    try {
      const novos: string[] = [];
      for (const a of arquivos) novos.push(await enviarImagemLanding(a, organizacaoId));
      aoMudar([...caminhos, ...novos]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-label-md text-foreground">
          {titulo}{" "}
          <span className="text-caption text-muted-foreground">
            ({caminhos.length}/{limite})
          </span>
        </p>
        <p className="text-caption text-muted-foreground">{dica}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {caminhos.map((c, i) => (
          <div key={c} className="group relative">
            <img
              src={urlLogo(c)}
              alt=""
              className="aspect-square w-full rounded-md border border-border object-cover"
            />
            <button
              type="button"
              aria-label={`Remover foto ${i + 1}`}
              onClick={() => aoMudar(caminhos.filter((x) => x !== c))}
              className="absolute -right-1.5 -top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {caminhos.length < limite && (
          <button
            type="button"
            disabled={enviando || !organizacaoId}
            onClick={() => entrada.current?.click()}
            className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-input text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
            aria-label={`Adicionar fotos em ${titulo}`}
          >
            {enviando ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
          </button>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={limite > 1}
        className="sr-only"
        onChange={(ev) => void enviar(ev.target.files)}
      />
    </div>
  );
}

/**
 * Tamanho ideal de cada grupo, pela proporção em que o modelo mostra a foto.
 * O painel reduz o envio para no máximo 1920 px no lado maior.
 */
const MEDIDAS: Record<EdicaoLanding["modelo"], { capa: string; galeria: string; sobre: string }> = {
  editorial: {
    capa: "2 fotos verticais, 1200 × 1600 px (3:4), lado a lado em tela cheia; no celular aparece só a primeira. A página mostra o centro de cada foto: deixe a pessoa no meio.",
    galeria: "Horizontais, 1600 × 1200 px (4:3).",
    sobre: "Vertical, 1200 × 1500 px (4:5).",
  },
  portfolio: {
    capa: "3 fotos verticais, 1200 × 1600 px (3:4), em leque.",
    galeria: "Horizontais, 1600 × 1000 px (16:10).",
    sobre: "Vertical, 1200 × 1500 px (4:5).",
  },
  estudio: {
    capa: "5 fotos bem verticais, 1080 × 1800 px (3:5), na faixa em curva.",
    galeria: "Horizontais, 1920 × 1080 px (16:9).",
    sobre: "Vertical, 1200 × 1500 px (4:5).",
  },
  classico: {
    capa: "1 foto horizontal, 1920 × 1280 px (3:2), em tela cheia. No celular as laterais são cortadas: deixe o casal ou a pessoa no centro.",
    galeria:
      "Verticais, 1200 × 1600 px (3:4), para os serviços. A 4ª foto vira o fundo da faixa de chamada (prefira uma horizontal).",
    sobre: "Quadrada, 1200 × 1200 px (1:1).",
  },
};

export function AbaFotos({
  e,
  mudar,
  organizacaoId,
}: {
  e: EdicaoLanding;
  mudar: Mudar;
  organizacaoId: string | null;
}) {
  const img = e.conteudo.imagens;
  const mudarImagens = (parcial: Partial<ConteudoLanding["imagens"]>) =>
    mudar({ conteudo: { ...e.conteudo, imagens: { ...img, ...parcial } } });
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-muted p-3 text-caption text-muted-foreground">
        Sem fotos aqui, a página usa as capas dos seus eventos publicados. Envie JPG, PNG ou WebP; o
        painel reduz para até 1920 px no lado maior, então foto maior que isso não melhora nada.
      </p>
      <GrupoFotos
        titulo="Capa"
        dica={`Ideal: ${MEDIDAS[e.modelo].capa}`}
        caminhos={img.capa}
        limite={5}
        organizacaoId={organizacaoId}
        aoMudar={(capa) => mudarImagens({ capa })}
      />
      {(e.modelo === "editorial" || e.modelo === "classico") && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <label id="lp-capa-foco-rotulo" className="text-label-md text-foreground">
              Enquadramento da capa
            </label>
            <span className="text-caption tabular-nums text-muted-foreground">
              {e.conteudo.capa_foco}%
            </span>
          </div>
          <Slider
            aria-labelledby="lp-capa-foco-rotulo"
            min={0}
            max={100}
            step={5}
            value={[e.conteudo.capa_foco]}
            onValueChange={([v]) => mudar({ conteudo: { ...e.conteudo, capa_foco: v ?? 50 } })}
          />
          <p className="text-caption text-muted-foreground">
            A capa corta a foto em cima e embaixo. Arraste para a direita para mostrar a parte de
            baixo da foto (a pessoa sobe na tela) e para a esquerda para mostrar a parte de cima.
            Confira na prévia.
          </p>
        </div>
      )}
      <GrupoFotos
        titulo="Galeria de trabalhos"
        dica={`Mosaico, cartões de serviço e fundos das seções. Ideal: ${MEDIDAS[e.modelo].galeria}`}
        caminhos={img.galeria}
        limite={8}
        organizacaoId={organizacaoId}
        aoMudar={(galeria) => mudarImagens({ galeria })}
      />
      <GrupoFotos
        titulo="Foto do “sobre”"
        dica={`Retrato seu ou do estúdio. Ideal: ${MEDIDAS[e.modelo].sobre}`}
        caminhos={img.sobre ? [img.sobre] : []}
        limite={1}
        organizacaoId={organizacaoId}
        aoMudar={(lista) => mudarImagens({ sobre: lista[0] ?? "" })}
      />
    </div>
  );
}

/* ─────────────────────────────── Cores ─────────────────────────────── */

const ROTULO_COR: Record<keyof CoresLanding, { rotulo: string; dica: string }> = {
  fundo: { rotulo: "Fundo", dica: "Cor de fundo da página." },
  texto: { rotulo: "Texto", dica: "Títulos e parágrafos." },
  primaria: { rotulo: "Principal", dica: "Botões e faixas de destaque." },
  destaque: { rotulo: "Destaque", dica: "Etiquetas, cartões e detalhes." },
};

function CampoCor({
  chave,
  valor,
  aoMudar,
}: {
  chave: keyof CoresLanding;
  valor: string;
  aoMudar: (cor: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  if (ehHex(valor) && texto !== valor && ehHex(texto)) setTexto(valor);
  return (
    <Campo
      rotulo={ROTULO_COR[chave].rotulo}
      htmlFor={`lp-cor-${chave}`}
      dica={ROTULO_COR[chave].dica}
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${ROTULO_COR[chave].rotulo}: escolher no seletor`}
          value={valor}
          onChange={(ev) => {
            setTexto(ev.target.value.toLowerCase());
            aoMudar(ev.target.value.toLowerCase());
          }}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
        />
        <Input
          id={`lp-cor-${chave}`}
          maxLength={7}
          value={texto}
          onChange={(ev) => {
            const v = ev.target.value.trim().toLowerCase();
            setTexto(v);
            if (ehHex(v)) aoMudar(v);
          }}
        />
      </div>
    </Campo>
  );
}

export function AbaCores({
  e,
  mudar,
  loja,
}: {
  e: EdicaoLanding;
  mudar: Mudar;
  loja: ConfiguracoesLoja | null | undefined;
}) {
  const temMarca = Boolean(loja?.cor_primaria);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => mudar({ cores: INFO_MODELO[e.modelo].cores })}
        >
          <RotateCcw className="size-4" />
          Cores do modelo
        </Button>
        {temMarca && loja && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              mudar({
                cores: {
                  ...e.cores,
                  primaria: loja.cor_primaria,
                  destaque: loja.cor_secundaria || loja.cor_primaria,
                },
              })
            }
          >
            Usar cores da minha marca
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(ROTULO_COR) as (keyof CoresLanding)[]).map((k) => (
          <CampoCor
            key={k}
            chave={k}
            valor={e.cores[k]}
            aoMudar={(cor) => mudar({ cores: { ...e.cores, [k]: cor } })}
          />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────── Rastreamento ──────────────────────────── */

export function AbaRastreamento({
  e,
  mudar,
  temToken,
  token,
  aoMudarToken,
}: {
  e: EdicaoLanding;
  mudar: Mudar;
  temToken: boolean;
  /** Nulo = não mexer no token salvo. */
  token: string | null;
  aoMudarToken: (token: string | null) => void;
}) {
  const r = e.rastreamento;
  const campo = (chave: keyof RastreamentoLanding, maiusculas = false) => ({
    value: String(r[chave]),
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      mudar({
        rastreamento: {
          ...r,
          [chave]: maiusculas ? ev.target.value.toUpperCase() : ev.target.value,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-label-md text-foreground">Pixels e tags</h3>
        <Campo
          rotulo="Meta Pixel (ID)"
          htmlFor="lp-meta"
          dica="Só os números. Gerenciador de Eventos → Fontes de dados."
        >
          <Input
            id="lp-meta"
            inputMode="numeric"
            placeholder="123456789012345"
            {...campo("meta_pixel_id")}
          />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Google Analytics 4" htmlFor="lp-ga4">
            <Input id="lp-ga4" placeholder="G-XXXXXXXXXX" {...campo("ga4_id", true)} />
          </Campo>
          <Campo rotulo="Google Ads" htmlFor="lp-ads">
            <Input id="lp-ads" placeholder="AW-123456789" {...campo("google_ads_id", true)} />
          </Campo>
          <Campo rotulo="Google Tag Manager" htmlFor="lp-gtm">
            <Input id="lp-gtm" placeholder="GTM-XXXXXXX" {...campo("gtm_id", true)} />
          </Campo>
          <Campo rotulo="Pixel do TikTok" htmlFor="lp-tiktok">
            <Input
              id="lp-tiktok"
              placeholder="C1ABCDEF2GHIJK3LMN"
              {...campo("tiktok_pixel_id", true)}
            />
          </Campo>
        </div>
        <p className="text-caption text-muted-foreground">
          Eventos enviados: visita da página (PageView), clique no botão (Contact) e clique num
          evento da vitrine (ViewContent).
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-label-md text-foreground">API de Conversões da Meta</h3>
            <p className="text-caption text-muted-foreground">
              Envia os mesmos eventos pelo servidor (com IP e navegador do visitante), o que
              recupera conversões que o pixel perde com bloqueadores. A Meta junta os dois sem
              contar duas vezes.
            </p>
          </div>
          <Switch
            aria-label="Ativar API de Conversões"
            checked={r.meta_capi_ativa}
            onCheckedChange={(v) => mudar({ rastreamento: { ...r, meta_capi_ativa: v } })}
          />
        </div>
        {r.meta_capi_ativa && (
          <>
            <Campo
              rotulo="Token de acesso"
              htmlFor="lp-token"
              dica={
                temToken && token === null
                  ? "Já existe um token salvo. Digite outro para trocar."
                  : "Gerenciador de Eventos → Configurações → API de Conversões → Gerar token. Fica guardado só no banco."
              }
            >
              <div className="flex gap-2">
                <Input
                  id="lp-token"
                  type="password"
                  autoComplete="off"
                  placeholder={temToken ? "•••••••••• (salvo)" : "Cole o token aqui"}
                  value={token ?? ""}
                  onChange={(ev) => aoMudarToken(ev.target.value)}
                />
                {temToken && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="Apagar o token salvo"
                    onClick={() => aoMudarToken("")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </Campo>
            <Campo
              rotulo="Código de teste (opcional)"
              htmlFor="lp-teste"
              dica="Da aba Testar eventos, para conferir na Meta. Apague depois de testar."
            >
              <Input
                id="lp-teste"
                placeholder="TEST12345"
                {...campo("meta_test_event_code", true)}
              />
            </Campo>
            {!r.meta_pixel_id && (
              <p className="text-caption text-warning">Preencha o ID do Meta Pixel acima.</p>
            )}
          </>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-label-md text-foreground">Outras tags (código livre)</h3>
        <p className="text-caption text-muted-foreground">
          Cole o código exatamente como a plataforma entrega (Hotjar, Clarity, Pinterest,
          LinkedIn…). Ele roda na página como veio: use só código de fontes que você confia.
        </p>
        <Campo rotulo="No <head>" htmlFor="lp-head">
          <Textarea
            id="lp-head"
            rows={4}
            className="font-mono text-xs"
            placeholder="<script>…</script>"
            {...campo("codigo_head")}
          />
        </Campo>
        <Campo rotulo="No início do <body>" htmlFor="lp-body">
          <Textarea
            id="lp-body"
            rows={3}
            className="font-mono text-xs"
            placeholder="<noscript>…</noscript>"
            {...campo("codigo_body")}
          />
        </Campo>
      </section>
    </div>
  );
}
