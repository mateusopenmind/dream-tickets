import { useState } from "react";
import { useClientes, useUpsertCliente, useDeleteCliente } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ClientesPage() {
  const { data: clientes, isLoading } = useClientes();
  const upsert = useUpsertCliente();
  const remove = useDeleteCliente();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ codigo: "", nome_fantasia: "" });

  const openNew = () => { setEditing(null); setForm({ codigo: "", nome_fantasia: "" }); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ codigo: c.codigo, nome_fantasia: c.nome_fantasia }); setOpen(true); };

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({ ...form, id: editing?.id });
      toast.success(editing ? "Cliente atualizado!" : "Cliente criado!");
      setOpen(false);
    } catch { toast.error("Erro ao salvar cliente"); }
  };

  const handleDelete = async (id: string) => {
    try { await remove.mutateAsync(id); toast.success("Cliente removido!"); }
    catch { toast.error("Erro ao remover cliente"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Clientes</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome Fantasia</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : clientes?.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum cliente cadastrado</TableCell></TableRow>
            ) : clientes?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm">{c.codigo}</TableCell>
                <TableCell>{c.nome_fantasia}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Cliente</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: A201" />
            </div>
            <div className="grid gap-2">
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia} onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} placeholder="Nome do cliente" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.codigo || !form.nome_fantasia}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
