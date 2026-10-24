import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useAssinaturas, useSalvarAssinatura, getBonusDaAssinatura, getAcoesDaAssinatura, getHistoricoDaAssinatura, useBonusModelos,
  useContaProgramasList, usePlanosClube, type BonusInput,
} from "@/hooks/useClubes";
import { useContas, useCartoes } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { ArrowLeft, Plus, Trash2, Gift, CalendarClock, History } from "lucide-react";
import { toast } from "sonner";

// A assinatura de clube é sempre mensal.
const PERIODICIDADES = [{ v: "1", l: "Mensal" }];
const FREQUENCIAS = [
  { v: "0", l: "Única vez" }, { v: "1", l: "Todo mês" }, { v: "3", l: "A cada 3 meses" },
  { v: "6", l: "A cada 6 meses" }, { v: "12", l: "A cada 12 meses" },
];
const STATUS = [
  { v: "ativo", l: "Ativo" }, { v: "atrasado", l: "Atrasado" },
  { v: "cancelado", l: "Cancelado" }, { v: "vai_cancelar", l: "Vai cancelar" },
];

// `nome` guarda o nome do modelo de bônus (quando veio de um) — vai para a Origem na Conferência.
type BonusRow = { id?: string; nome?: string; pontos: string; frequencia_meses: string; repeticoes: string; primeira_entrada: string };
// Data ISO de hoje + N dias (usada para preencher e limitar o campo "Assinante desde")
const isoAddDias = (dias: number) => {
  const n = new Date();
  n.setDate(n.getDate() + dias);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const emptyForm = {
  conta_id: "", programa_id: "", plano: "", credito_base: "", periodicidade_meses: "1",
  valor_parcela: "", dia_vencimento: "", cartao_id: "", cartao_virtual: "", assinante_desde: "", status: "ativo", observacao: "",
};

export default function NovaAssinaturaPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const { data: assinaturas } = useAssinaturas();
  const { data: contas } = useContas();
  const { data: cartoes } = useCartoes();
  const { data: modelos } = useBonusModelos();
  const { data: contaProgramas } = useContaProgramasList();
  const { data: planos } = usePlanosClube();
  const salvar = useSalvarAssinatura();

  const [form, setForm] = useState({ ...emptyForm, assinante_desde: isoAddDias(0) });
  const maxAssinanteDesde = isoAddDias(365);
  const [bonus, setBonus] = useState<BonusRow[]>([]);
  const [acoes, setAcoes] = useState<{ id?: string; titulo: string; data: string }[]>([]);
  const [historico, setHistorico] = useState<{ id?: string; data: string; descricao: string }[]>([]);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Carrega a assinatura ao editar
  useEffect(() => {
    if (!editing) return;
    const a = (assinaturas ?? []).find((x: any) => x.id === id);
    if (!a) return;
    setForm({
      conta_id: a.conta_id ?? "", programa_id: a.programa_estoque_id ?? "", plano: a.plano ?? "",
      credito_base: a.credito_base?.toString() ?? "", periodicidade_meses: a.periodicidade_meses?.toString() ?? "1",
      valor_parcela: a.valor_parcela?.toString() ?? "", dia_vencimento: a.dia_vencimento?.toString() ?? "",
      cartao_id: a.cartao_id ?? "", cartao_virtual: a.cartao_virtual ?? "", assinante_desde: a.assinante_desde ?? "", status: a.status ?? "ativo", observacao: a.observacao ?? "",
    });
    getBonusDaAssinatura(a.id).then((bs) => setBonus(bs.map((b) => ({
      id: b.id, nome: b.descricao ?? "", pontos: b.pontos?.toString() ?? "", frequencia_meses: b.frequencia_meses?.toString() ?? "0",
      repeticoes: b.repeticoes?.toString() ?? "1", primeira_entrada: b.primeira_entrada ?? "",
    })))).catch(() => {});
    getAcoesDaAssinatura(a.id).then(setAcoes).catch(() => {});
    getHistoricoDaAssinatura(a.id).then(setHistorico).catch(() => {});
  }, [editing, id, assinaturas]);

  const contaOptions = useMemo(
    () => (contas ?? []).slice()
      .sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true }))
      .map((c: any) => ({ value: c.id, label: `${c.codigo ? c.codigo + " · " : ""}${c.nome}` })),
    [contas]
  );
  const cartaoOptions = useMemo(
    () => [
      { value: "__none", label: "— nenhum —" },
      ...(cartoes ?? []).slice()
        .map((c: any) => ({ value: c.id, label: c.codigo || c.nome || "" }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label, "pt-BR", { numeric: true })),
    ],
    [cartoes]
  );
  const programaOptionsForm = useMemo(() => {
    if (!form.conta_id) return [];
    const vistos = new Set<string>();
    return (contaProgramas ?? [])
      .filter((r: any) => r.conta_id === form.conta_id && r.programa_estoque_id)
      .filter((r: any) => (vistos.has(r.programa_estoque_id) ? false : (vistos.add(r.programa_estoque_id), true)))
      .map((r: any) => ({ id: r.programa_estoque_id, nome: r.programas_estoque?.nome ?? "", ativo: r.ativo }))
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [contaProgramas, form.conta_id]);

  // Planos do programa selecionado — ao escolher, preenche milhas e valor (editáveis depois)
  const planosDoPrograma = useMemo(
    () => (planos ?? []).filter((p: any) => p.ativo !== false && p.programa_estoque_id === form.programa_id),
    [planos, form.programa_id]
  );
  const planoOptions = useMemo(() => {
    const nomes = planosDoPrograma.map((p: any) => p.nome);
    if (form.plano && !nomes.includes(form.plano)) nomes.push(form.plano);
    return nomes;
  }, [planosDoPrograma, form.plano]);
  const aplicarPlano = (nome: string) => {
    const p = planosDoPrograma.find((x: any) => x.nome === nome);
    if (!p) { set("plano", nome); return; }
    setForm((f) => ({
      ...f,
      plano: p.nome,
      credito_base: p.milhas != null ? String(p.milhas) : f.credito_base,
      valor_parcela: p.valor != null ? String(p.valor) : f.valor_parcela,
    }));
  };

  // Modelos de bônus do programa da assinatura (os sem programa valem para todos)
  const modelosDoPrograma = useMemo(
    () => (modelos ?? []).filter((m: any) => m.ativo !== false && (!m.programa_estoque_id || m.programa_estoque_id === form.programa_id)),
    [modelos, form.programa_id]
  );

  const addBonus = () => setBonus((b) => [...b, { pontos: "", frequencia_meses: "0", repeticoes: "1", primeira_entrada: "" }]);
  const addBonusDoModelo = (modeloId: string) => {
    const m = (modelos ?? []).find((x: any) => x.id === modeloId);
    if (!m) return;
    setBonus((b) => [...b, {
      nome: m.nome ?? "",
      pontos: m.pontos?.toString() ?? "", frequencia_meses: m.frequencia_meses?.toString() ?? "0",
      repeticoes: m.repeticoes?.toString() ?? "1", primeira_entrada: "",
    }]);
  };
  const setBonusField = (i: number, k: keyof BonusRow, v: string) =>
    setBonus((b) => b.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const removeBonus = (i: number) => setBonus((b) => b.filter((_, idx) => idx !== i));
  const addAcao = () => setAcoes((a) => [...a, { titulo: "", data: "" }]);
  const setAcaoField = (i: number, k: "titulo" | "data", v: string) => setAcoes((a) => a.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const removeAcao = (i: number) => setAcoes((a) => a.filter((_, idx) => idx !== i));
  const addHist = () => setHistorico((h) => [...h, { data: "", descricao: "" }]);
  const setHistField = (i: number, k: "data" | "descricao", v: string) => setHistorico((h) => h.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const removeHist = (i: number) => setHistorico((h) => h.filter((_, idx) => idx !== i));

  const voltar = () => navigate("/assinaturas");

  const handleSave = async () => {
    if (!form.conta_id) { toast.error("Selecione a conta."); return; }
    if (!form.programa_id) { toast.error("Selecione o programa."); return; }
    const dup = (assinaturas ?? []).find((x: any) => x.id !== id && x.conta_id === form.conta_id && x.programa_estoque_id === form.programa_id);
    if (dup) { toast.error("Já existe uma assinatura para esta conta neste programa."); return; }
    if (form.assinante_desde && form.assinante_desde > maxAssinanteDesde) {
      toast.error("A data 'Assinante desde' não pode passar de 365 dias a partir de hoje."); return;
    }
    for (const b of bonus) {
      if (!(Number(b.pontos) > 0)) { toast.error("Preencha os Pontos de todos os bônus (obrigatório)."); return; }
      if (!b.primeira_entrada) { toast.error("Preencha a 1ª entrada de todos os bônus (obrigatório)."); return; }
    }
    const bonusInput: BonusInput[] = bonus
      .filter((b) => Number(b.pontos) > 0)
      .map((b) => ({
        id: b.id, pontos: Number(b.pontos) || 0, frequencia_meses: Number(b.frequencia_meses) || 0,
        repeticoes: Number(b.repeticoes) || 1, primeira_entrada: b.primeira_entrada || null,
        descricao: b.nome?.trim() || null,
      }));
    try {
      await salvar.mutateAsync({
        id: editing ? id : undefined,
        conta_id: form.conta_id, programa_estoque_id: form.programa_id, plano: form.plano || null,
        credito_base: Number(form.credito_base) || 0, periodicidade_meses: Number(form.periodicidade_meses) || 1,
        valor_parcela: Number(form.valor_parcela) || 0,
        dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
        cartao_id: form.cartao_id || null, cartao_virtual: form.cartao_virtual || null,
        assinante_desde: form.assinante_desde || null, observacao: form.observacao || null,
        status: form.status, ativo: form.status !== "cancelado", bonus: bonusInput, acoes, historico,
      });
      toast.success(editing ? "Assinatura atualizada! Previsão regerada." : "Assinatura criada! Previsão gerada.");
      voltar();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar assinatura"); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold">{editing ? "Editar" : "Nova"} Assinatura de Clube</h1>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Conta *</Label>
              <SearchSelect value={form.conta_id} onChange={(v) => set("conta_id", v)} options={contaOptions} placeholder="Selecione a conta" emptyText="Nenhuma conta" />
            </div>
            <div className="grid gap-1"><Label>Programa *</Label>
              <Select value={form.programa_id} onValueChange={(v) => set("programa_id", v)} disabled={!form.conta_id}>
                <SelectTrigger><SelectValue placeholder={form.conta_id ? "Selecione o programa" : "Escolha a conta primeiro"} /></SelectTrigger>
                <SelectContent>
                  {programaOptionsForm.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Esta conta não tem programas vinculados</div>
                  ) : programaOptionsForm.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}{p.ativo === false ? " (inativo)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Plano do clube</Label>
              <Select value={form.plano} onValueChange={aplicarPlano} disabled={!form.programa_id}>
                <SelectTrigger><SelectValue placeholder={form.programa_id ? "Selecione o plano" : "Escolha o programa primeiro"} /></SelectTrigger>
                <SelectContent>
                  {planoOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum plano cadastrado para este programa</div>
                  ) : planoOptions.map((n: string) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Assinatura Clube (entra no estoque)</Label><Input type="number" min={0} value={form.credito_base} onChange={(e) => set("credito_base", e.target.value)} placeholder="20000" /></div>
            <div className="grid gap-1"><Label>Periodicidade</Label>
              <Select value={form.periodicidade_meses} onValueChange={(v) => set("periodicidade_meses", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Valor parcela (R$)</Label><NumericInput decimal prefix="R$ " value={Number(form.valor_parcela) || 0} onChange={(n) => set("valor_parcela", String(n))} placeholder="0,00" /></div>
            <div className="grid gap-1"><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={form.dia_vencimento} onChange={(e) => set("dia_vencimento", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Cartão</Label>
              <SearchSelect value={form.cartao_id || "__none"} onChange={(v) => set("cartao_id", v === "__none" ? "" : v)} options={cartaoOptions} placeholder="— nenhum —" emptyText="Nenhum cartão" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Assinante desde</Label><Input type="date" max={maxAssinanteDesde} value={form.assinante_desde} onChange={(e) => set("assinante_desde", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Cartão virtual (4 últimos dígitos)</Label><Input inputMode="numeric" maxLength={4} value={form.cartao_virtual} onChange={(e) => set("cartao_virtual", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" /></div>
          </div>

          <div className="mt-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Gift className="h-4 w-4" />Bônus de assinatura</div>
              <div className="flex items-center gap-2">
                <Select value="" onValueChange={addBonusDoModelo}>
                  <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Adicionar do modelo" /></SelectTrigger>
                  <SelectContent>
                    {modelosDoPrograma.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">{form.programa_id ? "Nenhum modelo para este programa" : "Escolha o programa primeiro"}</div>
                    ) : modelosDoPrograma.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={addBonus}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar bônus</Button>
              </div>
            </div>
            {bonus.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum bônus. Use "Adicionar bônus" para créditos extras (ex.: 10.000 única vez, 5.000 a cada 3 meses).</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1.2fr_0.7fr_1fr_auto] gap-2 text-xs text-muted-foreground px-1">
                  <span>Pontos *</span><span>Frequência</span><span>Repetir</span><span>1ª entrada *</span><span></span>
                </div>
                {bonus.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.2fr_0.7fr_1fr_auto] gap-2 items-center">
                    <Input type="number" min={0} value={b.pontos} onChange={(e) => setBonusField(i, "pontos", e.target.value)} placeholder="10000" />
                    <Select value={b.frequencia_meses} onValueChange={(v) => setBonusField(i, "frequencia_meses", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FREQUENCIAS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min={1} value={b.repeticoes} disabled={b.frequencia_meses === "0"} onChange={(e) => setBonusField(i, "repeticoes", e.target.value)} />
                    <Input type="date" value={b.primeira_entrada} onChange={(e) => setBonusField(i, "primeira_entrada", e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeBonus(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Ao salvar, o sistema gera os lançamentos previstos no Estoque (painel Previsão). Nada entra no saldo até ser confirmado.</p>
          </div>

          <div className="mt-2 border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="h-4 w-4" />Próximas ações</div>
              <Button type="button" variant="outline" size="sm" onClick={addAcao}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar ação</Button>
            </div>
            {acoes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma ação. Cadastre o que precisa ser feito e a data (ex.: renovar clube, trocar cartão). Entra na central de pendências e no calendário.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_180px_auto] gap-2 text-xs text-muted-foreground px-1"><span>Ação</span><span>Data</span><span></span></div>
                {acoes.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_180px_auto] gap-2 items-center">
                    <Input value={r.titulo} onChange={(e) => setAcaoField(i, "titulo", e.target.value)} placeholder="Ex.: renovar clube / trocar cartão" />
                    <Input type="date" value={r.data} onChange={(e) => setAcaoField(i, "data", e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAcao(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" />Histórico do plano</div>
              <Button type="button" variant="outline" size="sm" onClick={addHist}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar histórico</Button>
            </div>
            {historico.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum registro. Use para anotar o que muda no plano ao longo do tempo (ex.: migrou de 20K para 90K, reajuste da parcela, troca de cartão).</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_180px_auto] gap-2 text-xs text-muted-foreground px-1"><span>O que mudou</span><span>Data</span><span></span></div>
                {historico.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_180px_auto] gap-2 items-center">
                    <Input value={r.descricao} onChange={(e) => setHistField(i, "descricao", e.target.value)} placeholder="Ex.: migrou do plano 20K para 90K" />
                    <Input type="date" value={r.data} onChange={(e) => setHistField(i, "data", e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeHist(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-1"><Label>Observação</Label><Textarea value={form.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="Anotações gerais desta assinatura" rows={3} /></div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={voltar}>Cancelar</Button>
          <Button onClick={handleSave} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </Card>
    </div>
  );
}
