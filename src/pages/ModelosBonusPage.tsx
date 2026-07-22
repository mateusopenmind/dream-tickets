import { useState, useMemo } from "react";
import { useBonusModelos, useUpsertBonusModelo, useDeleteBonusModelo, useProgramasEstoque } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchBar } from "@/components/ui/search-bar";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const FREQUENCIAS = [
  { v: "0", l: "Única vez" }, { v: "1", l: "Todo mês" }, { v: "3", l: "A cada 3 meses" },
  { v: "6", l: "A cada 6 meses" }, { v: "12", l: "A cada 12 meses" },
];
const freqLabel = (m: number) => FREQUENCIAS.find((f) => f.v === String(m))?.l ?? `${m}m`;
const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const emptyForm = { nome: "", programa_id: "", pontos: "", frequencia_meses: "0", repeticoes: "1" };

export default function ModelosBonusPage() {
  const { data: modelos, isLoading } = useBonusModelos();
  const { data: programas } = useProgramasEstoque();
  const upsert = useUpsertBonusModelo();
  const remove = useDeleteBonusModelo();
  const podeExcluir = usePodeExcluir();
  const rows = useMemo(() => (modelos ?? []).map((m: any) => ({ ...m, _programa: m.programas_estoque?.nome ?? m.programas?.nome ?? "Todos" })), [modelos]);
  const { query, setQuery, filtered } = useSearch<any>(rows, ["nome", "_programa"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      nome: m.nome ?? "", programa_id: m.programa_estoque_id ?? "", pontos: m.pontos?.toString() ?? "",
      frequencia_meses: m.frequencia_meses?.toString() ?? "0", repeticoes: m.repeticoes?.toString() ?? "1",
    });
    setOpen(true);
  };
  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Informe um nome para o modelo."); return; }
    if (!(Number(form.pontos) > 0)) { toast.error("Informe os pontos."); return; }
    try {
      await upsert.mutateAsync({
        id: editing?.id, nome: form.nome, programa_estoque_id: form.programa_id || null, pontos: Number(form.pontos) || 0,
        frequencia_meses: Number(form.frequencia_meses) || 0, repeticoes: Number(form.repeticoes) || 1,
      });
      toast.success(editing ? "Modelo atualizado!" : "Modelo criado!");
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar modelo"); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este modelo de bônus?")) return;
    try { await remove.mutateAsync(id); toast.success("Modelo removido!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover modelo"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Modelos de Bônus</h1><AjudaButton chave="bonus_modelos" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Modelo</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por nome..." />
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Programa" sortKey="_programa" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Pontos" sortKey="pontos" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead>Frequência</TableHead>
              <TableHead className="text-center">Repetir</TableHead>
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum modelo cadastrado</TableCell></TableRow>
            ) : sorted.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="py-2 font-medium">{m.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{m._programa}</TableCell>
                <TableCell className="py-2 tabular-nums">{nf(m.pontos)}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{freqLabel(m.frequencia_meses)}</TableCell>
                <TableCell className="py-2 text-center">{m.frequencia_meses === 0 ? "—" : m.repeticoes}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Modelo de Bônus</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Bônus trimestral 5K" /></div>
            <div className="grid gap-1"><Label>Programa</Label>
              <Select value={form.programa_id || "__all"} onValueChange={(v) => set("programa_id", v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">— todos os programas —</SelectItem>
                  {(programas ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1"><Label>Pontos *</Label><Input type="number" min={0} value={form.pontos} onChange={(e) => set("pontos", e.target.value)} placeholder="5000" /></div>
              <div className="grid gap-1"><Label>Frequência</Label>
                <Select value={form.frequencia_meses} onValueChange={(v) => set("frequencia_meses", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIAS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1"><Label>Repetir</Label><Input type="number" min={1} value={form.repeticoes} disabled={form.frequencia_meses === "0"} onChange={(e) => set("repeticoes", e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Estes padrões ficam disponíveis para selecionar ao montar os bônus de uma assinatura. A data da 1ª entrada é definida na assinatura.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
