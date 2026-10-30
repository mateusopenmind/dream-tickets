import { useState, useMemo, useEffect } from "react";
import {
  useEstoqueMovimentos, useSaldosLidos, useAdicionarMovimento, useExcluirMovimento, useDesconfirmarMovimento,
  useEstoqueCompras, useEstoqueTransferencias, useEstoquePerdas, useProgramasEstoque, useProgramasComEstoque,
  compraCreditada, dataCreditoCompra,
} from "@/hooks/useClubes";
import { useContas, useEmissoes, useReembolsos } from "@/hooks/useData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchSelect } from "@/components/ui/search-select";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Wand2, Undo2, Download, X } from "lucide-react";
import { CampoFiltro, FiltroPeriodo, TotalCard, noPeriodo } from "@/components/estoque/ValidacaoEstoque";
import { exportarExcel, type ColunaExcel } from "@/lib/exportarExcel";
import { calcularCustoMedio, fmtCm } from "@/lib/custoMedioEstoque";
import { DicaCampo } from "@/components/ui/dica-campo";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { rotuloConta } from "@/lib/rotuloConta";

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const nfSigned = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}`;
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const fmtMesRef = (iso: string | null | undefined) => (iso && iso.length >= 7 ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const toDataHora = (data: string | null | undefined, hora?: string | null, dataHora?: string | null) =>
  dataHora || (data ? `${data}T${hora || "00:00:00"}` : "");
const fmtDataHora = (dh: string | null | undefined) => {
  if (!dh) return "—";
  const [d, t] = String(dh).split("T");
  const dd = d ? d.split("-").reverse().join("/") : "—";
  const hh = t ? t.slice(0, 5) : "";
  return hh ? `${dd} ${hh}` : dd;
};
const isoHoje = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const TIPO_LABEL: Record<string, string> = {
  abertura: "Saldo inicial", ajuste: "Ajuste", bonus: "Bônus",
  assinatura: "Assinatura", reembolso: "Reembolso", emissao: "Emissão",
  compra: "Compra", perda: "Perda", transferencia: "Transferência",
};
const tipoLabel = (t: string) => TIPO_LABEL[t] ?? t;
// Categorias da conferência do extrato: cada movimento cai em uma, e os cards somam por categoria.
// A "dica" de cada uma é a explicação de como o total é calculado.
const CATEGORIAS: { valor: string; label: string; tom: "pos" | "neg" | "neutro"; dica: string }[] = [
  { valor: "compra", label: "Compras", tom: "pos", dica: "Soma da Qtde das compras (Estoque › Compras) desta conta e programa no período. Cancelamentos entram negativos." },
  { valor: "clube", label: "Clubes (assinatura + bônus)", tom: "pos", dica: "Soma das assinaturas e bônus de clube confirmados na Conferência Clubes no período." },
  { valor: "transf_entrada", label: "Transferências recebidas", tom: "pos", dica: "Soma da Qtde recebida das transferências que entraram neste programa no período = (Qtde transferida ÷ conversão) + bônus." },
  { valor: "transf_saida", label: "Transferências enviadas", tom: "neg", dica: "Soma do que saiu deste programa nas transferências do período = Qtde transferida − carrinho (o carrinho é comprado na hora e não sai do estoque)." },
  { valor: "emissao", label: "Emissões", tom: "neg", dica: "Soma das milhas reais (ou do total de milhas, quando o real está vazio) das emissões NÃO canceladas desta conta no período. Na retarifação, conta no programa realmente emitido." },
  { valor: "reembolso", label: "Reembolsos", tom: "pos", dica: "Soma das milhas devolvidas pelos reembolsos desta conta no período." },
  { valor: "perda", label: "Perdas", tom: "neg", dica: "Soma da Qtde das perdas (Estoque › Perdas) no período." },
  { valor: "ajuste", label: "Ajustes e saldo inicial", tom: "neutro", dica: "Soma dos ajustes (entrada e saída) e dos saldos iniciais lançados em Estoque › Ajuste no período." },
];
const categoriaDe = (g: string) => (g === "assinatura" || g === "bonus" ? "clube" : g === "abertura" || g === "ajuste" ? "ajuste" : g);
const DICA_CM = "Custo médio do milheiro = custo em estoque ÷ (milhas em estoque ÷ 1.000), em média ponderada na ordem de data/hora. Compras entram com o custo pago (bônus com R$ 0); transferências levam o custo médio da origem + o custo do carrinho (o bônus entra com R$ 0); emissões e perdas saem pelo custo médio do momento; reembolsos voltam com o custo da emissão original.";
const DICA_ESTIMADO = "Estimado (≈): em algum momento uma saída foi maior que o estoque (saldo negativo) — nesta conta/programa OU no programa de origem de uma transferência que trouxe o custo para cá (ex.: a Livelo ficou negativa e as milhas transferidas para a Latam levaram esse custo). A saída com saldo negativo usa o último custo médio válido; quando o saldo volta a positivo, a média recomeça pelo custo da entrada. A marca fica até o estoque zerar. Normalmente indica compras ou saldo inicial que faltam lançar.";
const CAT_OPTIONS = [{ value: "", label: "Todos os tipos" }, ...CATEGORIAS.map((c) => ({ value: c.valor, label: c.label }))];
const PALETA = ["#4f46e5", "#0f9d76", "#b9770f", "#2563c9", "#c0392b", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#e11d48"];

export default function EstoqueMilhasPage() {
  const { data: movimentos, isLoading } = useEstoqueMovimentos();
  const { data: saldos } = useSaldosLidos();
  const { data: contas } = useContas();
  const { data: estoques } = useProgramasEstoque();
  const { data: programasComEstoque } = useProgramasComEstoque();
  const adicionar = useAdicionarMovimento();
  const excluir = useExcluirMovimento();
  const desconfirmar = useDesconfirmarMovimento();
  const podeExcluir = usePodeExcluir();
  const { data: emissoesData } = useEmissoes();
  const { data: reembolsosData } = useReembolsos();
  const { data: comprasData } = useEstoqueCompras();
  const { data: transferenciasData } = useEstoqueTransferencias();
  const { data: perdasData } = useEstoquePerdas();
  const contaByCodigo = useMemo(() => {
    const m = new Map<string, any>();
    (contas ?? []).forEach((c: any) => { if (c.codigo) m.set(c.codigo, c); });
    return m;
  }, [contas]);
  // Mapa: nome do programa de EMISSÃO -> nome do ESTOQUE (para resolver emissões/reembolsos).
  const estoqueDoProgramaNome = useMemo(() => {
    const m = new Map<string, string>();
    (programasComEstoque ?? []).forEach((p: any) => { if (p.nome && p.programas_estoque?.nome) m.set(p.nome, p.programas_estoque.nome); });
    return m;
  }, [programasComEstoque]);
  const resolveEstoqueNome = (programaNome: string | null | undefined) => (programaNome ? estoqueDoProgramaNome.get(programaNome) ?? null : null);

  const [contaId, setContaId] = useState("");
  const [estoqueId, setEstoqueId] = useState("");
  const parSelecionado = !!contaId && !!estoqueId;
  // Filtros do extrato (só valem com conta + programa selecionados).
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fCat, setFCat] = useState("");

  // Programas de estoque vinculados à conta selecionada (ativos OU inativos).
  const { data: estoqueIdsDaConta } = useQuery({
    queryKey: ["estoque-conta-programas", contaId],
    enabled: !!contaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conta_programas")
        .select("programa_estoque_id")
        .eq("conta_id", contaId)
        .limit(5000);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.programa_estoque_id).filter(Boolean));
    },
  });

  const contasOrd = useMemo(() => (contas ?? []).slice().sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true })), [contas]);
  const contaOptions = useMemo(() => contasOrd.map((c: any) => ({ value: c.id, label: rotuloConta(c) })), [contasOrd]);
  const estoqueOptions = useMemo(() => {
    const base = (estoques ?? []).slice();
    // Sem conta selecionada: mostra os estoques ativos (comportamento antigo).
    // Com conta: só os programas de estoque que a conta participa (ativos OU inativos).
    const filtrados = contaId
      ? base.filter((e: any) => estoqueIdsDaConta?.has(e.id))
      : base.filter((e: any) => e.ativo !== false);
    return filtrados
      .sort((a: any, b: any) => (a.nome ?? "").localeCompare(b.nome ?? ""))
      .map((e: any) => ({ value: e.id, label: e.nome }));
  }, [estoques, contaId, estoqueIdsDaConta]);

  // Se o programa selecionado não pertence mais à conta escolhida, limpa a seleção.
  useEffect(() => {
    if (estoqueId && !estoqueOptions.some((o) => o.value === estoqueId)) setEstoqueId("");
  }, [estoqueOptions, estoqueId]);
  const estoqueNomeSel = useMemo(() => (estoques ?? []).find((e: any) => e.id === estoqueId)?.nome ?? "", [estoques, estoqueId]);
  const contaSel = useMemo(() => (contas ?? []).find((c: any) => c.id === contaId), [contas, contaId]);

  // ----- Custo médio do milheiro (média ponderada móvel; regras em lib/custoMedioEstoque.ts) -----
  const custos = useMemo(() => calcularCustoMedio({
    movimentos: movimentos ?? [], emissoes: emissoesData ?? [], reembolsos: reembolsosData ?? [],
    compras: comprasData ?? [], transferencias: transferenciasData ?? [], perdas: perdasData ?? [],
    chave: (c, p) => (c && p ? `${c}|${p}` : null),
    estoqueDaEmissao: (p) => resolveEstoqueNome(p),
    contaIdPorCodigo: (cod) => (cod ? contaByCodigo.get(cod)?.id ?? null : null),
    dataHora: toDataHora,
  }), [movimentos, emissoesData, reembolsosData, comprasData, transferenciasData, perdasData, contaByCodigo, estoqueDoProgramaNome]);
  // Por programa: soma o custo e as milhas só das contas com saldo positivo.
  const custoPorPrograma = useMemo(() => {
    const m = new Map<string, { custo: number; milhas: number; estimado: boolean }>();
    custos.estados.forEach((st, key) => {
      if (st.saldo <= 0) return;
      const prog = key.slice(key.indexOf("|") + 1);
      const e = m.get(prog) ?? { custo: 0, milhas: 0, estimado: false };
      e.custo += st.custo; e.milhas += st.saldo; e.estimado = e.estimado || st.estimado;
      m.set(prog, e);
    });
    return m;
  }, [custos]);

  // ----- Visão geral: ESTOQUE por (conta, programa estoque) somando todas as origens. -----
  const saldosDet = useMemo(() => {
    const map = new Map<string, any>();
    const add = (conta_id: string, estoqueNome: string | null | undefined, contaObj: any, pontos: number) => {
      if (!conta_id || !estoqueNome) return;
      const key = `${conta_id}|${estoqueNome}`;
      let e = map.get(key);
      if (!e) { e = { conta_id, programa: estoqueNome, conta: contaObj, saldo: 0 }; map.set(key, e); }
      e.saldo += pontos;
      if (!e.conta && contaObj) e.conta = contaObj;
    };
    // Movimento confirmado do livro (por estoque)
    (movimentos ?? []).filter((m: any) => m.confirmado).forEach((m: any) => add(m.conta_id, m.programas_estoque?.nome, m.contas, Number(m.pontos) || 0));
    // Emissões (débito) — resolvidas para o estoque do programa de emissão.
    // Com retarifação a emissão saiu em outro programa (programa_real) e a conta gravada já é a dele.
    (emissoesData ?? []).filter((e: any) => e.conta_id && !e.cancelar).forEach((e: any) => add(e.conta_id, resolveEstoqueNome(e.programa_real || e.programa), e.contas, -(Number(e.milhas_real) || Number(e.total_milhas) || 0)));
    // Reembolsos (crédito) — conta = código; resolvidos para o estoque
    (reembolsosData ?? []).filter((r: any) => (Number(r.dt_milhas) || 0) > 0).forEach((r: any) => {
      const c = contaByCodigo.get(r.conta);
      if (c) add(c.id, resolveEstoqueNome(r.programa), c, Number(r.dt_milhas) || 0);
    });
    // Compras (crédito)
    (comprasData ?? []).filter(compraCreditada).forEach((c: any) => add(c.conta_id, c.programas_estoque?.nome, c.contas, Number(c.qtde) || 0));
    // Perdas (débito)
    (perdasData ?? []).forEach((p: any) => add(p.conta_id, p.programas_estoque?.nome, p.contas, -(Number(p.qtde) || 0)));
    // Transferências — sai do remetente (−) e entra no recebedor (+ com bônus).
    // As milhas do carrinho foram compradas: entram na transferência sem sair do estoque de origem.
    (transferenciasData ?? []).forEach((t: any) => {
      const saiDaOrigem = Math.max(0, (Number(t.qtde_transferida) || 0) - (Number(t.carrinho_qtde) || 0));
      add(t.conta_remetente_id, t.prog_remetente?.nome, t.remetente, -saiDaOrigem);
      add(t.conta_recebedora_id, t.prog_recebedor?.nome, t.recebedora, Number(t.qtde_recebida) || 0);
    });
    return [...map.values()].filter((x: any) => x.saldo !== 0);
  }, [movimentos, emissoesData, reembolsosData, comprasData, perdasData, transferenciasData, contaByCodigo, estoqueDoProgramaNome]);

  const porPrograma = useMemo(() => {
    const m = new Map<string, number>();
    saldosDet.forEach((x: any) => m.set(x.programa, (m.get(x.programa) || 0) + x.saldo));
    return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [saldosDet]);

  const cores = useMemo(() => {
    const m: Record<string, string> = {};
    porPrograma.forEach((p, i) => { m[p.nome] = PALETA[i % PALETA.length]; });
    return m;
  }, [porPrograma]);
  const corDe = (p: string) => cores[p] || "#94a3b8";

  const porConta = useMemo(() => {
    const m = new Map<string, any>();
    saldosDet.forEach((x: any) => {
      let e = m.get(x.conta_id);
      if (!e) { e = { conta_id: x.conta_id, conta: x.conta, total: 0, progs: {} as Record<string, number> }; m.set(x.conta_id, e); }
      e.total += x.saldo;
      e.progs[x.programa] = (e.progs[x.programa] || 0) + x.saldo;
    });
    return [...m.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [saldosDet]);
  const maxConta = porConta.length ? Math.max(...porConta.map((r: any) => Math.abs(r.total))) || 1 : 1;

  const charts = useMemo(() => {
    const list: any[] = [{ titulo: "Total", rows: porConta, max: maxConta }];
    porPrograma.forEach((p) => {
      const rows = saldosDet
        .filter((x: any) => x.programa === p.nome)
        .map((x: any) => ({ conta_id: x.conta_id, conta: x.conta, total: x.saldo, custo: custos.estados.get(`${x.conta_id}|${p.nome}`) }))
        .sort((a: any, b: any) => Math.abs(b.total) - Math.abs(a.total));
      list.push({ titulo: p.nome, rows, max: rows.length ? Math.max(...rows.map((r: any) => Math.abs(r.total))) || 1 : 1 });
    });
    return list;
  }, [porConta, maxConta, porPrograma, saldosDet, custos]);

  // ----- Detalhe (conta + estoque selecionados): conciliação e movimento -----
  const confirmados = useMemo(() => {
    if (!parSelecionado) return [];
    const base = (movimentos ?? [])
      .filter((m: any) => m.conta_id === contaId && m.programa_estoque_id === estoqueId && m.confirmado)
      .map((m: any) => ({ id: m.id, data: m.data, referencia: m.referencia, dataHora: toDataHora(m.data, m.hora, m.data_hora), tipo: m.tipo, origem: m.origem, descricao: m.descricao, pontos: Number(m.pontos) || 0, grupo: m.tipo, codigo: m.id_movimento || null, _mov: true }));
    const emis = (emissoesData ?? [])
      .filter((e: any) => e.conta_id === contaId && resolveEstoqueNome(e.programa_real || e.programa) === estoqueNomeSel && !e.cancelar)
      .map((e: any) => ({ id: "emi_" + e.id, data: e.data_emissao, dataHora: toDataHora(e.data_emissao, e.hora, null), tipo: "emissao", grupo: "emissao", codigo: e.id_emissao || e.localizador || null, origem: `Emissão ${e.id_emissao || e.localizador || ""}`.trim(), descricao: e.programa_real ? `${e.programa_real} (retarifação de ${e.programa})` : e.programa, pontos: -(Number(e.milhas_real) || Number(e.total_milhas) || 0), _mov: false }));
    const cod = contaSel?.codigo ?? "";
    const reem = (reembolsosData ?? [])
      .filter((r: any) => (r.conta || "") === cod && resolveEstoqueNome(r.programa) === estoqueNomeSel && (Number(r.dt_milhas) || 0) > 0)
      .map((r: any) => ({ id: "reem_" + r.id, data: r.milhas_reembolsadas_em || (r.created_at ? String(r.created_at).slice(0, 10) : null), dataHora: toDataHora(r.milhas_reembolsadas_em || (r.created_at ? String(r.created_at).slice(0, 10) : null), null, null), tipo: "reembolso", grupo: "reembolso", codigo: r.reembolso_id || null, origem: `Reembolso ${r.reembolso_id || ""}`.trim(), descricao: r.programa, pontos: Number(r.dt_milhas) || 0, _mov: false }));
    // Compra entra no extrato só depois de creditada, na data/hora do crédito (Conferência Compras).
    const comp = (comprasData ?? [])
      .filter((c: any) => c.conta_id === contaId && c.programa_estoque_id === estoqueId && compraCreditada(c))
      .map((c: any) => ({ id: "comp_" + c.id, data: dataCreditoCompra(c).data, dataHora: c.creditado_data ? toDataHora(c.creditado_data, c.creditado_hora, null) : toDataHora(c.data, c.hora, c.data_hora), tipo: "compra", grupo: "compra", codigo: c.id_compra || null, origem: c.operacao || "Compra", descricao: c.descricao, pontos: Number(c.qtde) || 0, _mov: false }));
    const perd = (perdasData ?? [])
      .filter((p: any) => p.conta_id === contaId && p.programa_estoque_id === estoqueId)
      .map((p: any) => ({ id: "perd_" + p.id, data: p.data, dataHora: toDataHora(p.data, p.hora, p.data_hora), tipo: "perda", grupo: "perda", codigo: null, origem: p.operacao || "Perda", descricao: p.descricao, pontos: -(Number(p.qtde) || 0), _mov: false }));
    const transfSaida = (transferenciasData ?? [])
      .filter((t: any) => t.conta_remetente_id === contaId && t.programa_estoque_remetente_id === estoqueId)
      .map((t: any) => ({ id: "tsai_" + t.id, data: t.data, dataHora: toDataHora(t.data, t.hora, t.data_hora), tipo: "transferencia", grupo: "transf_saida", codigo: t.id_transferencia || null, origem: `Transferência p/ ${t.prog_recebedor?.nome ?? ""}`.trim(), descricao: t.descricao, pontos: -Math.max(0, (Number(t.qtde_transferida) || 0) - (Number(t.carrinho_qtde) || 0)), _mov: false }));
    const transfEntrada = (transferenciasData ?? [])
      .filter((t: any) => t.conta_recebedora_id === contaId && t.programa_estoque_recebedor_id === estoqueId)
      .map((t: any) => ({ id: "tent_" + t.id, data: t.data, dataHora: toDataHora(t.data, t.hora, t.data_hora), tipo: "transferencia", grupo: "transf_entrada", codigo: t.id_transferencia || null, origem: `Transferência de ${t.prog_remetente?.nome ?? ""}`.trim(), descricao: t.descricao, pontos: Number(t.qtde_recebida) || 0, _mov: false }));
    return [...base, ...emis, ...reem, ...comp, ...perd, ...transfSaida, ...transfEntrada].sort((a: any, b: any) => (a.dataHora ?? "").localeCompare(b.dataHora ?? ""));
  }, [parSelecionado, movimentos, emissoesData, reembolsosData, comprasData, perdasData, transferenciasData, contaId, estoqueId, estoqueNomeSel, contaSel, estoqueDoProgramaNome]);
  const calculado = useMemo(() => confirmados.reduce((s: number, m: any) => s + (Number(m.pontos) || 0), 0), [confirmados]);
  // Saldo lido do estoque para a conta: pool único — pega a leitura mais recente entre as linhas do estoque.
  const lido = useMemo(() => {
    const rows = (saldos ?? []).filter((s: any) => s.conta_id === contaId && s.programa_estoque_id === estoqueId);
    if (rows.length === 0) return null;
    const maisRecente = rows.slice().sort((a: any, b: any) => String(b.saldo_atualizado_em ?? "").localeCompare(String(a.saldo_atualizado_em ?? "")))[0];
    return Number(maisRecente.saldo_milhas) || 0;
  }, [saldos, contaId, estoqueId]);
  const diff = lido == null ? null : lido - calculado;
  const extrato = useMemo(() => {
    let acc = 0;
    return confirmados.map((m: any) => { acc += Number(m.pontos) || 0; return { ...m, saldoCorrente: acc }; });
  }, [confirmados]);

  // ----- Conferência: filtro de período/tipo e totais por tipo -----
  // O saldo da coluna "Saldo" continua sendo o acumulado de TODO o extrato (o filtro só esconde linhas).
  const diaDe = (m: any) => String(m.dataHora || m.data || "").slice(0, 10);
  const extratoFiltrado = useMemo(
    () => extrato.filter((m: any) => noPeriodo(diaDe(m), fDe, fAte) && (!fCat || categoriaDe(m.grupo) === fCat)),
    [extrato, fDe, fAte, fCat],
  );
  const resumoPeriodo = useMemo(() => {
    const tot: Record<string, number> = {};
    extrato.filter((m: any) => noPeriodo(diaDe(m), fDe, fAte)).forEach((m: any) => {
      const c = categoriaDe(m.grupo);
      tot[c] = (tot[c] || 0) + (Number(m.pontos) || 0);
    });
    const antes = fDe ? extrato.filter((m: any) => diaDe(m) < fDe) : [];
    const ateFim = fAte ? extrato.filter((m: any) => diaDe(m) <= fAte) : extrato;
    return {
      tot,
      inicio: antes.length ? antes[antes.length - 1].saldoCorrente : 0,
      fim: ateFim.length ? ateFim[ateFim.length - 1].saldoCorrente : 0,
    };
  }, [extrato, fDe, fAte]);
  const temFiltroExtrato = !!(fDe || fAte || fCat);
  // Ordenação pelas colunas do Movimento das milhas. Padrão (nenhuma coluna clicada): data/hora
  // mais nova primeiro e, no mesmo minuto, Origem/motivo em ordem alfabética. O saldo de cada linha
  // não muda ao reordenar — é sempre o acumulado cronológico até ela.
  const extratoOrdenavel = useMemo(() => extratoFiltrado.map((m: any, i: number) => {
    const c = custos.porMov.get(m.id);
    return {
      ...m,
      _sOrdem: i,
      _sMes: String(m.referencia || m.data || "").slice(0, 7) || null,
      _sMovimento: tipoLabel(m.tipo),
      _sOrigem: `${m.origem || m.descricao || ""}${m.descricao && m.origem && m.descricao !== m.origem ? ` — ${m.descricao}` : ""}` || null,
      _sCusto: c && c.custoMov ? c.custoMov : null,
      _sCm: c ? c.cmApos : null,
    };
  }).sort((a: any, b: any) => {
    const da = String(a.dataHora || "").slice(0, 16), db = String(b.dataHora || "").slice(0, 16);
    if (da !== db) return db.localeCompare(da);
    const oc = String(a._sOrigem ?? "").localeCompare(String(b._sOrigem ?? ""), "pt-BR", { sensitivity: "base" });
    return oc !== 0 ? oc : b._sOrdem - a._sOrdem;
  }), [extratoFiltrado, custos]);
  const { sorted: extratoOrdenado, key: sortKey, dir: sortDir, toggle: toggleSort } = useSort<any>(extratoOrdenavel, null);
  const custoSel = parSelecionado ? custos.estados.get(`${contaId}|${estoqueNomeSel}`) : undefined;
  const exportarExtrato = () => {
    const colunas: ColunaExcel<any>[] = [
      { header: "Data", key: "data", tipo: "data" },
      { header: "Hora", key: "hora" },
      { header: "Mês referência", key: "mes" },
      { header: "Movimento", key: "movimento", largura: 26 },
      { header: "Origem / motivo", key: "origem", largura: 44 },
      { header: "Entrada/Saída", key: "pontos", tipo: "inteiro" },
      { header: "Saldo", key: "saldo", tipo: "inteiro" },
      { header: "Custo (R$)", key: "custo", tipo: "moeda" },
      { header: "Custo médio do milheiro", key: "cm", tipo: "moeda", largura: 24 },
      { header: "Custo estimado? (motivo)", key: "estimado", largura: 40 },
      { header: "ID", key: "codigo" },
    ];
    const linhas = extratoFiltrado.map((m: any) => {
      const [d, t] = String(m.dataHora || "").split("T");
      return {
        data: d || m.data, hora: t ? t.slice(0, 5) : "", mes: fmtMesRef(m.referencia || m.data),
        movimento: CATEGORIAS.find((c) => c.valor === categoriaDe(m.grupo))?.label ?? tipoLabel(m.tipo),
        origem: `${m.origem || m.descricao || ""}${m.descricao && m.origem && m.descricao !== m.origem ? ` — ${m.descricao}` : ""}`,
        pontos: Number(m.pontos) || 0, saldo: m.saldoCorrente,
        custo: custos.porMov.get(m.id)?.custoMov ?? null, cm: custos.porMov.get(m.id)?.cmApos ?? null,
        estimado: custos.porMov.get(m.id)?.estimado ? `sim — ${custos.porMov.get(m.id)?.motivo ?? "saldo negativo"}` : "",
        codigo: m.codigo ?? "",
      };
    });
    exportarExcel(`extrato-${contaSel?.codigo ?? "conta"}-${estoqueNomeSel || "programa"}-${isoHoje()}`, colunas, linhas, "Extrato");
  };

  const reconciliar = async () => {
    if (diff == null || diff === 0) { toast.info("Nada a ajustar — já está reconciliado."); return; }
    if (!confirm(`Lançar um ajuste de ${nfSigned(diff)} para igualar o saldo calculado ao saldo lido?`)) return;
    try {
      await adicionar.mutateAsync({ conta_id: contaId, programa_estoque_id: estoqueId, data: isoHoje(), tipo: "ajuste", pontos: diff, descricao: "Ajuste para bater com o saldo lido", origem: "Ajuste" });
      toast.success("Ajuste lançado — saldo reconciliado.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao reconciliar"); }
  };
  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir este movimento?")) return;
    try { await excluir.mutateAsync(id); toast.success("Movimento removido."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };
  // Assinatura/bônus vieram da Conferência Clubes: em vez de apagar, devolvemos
  // o lançamento para lá como previsão pendente, para poder ser confirmado de novo.
  const handleDevolver = async (id: string) => {
    if (!confirm("Devolver este lançamento para a Conferência Clubes? Ele sai do estoque e volta como conferência pendente, podendo ser confirmado novamente.")) return;
    try { await desconfirmar.mutateAsync(id); toast.success("Lançamento devolvido para a Conferência Clubes."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao devolver"); }
  };

  const renderChart = (ch: any) => (
    <Card key={ch.titulo} className="overflow-hidden">
      <div className="px-3 py-2 text-sm font-medium bg-muted/40 flex items-center gap-2">
        {ch.titulo === "Total" ? <span>Total</span> : (<><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: corDe(ch.titulo) }} />{ch.titulo}</>)}
      </div>
      <div className="max-h-80 overflow-y-auto p-3 space-y-1">
        {ch.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem movimento</p>
        ) : ch.rows.map((row: any) => {
          const neg = row.total < 0;
          const cor = neg ? "#c0392b" : (ch.titulo === "Total" ? "#4f46e5" : corDe(ch.titulo));
          return (
            <div key={row.conta_id} className="flex items-center gap-2 text-xs">
              <div className="w-24 shrink-0 truncate font-mono" title={`${row.conta?.codigo ?? ""} ${row.conta?.nome ?? ""}`}>{row.conta?.codigo}</div>
              <div className="flex-1 flex h-3.5 rounded overflow-hidden bg-muted">
                <div style={{ width: `${(Math.abs(row.total) / ch.max) * 100}%`, background: cor }} />
              </div>
              <div className={`w-20 shrink-0 text-right tabular-nums ${neg ? "text-destructive" : ""}`}>{nfSigned(row.total)}</div>
              {ch.titulo !== "Total" && (
                <div className={`w-16 shrink-0 text-right tabular-nums ${row.custo?.estimado ? "text-amber-600" : "text-muted-foreground"}`}
                  title={row.custo?.estimado ? `Custo médio estimado: ${row.custo.motivo ?? "houve saldo negativo"}` : "Custo médio do milheiro"}>
                  {row.total > 0 && row.custo ? `${row.custo.estimado ? "≈" : ""}${fmtCm(row.custo.cm).replace("R$", "").trim()}` : "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-display font-bold">Acompanhamento do estoque</h1><AjudaButton chave="estoque_milhas" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchSelect className="w-72" value={contaId} onChange={setContaId} options={contaOptions} placeholder="Conta" emptyText="Nenhuma conta" />
        <SearchSelect className="w-56" value={estoqueId} onChange={setEstoqueId} options={estoqueOptions} placeholder="Programa" emptyText="Nenhum programa" />
      </div>

      {!parSelecionado ? (
        <>
          <p className="text-sm text-muted-foreground">Selecione uma conta e um programa para ver a conciliação e o movimento das milhas. Os ajustes e o saldo inicial são lançados no menu Estoque › Ajuste.</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {porPrograma.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimento de estoque confirmado ainda.</p>
            ) : porPrograma.map((p) => (
              <Card key={p.nome} className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: corDe(p.nome) }} />{p.nome}
                </div>
                <div className={`text-2xl font-bold tabular-nums ${p.total < 0 ? "text-destructive" : ""}`}>{nfSigned(p.total)}</div>
                <div className="text-xs text-muted-foreground">milhas no estoque (líquido)</div>
                {(() => {
                  const c = custoPorPrograma.get(p.nome);
                  if (!c || c.milhas <= 0) return null;
                  return (
                    <div className="mt-1 flex items-center gap-1 text-xs">
                      <span className={c.estimado ? "text-amber-600" : ""}>{c.estimado ? "≈ " : ""}{fmtCm(c.custo / (c.milhas / 1000))}/milheiro</span>
                      <span className="text-muted-foreground">· {fmtCm(c.custo)} em estoque</span>
                      <DicaCampo texto={`Custo médio do programa = soma do custo em estoque ÷ (soma das milhas ÷ 1.000), só das contas com saldo positivo. ${DICA_CM}${c.estimado ? " " + DICA_ESTIMADO : ""}`} />
                    </div>
                  );
                })()}
              </Card>
            ))}
          </div>

          {porConta.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {charts.map((ch: any) => renderChart(ch))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Saldo calculado (livro)</div>
              <div className="text-2xl font-bold tabular-nums">{nf(calculado)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Saldo lido (programa)</div>
              <div className="text-2xl font-bold tabular-nums">{lido == null ? "—" : nf(lido)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Diferença</div>
                  <div className={`text-2xl font-bold tabular-nums ${diff === 0 ? "text-emerald-600" : diff == null ? "" : "text-amber-600"}`}>{diff == null ? "—" : nfSigned(diff)}</div>
                </div>
                {diff != null && diff !== 0 && (
                  <Button variant="outline" size="sm" onClick={reconciliar} title="Lança um ajuste para igualar ao saldo lido"><Wand2 className="h-3.5 w-3.5 mr-1" />Reconciliar</Button>
                )}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">Custo em estoque<DicaCampo texto={`Custo das milhas que estão no estoque desta conta/programa hoje (zero quando o saldo não é positivo). ${DICA_CM}`} /></div>
              <div className="text-2xl font-bold tabular-nums">{custoSel && custoSel.saldo > 0 ? fmtCm(custoSel.custo) : "—"}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">Custo médio do milheiro<DicaCampo texto={`${DICA_CM}${custoSel?.estimado ? " " + DICA_ESTIMADO : ""}`} /></div>
              <div className={`text-2xl font-bold tabular-nums ${custoSel?.estimado ? "text-amber-600" : ""}`}>{custoSel && (custoSel.saldo > 0 || custoSel.cm) ? `${custoSel.estimado ? "≈ " : ""}${fmtCm(custoSel.cm)}` : "—"}</div>
              {custoSel?.estimado && <div className="text-xs text-amber-600">estimado — {custoSel.motivo ?? "houve saldo negativo"}</div>}
            </Card>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <FiltroPeriodo de={fDe} ate={fAte} onDe={setFDe} onAte={setFAte} />
            <CampoFiltro label="Tipo de movimento">
              <SearchSelect className="w-60" value={fCat} onChange={setFCat} options={CAT_OPTIONS} placeholder="Todos os tipos" />
            </CampoFiltro>
            {temFiltroExtrato && <Button variant="ghost" onClick={() => { setFDe(""); setFAte(""); setFCat(""); }}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <TotalCard titulo={fDe ? "Saldo no início do período" : "Saldo no início"} valor={nf(resumoPeriodo.inicio)}
              dica="Saldo acumulado do extrato até o dia anterior à data 'De'. Sem data 'De', começa do zero." />
            {CATEGORIAS.map((c) => (
              <TotalCard key={c.valor} titulo={c.label} valor={nfSigned(resumoPeriodo.tot[c.valor] || 0)} tom={(resumoPeriodo.tot[c.valor] || 0) === 0 ? "neutro" : c.tom}
                dica={c.dica} ativo={fCat === c.valor} onClick={() => setFCat(fCat === c.valor ? "" : c.valor)} />
            ))}
            <TotalCard titulo={fAte ? "Saldo no fim do período" : "Saldo no fim"} valor={nf(resumoPeriodo.fim)}
              dica="Saldo acumulado do extrato até a data 'Até' (ou até hoje). Fecha a conta: saldo no início + soma dos cards do período = saldo no fim." />
          </div>

          <Card className="overflow-hidden">
            <div className="px-4 py-2 text-sm font-medium bg-muted/40 flex items-center justify-between gap-2">
              <span>Movimento das milhas (confirmados){temFiltroExtrato ? ` — ${extratoFiltrado.length} de ${extrato.length} lançamentos` : ` — ${extrato.length} lançamentos`}</span>
              <Button variant="outline" size="sm" onClick={exportarExtrato} disabled={extratoFiltrado.length === 0}><Download className="h-3.5 w-3.5 mr-1" />Exportar Excel</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Data / hora" sortKey="_sOrdem" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableHead label="Mês referência" sortKey="_sMes" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableHead label="Movimento" sortKey="_sMovimento" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableHead label="Origem / motivo" sortKey="_sOrigem" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableHead label="Entrada/Saída" sortKey="pontos" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" align="right" />
                  <SortableHead label="Saldo" sortKey="saldoCorrente" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" align="right" />
                  <SortableHead label="Custo" sortKey="_sCusto" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" align="right"
                    extra={<DicaCampo texto="Valor em R$ que entrou (+) ou saiu (−) do estoque neste movimento: compra = custo pago; transferência = milhas × custo médio da origem (+ carrinho); emissão/perda = milhas × custo médio do momento." />} />
                  <SortableHead label="Custo médio" sortKey="_sCm" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" align="right"
                    extra={<DicaCampo texto={`Custo médio do milheiro do estoque logo depois deste movimento. Valores com ≈ são estimados. ${DICA_CM}`} />} />
                  <TableHead className="w-[60px] text-right">Ações</TableHead>
                  <SortableHead label="ID" sortKey="codigo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
                ) : extratoFiltrado.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">{temFiltroExtrato ? "Nenhum movimento com esses filtros" : "Sem movimentos confirmados"}</TableCell></TableRow>
                ) : extratoOrdenado.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="py-2 whitespace-nowrap">{fmtDataHora(m.dataHora)}</TableCell>
                    <TableCell className="py-2 tabular-nums">{fmtMesRef(m.referencia || m.data)}</TableCell>
                    <TableCell className="py-2">{tipoLabel(m.tipo)}</TableCell>
                    <TableCell className="py-2 text-muted-foreground">{m.origem || m.descricao}{m.descricao && m.origem && m.descricao !== m.origem ? ` — ${m.descricao}` : ""}</TableCell>
                    <TableCell className={`py-2 text-right tabular-nums ${(Number(m.pontos) || 0) < 0 ? "text-destructive" : "text-emerald-600"}`}>{nfSigned(Number(m.pontos) || 0)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums font-medium">{nf(m.saldoCorrente)}</TableCell>
                    {(() => {
                      const c = custos.porMov.get(m.id);
                      return (
                        <>
                          <TableCell className={`py-2 text-right tabular-nums whitespace-nowrap ${c && c.custoMov < 0 ? "text-destructive" : ""}`}>{c && c.custoMov ? fmtCm(c.custoMov) : "—"}</TableCell>
                          <TableCell className={`py-2 text-right tabular-nums whitespace-nowrap ${c?.estimado ? "text-amber-600" : ""}`} title={c?.estimado ? `Estimado: ${c.motivo ?? "houve saldo negativo"}` : undefined}>
                            {c ? `${c.estimado ? "≈ " : ""}${fmtCm(c.cmApos)}` : "—"}
                          </TableCell>
                        </>
                      );
                    })()}
                    <TableCell className="py-1 text-right">
                      {podeExcluir && m._mov && (
                        (m.tipo === "assinatura" || m.tipo === "bonus") ? (
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Devolver para a Conferência Clubes" onClick={() => handleDevolver(m.id)}>
                            <Undo2 className="h-4 w-4 text-amber-600" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Excluir movimento" onClick={() => handleExcluir(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )
                      )}
                    </TableCell>
                    <TableCell className="py-2 font-mono whitespace-nowrap">{m.codigo || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
