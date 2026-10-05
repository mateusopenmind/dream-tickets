// Regras de telefone brasileiro usadas em todo o sistema (Clientes, Contas, Usuários).
// Número local = o que vem depois do DDD.
//  - Começa com 6, 7, 8 ou 9 → celular: máscara de 9 dígitos (5+4).
//  - Começa com 6 → OBRIGATÓRIO ter 9 dígitos (não salva com 8).

/** Número local começa como celular (máscara 9XXXX-XXXX). */
export const ehCelularBR = (local: string) => /^[6789]/.test(local);

/** Primeiros dígitos que obrigam o número local a ter exatamente 9 dígitos. */
export const INICIOS_OBRIGA_9_DIGITOS = ["6"];

/**
 * Valida um telefone brasileiro. Aceita qualquer formato (com ou sem máscara, com ou sem 55).
 * comDDI = true quando o valor é guardado com o 55 na frente (WhatsApp dos Usuários).
 * Devolve a mensagem de erro, ou null se estiver ok (vazio também é ok — obrigatoriedade é de cada tela).
 */
export function erroTelefoneBR(valor: string | null | undefined, comDDI = false, rotulo = "Telefone"): string | null {
  let d = String(valor ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (comDDI && d.startsWith("55") && d.length >= 12) d = d.slice(2);
  const local = d.slice(2);
  const inicio = local.charAt(0);
  if (INICIOS_OBRIGA_9_DIGITOS.includes(inicio) && local.length !== 9) {
    return `${rotulo}: número que começa com ${inicio} precisa ter 9 dígitos depois do DDD (tem ${local.length}).`;
  }
  return null;
}
