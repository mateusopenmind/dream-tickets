// Conversão de valores em moeda estrangeira para reais.
//
// Nas emissões internacionais (Iberia, AAdvantage, Flying Blue) as taxas,
// bagagens, assentos e outros são pagos em moeda estrangeira. O emissor informa
// a moeda e o valor; aqui buscamos a cotação do momento e aplicamos o spread
// cadastrado na moeda (Configurações > Moedas, default 8%).
//
// O valor final em R$ é o que fica gravado nas colunas que já existiam
// (taxas_cobrado, taxas_real, ...), então nenhum relatório muda. As colunas
// _moeda / _valor_moeda / _cotacao guardam o rastro para auditoria.

export type Cotacao = {
  moeda: string;
  base: number; // cotação de mercado, sem spread
  spread: number; // % aplicado
  efetiva: number; // base * (1 + spread/100) — é esta que multiplica o valor
  fonte: string;
  atualizadaEm: string | null;
};

const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// Fonte primária: AwesomeAPI (brasileira, cotação intraday, bate com o Google).
async function cotacaoAwesomeApi(codigo: string): Promise<{ base: number; atualizadaEm: string | null }> {
  const j = await getJson(`https://economia.awesomeapi.com.br/last/${codigo}-BRL`);
  const par = j?.[`${codigo}BRL`];
  const base = Number(par?.bid);
  if (!isFinite(base) || base <= 0) throw new Error("Cotação inválida na AwesomeAPI");
  return { base, atualizadaEm: par?.create_date ?? null };
}

// Fonte reserva: open.er-api.com (grátis, sem chave, atualiza 1x/dia).
async function cotacaoErApi(codigo: string): Promise<{ base: number; atualizadaEm: string | null }> {
  const j = await getJson(`https://open.er-api.com/v6/latest/${codigo}`);
  const base = Number(j?.rates?.BRL);
  if (!isFinite(base) || base <= 0) throw new Error("Cotação inválida na er-api");
  return { base, atualizadaEm: j?.time_last_update_utc ?? null };
}

export const arred = (n: number, casas: number) => {
  const f = Math.pow(10, casas);
  return Math.round((n + Number.EPSILON) * f) / f;
};

/**
 * Busca a cotação de `codigo` para BRL e aplica o spread.
 * Tenta a AwesomeAPI e, se ela falhar, cai na er-api.
 */
export async function buscarCotacao(codigo: string, spreadPercentual: number): Promise<Cotacao> {
  const moeda = (codigo || "").toUpperCase().trim();
  if (!moeda) throw new Error("Informe a moeda.");

  const spread = isFinite(Number(spreadPercentual)) ? Number(spreadPercentual) : 0;

  if (moeda === "BRL") {
    return { moeda, base: 1, spread: 0, efetiva: 1, fonte: "BRL", atualizadaEm: null };
  }

  let r: { base: number; atualizadaEm: string | null };
  let fonte = "AwesomeAPI";
  try {
    r = await cotacaoAwesomeApi(moeda);
  } catch {
    try {
      r = await cotacaoErApi(moeda);
      fonte = "exchangerate-api";
    } catch {
      throw new Error(`Não consegui buscar a cotação de ${moeda} agora. Informe o valor em reais manualmente.`);
    }
  }

  return {
    moeda,
    base: arred(r.base, 6),
    spread,
    efetiva: arred(r.base * (1 + spread / 100), 6),
    fonte,
    atualizadaEm: r.atualizadaEm,
  };
}

/** Converte um valor na moeda para reais usando a cotação efetiva (2 casas). */
export function converterParaReais(valorMoeda: number, cotacaoEfetiva: number): number {
  const v = Number(valorMoeda);
  const c = Number(cotacaoEfetiva);
  if (!isFinite(v) || !isFinite(c)) return 0;
  return arred(v * c, 2);
}
