import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEstoqueTransferencias, useSalvarTransferencia, useProgramasEstoque, qtdeRecebida } from "@/hooks/useClubes";
import { useContas, useCartoes } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const isoHoje = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const horaAgora = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
};

const calcParcela = (custo: string, parcelas: string) => {
  const c = Number(custo) || 0;
  const n = Number(parcelas) || 0;
  return c > 0 && n > 0 ? (c / n).toFixed(2) : "";
};
const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const emptyForm = {
  data: isoHoje(),
  hora: "",
  conta_remetente_id: "", programa_estoque_remetente_id: "",
  conta_recebedora_id: "", programa_estoque_recebedor_id: "",
  qtde_transferida: "", bonus_pct: "",
  custo_total: "", num_parcelas: "", forma_pagamento: "", valor_parcela: "", descricao: "",
};

export default function NovaTransferenciaPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const { data: transfers } = useEstoqueTransferencias();
  const { data: contas } = useContas();
  const { data: cartoes } = useCartoes();
  const { data: estoques } = useProgramasEstoque();
  const salvar = useSalvarTransferencia();

  const [form, setForm] = useState(() => ({ ...emptyForm, hora: horaAgora() }));
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    const t = (transfers ?? []).find((x: any) => x.id === id);
    if (!t) return;
    setForm({
      data: t.data ?? isoHoje(),
      hora: t.hora ?? "",
      conta_remetente_id: t.conta_remetente_id ?? "", programa_estoque_remetente_id: t.programa_estoque_remetente_id ?? "",
      conta_recebedora_id: t.conta_recebedora_id ?? "", programa_estoque_recebedor_id: t.programa_estoque_recebedor_id ?? "",
      qtde_transferida: t.qtde_transferida?.toString() ?? "",
      bonus_pct: t.bonus != null ? String(Number(t.bonus) * 100) : "",
      custo_total: t.custo_total?.toString() ?? "", num_parcelas: t.num_parcelas?.toString() ?? "",
      forma_pagamento: t.forma_pagamento ?? "", valor_parcela: t.valor_parcela?.toString() ?? "", descricao: t.descricao ?? "",
    });
  }, [editing, id, transfers]);

  const contaOptions = useMemo(
    () => (contas ?? []).slice()
      .sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true }))
      .map((c: any) => ({ value: c.id, label: c.codigo || c.nome || "", searchText: c.nome || "" })),
    [contas]
  );
  const cartaoOptions = useMemo(
    () => [
      { value: "__none", label: "— nenhum —" },
      ...(cartoes ?? []).slice()
        .map((c: any) => ({ value: c.codigo || c.nome || "", label: c.codigo || c.nome || "" }))
        .filter((o: any) => o.value)
        .sort((a: any, b: any) => a.label.localeCompare(b.label, "pt-BR", { numeric: true })),
    ],
    [cartoes]
  );
  const estoqueOptions = useMemo(
    () => (estoques ?? []).filter((e: any) => e.ativo !== false).map((e: any) => ({ id: e.id, nome: e.nome })),
    [estoques]
  );

  const recebida = useMemo(
    () => qtdeRecebida(Number(form.qtde_transferida) || 0, (Number(form.bonus_pct) || 0) / 100),
    [form.qtde_transferida, form.bonus_pct]
  );

  const voltar = () => navigate("/estoque-transferencias");

  const handleSave = async () => {
    if (!form.conta_remetente_id || !form.programa_estoque_remetente_id) { toast.error("Selecione a conta e o estoque de origem."); return; }
    if (!form.conta_recebedora_id || !form.programa_estoque_recebedor_id) { toast.error("Selecione a conta e o estoque de destino."); return; }
    if (!form.data) { toast.error("Informe a data."); return; }
    if (!(Number(form.qtde_transferida) > 0)) { toast.error("Informe a quantidade transferida."); return; }
    if (form.conta_remetente_id === form.conta_recebedora_id && form.programa_estoque_remetente_id === form.programa_estoque_recebedor_id) {
      toast.error("Origem e destino não podem ser o mesmo par conta/programa."); return;
    }
    try {
      await salvar.mutateAsync({
        id: editing ? id : undefined,
        data: form.data,
        hora: form.hora || null,
        conta_remetente_id: form.conta_remetente_id, programa_estoque_remetente_id: form.programa_estoque_remetente_id,
        conta_recebedora_id: form.conta_recebedora_id, programa_estoque_recebedor_id: form.programa_estoque_recebedor_id,
        qtde_transferida: Number(form.qtde_transferida) || 0,
        bonus: (Number(form.bonus_pct) || 0) / 100,
        custo_total: form.custo_total === "" ? null : Number(form.custo_total),
        num_parcelas: form.num_parcelas === "" ? null : Number(form.num_parcelas),
        forma_pagamento: form.forma_pagamento || null,
        valor_parcela: form.valor_parcela === "" ? null : Number(form.valor_parcela),
        descricao: form.descricao || null,
      });
      toast.success(editing ? "Transferência atualizada!" : "Transferência lançada — origem descontada e destino somado.");
      voltar();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar transferência"); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold">{editing ? "Editar" : "Nova"} Transferência</h1>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-md">
            <div className="grid gap-1"><Label>Data *</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Hora</Label><Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-sm font-medium text-destructive">Origem (sai −)</div>
              <div className="grid gap-1"><Label>Conta *</Label>
                <SearchSelect value={form.conta_remetente_id} onChange={(v) => setForm((f) => ({ ...f, conta_remetente_id: v, conta_recebedora_id: f.conta_recebedora_id || v }))} options={contaOptions} placeholder="Conta de origem" emptyText="Nenhuma conta" />
              </div>
              <div className="grid gap-1"><Label>Programa *</Label>
                <Select value={form.programa_estoque_remetente_id} onValueChange={(v) => set("programa_estoque_remetente_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Programa de origem" /></SelectTrigger>
                  <SelectContent>
                    {estoqueOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum programa cadastrado</div>
                    ) : estoqueOptions.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-sm font-medium text-emerald-600">Destino (entra +)</div>
              <div className="grid gap-1"><Label>Conta *</Label>
                <SearchSelect value={form.conta_recebedora_id} onChange={(v) => set("conta_recebedora_id", v)} options={contaOptions} placeholder="Conta de destino" emptyText="Nenhuma conta" />
              </div>
              <div className="grid gap-1"><Label>Programa *</Label>
                <Select value={form.programa_estoque_recebedor_id} onValueChange={(v) => set("programa_estoque_recebedor_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Programa de destino" /></SelectTrigger>
                  <SelectContent>
                    {estoqueOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum programa cadastrado</div>
                    ) : estoqueOptions.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Qtde transferida *</Label><Input type="number" min={0} value={form.qtde_transferida} onChange={(e) => set("qtde_transferida", e.target.value)} placeholder="55000" /></div>
            <div className="grid gap-1"><Label>Bônus (%)</Label><Input type="number" min={0} step="0.01" value={form.bonus_pct} onChange={(e) => set("bonus_pct", e.target.value)} placeholder="35" /></div>
            <div className="grid gap-1"><Label>Qtde recebida (destino)</Label><Input value={nf(recebida)} readOnly disabled /></div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-destructive tabular-nums">-{nf(Number(form.qtde_transferida) || 0)}</span>
            <ArrowRight className="h-4 w-4" />
            <span className="text-emerald-600 tabular-nums">+{nf(recebida)}</span>
            <span>(inclui o bônus)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
            <div className="grid gap-1"><Label>Custo total (R$)</Label><Input type="number" min={0} step="0.01" value={form.custo_total} onChange={(e) => setForm((f) => ({ ...f, custo_total: e.target.value, valor_parcela: calcParcela(e.target.value, f.num_parcelas) }))} placeholder="opcional" /></div>
            <div className="grid gap-1"><Label>Nº de parcelas</Label><Input type="number" min={1} value={form.num_parcelas} onChange={(e) => setForm((f) => ({ ...f, num_parcelas: e.target.value, valor_parcela: calcParcela(f.custo_total, e.target.value) }))} /></div>
            <div className="grid gap-1"><Label>Valor parcela (R$)</Label><Input type="number" min={0} step="0.01" value={form.valor_parcela} onChange={(e) => set("valor_parcela", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Cartão</Label><SearchSelect value={form.forma_pagamento || "__none"} onChange={(v) => set("forma_pagamento", v === "__none" ? "" : v)} options={cartaoOptions} placeholder="— nenhum —" emptyText="Nenhum cartão" /></div>
          </div>
          <div className="grid gap-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex.: Transferência integral com bônus 35%" rows={2} /></div>
          <p className="text-xs text-muted-foreground">Ao salvar, o estoque da origem diminui em {nf(Number(form.qtde_transferida) || 0)} e o do destino aumenta em {nf(recebida)}.</p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={voltar}>Cancelar</Button>
          <Button onClick={handleSave} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </Card>
    </div>
  );
}
