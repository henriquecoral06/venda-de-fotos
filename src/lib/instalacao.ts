import { supabase } from "@/integrations/supabase/client";

/**
 * Chama `garantir_instalacao()` (migration `auto_reparo_remix`): recria o
 * trigger de cadastro, cria perfil e vínculo de contas que nasceram sem ele e
 * refaz os privilégios do banco. Devolve true se consertou algo.
 * Falha nunca bloqueia a tela: sem a função (migrations antigas) ou sem rede,
 * devolve false.
 */
export async function garantirInstalacao(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("garantir_instalacao");
    return !error && data === true;
  } catch {
    return false;
  }
}

const DEZ_MINUTOS = 10 * 60 * 1000;
const LIMITE_ESPERA = 2500;
let ultimaConferencia = 0;
let emAndamento: Promise<void> | null = null;

/**
 * Versão para a tela de entrada: no máximo uma chamada a cada 10 minutos por
 * instância (isolate do servidor ou aba do navegador), e nunca segura a tela
 * por mais de 2,5 s.
 */
export function conferirInstalacao(): Promise<void> {
  if (Date.now() - ultimaConferencia < DEZ_MINUTOS) return Promise.resolve();
  if (!emAndamento) {
    ultimaConferencia = Date.now();
    emAndamento = garantirInstalacao()
      .then(() => undefined)
      .finally(() => {
        emAndamento = null;
      });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const espera = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, LIMITE_ESPERA);
  });
  return Promise.race([emAndamento, espera]).finally(() => clearTimeout(timer));
}
