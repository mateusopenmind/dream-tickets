// Campos de ajuste que aparecem quando Valores Reais ≠ Valores Cobrados.
// Cada campo é liberado por programa, conforme a tabela do cliente.

export type AjusteKey = "cupom" | "hack_upgrade" | "retarifacao" | "taxa_resgate" | "desconto_promo" | "campo_aberto";

// Programas (em minúsculas) onde cada campo aparece. "campo_aberto" vale para todos.
const MAPA: Record<Exclude<AjusteKey, "campo_aberto">, string[]> = {
  cupom: ["smiles", "azul viagens"],
  hack_upgrade: ["smiles"],
  retarifacao: ["smiles", "latam", "azul liminar", "azul viagens", "interline", "iberia"],
  taxa_resgate: ["azul liminar"],
  desconto_promo: ["smiles", "latam"],
};

// Retorna true se o campo deve aparecer para o programa informado.
export function ajusteVisivel(key: AjusteKey, programa: string): boolean {
  if (key === "campo_aberto") return true; // todos os programas
  const p = (programa || "").toLowerCase().trim();
  return (MAPA[key] ?? []).includes(p);
}

// True quando Valores Reais diferem dos Cobrados em qualquer um dos campos (milhas, taxas, bagagens, assentos, outros).
// Taxas/Bagagens/Assentos têm tipo (R$ ou milhas) independente em cada lado — tipo diferente também conta como diferença.
export function reaisDiferemDosCobrados(form: {
  milhas_cobrado: number; taxas_cobrado: number; outros_cobrado: number;
  milhas_real: number; taxas_real: number; outros_real: number;
  bagagens_cobrado?: number; assentos_cobrado?: number;
  bagagens_real?: number; assentos_real?: number;
  taxas_tipo?: string; bagagens_tipo?: string; assentos_tipo?: string;
  taxas_real_tipo?: string; bagagens_real_tipo?: string; assentos_real_tipo?: string;
}): boolean {
  const t = (v?: string) => v || "reais";
  return (
    Number(form.milhas_cobrado) !== Number(form.milhas_real) ||
    Number(form.taxas_cobrado) !== Number(form.taxas_real) ||
    t(form.taxas_tipo) !== t(form.taxas_real_tipo) ||
    Number(form.bagagens_cobrado ?? 0) !== Number(form.bagagens_real ?? 0) ||
    t(form.bagagens_tipo) !== t(form.bagagens_real_tipo) ||
    Number(form.assentos_cobrado ?? 0) !== Number(form.assentos_real ?? 0) ||
    t(form.assentos_tipo) !== t(form.assentos_real_tipo) ||
    Number(form.outros_cobrado) !== Number(form.outros_real)
  );
}

// True se ao menos um campo de ajuste foi preenchido (para a validação "pelo menos um").
export function temAlgumAjuste(form: {
  ajuste_cupom?: any; ajuste_hack_upgrade?: boolean; ajuste_retarifacao?: boolean;
  ajuste_taxa_resgate?: boolean; ajuste_desconto_promo?: boolean; ajuste_campo_aberto?: string;
}): boolean {
  const cupom = form.ajuste_cupom;
  const cupomOk = cupom !== "" && cupom != null && Number(cupom) > 0;
  return (
    cupomOk ||
    !!form.ajuste_hack_upgrade ||
    !!form.ajuste_retarifacao ||
    !!form.ajuste_taxa_resgate ||
    !!form.ajuste_desconto_promo ||
    !!(form.ajuste_campo_aberto && String(form.ajuste_campo_aberto).trim())
  );
}
