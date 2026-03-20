import { useState } from "react";
import { useProgramas, useOperacoes, useOrigens, useEmissores } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";

type LookupTable = "programas" | "operacoes" | "origens" | "emissores";

interface LookupItem {
  id: string;
  nome: string;
}

function LookupCrud({ table, queryKey, items, isLoading }: { table: LookupTable; queryKey: string; items: LookupItem[] | undefined; isLoading: boolean }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LookupItem | null>(null);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setNome(""); setDialogOpen(true); };
  const openEdit = (item: LookupItem) => { setEditing(item); setNome(item.nome); setDialogOpen(true); };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from(table).update({ nome: nome.trim() }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Atualizado com sucesso");
      } else {
        const { error } = await supabase.from(table).insert({ nome: nome.trim() });
        if (error) throw error;
        toast.success("Adicionado com sucesso");
      }
      qc.invalidateQueries({ queryKey: [queryKey] });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir?")) return;
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído com sucesso");
      qc.invalidateQueries({ queryKey: [queryKey] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.nome}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!items || items.length === 0) && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">Nenhum item cadastrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Novo"} item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const programas = useProgramas();
  const operacoes = useOperacoes();
  const origens = useOrigens();
  const emissores = useEmissores();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
      </div>

      <Tabs defaultValue="programas">
        <TabsList>
          <TabsTrigger value="programas">Programas</TabsTrigger>
          <TabsTrigger value="operacoes">Operações</TabsTrigger>
          <TabsTrigger value="emissores">Emissores</TabsTrigger>
          <TabsTrigger value="origens">Origens</TabsTrigger>
        </TabsList>

        <TabsContent value="programas" className="mt-4">
          <LookupCrud table="programas" queryKey="programas" items={programas.data} isLoading={programas.isLoading} />
        </TabsContent>
        <TabsContent value="operacoes" className="mt-4">
          <LookupCrud table="operacoes" queryKey="operacoes" items={operacoes.data} isLoading={operacoes.isLoading} />
        </TabsContent>
        <TabsContent value="emissores" className="mt-4">
          <LookupCrud table="emissores" queryKey="emissores" items={emissores.data} isLoading={emissores.isLoading} />
        </TabsContent>
        <TabsContent value="origens" className="mt-4">
          <LookupCrud table="origens" queryKey="origens" items={origens.data} isLoading={origens.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
