import { useState, useMemo } from "react";
import { usePlanosClube, useUpsertPlanoClube, useDeletePlanoClube, useProgramasEstoque } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
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

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const brl = (n: number) => `R$ ${(Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const emptyForm = { programa_id: "", nome: "", valor: "", milhas: "" };

export default function PlanosClubePage() {
  const { data: planos, isLoading } = usePlanosClube();
  const { data: programas } = useProgramasEstoque();
  const upsert = useUpsertPlanoClube();
  const remove = useDeletePlanoClube();
  const podeExcluir = usePodeExcluir();

  const rows = useMemo(() => (planos ?? []).map((p: any) => ({ ...p, _programa: p.programas_estoque?.nome ?? p.programas?.nome ?? "" })), [planos]);
  const { query, setQuery, filtered } = useSearch<any>(rows, ["nome", "_programa"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "_programa");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      programa_id: p.programa_estoque_id ?? "", nome: p.nome ?? "",
      valor: p.valor?.toString() ?? "", milhas: p.milhas?.toString() ?? "",
    });
    setOpen(true);
  };
  const handleSave = async () => {
    if (!form.programa_id) { toast.error("Selecione o programa."); return; }
    if (!form.nome.trim()) { toast.error("Informe o nome do plano."); return; }
    try {
      await upsert.mutateAsync({
        id: editing?.id, programa_estoque_id: form.programa_id, nome: form.nome,
        valor: Number(form.valor) || 0, milhas: Number(form.milhas) || 0,
      });
      toast.success(editing ? "Plano atualizado!" : "Plano criado!");
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar plano"); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este plano?")) return;
    try { await remove.mutateAsync(id); toast.success("Plano removido!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover plano"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Planos de Clube</h1><AjudaButton chave="planos_clube" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Plano</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por programa ou plano..." />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Programa" sortKey="_programa" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Plano" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Milhas" sortKey="milhas" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Valor" sortKey="valor" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum plano cadastrado</TableCell></TableRow>
            ) : sorted.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="py-2">{p._programa}</TableCell>
                <TableCell className="py-2 font-medium">{p.nome}</TableCell>
                <TableCell className="py-2 tabular-nums">{nf(p.milhas)}</TableCell>
                <TableCell className="py-2 tabular-nums">{brl(p.valor)}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Plano de Clube</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Programa *</Label>
                <Select value={form.programa_id} onValueChange={(v) => set("programa_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o programa" /></SelectTrigger>
                  <SelectContent>
                    {(programas ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1"><Label>Plano *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: 20K" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Milhas (por ciclo)</Label><Input type="number" min={0} value={form.milhas} onChange={(e) => set("milhas", e.target.value)} placeholder="20000" /></div>
              <div className="grid gap-1"><Label>Valor (R$)</Label><NumericInput decimal prefix="R$ " value={Number(form.valor) || 0} onChange={(n) => set("valor", String(n))} placeholder="0,00" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Ao escolher este plano numa assinatura, as milhas e o valor são preenchidos automaticamente — e continuam editáveis lá.</p>
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
