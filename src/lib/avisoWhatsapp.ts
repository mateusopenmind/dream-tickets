// Lê a resposta do n8n (repassada pela edge function disparar-n8n em `n8n_resposta`)
// e diz se a mensagem de WhatsApp provavelmente NÃO chegou porque a janela de 24h
// do WhatsApp do usuário está fechada (ele não mandou mensagem para o número da
// DreamTickets nas últimas 24h). A informação vem do fluxo "WhatsApp Eventos Meta".
export const MSG_JANELA_FECHADA =
  'a janela de 24h do seu WhatsApp está fechada, então a mensagem não deve chegar. Mande um "oi" para o WhatsApp da DreamTickets e use Reenviar (em Reprocessamento).';

export function janelaFechada(data: any): boolean {
  const r = data?.n8n_resposta;
  return !!r && /"janela_fechada":true/.test(String(r));
}
