import { useState } from "react";
import { useCartoes, useUpsertCartao, useDeleteCartao } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CartoesPage() {
  const { data: cartoes, isLoading } = useCartoes();
  const upsert = useUpsertCartao();
  const remove = useDeleteCartao();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ codigo: "", nome: "" });

  const openNew = () => { setEditing(null); setForm({ codigo: "", nome: "" }); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ codigo: c.codigo, nome: c.nome }); setOpen(true); };

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({ ...form, id: editing?.id });
      toast.success(editing ? "Cartão atualizado!" : "Cartão criado!");
      setOpen(false);
    } catch { toast.error("Erro ao salvar cartão"); }
  };

  const handleDelete = async (id: string) => {
    try { await remove.mutateAsync(id); toast.success("Cartão removido!"); }
    catch { toast.error("Erro ao remover cartão"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Cartões</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Cartão</Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : cartoes?.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum cartão cadastrado</TableCell></TableRow>
            ) : cartoes?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm">{c.codigo}</TableCell>
                <TableCell>{c.nome}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Cartão</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: IP BR" />
            </div>
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do cartão" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.codigo || !form.nome}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
