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
