/**
 * Erros do Supabase Auth (e do trigger de cadastro) em português, com o que a
 * pessoa pode fazer. Prioriza o `code` (estável) e cai para a mensagem quando
 * ele não vem. Nunca devolve a mensagem crua em inglês.
 */

const CADASTRO_FECHADO = "Cadastro fechado. Peça ao responsável para liberar.";
const MUITAS_TENTATIVAS = "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";

const POR_CODIGO: Record<string, string> = {
  weak_password:
    "Senha fraca ou já vazada em outros sites. Use pelo menos 8 caracteres, misturando letras e números.",
  user_already_exists: 'Este e-mail já tem conta. Entre (ou use "Esqueceu a senha?").',
  email_exists: 'Este e-mail já tem conta. Entre (ou use "Esqueceu a senha?").',
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar. O link foi enviado no cadastro.",
  over_email_send_rate_limit: MUITAS_TENTATIVAS,
  over_request_rate_limit: MUITAS_TENTATIVAS,
  email_address_invalid: "E-mail inválido. Confira se digitou corretamente.",
  validation_failed: "E-mail inválido. Confira se digitou corretamente.",
  same_password: "A nova senha precisa ser diferente da atual.",
  session_expired: "Sua sessão expirou. Entre de novo.",
  session_not_found: "Sua sessão expirou. Entre de novo.",
  otp_expired: "Este link expirou. Peça outro na tela de login.",
  signup_disabled: "Cadastro desativado neste projeto. Fale com o responsável.",
  email_provider_disabled: "Cadastro desativado neste projeto. Fale com o responsável.",
};

const POR_MENSAGEM: Array<[RegExp, string]> = [
  // O trigger `handle_new_user` recusa a conta com o cadastro fechado; o Auth
  // costuma devolver só o erro genérico de banco.
  [/cadastro fechado|database error saving new user/i, CADASTRO_FECHADO],
  [/signups? not allowed|signup.*disabled/i, POR_CODIGO["signup_disabled"]!],
  [/invalid login credentials/i, POR_CODIGO["invalid_credentials"]!],
  [/email not confirmed/i, POR_CODIGO["email_not_confirmed"]!],
  [/weak|pwned|easy to guess/i, POR_CODIGO["weak_password"]!],
  [/already registered|already exists/i, POR_CODIGO["user_already_exists"]!],
  [/rate limit|too many/i, MUITAS_TENTATIVAS],
  [/invalid.*email|unable to validate email/i, POR_CODIGO["validation_failed"]!],
  [/different from the old password/i, POR_CODIGO["same_password"]!],
  [/expired|invalid.*(token|link)/i, POR_CODIGO["otp_expired"]!],
  [/auth session missing/i, POR_CODIGO["session_expired"]!],
  [/network|failed to fetch/i, "Falha de conexão. Verifique sua internet e tente de novo."],
];

interface ErroAuth {
  message: string;
  code?: string | undefined;
}

export function traduzirErroAuth(erro: unknown): string {
  if (!erro || typeof erro !== "object" || !("message" in erro)) {
    return "Não foi possível concluir. Tente de novo em instantes.";
  }
  const { message, code } = erro as ErroAuth;
  const tamanho = /password should be at least (\d+)/i.exec(message)?.[1];
  if (tamanho) return `A senha precisa ter pelo menos ${tamanho} caracteres.`;
  // A mensagem do trigger vem antes do código: o Auth a devolve como erro genérico.
  if (/cadastro fechado|database error saving new user/i.test(message)) return CADASTRO_FECHADO;
  const porCodigo = code ? POR_CODIGO[code] : undefined;
  if (porCodigo) return porCodigo;
  for (const [padrao, texto] of POR_MENSAGEM) {
    if (padrao.test(message)) return texto;
  }
  return "Não foi possível concluir. Tente de novo em instantes.";
}

/**
 * Pedido de magic link para e-mail sem conta (`shouldCreateUser: false`): o
 * Auth recusa com "Signups not allowed for otp". A tela trata como envio
 * normal, para não revelar quais e-mails têm conta.
 */
export function ehContaInexistenteNoOtp(erro: ErroAuth): boolean {
  return (
    erro.code === "otp_disabled" ||
    erro.code === "user_not_found" ||
    /signups? not allowed for otp|user not found/i.test(erro.message)
  );
}

/** Limite de envio: o único erro que vale mostrar num pedido de link por e-mail. */
export function ehLimiteDeEnvio(erro: ErroAuth): boolean {
  return (
    erro.code === "over_email_send_rate_limit" ||
    erro.code === "over_request_rate_limit" ||
    /rate limit|too many/i.test(erro.message)
  );
}
