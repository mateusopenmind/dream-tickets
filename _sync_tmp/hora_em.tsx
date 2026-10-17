import { useState, useMemo, useEffect } from "react";
import {
  useEstoqueMovimentos, useSaldosLidos, useAdicionarMovimento, useExcluirMovimento, useDesconfirmarMovimento,
  useEstoqueCompras, useEstoqueTransferencias, useEstoquePerdas, useProgramasEstoque, useProgramasComEstoque,
} from "@/hooks/useClubes";
import { useContas, useEmissoes, useReembolsos } from "@/hooks/useData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchSelect } from "@/components/ui/search-select";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Wand2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const nfSigned = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}`;
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
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
  const contaOptions = useMemo(() => contasOrd.map((c: any) => ({ value: c.id, label: `${c.codigo ? c.codigo + " · " : ""}${c.nome}` })), [contasOrd]);
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
    // Emissões (débito) — resolvidas para o estoque do programa de emissão
    (emissoesData ?? []).filter((e: any) => e.conta_id && !e.cancelar).forEach((e: any) => add(e.conta_id, resolveEstoqueNome(e.programa), e.contas, -(Number(e.milhas_real) || Number(e.total_milhas) || 0)));
    // Reembolsos (crédito) — conta = código; resolvidos para o estoque
    (reembolsosData ?? []).filter((r: any) => (Number(r.dt_milhas) || 0) > 0).forEach((r: any) => {
      const c = contaByCodigo.get(r.conta);
      if (c) add(c.id, resolveEstoqueNome(r.programa), c, Number(r.dt_milhas) || 0);
    });
    // Compras (crédito)
    (comprasData ?? []).forEach((c: any) => add(c.conta_id, c.programas_estoque?.nome, c.contas, Number(c.qtde) || 0));
    // Perdas (débito)
    (perdasData ?? []).forEach((p: any) => add(p.conta_id, p.programas_estoque?.nome, p.contas, -(Number(p.qtde) || 0)));
    // Transferências — sai do remetente (−) e entra no recebedor (+ com bônus)
    (transferenciasData ?? []).forEach((t: any) => {
      add(t.conta_remetente_id, t.prog_remetente?.nome, t.remetente, -(Number(t.qtde_transferida) || 0));
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
        .map((x: any) => ({ conta_id: x.conta_id, conta: x.conta, total: x.saldo }))
        .sort((a: any, b: any) => Math.abs(b.total) - Math.abs(a.total));
      list.push({ titulo: p.nome, rows, max: rows.length ? Math.max(...rows.map((r: any) => Math.abs(r.total))) || 1 : 1 });
    });
    return list;
  }, [porConta, maxConta, porPrograma, saldosDet]);

  // ----- Detalhe (conta + estoque selecionados): conciliação e movimento -----
  const confirmados = useMemo(() => {
    if (!parSelecionado) return [];
    const base = (movimentos ?? [])
      .filter((m: any) => m.conta_id === contaId && m.programa_estoque_id === estoqueId && m.confirmado)
      .map((m: any) => ({ id: m.id, data: m.data, dataHora: toDataHora(m.data, m.hora, m.data_hora), tipo: m.tipo, origem: m.origem, descricao: m.descricao, pontos: Number(m.pontos) || 0, _mov: true }));
    const emis = (emissoesData ?? [])
      .filter((e: any) => e.conta_id === contaId && resolveEstoqueNome(e.programa) === estoqueNomeSel && !e.cancelar)
      .map((e: any) => ({ id: "emi_" + e.id, data: e.data_emissao, dataHora: toDataHora(e.data_emissao, e.hora, null), tipo: "emissao", origem: `Emissão ${e.id_emissao || e.localizador || ""}`.trim(), descricao: e.programa, pontos: -(Number(e.milhas_real) || Number(e.total_milhas) || 0), _mov: false }));
    const cod = contaSel?.codigo ?? "";
    const reem = (reembolsosData ?? [])
      .filter((r: any) => (r.conta || "") === cod && resolveEstoqueNome(r.programa) === estoqueNomeSel && (Number(r.dt_milhas) || 0) > 0)
      .map((r: any) => ({ id: "reem_" + r.id, data: r.milhas_reembolsadas_em || (r.created_at ? String(r.created_at).slice(0, 10) : null), dataHora: toDataHora(r.milhas_reembolsadas_em || (r.created_at ? String(r.created_at).slice(0, 10) : null), null, null), tipo: "reembolso", origem: `Reembolso ${r.reembolso_id || ""}`.trim(), descricao: r.programa, pontos: Number(r.dt_milhas) || 0, _mov: false }));
    const comp = (comprasData ?? [])
      .filter((c: any) => c.conta_id === contaId && c.programa_estoque_id === estoqueId)
      .map((c: any) => ({ id: "comp_" + c.id, data: c.data, dataHora: toDataHora(c.data, c.hora, c.data_hora), tipo: "compra", origem: c.operacao || "Compra", descricao: c.descricao, pontos: Number(c.qtde) || 0, _mov: false }));
    const perd = (perdasData ?? [])
      .filter((p: any) => p.conta_id === contaId && p.programa_estoque_id === estoqueId)
      .map((p: any) => ({ id: "perd_" + p.id, data: p.data, dataHora: toDataHora(p.data, p.hora, p.data_hora), tipo: "perda", origem: p.operacao || "Perda", descricao: p.descricao, pontos: -(Number(p.qtde) || 0), _mov: false }));
    const transfSaida = (transferenciasData ?? [])
      .filter((t: any) => t.conta_remetente_id === contaId && t.programa_estoque_remetente_id === estoqueId)
      .map((t: any) => ({ id: "tsai_" + t.id, data: t.data, dataHora: toDataHora(t.data, t.hora, t.data_hora), tipo: "transferencia", origem: `Transferência p/ ${t.prog_recebedor?.nome ?? ""}`.trim(), descricao: t.descricao, pontos: -(Number(t.qtde_transferida) || 0), _mov: false }));
    const transfEntrada = (transferenciasData ?? [])
      .filter((t: any) => t.conta_recebedora_id === contaId && t.programa_estoque_recebedor_id === estoqueId)
      .map((t: any) => ({ id: "tent_" + t.id, data: t.data, dataHora: toDataHora(t.data, t.hora, t.data_hora), tipo: "transferencia", origem: `Transferência de ${t.prog_remetente?.nome ?? ""}`.trim(), descricao: t.descricao, pontos: Number(t.qtde_recebida) || 0, _mov: false }));
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          </div>

          <Card className="overflow-hidden">
            <div className="px-4 py-2 text-sm font-medium bg-muted/40">Movimento das milhas (confirmados)</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / hora</TableHead><TableHead>Movimento</TableHead><TableHead>Origem / motivo</TableHead>
                  <TableHead className="text-right">Entrada/Saída</TableHead><TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-[60px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
                ) : extrato.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem movimentos confirmados</TableCell></TableRow>
                ) : extrato.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="py-2 whitespace-nowrap">{fmtDataHora(m.dataHora)}</TableCell>
                    <TableCell className="py-2">{tipoLabel(m.tipo)}</TableCell>
                    <TableCell className="py-2 text-muted-foreground">{m.origem || m.descricao}{m.descricao && m.origem && m.descricao !== m.origem ? ` — ${m.descricao}` : ""}</TableCell>
                    <TableCell className={`py-2 text-right tabular-nums ${(Number(m.pontos) || 0) < 0 ? "text-destructive" : "text-emerald-600"}`}>{nfSigned(Number(m.pontos) || 0)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums font-medium">{nf(m.saldoCorrente)}</TableCell>
                    <TableCell className="py-2 text-right">
                      {podeExcluir && m._mov && (
                        (m.tipo === "assinatura" || m.tipo === "bonus") ? (
                          <Button variant="ghost" size="icon" title="Devolver para a Conferência Clubes" onClick={() => handleDevolver(m.id)}>
                            <Undo2 className="h-4 w-4 text-amber-600" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Excluir movimento" onClick={() => handleExcluir(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )
                      )}
                    </TableCell>
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
