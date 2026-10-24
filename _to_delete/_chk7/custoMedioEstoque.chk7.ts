/**
 * Custo médio do milheiro no estoque (média ponderada móvel), por conta + programa de estoque.
 *
 * Regras (as mesmas da aba Movimento da Planilha Mestre, com o tratamento de saldo negativo
 * definido pelo Mateus em 21/10/2026):
 *  - Compra: entram as milhas e o custo pago. Bônus/lançamentos sem custo entram com R$ 0 e baixam a média.
 *  - Assinatura de clube (Conferência Clubes): entra com o valor da assinatura; bônus de clube com R$ 0.
 *  - Saldo inicial / ajuste de entrada: entra com o campo valor (se houver), senão R$ 0. Ajuste de saída sai pelo custo médio.
 *  - Transferência: o que sai da origem (transferida − carrinho) sai pelo custo médio da origem naquele momento;
 *    no destino entra a Qtde recebida com custo = (milhas que saíram × custo médio da origem) + custo do carrinho.
 *    O bônus entra com custo zero (dilui a média).
 *  - Emissão e perda: as milhas saem pelo custo médio do momento (a média não muda, o custo em estoque cai).
 *  - Reembolso: as milhas voltam com o custo por milheiro da emissão original; sem a emissão, pelo custo médio atual.
 *  - Saldo negativo: saída maior que o saldo (ou com saldo ≤ 0) usa o ÚLTIMO custo médio válido e fica marcada
 *    como "estimado". Enquanto o saldo está negativo o custo em estoque fica zerado; quando uma entrada faz o saldo
 *    voltar a positivo, a média recomeça pelo custo dessa entrada (custo ÷ milhas da entrada) — também "estimado".
 *  - Ordem: data/hora; no mesmo instante, entradas antes de transferências e antes de saídas.
 *
 * Custo médio do milheiro = custo em estoque ÷ (saldo ÷ 1.000).
 */

export interface EstadoCusto {
  saldo: number;
  custo: number; // R$ em estoque
  cm: number; // custo médio do milheiro (último válido quando o saldo não é positivo)
  estimado: boolean; // o custo médio atual veio de saldo negativo / recomeço
  motivo?: string; // por que está estimado (ex.: "saldo negativo desde 08/01/2026" ou "veio da Livelo, que ...")
}

export interface ResultadoMov {
  custoMov: number; // R$ que entrou (+) ou saiu (−) do estoque neste movimento
  cmMov: number; // custo do milheiro usado neste movimento
  cmApos: number; // custo médio do estoque depois do movimento
  custoApos: number; // custo em estoque depois do movimento
  estimado: boolean;
  motivo?: string;
}

type Op =
  | { k: "in"; id: string; key: string; dh: string; qtde: number; custo: number }
  | { k: "out"; id: string; key: string; dh: string; qtde: number; emissaoId?: string }
  | { k: "reemb"; id: string; key: string; dh: string; qtde: number; emissaoId?: string | null }
  | { k: "transf"; idSai: string; idEnt: string; dh: string; de: string; para: string; sai: number; recebida: number; custoExtra: number };

const ordemOp = (o: Op) => (o.k === "in" || o.k === "reemb" ? 0 : o.k === "transf" ? 1 : 2);
const n = (v: any) => Number(v) || 0;

export interface EntradasCusto {
  movimentos: any[]; // estoque_movimentos confirmados
  emissoes: any[];
  reembolsos: any[];
  compras: any[];
  transferencias: any[];
  perdas: any[];
  /** chave "conta_id|NomeEstoque" a partir de conta_id e nome do programa de estoque */
  chave: (contaId: string | null | undefined, estoqueNome: string | null | undefined) => string | null;
  /** nome do programa de estoque a partir do nome do programa de emissão */
  estoqueDaEmissao: (programaNome: string | null | undefined) => string | null;
  /** conta_id a partir do código da conta (reembolsos guardam o código) */
  contaIdPorCodigo: (codigo: string | null | undefined) => string | null;
  /** data/hora ordenável (yyyy-mm-ddThh:mm:ss) */
  dataHora: (data: string | null | undefined, hora?: string | null, dataHora?: string | null) => string;
}

export function calcularCustoMedio(e: EntradasCusto) {
  const ops: Op[] = [];

  (e.movimentos ?? []).filter((m: any) => m.confirmado).forEach((m: any) => {
    const key = e.chave(m.conta_id, m.programas_estoque?.nome);
    if (!key) return;
    const pts = n(m.pontos);
    const dh = e.dataHora(m.data, m.hora, m.data_hora);
    if (pts >= 0) {
      const custo = m.tipo === "bonus" ? 0 : n(m.valor);
      ops.push({ k: "in", id: m.id, key, dh, qtde: pts, custo });
    } else {
      ops.push({ k: "out", id: m.id, key, dh, qtde: -pts });
    }
  });
  // Compra só entra depois de creditada (Conferência Compras), na data/hora do crédito dos pontos.
  (e.compras ?? []).filter((c: any) => c.creditado !== false).forEach((c: any) => {
    const key = e.chave(c.conta_id, c.programas_estoque?.nome);
    const dh = c.creditado_data ? e.dataHora(c.creditado_data, c.creditado_hora, null) : e.dataHora(c.data, c.hora, c.data_hora);
    if (key) ops.push({ k: "in", id: "comp_" + c.id, key, dh, qtde: n(c.qtde), custo: n(c.custo_total) });
  });
  (e.perdas ?? []).forEach((p: any) => {
    const key = e.chave(p.conta_id, p.programas_estoque?.nome);
    if (key) ops.push({ k: "out", id: "perd_" + p.id, key, dh: e.dataHora(p.data, p.hora, p.data_hora), qtde: n(p.qtde) });
  });
  (e.transferencias ?? []).forEach((t: any) => {
    const de = e.chave(t.conta_remetente_id, t.prog_remetente?.nome);
    const para = e.chave(t.conta_recebedora_id, t.prog_recebedor?.nome);
    if (!de || !para) return;
    ops.push({
      k: "transf", idSai: "tsai_" + t.id, idEnt: "tent_" + t.id, dh: e.dataHora(t.data, t.hora, t.data_hora), de, para,
      sai: Math.max(0, n(t.qtde_transferida) - n(t.carrinho_qtde)), recebida: n(t.qtde_recebida), custoExtra: n(t.custo_total),
    });
  });
  (e.emissoes ?? []).filter((x: any) => x.conta_id && !x.cancelar).forEach((x: any) => {
    const key = e.chave(x.conta_id, e.estoqueDaEmissao(x.programa_real || x.programa));
    if (key) ops.push({ k: "out", id: "emi_" + x.id, key, dh: e.dataHora(x.data_emissao, x.hora, null), qtde: n(x.milhas_real) || n(x.total_milhas), emissaoId: x.id });
  });
  (e.reembolsos ?? []).filter((r: any) => n(r.dt_milhas) > 0).forEach((r: any) => {
    const key = e.chave(e.contaIdPorCodigo(r.conta), e.estoqueDaEmissao(r.programa));
    const dia = r.milhas_reembolsadas_em || (r.created_at ? String(r.created_at).slice(0, 10) : null);
    if (key) ops.push({ k: "reemb", id: "reem_" + r.id, key, dh: e.dataHora(dia, null, null), qtde: n(r.dt_milhas), emissaoId: r.tabela_origem === "emissoes" ? r.emissao_id : null });
  });

  ops.sort((a, b) => (a.dh || "").localeCompare(b.dh || "") || ordemOp(a) - ordemOp(b));

  const estados = new Map<string, EstadoCusto>();
  const porMov = new Map<string, ResultadoMov>();
  const cmEmissao = new Map<string, { cm: number; estimado: boolean; motivo?: string }>();
  const est = (key: string) => {
    let s = estados.get(key);
    if (!s) { s = { saldo: 0, custo: 0, cm: 0, estimado: false }; estados.set(key, s); }
    return s;
  };
  const registrar = (id: string, s: EstadoCusto, custoMov: number, cmMov: number, estimado: boolean, motivo?: string) => {
    porMov.set(id, { custoMov, cmMov, cmApos: s.cm, custoApos: s.custo, estimado, motivo: estimado ? motivo ?? s.motivo : undefined });
  };
  const dataBr = (dh: string) => (dh ? dh.slice(0, 10).split("-").reverse().join("/") : "");
  const progDaChave = (key: string) => key.slice(key.indexOf("|") + 1);

  // Entrada: média ponderada. `motivoOrigem` = o custo que está entrando já veio de uma média estimada (e por quê).
  // Uma vez estimada, a média continua marcada até o estoque zerar (não dá para "limpar" um custo misturado).
  const entrar = (s: EstadoCusto, qtde: number, custo: number, dh: string, motivoOrigem?: string) => {
    if (s.saldo > 0) {
      s.saldo += qtde; s.custo += custo;
      if (s.saldo > 0) {
        s.cm = s.custo / (s.saldo / 1000);
        if (motivoOrigem && !s.estimado) { s.estimado = true; s.motivo = motivoOrigem; }
      } else { s.custo = 0; marcarNegativo(s, dh); }
    } else {
      // Saldo zerado/negativo: a média recomeça pelo custo desta entrada.
      const cobriuNegativo = s.saldo < 0;
      const unit = qtde > 0 ? custo / (qtde / 1000) : s.cm;
      s.saldo += qtde;
      if (s.saldo > 0) {
        s.cm = unit; s.custo = s.cm * (s.saldo / 1000);
        if (cobriuNegativo) { s.estimado = true; /* mantém o motivo do saldo negativo */ }
        else if (motivoOrigem) { s.estimado = true; s.motivo = motivoOrigem; }
        else { s.estimado = false; s.motivo = undefined; }
      } else if (s.saldo < 0) { s.custo = 0; marcarNegativo(s, dh); }
      else { s.custo = 0; s.estimado = false; s.motivo = undefined; }
    }
    return s.estimado;
  };
  const marcarNegativo = (s: EstadoCusto, dh: string) => {
    if (!s.estimado || !s.motivo?.startsWith("saldo negativo")) s.motivo = `saldo negativo desde ${dataBr(dh)}`;
    s.estimado = true;
  };
  // Saída: sai pelo custo médio do momento (ou o último válido, se o saldo não cobre a saída).
  const sair = (s: EstadoCusto, qtde: number, dh: string) => {
    const cm = s.cm;
    s.saldo -= qtde;
    if (s.saldo > 0) s.custo -= cm * (qtde / 1000);
    else if (s.saldo < 0) { s.custo = 0; marcarNegativo(s, dh); }
    else {
      // zerou: o que saiu levou o custo (estimado ou não); o próximo estoque começa limpo
      const r = { cm, estimado: s.estimado, motivo: s.motivo };
      s.custo = 0; s.estimado = false; s.motivo = undefined;
      return r;
    }
    return { cm, estimado: s.estimado, motivo: s.motivo };
  };

  for (const o of ops) {
    if (o.k === "in") {
      const s = est(o.key);
      const estimado = entrar(s, o.qtde, o.custo, o.dh);
      registrar(o.id, s, o.custo, o.qtde ? o.custo / (o.qtde / 1000) : 0, estimado);
    } else if (o.k === "out") {
      const s = est(o.key);
      const r = sair(s, o.qtde, o.dh);
      if (o.emissaoId) cmEmissao.set(o.emissaoId, r);
      registrar(o.id, s, -r.cm * (o.qtde / 1000), r.cm, r.estimado, r.motivo);
    } else if (o.k === "reemb") {
      const s = est(o.key);
      const original = o.emissaoId ? cmEmissao.get(o.emissaoId) : undefined;
      const cm = original ? original.cm : s.cm;
      const custo = cm * (o.qtde / 1000);
      const motivoOrigem = original?.estimado ? `custo da emissão original era estimado (${original.motivo ?? ""})` : undefined;
      const estimado = entrar(s, o.qtde, custo, o.dh, motivoOrigem);
      registrar(o.id, s, custo, cm, estimado);
    } else {
      const sDe = est(o.de);
      const r = sair(sDe, o.sai, o.dh);
      registrar(o.idSai, sDe, -r.cm * (o.sai / 1000), r.cm, r.estimado, r.motivo);
      const sPara = est(o.para);
      const custoEnt = r.cm * (o.sai / 1000) + o.custoExtra;
      const motivoOrigem = r.estimado ? `custo veio da ${progDaChave(o.de)} (${r.motivo ?? "estimado"})` : undefined;
      const estEnt = entrar(sPara, o.recebida, custoEnt, o.dh, motivoOrigem);
      registrar(o.idEnt, sPara, custoEnt, o.recebida ? custoEnt / (o.recebida / 1000) : 0, estEnt);
    }
  }

  return { estados, porMov, cmEmissao };
}

export const fmtCm = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? "—" : (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
