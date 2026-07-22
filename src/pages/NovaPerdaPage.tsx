import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEstoquePerdas, useSalvarPerda, useProgramasEstoque } from "@/hooks/useClubes";
import { useContas } from "@/hooks/useData";
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
const emptyForm = { data: isoHoje(), hora: "", conta_id: "", programa_estoque_id: "", qtde: "", operacao: "", descricao: "" };

export default function NovaPerdaPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const { data: perdas } = useEstoquePerdas();
  const { data: contas } = useContas();
  const { data: estoques } = useProgramasEstoque();
  const salvar = useSalvarPerda();

  const [form, setForm] = useState(() => ({ ...emptyForm, hora: horaAgora() }));
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    const p = (perdas ?? []).find((x: any) => x.id === id);
    if (!p) return;
    setForm({
      data: p.data ?? isoHoje(), hora: p.hora ?? "", conta_id: p.conta_id ?? "", programa_estoque_id: p.programa_estoque_id ?? "",
      qtde: p.qtde?.toString() ?? "", operacao: p.operacao ?? "", descricao: p.descricao ?? "",
    });
  }, [editing, id, perdas]);

  const contaOptions = useMemo(
    () => (contas ?? []).slice()
      .sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true }))
      .map((c: any) => ({ value: c.id, label: c.codigo || c.nome || "", searchText: c.nome || "" })),
    [contas]
  );
  const estoqueOptions = useMemo(
    () => (estoques ?? []).filter((e: any) => e.ativo !== false).map((e: any) => ({ id: e.id, nome: e.nome })),
    [estoques]
  );

  const voltar = () => navigate("/estoque-perdas");

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
        operacao: form.operacao || null,
        descricao: form.descricao || null,
      });
      toast.success(editing ? "Perda atualizada!" : "Perda lançada — descontada do estoque.");
      voltar();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar perda"); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold">{editing ? "Editar" : "Nova"} Perda</h1>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Data *</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Hora</Label><Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Operação</Label><Input value={form.operacao} onChange={(e) => set("operacao", e.target.value)} placeholder="Ex.: Expiração / Estorno" /></div>
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
          <div className="grid gap-1 sm:max-w-xs"><Label>Qtde de milhas *</Label><Input type="number" min={0} value={form.qtde} onChange={(e) => set("qtde", e.target.value)} placeholder="10000" /></div>
          <div className="grid gap-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Motivo da perda" rows={2} /></div>
          <p className="text-xs text-muted-foreground">Ao salvar, as milhas saem (−) do estoque da conta/programa.</p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={voltar}>Cancelar</Button>
          <Button onClick={handleSave} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </Card>
    </div>
  );
}
