import { useState, useMemo, useEffect } from "react";
import {
  useEstoqueMovimentos, useSaldosLidos, useConfirmarMovimento, useConfirmarMovimentoEditado, useAdicionarMovimento, useExcluirMovimento,
  useProgramasEstoque, useAssinaturas, usePlanosClube,
} from "@/hooks/useClubes";
import { useContas, useCartoes } from "@/hooks/useData";
import { SearchSelect } from "@/components/ui/search-select";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Check, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const nfSigned = (n: number) => `${n > 0 ? "+" : ""}${nf(n)}`;
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const isoHoje = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const horaAgora = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
};
const TIPOS = [
  { v: "abertura", l: "Saldo de abertura", sinal: 1 },
  { v: "bonus", l: "Bônus", sinal: 1 },
  { v: "assinatura", l: "Assinatura", sinal: 1 },
  { v: "reembolso", l: "Reembolso", sinal: 1 },
  { v: "emissao", l: "Emissão", sinal: -1 },
  { v: "ajuste", l: "Ajuste", sinal: 0 },
];
const tipoLabel = (t: string) => TIPOS.find((x) => x.v === t)?.l ?? t;

export default function EstoquePage() {
  const { data: movimentos, isLoading } = useEstoqueMovimentos();
  const { data: saldos } = useSaldosLidos();
  const { data: contas } = useContas();
  const { data: estoques } = useProgramasEstoque();
  const confirmar = useConfirmarMovimento();
  const confirmarEd = useConfirmarMovimentoEditado();
  const adicionar = useAdicionarMovimento();
  const excluir = useExcluirMovimento();
  const podeExcluir = usePodeExcluir();
  const { data: assinaturasData } = useAssinaturas();
  const { data: planosData } = usePlanosClube();
  const { data: cartoesData } = useCartoes();
  const cartaoOptionsConf = useMemo(
    () => [
      { value: "__none", label: "— nenhum —" },
      ...(cartoesData ?? []).slice()
        .map((c: any) => ({ value: c.codigo || "", label: c.codigo || c.nome || "" }))
        .filter((c: any) => c.value)
        .sort((a: any, b: any) => a.label.localeCompare(b.label, "pt-BR", { numeric: true })),
    ],
    [cartoesData]
  );
  const valorPorAssinatura = useMemo(() => {
    const m = new Map<string, number>();
    (assinaturasData ?? []).forEach((a: any) => m.set(a.id, Number(a.valor_parcela) || 0));
    return m;
  }, [assinaturasData]);
  // Plano de cada assinatura
  const planoPorAssinatura = useMemo(() => {
    const m = new Map<string, string>();
    (assinaturasData ?? []).forEach((a: any) => m.set(a.id, a.plano ?? ""));
    return m;
  }, [assinaturasData]);
  // Bônus de cada assinatura (nomes distintos das previsões de bônus, separados por "; ")
  const bonusPorAssinatura = useMemo(() => {
    const acc = new Map<string, string[]>();
    (movimentos ?? []).forEach((mv: any) => {
      if (mv.tipo !== "bonus" || !mv.assinatura_id) return;
      const nome = (mv.origem || "").trim();
      if (!nome) return;
      const arr = acc.get(mv.assinatura_id) ?? [];
      if (!arr.includes(nome)) arr.push(nome);
      acc.set(mv.assinatura_id, arr);
    });
    const m = new Map<string, string>();
    acc.forEach((arr, id) => m.set(id, arr.join("; ")));
    return m;
  }, [movimentos]);

  const [contaId, setContaId] = useState("");
  const [estoqueId, setEstoqueId] = useState("");
  const parSelecionado = !!contaId && !!estoqueId;

  const pairMovs = useMemo(
    () => (movimentos ?? []).filter((m: any) => m.conta_id === contaId && m.programa_estoque_id === estoqueId),
    [movimentos, contaId, estoqueId]
  );
  const confirmados = useMemo(
    () => pairMovs.filter((m: any) => m.confirmado).sort((a: any, b: any) => (a.data ?? "").localeCompare(b.data ?? "")),
    [pairMovs]
  );
  const previstos = useMemo(
    () => pairMovs.filter((m: any) => !m.confirmado).sort((a: any, b: any) => (a.data ?? "").localeCompare(b.data ?? "")),
    [pairMovs]
  );
  const calculado = useMemo(() => confirmados.reduce((s: number, m: any) => s + (Number(m.pontos) || 0), 0), [confirmados]);
  const lido = useMemo(() => {
    const rows = (saldos ?? []).filter((s: any) => s.conta_id === contaId && s.programa_estoque_id === estoqueId);
    if (rows.length === 0) return null;
    const maisRecente = rows.slice().sort((a: any, b: any) => String(b.saldo_atualizado_em ?? "").localeCompare(String(a.saldo_atualizado_em ?? "")))[0];
    return Number(maisRecente.saldo_milhas) || 0;
  }, [saldos, contaId, estoqueId]);
  const diff = lido == null ? null : lido - calculado;

  // Extrato com saldo corrente
  const extrato = useMemo(() => {
    let acc = 0;
    return confirmados.map((m: any) => { acc += Number(m.pontos) || 0; return { ...m, saldoCorrente: acc }; });
  }, [confirmados]);

  // Conferência Clubes (quando nenhum par selecionado): mês atual, atrasadas e próximas
  const hojeISO = isoHoje();
  const mesAtual = hojeISO.slice(0, 7);
  const isVencida = (d: string | null) => !!d && d < hojeISO;
  const ordData = (a: any, b: any) => (a.data ?? "").localeCompare(b.data ?? "");
  const pendentes = useMemo(() => (movimentos ?? []).filter((m: any) => !m.confirmado), [movimentos]);
  const confMes = useMemo(() => pendentes.filter((m: any) => (m.data ?? "").slice(0, 7) === mesAtual).sort(ordData), [pendentes, mesAtual]);
  const confAtrasadas = useMemo(() => pendentes.filter((m: any) => (m.data ?? "").slice(0, 7) < mesAtual).sort(ordData), [pendentes, mesAtual]);
  const confProximas = useMemo(() => pendentes.filter((m: any) => (m.data ?? "").slice(0, 7) > mesAtual).sort(ordData).slice(0, 100), [pendentes, mesAtual]);
  const mesLabel = useMemo(() => {
    const [y, m] = hojeISO.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [hojeISO]);

  const [open, setOpen] = useState(false);
  const [mov, setMov] = useState({ tipo: "ajuste", data: isoHoje(), pontos: "", descricao: "" });
  const setMovField = (k: string, v: string) => setMov((m) => ({ ...m, [k]: v }));

  const handleAdd = async () => {
    if (!parSelecionado) { toast.error("Selecione conta e programa."); return; }
    const val = Number(mov.pontos);
    if (!val) { toast.error("Informe os pontos."); return; }
    const sinal = TIPOS.find((t) => t.v === mov.tipo)?.sinal ?? 0;
    const pontos = sinal === 0 ? val : sinal * Math.abs(val); // ajuste mantém sinal digitado
    try {
      await adicionar.mutateAsync({
        conta_id: contaId, programa_estoque_id: estoqueId, data: mov.data, tipo: mov.tipo,
        pontos, descricao: mov.descricao || null, origem: tipoLabel(mov.tipo),
      });
      toast.success("Movimento lançado!");
      setOpen(false); setMov({ tipo: "ajuste", data: isoHoje(), pontos: "", descricao: "" });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao lançar movimento"); }
  };

  const reconciliar = async () => {
    if (diff == null || diff === 0) { toast.info("Nada a ajustar — já está reconciliado."); return; }
    if (!confirm(`Lançar um ajuste de ${nfSigned(diff)} para igualar o saldo calculado ao saldo lido?`)) return;
    try {
      await adicionar.mutateAsync({
        conta_id: contaId, programa_estoque_id: estoqueId, data: isoHoje(), tipo: "ajuste",
        pontos: diff, descricao: "Ajuste para bater com o saldo lido", origem: "Ajuste",
      });
      toast.success("Ajuste lançado — saldo reconciliado.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao reconciliar"); }
  };

  const handleConfirmar = async (id: string) => {
    try { await confirmar.mutateAsync(id); toast.success("Lançamento confirmado — somado ao estoque."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao confirmar"); }
  };

  // Confirmação via pop-up: todos os campos editáveis. Motivo é SEMPRE opcional.
  const [confMov, setConfMov] = useState<any>(null);
  const [confForm, setConfForm] = useState({ data: "", hora: "", plano: "", pontos: "", valor: "", cartao_codigo: "", cartao_final: "", motivo: "" });
  const openConfirmar = (m: any) => {
    setConfMov(m);
    const vp = m.tipo === "assinatura" ? valorPorAssinatura.get(m.assinatura_id) : undefined;
    setConfForm({
      data: m.data ?? isoHoje(),
      hora: m.hora ? String(m.hora).slice(0, 5) : horaAgora(),
      plano: m.plano ?? "",
      pontos: String(m.pontos ?? ""),
      valor: m.valor != null ? String(m.valor) : (vp != null ? String(vp) : ""),
      cartao_codigo: m.cartao_codigo ?? "",
      cartao_final: m.cartao_final ?? "",
      motivo: "",
    });
  };
  // Planos cadastrados para o programa do lançamento em confirmação
  const planosDoMovConf = useMemo(
    () => (planosData ?? []).filter((p: any) => p.ativo !== false && p.programa_estoque_id === confMov?.programa_estoque_id),
    [planosData, confMov]
  );
  const planoOptionsConf = useMemo(() => {
    const nomes = planosDoMovConf.map((p: any) => p.nome);
    if (confForm.plano && !nomes.includes(confForm.plano)) nomes.push(confForm.plano);
    return nomes;
  }, [planosDoMovConf, confForm.plano]);
  const aplicarPlanoConf = (nome: string) => {
    const p = planosDoMovConf.find((x: any) => x.nome === nome);
    setConfForm((f) => ({
      ...f,
      plano: nome,
      pontos: p?.milhas != null ? String(p.milhas) : f.pontos,
      valor: p?.valor != null ? String(p.valor) : f.valor,
    }));
  };
  const confirmarEditado = async () => {
    if (!confMov) return;
    if (!confForm.data) { toast.error("Informe a data."); return; }
    if (confForm.pontos === "" || Number.isNaN(Number(confForm.pontos))) { toast.error("Informe a quantidade de milhas."); return; }
    try {
      await confirmarEd.mutateAsync({
        id: confMov.id,
        data: confForm.data || null,
        hora: confForm.hora || null,
        plano: confForm.plano.trim() || null,
        pontos: Number(confForm.pontos),
        valor: confForm.valor !== "" ? Number(confForm.valor) : null,
        cartao_codigo: confForm.cartao_codigo.trim() || null,
        cartao_final: confForm.cartao_final.trim() || null,
        motivo: confForm.motivo.trim() || null,
      });
      toast.success("Lançamento confirmado — somado ao estoque.");
      setConfMov(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao confirmar"); }
  };
  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    try { await excluir.mutateAsync(id); toast.success("Lançamento removido."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };

  const contasOrd = useMemo(() => (contas ?? []).slice().sort((a: any, b: any) => (a.nome ?? "").localeCompare(b.nome ?? "")), [contas]);
  const contaOptions = useMemo(
    () => contasOrd.map((c: any) => ({ value: c.id, label: `${c.codigo ? c.codigo + " · " : ""}${c.nome}` })),
    [contasOrd]
  );
  const estoqueOptions = useMemo(
    () => (estoques ?? []).filter((e: any) => e.ativo !== false).slice().sort((a: any, b: any) => (a.nome ?? "").localeCompare(b.nome ?? "")).map((e: any) => ({ value: e.id, label: e.nome })),
    [estoques]
  );

  // Tabela de conferência (usada nos blocos: atrasadas, mês atual e próximas)
  const confTable = (list: any[], vazio = "Nada pendente") => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data prevista</TableHead><TableHead>Conta</TableHead><TableHead>Programa</TableHead>
          <TableHead>Plano</TableHead><TableHead>Bônus</TableHead>
          <TableHead>Origem</TableHead><TableHead className="text-right">Pontos</TableHead>
          <TableHead className="w-[150px] text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.length === 0 ? (
          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{vazio}</TableCell></TableRow>
        ) : list.map((m: any) => {
          const venc = isVencida(m.data);
          return (
            <TableRow key={m.id} className={venc ? "bg-amber-50 dark:bg-amber-950/40" : undefined}>
              <TableCell className="py-2">
                {fmtData(m.data)}
                {venc && <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">atrasada</span>}
              </TableCell>
              <TableCell className="py-2"><span className="font-mono font-semibold text-base">{m.contas?.codigo}</span> <span className="text-sm text-muted-foreground">{m.contas?.nome}</span></TableCell>
              <TableCell className="py-2">{m.programas_estoque?.nome}</TableCell>
              <TableCell className="py-2 text-muted-foreground">{planoPorAssinatura.get(m.assinatura_id) || "—"}</TableCell>
              <TableCell className="py-2 text-muted-foreground">{bonusPorAssinatura.get(m.assinatura_id) || "—"}</TableCell>
              <TableCell className="py-2 text-muted-foreground">{m.origem}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-emerald-600">{nfSigned(Number(m.pontos) || 0)}</TableCell>
              <TableCell className="py-2 text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => openConfirmar(m)}><Check className="h-3.5 w-3.5 mr-1" />Confirmar</Button>
                  {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleExcluir(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Conferência Clubes</h1><AjudaButton chave="estoque" /></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchSelect className="w-72" value={contaId} onChange={setContaId} options={contaOptions} placeholder="Conta" emptyText="Nenhuma conta" />
        <SearchSelect className="w-56" value={estoqueId} onChange={setEstoqueId} options={estoqueOptions} placeholder="Programa" emptyText="Nenhum programa" />
      </div>

      {!parSelecionado ? (
        <>
          <p className="text-sm text-muted-foreground">Conferência Clubes — confira e confirme os créditos previstos. Selecione uma conta e um programa para ver o extrato e a reconciliação de cada uma.</p>

          {confAtrasadas.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-2 text-sm font-medium bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">Atrasadas de meses anteriores — {confAtrasadas.length}</div>
              {confTable(confAtrasadas)}
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="px-4 py-2 text-sm font-medium bg-muted/40 capitalize">Conferência do mês — {mesLabel}</div>
            {confTable(confMes, isLoading ? "Carregando..." : "Nenhuma conferência neste mês")}
          </Card>

          {confProximas.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-2 text-sm font-medium bg-muted/40">Próximas conferências</div>
              {confTable(confProximas)}
            </Card>
          )}
        </>
      ) : (
        <>
          {previstos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conferência pendente para esta conta e programa.</p>
          ) : (
            <Card className="overflow-hidden">
              <div className="px-4 py-2 text-sm font-medium bg-muted/40">Conferência Clubes — a confirmar</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data prevista</TableHead><TableHead>Origem</TableHead>
                    <TableHead className="text-right">Pontos</TableHead><TableHead className="w-[150px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previstos.map((m: any) => (
                    <TableRow key={m.id} className={isVencida(m.data) ? "bg-amber-50 dark:bg-amber-950/40" : undefined}>
                      <TableCell className="py-2">
                        {fmtData(m.data)}
                        {isVencida(m.data) && <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">atrasada</span>}
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground">{m.origem}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-emerald-600">{nfSigned(Number(m.pontos) || 0)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" onClick={() => openConfirmar(m)}><Check className="h-3.5 w-3.5 mr-1" />Confirmar</Button>
                          {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleExcluir(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!confMov} onOpenChange={(o) => !o && setConfMov(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Confirmar lançamento</DialogTitle></DialogHeader>
          {confMov && (
            <div className="grid gap-3 py-2">
              {/* Resumo do lançamento */}
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-mono font-semibold text-base">{confMov.contas?.codigo}</span>{" "}
                <span className="text-muted-foreground">{confMov.contas?.nome}</span>
                <span className="text-muted-foreground"> · {confMov.programas_estoque?.nome} · {confMov.origem}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="grid gap-1"><Label>Data * <span className="text-xs text-muted-foreground">(entra no estoque)</span></Label>
                  <Input type="date" value={confForm.data} onChange={(e) => setConfForm((f) => ({ ...f, data: e.target.value }))} />
                </div>
                <div className="grid gap-1"><Label>Hora</Label>
                  <Input type="time" value={confForm.hora} onChange={(e) => setConfForm((f) => ({ ...f, hora: e.target.value }))} />
                </div>
                <div className="grid gap-1"><Label>Plano</Label>
                  <Select value={confForm.plano || "__none"} onValueChange={(v) => aplicarPlanoConf(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— nenhum —</SelectItem>
                      {planoOptionsConf.map((n: string) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1"><Label>Qtde de milhas *</Label><Input type="number" value={confForm.pontos} onChange={(e) => setConfForm((f) => ({ ...f, pontos: e.target.value }))} /></div>
                <div className="grid gap-1"><Label>Valor (R$)</Label><Input type="number" min={0} step="0.01" value={confForm.valor} onChange={(e) => setConfForm((f) => ({ ...f, valor: e.target.value }))} placeholder="799,90" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1"><Label>Código cartão</Label>
                  <SearchSelect
                    value={confForm.cartao_codigo || "__none"}
                    onChange={(v) => setConfForm((f) => ({ ...f, cartao_codigo: v === "__none" ? "" : v }))}
                    options={cartaoOptionsConf}
                    placeholder="— nenhum —"
                    emptyText="Nenhum cartão"
                  />
                </div>
                <div className="grid gap-1"><Label>Final cartão</Label><Input maxLength={4} value={confForm.cartao_final} onChange={(e) => setConfForm((f) => ({ ...f, cartao_final: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="1234" /></div>
              </div>
              <div className="grid gap-1"><Label>Motivo <span className="text-xs text-muted-foreground">(opcional)</span></Label><Input value={confForm.motivo} onChange={(e) => setConfForm((f) => ({ ...f, motivo: e.target.value }))} placeholder="Opcional — ex.: ajuste de qtde/valor" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfMov(null)}>Cancelar</Button>
            <Button onClick={confirmarEditado} disabled={confirmarEd.isPending}>{confirmarEd.isPending ? "Confirmando..." : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
