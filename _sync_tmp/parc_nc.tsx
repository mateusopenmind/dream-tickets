import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEstoqueCompras, useSalvarCompra, useProgramasEstoque, custoMilheiro } from "@/hooks/useClubes";
import { useContas, useCartoes } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { ArrowLeft } from "lucide-react";
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
const brl = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const emptyForm = {
  data: isoHoje(), hora: "", conta_id: "", programa_estoque_id: "", qtde: "", custo_total: "",
  num_parcelas: "", forma_pagamento: "", valor_parcela: "", operacao: "", descricao: "",
};

export default function NovaCompraPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const { data: compras } = useEstoqueCompras();
  const { data: contas } = useContas();
  const { data: cartoes } = useCartoes();
  const { data: estoques } = useProgramasEstoque();
  const salvar = useSalvarCompra();

  const [form, setForm] = useState(() => ({ ...emptyForm, hora: horaAgora() }));
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    const c = (compras ?? []).find((x: any) => x.id === id);
    if (!c) return;
    setForm({
      data: c.data ?? isoHoje(), hora: c.hora ?? "", conta_id: c.conta_id ?? "", programa_estoque_id: c.programa_estoque_id ?? "",
      qtde: c.qtde?.toString() ?? "", custo_total: c.custo_total?.toString() ?? "",
      num_parcelas: c.num_parcelas?.toString() ?? "", forma_pagamento: c.forma_pagamento ?? "",
      valor_parcela: c.valor_parcela?.toString() ?? "", operacao: c.operacao ?? "", descricao: c.descricao ?? "",
    });
  }, [editing, id, compras]);

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

  const milheiro = useMemo(
    () => custoMilheiro(Number(form.custo_total) || 0, Number(form.qtde) || 0),
    [form.custo_total, form.qtde]
  );

  const voltar = () => navigate("/estoque-compras");

  const handleSave = async () => {
    if (!form.conta_id) { toast.error("Selecione a conta."); return; }
    if (!form.programa_estoque_id) { toast.error("Selecione o estoque."); return; }
    if (!form.data) { toast.error("Informe a data."); return; }
    if (!(Number(form.qtde) > 0)) { toast.error("Informe a quantidade de milhas."); return; }
    try {
      await salvar.mutateAsync({
        id: editing ? id : undefined,
        data: form.data, hora: form.hora || null, conta_id: form.conta_id, programa_estoque_id: form.programa_estoque_id,
        qtde: Number(form.qtde) || 0,
        custo_total: form.custo_total === "" ? null : Number(form.custo_total),
        num_parcelas: form.num_parcelas === "" ? null : Number(form.num_parcelas),
        forma_pagamento: form.forma_pagamento || null,
        valor_parcela: form.valor_parcela === "" ? null : Number(form.valor_parcela),
        operacao: form.operacao || null,
        descricao: form.descricao || null,
      });
      toast.success(editing ? "Compra atualizada!" : "Compra lançada — somada ao estoque.");
      voltar();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar compra"); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold">{editing ? "Editar" : "Nova"} Compra</h1>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Data *</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Hora</Label><Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Operação</Label><Input value={form.operacao} onChange={(e) => set("operacao", e.target.value)} placeholder="Ex.: Assinatura de clube / Compra avulsa" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Conta *</Label>
              <SearchSelect value={form.conta_id} onChange={(v) => set("conta_id", v)} options={contaOptions} placeholder="Selecione a conta" emptyText="Nenhuma conta" />
            </div>
            <div className="grid gap-1"><Label>Programa *</Label>
              <Select value={form.programa_estoque_id} onValueChange={(v) => set("programa_estoque_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o programa" /></SelectTrigger>
                <SelectContent>
                  {estoqueOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum programa cadastrado</div>
                  ) : estoqueOptions.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Qtde de milhas *</Label><Input type="number" min={0} value={form.qtde} onChange={(e) => set("qtde", e.target.value)} placeholder="20000" /></div>
            <div className="grid gap-1"><Label>Custo total (R$)</Label><Input type="number" min={0} step="0.01" value={form.custo_total} onChange={(e) => setForm((f) => ({ ...f, custo_total: e.target.value, valor_parcela: calcParcela(e.target.value, f.num_parcelas) }))} placeholder="799,90" /></div>
            <div className="grid gap-1"><Label>Custo milheiro</Label><Input value={milheiro ? brl(milheiro) : "—"} readOnly disabled /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Nº de parcelas</Label><Input type="number" min={1} value={form.num_parcelas} onChange={(e) => setForm((f) => ({ ...f, num_parcelas: e.target.value, valor_parcela: calcParcela(f.custo_total, e.target.value) }))} placeholder="1" /></div>
            <div className="grid gap-1"><Label>Valor parcela (R$)</Label><Input type="number" min={0} step="0.01" value={form.valor_parcela} onChange={(e) => set("valor_parcela", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Cartão</Label><SearchSelect value={form.forma_pagamento || "__none"} onChange={(v) => set("forma_pagamento", v === "__none" ? "" : v)} options={cartaoOptions} placeholder="— nenhum —" emptyText="Nenhum cartão" /></div>
          </div>
          <div className="grid gap-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Anotações desta compra" rows={2} /></div>
          <p className="text-xs text-muted-foreground">Ao salvar, as milhas entram (+) no estoque da conta/programa.</p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={voltar}>Cancelar</Button>
          <Button onClick={handleSave} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </Card>
    </div>
  );
}
