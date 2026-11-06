// Dashboard de Faturamento — regras de cálculo e agregações.
//
// Reproduz o dashboard montado pelo cliente (BI/Handoff_Dev/Dashboard_Faturamento.html).
// Toda a lógica de negócio vive aqui, em funções puras, para poder ser conferida contra
// o HTML de referência sem depender da tela.
//
// Regras fixas (definidas pelo dono — não mudar sem consultar):
//  R1  "emissões" conta SOMENTE registros com nome_operacao == "Emissão".
//      Pós-vendas (Remarcação, Queima CPFs, Assento, Bagagem, Taxa Reembolso, Upgrade)
//      entram no faturamento mas NÃO contam como emissão.
//  R2  PAX segue a mesma regra de R1.
//  R3  Faturamento = Σ total de TODOS os registros (inclusive pós-vendas e canceladas).
//  R4  Preço médio do milheiro é SEMPRE ponderado por milhas, nunca média simples.
//  R5  Faixas classificam por milhas ÷ pax, só em linhas Emissão com pax > 0.
//  R6  Semana ISO (segunda a domingo).

export const OPERACAO_EMISSAO = "Emissão";

export interface RegistroDash {
  data: string;            // data_emissao (yyyy-mm-dd)
  hora: string | null;
  programa: string;
  operacao: string;        // nome_operacao
  emissor: string;
  cliente: string;         // código da agência
  pax: number;
  milhas: number;
  preco_milheiro: number;
  taxas: number;
  outros: number;          // outros + bagagens + assentos (tudo em R$)
  total: number;           // preco_total
  status: string;          // status_pix
  origem: "propria" | "terceirizada";
  id_emissao: string;
}

export const ehEmissao = (r: RegistroDash) => r.operacao === OPERACAO_EMISSAO;

/* ---------------------------------------------------------------- formatação */

export const fmtBRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const fmtBRL2 = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (v: number) => (v || 0).toLocaleString("pt-BR");
export const fmtMilhas = (v: number) =>
  v >= 1e6 ? (v / 1e6).toFixed(2).replace(".", ",") + "M" : v >= 1e3 ? Math.round(v / 1e3) + "K" : fmtNum(v);
export const fmtMilK = (v: number) => Math.round((v || 0) / 1000).toLocaleString("pt-BR") + "K";
export const fmtPct1 = (v: number) => (v || 0).toFixed(1).replace(".", ",") + "%";
export const fmtDataBR = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
/** "2026-03" -> "Mar/26" */
export const mesLabel = (m: string) => {
  const [y, mm] = m.split("-");
  return `${MESES_ABREV[Number(mm) - 1] ?? mm}/${(y ?? "").slice(2)}`;
};

/* -------------------------------------------------------------------- cores */

// Cores da marca de cada programa. Lista aberta: quem não estiver aqui cai na paleta.
export const PROG_CORES: Record<string, string> = {
  Latam: "#E2231A",
  Smiles: "#FF8000",
  Interline: "#1F4E78",
  American: "#0078D2",
  "Azul Viagens": "#0071CE",
  "Azul Liminar": "#5B9BD5",
  Iberia: "#D4AF37",
  "All Accor": "#7030A0",
  Qatar: "#5C0F2B",
  TAP: "#1B3A6B",
  "Air Canada": "#D8262C",
};
export const PALETA = ["#1F4E78", "#2E75B6", "#D4AF37", "#70AD47", "#ED7D31", "#7030A0", "#C00000", "#5B9BD5", "#A5A5A5"];
export const CORES_MES = ["#1F4E78", "#2E75B6", "#D4AF37", "#70AD47", "#ED7D31", "#7030A0", "#C00000", "#5B9BD5"];
export const CORES_CLIENTE = [
  "#1F4E78", "#2E75B6", "#D4AF37", "#70AD47", "#ED7D31", "#7030A0", "#C00000", "#5B9BD5",
  "#A5A5A5", "#264478", "#9E480E", "#636363", "#997300", "#43682B", "#255E91",
];
export const corPrograma = (p: string, i = 0) => PROG_CORES[p] ?? PALETA[i % PALETA.length];

// Barra colorida na borda esquerda dos cards de indicador (mesmas cores do dashboard
// de referência: azul escuro padrão, azul, dourado, verde, âmbar e vermelho).
export const ACENTO = {
  padrao: "#1F4E78",
  azul: "#3B82F6",
  dourado: "#D4AF37",
  verde: "#10B981",
  ambar: "#F59E0B",
  vermelho: "#EF4444",
} as const;

/** Acento do card de cada mês, por índice do mês (0 = janeiro). */
export const ACENTO_MES = [
  ACENTO.padrao, ACENTO.azul, ACENTO.dourado, ACENTO.verde, ACENTO.ambar, ACENTO.vermelho,
  ACENTO.padrao, ACENTO.azul, ACENTO.dourado, ACENTO.verde, ACENTO.ambar, ACENTO.vermelho,
];
export const acentoDoMes = (mes: string) => ACENTO_MES[(Number(mes.slice(5, 7)) || 1) - 1];

/** Mistura branco → cor base conforme a intensidade (0..1). Usado nas escalas de calor. */
export function escalaCor(intensidade: number, base: [number, number, number]) {
  const i = Math.max(0, Math.min(1, intensidade || 0));
  const c = base.map((b) => Math.round(255 - (255 - b) * i));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
/** Contraste do texto sobre a célula colorida. */
export function corTexto(intensidade: number) {
  if (intensidade >= 0.5) return "#FFFFFF";
  if (intensidade >= 0.25) return "#1F2937";
  return "#374151";
}
export const RGB_VERDE: [number, number, number] = [56, 118, 29];
export const RGB_SMILES: [number, number, number] = [237, 125, 49];
export const RGB_LATAM: [number, number, number] = [226, 35, 26];

/* ------------------------------------------------------- faixas (regra R5) */

export interface Faixa {
  programa: string;
  cor: string;
  rgb: [number, number, number];
  ordem: string[];
  classificar: (milhas: number, pax: number) => string;
}

export const FAIXAS: Faixa[] = [
  {
    programa: "Smiles",
    cor: "#FF8000",
    rgb: RGB_SMILES,
    ordem: ["100K+ por PAX", "75-99K por PAX", "50-74K por PAX", "25-49K por PAX", "até 24K por PAX"],
    classificar: (milhas, pax) => {
      const pp = pax > 0 ? milhas / pax : 0;
      if (pp >= 100000) return "100K+ por PAX";
      if (pp >= 75000) return "75-99K por PAX";
      if (pp >= 50000) return "50-74K por PAX";
      if (pp >= 25000) return "25-49K por PAX";
      return "até 24K por PAX";
    },
  },
  {
    programa: "Latam",
    cor: "#E2231A",
    rgb: RGB_LATAM,
    ordem: ["100K+ por PAX", "75-99K por PAX", "50-74K por PAX", "25-49K por PAX", "18-24K por PAX", "até 17K por PAX"],
    classificar: (milhas, pax) => {
      const pp = pax > 0 ? milhas / pax : 0;
      if (pp >= 100000) return "100K+ por PAX";
      if (pp >= 75000) return "75-99K por PAX";
      if (pp >= 50000) return "50-74K por PAX";
      if (pp >= 25000) return "25-49K por PAX";
      if (pp >= 18000) return "18-24K por PAX";
      return "até 17K por PAX";
    },
  },
];

/* ------------------------------------------------------ datas / semana ISO */

/** Segunda-feira da semana ISO da data (yyyy-mm-dd), em UTC. */
export function isoSegunda(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}
export const somaDias = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Índice 0=Segunda … 6=Domingo. */
export const indiceDow = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7;
export const DOW_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const DOW_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/* ------------------------------------------------------------- agregações */

export interface ResumoDash {
  registros: number;
  faturamento: number;
  emissoes: number;
  milhas: number;
  pax: number;
  ticket: number;
  pago: number;
  aberto: number;
  cancelado: number;
  milheiroMedio: number;
  taxas: number;
  vendaMilhas: number;
  taxasOutros: number;
  fatPorPax: number;
  milhasPorPax: number;
  milhasPorEmissao: number;
}

export function resumo(rows: RegistroDash[]): ResumoDash {
  let faturamento = 0, milhas = 0, taxas = 0, pago = 0, aberto = 0, cancelado = 0;
  let emissoes = 0, pax = 0, vendaMilhas = 0;
  for (const r of rows) {
    faturamento += r.total || 0;
    milhas += r.milhas || 0;
    taxas += r.taxas || 0;
    vendaMilhas += ((r.milhas || 0) * (r.preco_milheiro || 0)) / 1000;
    if (r.status === "PAGO") pago += r.total || 0;
    else if (r.status === "EM ABERTO") aberto += r.total || 0;
    else if (r.status === "CANCELADO" || r.status === "CANCELADA") cancelado += r.total || 0;
    if (ehEmissao(r)) {
      emissoes++;
      pax += r.pax || 0;
    }
  }
  return {
    registros: rows.length,
    faturamento,
    emissoes,
    milhas,
    pax,
    ticket: emissoes > 0 ? faturamento / emissoes : 0,
    pago,
    aberto,
    cancelado,
    // R4 — ponderado por milhas, na forma escrita na spec:
    // Σ(milhas × preco_milheiro ÷ 1000) ÷ Σ milhas × 1000.
    // O HTML de referência calculava o numerador como Σ(total − taxas − outros), que dá o
    // mesmo número quando o total fecha com a fórmula. No banco há 35 emissões antigas
    // (import de julho/2026) em que não fecha, e nelas aquela forma distorce o resultado —
    // por isso aqui usamos milhas × milheiro, que é imune a isso e é a mesma conta do
    // Relatório de Emissões.
    milheiroMedio: milhas > 0 ? (vendaMilhas / milhas) * 1000 : 0,
    taxas,
    vendaMilhas,
    taxasOutros: faturamento - vendaMilhas,
    fatPorPax: pax > 0 ? faturamento / pax : 0,
    milhasPorPax: pax > 0 ? milhas / pax : 0,
    milhasPorEmissao: emissoes > 0 ? milhas / emissoes : 0,
  };
}

export const mesesDe = (rows: RegistroDash[]) =>
  [...new Set(rows.map((r) => (r.data || "").slice(0, 7)).filter(Boolean))].sort();

export const valoresDe = (rows: RegistroDash[], campo: keyof RegistroDash) =>
  [...new Set(rows.map((r) => String(r[campo] ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

export interface ResumoMes {
  mes: string;
  faturamento: number;
  emissoes: number;
  milhas: number;
  ticket: number;
}

export function porMes(rows: RegistroDash[]): ResumoMes[] {
  const map = new Map<string, ResumoMes>();
  for (const r of rows) {
    const m = (r.data || "").slice(0, 7);
    if (!m) continue;
    let e = map.get(m);
    if (!e) { e = { mes: m, faturamento: 0, emissoes: 0, milhas: 0, ticket: 0 }; map.set(m, e); }
    e.faturamento += r.total || 0;
    e.milhas += r.milhas || 0;
    if (ehEmissao(r)) e.emissoes++;
  }
  const arr = [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  arr.forEach((e) => (e.ticket = e.emissoes > 0 ? e.faturamento / e.emissoes : 0));
  return arr;
}

/** Métrica de cada célula das tabelas "Programa × Mês". */
export type MetricaProg = "faturamento" | "vendaMilhas" | "milhas" | "emissoes" | "milhasPorPax";

export interface MatrizProg {
  meses: string[];
  linhas: { chave: string; celulas: number[]; total: number }[];
  totaisMes: number[];
  totalGeral: number;
}

/**
 * Matriz programa × mês. Para "milhasPorPax" as células são razões, então
 * a soma não faz sentido — nesse caso o total da linha é recalculado.
 */
export function matrizProgramaMes(rows: RegistroDash[], meses: string[], metrica: MetricaProg): MatrizProg {
  const progs = [...new Set(rows.map((r) => r.programa).filter(Boolean))];
  const idx = new Map(meses.map((m, i) => [m, i]));
  const num = new Map<string, number[]>();  // acumulador principal
  const den = new Map<string, number[]>();  // denominador (pax) p/ milhasPorPax
  for (const p of progs) {
    num.set(p, meses.map(() => 0));
    den.set(p, meses.map(() => 0));
  }
  for (const r of rows) {
    const i = idx.get((r.data || "").slice(0, 7));
    if (i === undefined || !num.has(r.programa)) continue;
    const n = num.get(r.programa)!;
    const d = den.get(r.programa)!;
    switch (metrica) {
      case "faturamento": n[i] += r.total || 0; break;
      case "vendaMilhas": n[i] += ((r.milhas || 0) * (r.preco_milheiro || 0)) / 1000; break;
      case "milhas": n[i] += r.milhas || 0; break;
      case "emissoes": if (ehEmissao(r)) n[i] += 1; break;
      case "milhasPorPax":
        if (ehEmissao(r)) { n[i] += r.milhas || 0; d[i] += r.pax || 0; }
        break;
    }
  }
  const linhas = progs.map((p) => {
    const n = num.get(p)!;
    const d = den.get(p)!;
    if (metrica === "milhasPorPax") {
      const somaN = n.reduce((s, v) => s + v, 0);
      const somaD = d.reduce((s, v) => s + v, 0);
      return {
        chave: p,
        celulas: n.map((v, i) => (d[i] > 0 ? v / d[i] : 0)),
        total: somaD > 0 ? somaN / somaD : 0,
      };
    }
    return { chave: p, celulas: [...n], total: n.reduce((s, v) => s + v, 0) };
  });
  linhas.sort((a, b) => b.total - a.total);
  const totaisMes = meses.map((_, i) => linhas.reduce((s, l) => s + l.celulas[i], 0));
  return {
    meses,
    linhas,
    totaisMes,
    totalGeral: linhas.reduce((s, l) => s + l.total, 0),
  };
}

/* --------------------------------------------------------- faixas (R5) */

export interface LinhaFaixa {
  faixa: string;
  emissoes: number;
  pax: number;
  milhas: number;
  faturamento: number;
  milheiro: number;   // ponderado por milhas (R4), igual às demais telas
}

const linhasDeFaixa = (rows: RegistroDash[], f: Faixa) =>
  rows.filter((r) => r.programa === f.programa && ehEmissao(r) && (r.pax || 0) > 0);

export function faixaResumo(rows: RegistroDash[], f: Faixa): LinhaFaixa[] {
  const acc = new Map(f.ordem.map((t) => [t, { faixa: t, emissoes: 0, pax: 0, milhas: 0, faturamento: 0, valorMilhas: 0 }]));
  for (const r of linhasDeFaixa(rows, f)) {
    const a = acc.get(f.classificar(r.milhas || 0, r.pax || 0));
    if (!a) continue;
    a.emissoes++;
    a.pax += r.pax || 0;
    a.milhas += r.milhas || 0;
    a.faturamento += r.total || 0;
    a.valorMilhas += ((r.milhas || 0) * (r.preco_milheiro || 0)) / 1000;
  }
  return f.ordem
    .map((t) => acc.get(t)!)
    .filter((a) => a.emissoes > 0)
    .map((a) => ({
      faixa: a.faixa,
      emissoes: a.emissoes,
      pax: a.pax,
      milhas: a.milhas,
      faturamento: a.faturamento,
      // Ponderado, para bater com a tabela de milheiro por faixa/mês logo abaixo.
      milheiro: a.milhas > 0 ? (a.valorMilhas / a.milhas) * 1000 : 0,
    }));
}

export interface MatrizFaixa {
  faixas: string[];
  meses: string[];
  celulas: number[][];
  totaisMes: number[];
  totaisFaixa: number[];
  total: number;
  min: number;
  max: number;
}

/** metrica: "emissoes" | "faturamento" | "milheiro" (este último ponderado por milhas). */
export function faixaPorMes(
  rows: RegistroDash[],
  f: Faixa,
  meses: string[],
  metrica: "emissoes" | "faturamento" | "milheiro",
): MatrizFaixa {
  const idx = new Map(meses.map((m, i) => [m, i]));
  const num = f.ordem.map(() => meses.map(() => 0));
  const den = f.ordem.map(() => meses.map(() => 0));
  const posFaixa = new Map(f.ordem.map((t, i) => [t, i]));

  for (const r of linhasDeFaixa(rows, f)) {
    const i = posFaixa.get(f.classificar(r.milhas || 0, r.pax || 0));
    const j = idx.get((r.data || "").slice(0, 7));
    if (i === undefined || j === undefined) continue;
    if (metrica === "emissoes") num[i][j] += 1;
    else if (metrica === "faturamento") num[i][j] += r.total || 0;
    else {
      num[i][j] += ((r.milhas || 0) * (r.preco_milheiro || 0)) / 1000;
      den[i][j] += r.milhas || 0;
    }
  }

  const ponderado = metrica === "milheiro";
  const celulas = num.map((linha, i) =>
    linha.map((v, j) => (ponderado ? (den[i][j] > 0 ? (v / den[i][j]) * 1000 : 0) : v)),
  );
  const totaisFaixa = num.map((linha, i) => {
    if (!ponderado) return linha.reduce((s, v) => s + v, 0);
    const n = linha.reduce((s, v) => s + v, 0);
    const d = den[i].reduce((s, v) => s + v, 0);
    return d > 0 ? (n / d) * 1000 : 0;
  });
  const totaisMes = meses.map((_, j) => {
    if (!ponderado) return num.reduce((s, linha) => s + linha[j], 0);
    const n = num.reduce((s, linha) => s + linha[j], 0);
    const d = den.reduce((s, linha) => s + linha[j], 0);
    return d > 0 ? (n / d) * 1000 : 0;
  });
  let total: number;
  if (!ponderado) total = totaisFaixa.reduce((s, v) => s + v, 0);
  else {
    const n = num.reduce((s, l) => s + l.reduce((x, v) => x + v, 0), 0);
    const d = den.reduce((s, l) => s + l.reduce((x, v) => x + v, 0), 0);
    total = d > 0 ? (n / d) * 1000 : 0;
  }

  const planos = celulas.flat().filter((v) => v > 0);
  return {
    faixas: f.ordem,
    meses,
    celulas,
    totaisMes,
    totaisFaixa,
    total,
    min: planos.length ? Math.min(...planos) : 0,
    max: planos.length ? Math.max(...planos) : 0,
  };
}

/* ------------------------------------------------------------ rankings */

export interface LinhaCliente {
  cliente: string;
  faturamento: number;
  emissoes: number;
}

export function porCliente(rows: RegistroDash[]): LinhaCliente[] {
  const map = new Map<string, LinhaCliente>();
  for (const r of rows) {
    if (!r.cliente) continue;
    let e = map.get(r.cliente);
    if (!e) { e = { cliente: r.cliente, faturamento: 0, emissoes: 0 }; map.set(r.cliente, e); }
    e.faturamento += r.total || 0;
    if (ehEmissao(r)) e.emissoes++;
  }
  return [...map.values()];
}

export const topPorFaturamento = (rows: RegistroDash[], n = 15) =>
  porCliente(rows).sort((a, b) => b.faturamento - a.faturamento).slice(0, n);

/* ---------------------------------------------------------- calendários */

export interface CelulaDia {
  data: string;
  valor: number;
  emissoes: number;
  foraDoPeriodo: boolean;
  semDados: boolean;
}
export interface Calendario {
  semanas: { inicio: string; fim: string; dias: CelulaDia[]; total: number; emissoes: number }[];
  totaisDow: { valor: number; emissoes: number }[];
  total: number;
  emissoes: number;
  max: number;
}

/**
 * Calendário semana ISO × dia da semana.
 * `metrica`: "faturamento" (R$) ou "milhas".
 * `limites`: primeira e última data do período completo (para marcar dias fora dele).
 */
export function calendario(
  rows: RegistroDash[],
  metrica: "faturamento" | "milhas",
  limites: [string, string] | null,
): Calendario {
  const dia = new Map<string, { valor: number; emissoes: number }>();
  for (const r of rows) {
    if (!r.data) continue;
    let d = dia.get(r.data);
    if (!d) { d = { valor: 0, emissoes: 0 }; dia.set(r.data, d); }
    d.valor += metrica === "faturamento" ? r.total || 0 : r.milhas || 0;
    if (ehEmissao(r)) d.emissoes++;
  }
  const vazio: Calendario = { semanas: [], totaisDow: [], total: 0, emissoes: 0, max: 0 };
  if (!limites) return vazio;
  const [ini, fim] = limites;
  if (!ini || !fim) return vazio;

  const max = Math.max(0, ...[...dia.values()].map((v) => v.valor));
  const totaisDow = Array.from({ length: 7 }, () => ({ valor: 0, emissoes: 0 }));
  const semanas: Calendario["semanas"] = [];
  let total = 0, emissoes = 0;

  for (let seg = isoSegunda(ini); seg <= fim; seg = somaDias(seg, 7)) {
    const dias: CelulaDia[] = [];
    let sTotal = 0, sEmi = 0;
    for (let i = 0; i < 7; i++) {
      const iso = somaDias(seg, i);
      if (iso < ini || iso > fim) {
        dias.push({ data: iso, valor: 0, emissoes: 0, foraDoPeriodo: true, semDados: false });
        continue;
      }
      const d = dia.get(iso);
      if (!d) {
        dias.push({ data: iso, valor: 0, emissoes: 0, foraDoPeriodo: false, semDados: true });
        continue;
      }
      dias.push({ data: iso, valor: d.valor, emissoes: d.emissoes, foraDoPeriodo: false, semDados: false });
      sTotal += d.valor; sEmi += d.emissoes;
      totaisDow[i].valor += d.valor; totaisDow[i].emissoes += d.emissoes;
      total += d.valor; emissoes += d.emissoes;
    }
    semanas.push({ inicio: seg, fim: somaDias(seg, 6), dias, total: sTotal, emissoes: sEmi });
  }
  return { semanas, totaisDow, total, emissoes, max };
}

/** Primeira e última data presentes nos registros. */
export function periodoDe(rows: RegistroDash[]): [string, string] | null {
  const datas = rows.map((r) => r.data).filter(Boolean).sort();
  return datas.length ? [datas[0], datas[datas.length - 1]] : null;
}

/* ------------------------------------------------------ séries temporais */

export function porSemana(rows: RegistroDash[]) {
  const map = new Map<string, { total: number; emissoes: number }>();
  for (const r of rows) {
    if (!r.data) continue;
    const k = isoSegunda(r.data);
    let e = map.get(k);
    if (!e) { e = { total: 0, emissoes: 0 }; map.set(k, e); }
    e.total += r.total || 0;
    if (ehEmissao(r)) e.emissoes++;
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([inicio, v]) => ({ inicio, label: `${ddmm(inicio)}–${ddmm(somaDias(inicio, 6))}`, ...v }));
}

/**
 * Faturamento por dia. Com `limites`, devolve a série contínua — todos os dias do
 * período, inclusive os sem venda (zerados), para o gráfico não pular datas.
 */
export function porDia(rows: RegistroDash[], limites?: [string, string] | null) {
  const map = new Map<string, { total: number; emissoes: number }>();
  for (const r of rows) {
    if (!r.data) continue;
    let e = map.get(r.data);
    if (!e) { e = { total: 0, emissoes: 0 }; map.set(r.data, e); }
    e.total += r.total || 0;
    if (ehEmissao(r)) e.emissoes++;
  }
  if (!limites || !limites[0] || !limites[1]) {
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, v]) => ({ data, ...v }));
  }
  const out: { data: string; total: number; emissoes: number }[] = [];
  for (let d = limites[0]; d <= limites[1]; d = somaDias(d, 1)) {
    out.push({ data: d, ...(map.get(d) ?? { total: 0, emissoes: 0 }) });
  }
  return out;
}

export function porDiaDaSemana(rows: RegistroDash[]) {
  const fat = Array(7).fill(0) as number[];
  const emi = Array(7).fill(0) as number[];
  for (const r of rows) {
    if (!r.data) continue;
    const i = indiceDow(r.data);
    fat[i] += r.total || 0;
    if (ehEmissao(r)) emi[i] += 1;
  }
  return { fat, emi };
}

/** Contagem/soma por chave (programa, emissor, cliente…), respeitando R1/R2. */
export function agrupar(rows: RegistroDash[], campo: keyof RegistroDash) {
  const map = new Map<string, { chave: string; total: number; milhas: number; emissoes: number; pax: number }>();
  for (const r of rows) {
    const k = String(r[campo] ?? "") || "(vazio)";
    let e = map.get(k);
    if (!e) { e = { chave: k, total: 0, milhas: 0, emissoes: 0, pax: 0 }; map.set(k, e); }
    e.total += r.total || 0;
    e.milhas += r.milhas || 0;
    if (ehEmissao(r)) { e.emissoes++; e.pax += r.pax || 0; }
  }
  return [...map.values()];
}

/** Matriz genérica linha × mês (usada em emissor×mês e cliente×mês). */
export function matrizPorMes(
  rows: RegistroDash[],
  campo: keyof RegistroDash,
  meses: string[],
  metrica: "emissoes" | "faturamento",
  chaves: string[],
) {
  const idx = new Map(meses.map((m, i) => [m, i]));
  const pos = new Map(chaves.map((c, i) => [c, i]));
  const m = chaves.map(() => meses.map(() => 0));
  for (const r of rows) {
    const i = pos.get(String(r[campo] ?? ""));
    const j = idx.get((r.data || "").slice(0, 7));
    if (i === undefined || j === undefined) continue;
    if (metrica === "emissoes") { if (ehEmissao(r)) m[i][j] += 1; }
    else m[i][j] += r.total || 0;
  }
  return m;
}
