import { enviarEventoConversao } from "./serverFns";

/**
 * Pixels e tags da landing, instalados no navegador do visitante com o código
 * oficial de cada plataforma. Cada evento recebe um `eventID`; o mesmo vai para
 * a API de Conversões, e a Meta junta os dois (deduplicação).
 */

export interface ConfigRastreamento {
  meta_pixel_id: string;
  ga4_id: string;
  google_ads_id: string;
  gtm_id: string;
  tiktok_pixel_id: string;
  codigo_head: string;
  codigo_body: string;
  meta_capi: boolean;
}

export type EventoLanding = "PageView" | "ViewContent" | "Contact" | "Lead";

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;
interface Ttq {
  track: (
    evento: string,
    dados?: Record<string, unknown>,
    opcoes?: Record<string, unknown>,
  ) => void;
}
interface JanelaComPixels {
  fbq?: Fbq;
  gtag?: Gtag;
  dataLayer?: unknown[];
  ttq?: Ttq;
}

const janela = () => window as unknown as Window & JanelaComPixels;

function adicionarScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** Código livre do fotógrafo: HTML com `<script>` recriado para executar. */
function inserirCodigo(html: string, destino: HTMLElement) {
  if (!html.trim()) return;
  const modelo = document.createElement("template");
  modelo.innerHTML = html;
  for (const no of Array.from(modelo.content.childNodes)) {
    if (no instanceof HTMLScriptElement) {
      const s = document.createElement("script");
      for (const attr of Array.from(no.attributes)) s.setAttribute(attr.name, attr.value);
      s.text = no.text;
      destino.appendChild(s);
    } else {
      destino.appendChild(no.cloneNode(true));
    }
  }
}

/** Script em linha (código oficial de instalação das plataformas). */
function adicionarScriptEmLinha(codigo: string) {
  const s = document.createElement("script");
  s.text = codigo;
  document.head.appendChild(s);
}

// IDs validados no banco e no editor (só dígitos ou letras maiúsculas e
// números): entram no código de instalação sem risco de injeção.
function instalarMeta(id: string) {
  if (!/^[0-9]+$/.test(id) || janela().fbq) return;
  adicionarScriptEmLinha(
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');`,
  );
}

function instalarGtag(ids: string[]) {
  const w = janela();
  if (w.gtag || ids.length === 0) return;
  w.dataLayer = w.dataLayer ?? [];
  const gtag: Gtag = function () {
    // gtag exige o objeto `arguments`, não um array.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer?.push(arguments);
  };
  w.gtag = gtag;
  adicionarScript(`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`);
  gtag("js", new Date());
  for (const id of ids) gtag("config", id);
}

function instalarGtm(id: string) {
  const w = janela();
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  adicionarScript(`https://www.googletagmanager.com/gtm.js?id=${id}`);
}

function instalarTiktok(id: string) {
  if (!/^[A-Z0-9]+$/.test(id) || janela().ttq) return;
  adicionarScriptEmLinha(
    `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${id}');ttq.page();}(window,document,'ttq');`,
  );
}

let instalado = false;
let atual: { slug: string; config: ConfigRastreamento } | null = null;

export function instalarRastreamento(slug: string, config: ConfigRastreamento) {
  atual = { slug, config };
  if (instalado) return;
  instalado = true;
  if (config.meta_pixel_id) instalarMeta(config.meta_pixel_id);
  instalarGtag([config.ga4_id, config.google_ads_id].filter(Boolean));
  if (config.gtm_id) instalarGtm(config.gtm_id);
  if (config.tiktok_pixel_id) instalarTiktok(config.tiktok_pixel_id);
  inserirCodigo(config.codigo_head, document.head);
  inserirCodigo(config.codigo_body, document.body);
  rastrear("PageView");
}

function lerCookie(nome: string): string {
  const achado = document.cookie.split("; ").find((c) => c.startsWith(`${nome}=`));
  return achado ? decodeURIComponent(achado.slice(nome.length + 1)) : "";
}

/** `_fbc` vem do cookie ou, na primeira visita pelo anúncio, do `fbclid` da URL. */
function fbcAtual(): string {
  const cookie = lerCookie("_fbc");
  if (cookie) return cookie;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : "";
}

const EVENTO_GOOGLE: Record<EventoLanding, string> = {
  PageView: "page_view",
  ViewContent: "view_item",
  Contact: "contact",
  Lead: "generate_lead",
};

export function rastrear(evento: EventoLanding, dados: Record<string, unknown> = {}) {
  if (!atual) return;
  const { slug, config } = atual;
  const w = janela();
  const eventId = crypto.randomUUID();

  if (config.meta_pixel_id && w.fbq) w.fbq("track", evento, dados, { eventID: eventId });
  // O gtag já mede a visita sozinho no `config`.
  if (w.gtag && evento !== "PageView") w.gtag("event", EVENTO_GOOGLE[evento], dados);
  if (w.ttq && evento !== "PageView") {
    w.ttq.track(evento === "Lead" ? "SubmitForm" : evento, dados, { event_id: eventId });
  }
  w.dataLayer?.push({ event: `landing_${evento.toLowerCase()}`, ...dados });

  if (config.meta_capi) {
    void enviarEventoConversao({
      data: {
        slug,
        evento,
        eventId,
        url: window.location.href,
        fbp: lerCookie("_fbp"),
        fbc: fbcAtual(),
      },
    }).catch(() => undefined);
  }
}
