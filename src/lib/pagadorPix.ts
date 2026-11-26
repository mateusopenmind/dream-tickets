// Dados de quem pagou um Pix (gravados pela conciliação n8n + trigger do e2eid).
// Ver supabase/migrations/20261126120000_pix_dados_pagador.sql

/** CPF (11) ou CNPJ (14) formatado; qualquer outra coisa volta como veio. */
export function formatarDocumento(doc: string | null | undefined): string {
  const d = String(doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return String(doc ?? "");
}

export function tipoDocumento(doc: string | null | undefined): "CPF" | "CNPJ" | "" {
  const n = String(doc ?? "").replace(/\D/g, "").length;
  return n === 11 ? "CPF" : n === 14 ? "CNPJ" : "";
}

export interface PagadorPix {
  pagador_nome?: string | null;
  pagador_documento?: string | null;
  pagador_ispb?: string | null;
  pagador_instituicao?: string | null;
}

export const temPagador = (p: PagadorPix | null | undefined) =>
  !!(p && (p.pagador_nome || p.pagador_documento || p.pagador_instituicao));
