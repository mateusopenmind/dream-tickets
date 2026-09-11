// Validação genérica de campo de data (YYYY-MM-DD).
// Regra do sistema: qualquer data é aceita, só não pode ano absurdo — erro de digitação
// do tipo 0202 ou 9999. Limites mais apertados (data do voo, vencimento etc.) continuam
// sendo tratados por cada tela.

export const ANO_MIN = 1900;
export const ANO_MAX = 2100;
export const DATA_MIN = `${ANO_MIN}-01-01`;
export const DATA_MAX = `${ANO_MAX}-12-31`;

// Retorna null quando OK, ou a mensagem de erro.
export function vData(iso: string | null | undefined, rotulo = "data"): string | null {
  if (!iso) return null; // obrigatoriedade é cobrada no submit de cada tela
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return `Informe uma ${rotulo} válida.`;
  const ano = Number(m[1]);
  if (ano < ANO_MIN || ano > ANO_MAX) return `Ano inválido na ${rotulo} — use um ano entre ${ANO_MIN} e ${ANO_MAX}.`;
  const [y, mes, d] = iso.split("-").map(Number);
  const dt = new Date(y, mes - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mes - 1 || dt.getDate() !== d) return `Informe uma ${rotulo} válida.`;
  return null;
}
