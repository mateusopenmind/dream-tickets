// Campos de ajuste que aparecem quando Valores Reais ≠ Valores Cobrados.
//
// Quais campos aparecem em cada programa NÃO fica mais aqui: virou flag no cadastro
// (Configurações > Programas > aba Regras). Use `useRegras`/`regraAtiva` de
// "@/lib/regrasPrograma" com as chaves ajuste_cupom, ajuste_hack_upgrade,
// ajuste_retarifacao, ajuste_taxa_resgate, ajuste_desconto_promo e ajuste_campo_aberto.

// Explicações do "?" ao lado do campo Conta, nas duas telas de emissão própria.
export const DICA_CONTA =
  "Deixe esse campo vazio quando emitir com milhas de outro Programa (Retarifação).";

export const DICA_CONTA_RETARIFADA =
  "Retarifação marcada: a conta é escolhida mais abaixo, junto com o Programa Emitido.";

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
  // "moeda" já é um valor em reais (o câmbio é aplicado no próprio campo), então
  // conta como "reais" aqui. Cobrar em euro e registrar o custo real em reais não
  // é, por si só, uma diferença que precise de justificativa — só o valor importa.
  const t = (v?: string) => (v === "milhas" ? "milhas" : "reais");
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
  ajuste_retarifacao_outro_programa?: boolean;
  ajuste_taxa_resgate?: boolean; ajuste_desconto_promo?: boolean; ajuste_campo_aberto?: string;
}): boolean {
  const cupom = form.ajuste_cupom;
  const cupomOk = cupom !== "" && cupom != null && Number(cupom) > 0;
  return (
    cupomOk ||
    !!form.ajuste_hack_upgrade ||
    !!form.ajuste_retarifacao ||
    !!form.ajuste_retarifacao_outro_programa ||
    !!form.ajuste_taxa_resgate ||
    !!form.ajuste_desconto_promo ||
    !!(form.ajuste_campo_aberto && String(form.ajuste_campo_aberto).trim())
  );
}
