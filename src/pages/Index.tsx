import { useState, useMemo } from "react";
import { useEmissoes, useUpsertEmissao, useDeleteEmissao } from "@/hooks/useData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, BanknoteIcon, Filter } from "lucide-react";
import { toast } from "sonner";
import { EmissaoFormDialog } from "@/components/EmissaoFormDialog";
import { DashboardCards } from "@/components/DashboardCards";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function EmissoesPage() {
  const { data: emissoes, isLoading } = useEmissoes();
  const upsertMutation = useUpsertEmissao();
  const deleteMutation = useDeleteEmissao();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterMesAtual, setFilterMesAtual] = useState(false);
  const [filterPixAberto, setFilterPixAberto] = useState(false);

  const filtered = useMemo(() => {
    if (!emissoes) return [];
    let list = [...emissoes];
    if (filterMesAtual) {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      list = list.filter(e => {
        const d = new Date(e.data_emissao);
        return d >= start && d <= end;
      });
    }
    if (filterPixAberto) {
      list = list.filter(e => e.status_pix === "EM ABERTO");
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(e =>
        e.localizador?.toLowerCase().includes(s) ||
        (e.clientes as any)?.nome_fantasia?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [emissoes, filterMesAtual, filterPixAberto, search]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (e: any) => { setEditing(e); setOpen(true); };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); toast.success("Emissão removida!"); }
    catch { toast.error("Erro ao remover"); }
  };

  const handleCobrar = async (e: any) => {
    try {
      await upsertMutation.mutateAsync({ ...e, status_pix: "EM ABERTO", id: e.id });
      toast.success("Status atualizado para EM ABERTO!");
    } catch { toast.error("Erro ao atualizar status"); }
  };

  const statusBadge = (status: string | null) => {
    switch (status) {
      case "PAGO": return <Badge className="bg-success text-success-foreground">PAGO</Badge>;
      case "CANCELADO": return <Badge className="bg-destructive text-destructive-foreground">CANCELADO</Badge>;
      default: return <Badge className="bg-warning text-warning-foreground">EM ABERTO</Badge>;
    }
  };

  const formatCurrency = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div>
      <DashboardCards emissoes={emissoes} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Emissões</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Emissão</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button
          variant={filterMesAtual ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterMesAtual(!filterMesAtual)}
        >
          <Filter className="h-3 w-3 mr-1" />Mês Atual
        </Button>
        <Button
          variant={filterPixAberto ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterPixAberto(!filterPixAberto)}
        >
          <BanknoteIcon className="h-3 w-3 mr-1" />Pix em Aberto
        </Button>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar localizador ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Localizador</TableHead>
              <TableHead>Programa</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Pix</TableHead>
              <TableHead className="w-[130px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhuma emissão encontrada</TableCell></TableRow>
            ) : filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{e.data_emissao ? format(new Date(e.data_emissao + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="font-mono text-sm font-semibold">{e.localizador}</TableCell>
                <TableCell>{e.programa || "—"}</TableCell>
                <TableCell>{e.nome_operacao || "—"}</TableCell>
                <TableCell>{(e.clientes as any)?.nome_fantasia || "—"}</TableCell>
                <TableCell>{(e.contas as any)?.nome || "—"}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(e.preco_total)}</TableCell>
                <TableCell>{statusBadge(e.status_pix)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(e)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)} title="Deletar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleCobrar(e)} title="Cobrar"><BanknoteIcon className="h-4 w-4 text-warning" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmissaoFormDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}
