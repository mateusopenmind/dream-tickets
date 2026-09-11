import { useState } from "react";
import { useFornecedores, useUpsertFornecedor, useDeleteFornecedor } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { SearchBar } from "@/components/ui/search-bar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const emptyForm = { codigo: "", nome: "", chave_pix: "", ativo: true };

export default function FornecedoresPage() {
  const { data: fornecedores, isLoading } = useFornecedores();
  const upsert = useUpsertFornecedor();
  const remove = useDeleteFornecedor();
  const podeExcluir = usePodeExcluir();
  const { query, setQuery, filtered } = useSearch<any>(fornecedores);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome");
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (f: any) => {
    setEditing(f);
    setForm({
      codigo: f.codigo ?? "", nome: f.nome ?? "", chave_pix: f.chave_pix ?? "",
      ativo: f.ativo ?? true,
    });
    setOpen(true);
  };
  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório."); return; }
    try {
      await upsert.mutateAsync({ ...form, codigo: form.codigo || null, id: editing?.id } as any);
      toast.success(editing ? "Fornecedor atualizado!" : "Fornecedor criado!");
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar fornecedor"); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este fornecedor?")) return;
    try { await remove.mutateAsync(id); toast.success("Fornecedor removido!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover fornecedor"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Fornecedores</h1><AjudaButton chave="fornecedores" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Fornecedor</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por código, nome, chave Pix..." />
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="codigo" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead>Chave Pix</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum fornecedor</TableCell></TableRow>
            ) : paged.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="py-2 font-mono text-sm">{f.codigo || "—"}</TableCell>
                <TableCell className="py-2 font-medium">{f.nome}</TableCell>
                <TableCell className="py-2 font-mono text-xs text-muted-foreground max-w-[220px] truncate">{f.chave_pix || "—"}</TableCell>
                <TableCell className="py-2">
                  {f.ativo ? <Badge className="bg-success text-success-foreground">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Fornecedor</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Código</Label><Input value={form.codigo} readOnly disabled placeholder="Gerado automaticamente (F001, F002...)" className="bg-muted font-mono" /></div>
              <div className="grid gap-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
            </div>
            <div className="grid gap-1"><Label>Chave Pix</Label><Input value={form.chave_pix} onChange={(e) => set("chave_pix", e.target.value)} placeholder="CPF/CNPJ, e-mail, telefone ou aleatória" /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
              <span>Fornecedor ativo</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
