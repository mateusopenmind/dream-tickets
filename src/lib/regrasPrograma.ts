// Regras de emissão configuráveis por Programa.
//
// Antes essas regras estavam escritas no código (ex.: `programa === "latam"`).
// Agora cada uma é uma coluna booleana em `programas` (regra_*), ligada/desligada
// em Configurações > Programas > aba "Regras".
//
// Para criar uma regra nova: adicionar a coluna regra_<key> em `programas`,
// incluir a entrada aqui e usar `regraAtiva()` no formulário.

import { useMemo } from "react";
import { useProgramas } from "@/hooks/useData";

export type RegraKey =
  | "cpfs_otimizados"
  | "codigo_la"
  | "percentual_cb"
  | "facial"
  | "ajuste_cupom"
  | "ajuste_hack_upgrade"
  | "ajuste_retarifacao"
  | "ajuste_retarifacao_outro_programa"
  | "ajuste_taxa_resgate"
  | "ajuste_desconto_promo"
  | "ajuste_campo_aberto"
  | "taxa_queima_cpf"
  | "aceita_reais"
  | "milhas_fracionadas";

export type GrupoRegra = "Campos da Emissão" | "Ajustes (Valores Reais ≠ Cobrados)" | "Outros";

export type RegraDef = {
  key: RegraKey;
  coluna: `regra_${RegraKey}`;
  titulo: string;
  descricao: string;
  grupo: GrupoRegra;
};

// Catálogo único das regras — a aba "Regras" do cadastro é montada a partir daqui.
export const REGRAS: RegraDef[] = [
  {
    key: "cpfs_otimizados",
    coluna: "regra_cpfs_otimizados",
    titulo: "CPFs Otimizados",
    descricao: "Mostra o campo CPFs Otimizados na emissão. Quando preenchido, tem que ser entre 1 e o Nº de Pax.",
    grupo: "Campos da Emissão",
  },
  {
    key: "codigo_la",
    coluna: "regra_codigo_la",
    titulo: "Código LA",
    descricao: "Mostra o campo Código LA e torna ele obrigatório: precisa começar com \"LA\" e ter 13 caracteres.",
    grupo: "Campos da Emissão",
  },
  {
    key: "percentual_cb",
    coluna: "regra_percentual_cb",
    titulo: "% Cashback",
    descricao: "Mostra o campo de percentual de cashback da emissão.",
    grupo: "Campos da Emissão",
  },
  {
    key: "facial",
    coluna: "regra_facial",
    titulo: "Pagar facial?",
    descricao: "Mostra o Sim/Não de biometria facial. As emissões marcadas como Sim aparecem na tela Pagamento Facial.",
    grupo: "Campos da Emissão",
  },
  {
    key: "ajuste_cupom",
    coluna: "regra_ajuste_cupom",
    titulo: "Ajuste: Cupom (%)",
    descricao: "Libera o campo Cupom (%) no bloco de Ajustes, que só aparece quando os Valores Reais diferem dos Cobrados.",
    grupo: "Ajustes (Valores Reais ≠ Cobrados)",
  },
  {
    key: "ajuste_hack_upgrade",
    coluna: "regra_ajuste_hack_upgrade",
    titulo: "Ajuste: Hack Upgrade",
    descricao: "Libera o checkbox Hack Upgrade como justificativa da diferença entre Reais e Cobrados.",
    grupo: "Ajustes (Valores Reais ≠ Cobrados)",
  },
  {
    key: "ajuste_retarifacao",
    coluna: "regra_ajuste_retarifacao",
    titulo: "Ajuste: Retarifação",
    descricao: "Libera o checkbox Retarifação como justificativa da diferença entre Reais e Cobrados. É só a marcação, sem campo nenhum — a emissão continua no mesmo programa e na mesma conta.",
    grupo: "Ajustes (Valores Reais ≠ Cobrados)",
  },
  {
    key: "ajuste_retarifacao_outro_programa",
    coluna: "regra_ajuste_retarifacao_outro_programa",
    titulo: "Ajuste: Retarifação (Outro Programa)",
    descricao: "Libera o checkbox Retarifação (Outro Programa), para quando a emissão saiu em outra companhia. Ao marcar, abre 'Programa Emitido' e 'Conta' (obrigatórios), a Conta do cabeçalho deixa de ser pedida e a baixa de estoque vai para esse par.",
    grupo: "Ajustes (Valores Reais ≠ Cobrados)",
  },
  {
    key: "ajuste_taxa_resgate",
    coluna: "regra_ajuste_taxa_resgate",
    titulo: "Ajuste: Taxa de Resgate",
    descricao: "Libera o checkbox Taxa de Resgate como justificativa da diferença entre Reais e Cobrados.",
    grupo: "Ajustes (Valores Reais ≠ Cobrados)",
  },
  {
    key: "ajuste_desconto_promo",
    coluna: "regra_ajuste_desconto_promo",
    titulo: "Ajuste: Desconto Promocional",
    descricao: "Libera o checkbox Desconto Promocional como justificativa da diferença entre Reais e Cobrados.",
    grupo: "Ajustes (Valores Reais ≠ Cobrados)",
  },
  {
    key: "ajuste_campo_aberto",
    coluna: "regra_ajuste_campo_aberto",
    titulo: "Ajuste: Campo Aberto",
    descricao: "Libera o texto livre para justificar a diferença. Desligar deixa o emissor sem saída quando nenhum outro ajuste estiver ligado — mantenha ligado.",
    grupo: "Ajustes (Valores Reais ≠ Cobrados)",
  },
  {
    key: "taxa_queima_cpf",
    coluna: "regra_taxa_queima_cpf",
    titulo: "Taxa de Queima de CPF",
    descricao: "Marca que este programa cobra queima de CPF. O valor por passageiro é cadastrado em Configurações > Taxa Queima CPF e entra no cálculo do reembolso.",
    grupo: "Outros",
  },
  {
    key: "aceita_reais",
    coluna: "regra_aceita_reais",
    titulo: "Aceita valores em reais",
    descricao:
      "Ligado (padrão): Taxas, Bagagens, Assentos e Outros podem ser lançados em R$. Desligue nos programas que NUNCA são pagos em reais (Iberia, Flying Blue) — aí o botão R$ some da emissão e o campo já abre em moeda estrangeira. Só tem efeito em programa com moedas cadastradas na aba \"Moedas\"; sem elas o emissor ficaria sem opção nenhuma, então o R$ continua.",
    grupo: "Campos da Emissão",
  },
  {
    key: "milhas_fracionadas",
    coluna: "regra_milhas_fracionadas",
    titulo: "Milhas abaixo de 1.000",
    descricao:
      "Desligado (padrão): a Qtde Milhas da emissão tem que ser 0 ou no mínimo 1.000. Ligue nos programas que emitem com poucas milhas (Azul Liminar) — aí o mínimo cai para 100 (0 continua valendo).",
    grupo: "Campos da Emissão",
  },
];

// Piso da Qtde Milhas na emissão. Com a regra ligada cai de 1.000 para 100.
export const MILHAS_MIN_PADRAO = 1000;
export const MILHAS_MIN_FRACIONADO = 100;

export const REGRAS_POR_GRUPO: { grupo: GrupoRegra; regras: RegraDef[] }[] = [
  "Campos da Emissão",
  "Ajustes (Valores Reais ≠ Cobrados)",
  "Outros",
].map((g) => ({ grupo: g as GrupoRegra, regras: REGRAS.filter((r) => r.grupo === g) }));

// Lê a flag direto de um registro de `programas` (aceita undefined).
export function regraDoPrograma(programa: any, key: RegraKey): boolean {
  if (!programa) return false;
  return programa[`regra_${key}`] === true;
}

// Localiza o programa pelo nome (é o que os formulários guardam em form.programa).
export function regraAtiva(programas: any[] | undefined, nomePrograma: string, key: RegraKey): boolean {
  const p = (programas ?? []).find((x: any) => x?.nome === nomePrograma);
  return regraDoPrograma(p, key);
}

// Açúcar para os formulários: const regra = useRegras(form.programa); regra("codigo_la")
export function useRegras(nomePrograma: string) {
  const { data: programas } = useProgramas();
  return useMemo(() => {
    const p = (programas ?? []).find((x: any) => x?.nome === nomePrograma);
    return (key: RegraKey) => regraDoPrograma(p, key);
  }, [programas, nomePrograma]);
}
