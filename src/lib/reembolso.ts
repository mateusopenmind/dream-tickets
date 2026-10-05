// Rótulos de Reembolso — centraliza o nome do tipo e o sufixo "(X de Y Pax)".
// X = pax reembolsados neste reembolso (pax_qtd); Y = total de pax da emissão (pax_total).
// O sufixo só aparece quando X < Y (reembolso de parte dos pax). Quando é o total dos
// pax (X = Y), mostra só o nome do tipo.

export function nomeTipoReembolso(tipo?: string | null): string {
  switch (tipo) {
    case "total": return "Total";
    case "taxas": return "Taxas";
    case "parcial_trecho": return "Parcial 1 Trecho";
    case "parcial": return "Parcial";
    default: return tipo ?? "—";
  }
}

// Sufixo " (X de Y Pax)" — string vazia quando não se aplica (total dos pax ou dados ausentes).
export function sufixoPax(paxReemb?: number | null, paxTotal?: number | null): string {
  const x = Number(paxReemb) || 0;
  const y = Number(paxTotal) || 0;
  return y > 0 && x > 0 && x < y ? ` (${x} de ${y} Pax)` : "";
}

// Nome do tipo + sufixo de pax. Ex.: "Parcial (1 de 2 Pax)" ou "Total".
// trecho (opcional, só p/ parcial_trecho): "Parcial 1 Trecho Ida (1 de 3 Pax)".
export function rotuloReembolso(tipo?: string | null, paxReemb?: number | null, paxTotal?: number | null, trecho?: string | null): string {
  const t = tipo === "parcial_trecho" && trecho ? ` ${trecho.charAt(0).toUpperCase()}${trecho.slice(1)}` : "";
  return nomeTipoReembolso(tipo) + t + sufixoPax(paxReemb, paxTotal);
}
