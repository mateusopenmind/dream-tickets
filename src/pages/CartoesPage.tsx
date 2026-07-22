import { useState, useMemo } from "react";
import { useCartoes, useUpsertCartao, useDeleteCartao } from "@/hooks/useData";
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
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { SearchBar } from "@/components/ui/search-bar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const emptyForm = { codigo: "", nome: "", bandeira: "", titular: "", cpf_cnpj: "", dia_fechamento: "", dia_vencimento: "", limite: "" };

export default function CartoesPage() {
  const { data: cartoes, isLoading } = useCartoes();
  const upsert = useUpsertCartao();
  const remove = useDeleteCartao();
  const podeExcluir = usePodeExcluir();
  const { query, setQuery, filtered } = useSearch<any>(cartoes);
  const [fBandeira, setFBandeira] = useState("__all");
  const bandeiras = useMemo(
    () => Array.from(new Set((cartoes ?? []).map((c: any) => c.bandeira).filter(Boolean))).sort(),
    [cartoes]
  );
  const porBandeira = useMemo(
    () => fBandeira === "__all" ? filtered : (filtered ?? []).filter((c: any) => c.bandeira === fBandeira),
    [filtered, fBandeira]
  );
  const { sorted, key, dir, toggle } = useSort<any>(porBandeira, "nome");
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      codigo: c.codigo ?? "", nome: c.nome ?? "", bandeira: c.bandeira ?? "", titular: c.titular ?? "",
      cpf_cnpj: c.cpf_cnpj ?? "", dia_fechamento: c.dia_fechamento?.toString() ?? "",
      dia_vencimento: c.dia_vencimento?.toString() ?? "", limite: c.limite?.toString() ?? "",
    });
    setOpen(true);
  };
  const handleSave = async () => {
    if (!form.codigo || !form.nome) { toast.error("Código e Nome são obrigatórios."); return; }
    const codDup = (cartoes ?? []).find((x: any) => x.id !== editing?.id && (x.codigo || "").toLowerCase() === form.codigo.toLowerCase());
    if (codDup) { toast.error(`Já existe cartão com o código ${form.codigo}.`); return; }
    try { await upsert.mutateAsync({ ...form, id: editing?.id }); toast.success(editing ? "Cartão atualizado!" : "Cartão criado!"); setOpen(false); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar cartão"); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cartão?")) return;
    try { await remove.mutateAsync(id); toast.success("Cartão removido!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover cartão"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Cartões</h1><AjudaButton chave="cartoes" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Cartão</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por código, nome, bandeira, titular..." />
        <Select value={fBandeira} onValueChange={setFBandeira}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Bandeira" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas as bandeiras</SelectItem>
            {bandeiras.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="codigo" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Bandeira" sortKey="bandeira" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Titular" sortKey="titular" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum cartão</TableCell></TableRow>
            ) : paged.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="py-2 font-mono text-sm">{c.codigo}</TableCell>
                <TableCell className="py-2 font-medium">{c.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.bandeira}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.titular}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Cartão</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Código *</Label><Input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="C6 BR" /></div>
              <div className="grid gap-1"><Label>Bandeira</Label><Input value={form.bandeira} onChange={(e) => set("bandeira", e.target.value)} placeholder="MasterCard / Visa" /></div>
            </div>
            <div className="grid gap-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Titular</Label><Input value={form.titular} onChange={(e) => set("titular", e.target.value)} /></div>
              <div className="grid gap-1"><Label>CPF/CNPJ</Label><Input value={form.cpf_cnpj} onChange={(e) => set("cpf_cnpj", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1"><Label>Dia Fechamento</Label><Input type="number" min={1} max={31} value={form.dia_fechamento} onChange={(e) => set("dia_fechamento", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Dia Vencimento</Label><Input type="number" min={1} max={31} value={form.dia_vencimento} onChange={(e) => set("dia_vencimento", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Limite (R$)</Label><Input type="number" min={0} step="0.01" value={form.limite} onChange={(e) => set("limite", e.target.value)} /></div>
            </div>
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
