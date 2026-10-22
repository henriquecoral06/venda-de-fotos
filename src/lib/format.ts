export const TZ = "America/Sao_Paulo";
/** Offset fixo de São Paulo (sem horário de verão desde 2019). */
export const TZ_OFFSET = "-03:00";

export function brl(value: number | null | undefined, digits = 2): string {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function num(value: number | null | undefined, digits = 0): string {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(value: number | null | undefined, digits = 2): string {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${num(v * 100, digits)}%`;
}

export function ratio(value: number | null | undefined, digits = 2): string {
  return `${num(value ?? 0, digits)}x`;
}

/** Converte "2026-09-16" ou ISO para dd/mm/aaaa no fuso de São Paulo. */
export function dataBR(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00Z`)
      : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function dataHoraBR(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
}

/** dd/mm curto, para eixos de gráfico. */
export function diaMes(value: string): string {
  const [, m, d] = value.split("-");
  return `${d}/${m}`;
}

/**
 * Telefone digitado pela pessoa: só dígitos, com DDI 55 quando faltar
 * (10 ou 11 dígitos = DDD + número brasileiro).
 */
export function normalizarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (digitos === "") return "";
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

/**
 * Máscara de telefone brasileiro enquanto a pessoa digita: (11) 3456-7890 ou
 * (11) 98765-4321. Os separadores só entram quando já há dígito depois deles,
 * para o backspace não travar num parêntese ou hífen. Um +55 colado sai.
 */
export function mascararTelefone(valor: string): string {
  let d = valor.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  if (resto.length <= corte) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Máscara de CPF enquanto a pessoa digita: 123.456.789-09. */
export function mascararCpf(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}
