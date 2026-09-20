import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAssinaturas, useDeleteAssinatura } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { SearchBar } from "@/components/ui/search-bar";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const PERIODICIDADES = [
  { v: "1", l: "Mensal" }, { v: "2", l: "Bimestral" }, { v: "3", l: "Trimestral" },
  { v: "6", l: "Semestral" }, { v: "12", l: "Anual" },
];
const STATUS = [
  { v: "ativo", l: "Ativo" }, { v: "atrasado", l: "Atrasado" },
  { v: "cancelado", l: "Cancelado" }, { v: "vai_cancelar", l: "Vai cancelar" },
  { v: "sem_clube", l: "Sem clube" },
];
const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const periodLabel = (m: number) => PERIODICIDADES.find((p) => p.v === String(m))?.l ?? `${m}m`;
const statusLabel = (s: string) => STATUS.find((x) => x.v === s)?.l ?? s;

export default function AssinaturasPage() {
  const navigate = useNavigate();
  const { data: assinaturas, isLoading } = useAssinaturas();
  const remove = useDeleteAssinatura();
  const podeExcluir = usePodeExcluir();

  const rows = useMemo(() => (assinaturas ?? []).map((a: any) => ({
    ...a,
    _conta: `${a.contas?.codigo ?? ""} ${a.contas?.nome ?? ""}`.trim(),
    _programa: a.programas_estoque?.nome ?? a.programas?.nome ?? "",
    _plano: a.plano ?? "",
  })), [assinaturas]);
  const { query, setQuery, filtered } = useSearch<any>(rows, ["_conta", "_programa", "_plano", "status"]);
  const [fPrograma, setFPrograma] = useState("__all");
  const programasNomes = useMemo(
    () => Array.from(new Set((assinaturas ?? []).map((a: any) => a.programas_estoque?.nome ?? a.programas?.nome).filter(Boolean))).sort(),
    [assinaturas]
  );
  const porPrograma = useMemo(
    () => fPrograma === "__all" ? filtered : (filtered ?? []).filter((a: any) => (a.programas_estoque?.nome ?? a.programas?.nome) === fPrograma),
    [filtered, fPrograma]
  );
  const { sorted, key, dir, toggle } = useSort<any>(porPrograma, "created_at");
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta assinatura? As previsões não confirmadas serão removidas (as já confirmadas permanecem no extrato).")) return;
    try { await remove.mutateAsync(id); toast.success("Assinatura removida!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover assinatura"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Assinaturas</h1><AjudaButton chave="assinaturas" /></div>
        <Button onClick={() => navigate("/assinaturas/nova")}><Plus className="h-4 w-4 mr-2" />Nova Assinatura</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por conta, programa, plano..." />
        <Select value={fPrograma} onValueChange={setFPrograma}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Programa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os programas</SelectItem>
            {programasNomes.map((p: any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              <SortableHead label="Programa" sortKey="_programa" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Crédito base</TableHead>
              <TableHead>Periodic.</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Vencto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma assinatura</TableCell></TableRow>
            ) : paged.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="py-2"><span className="font-mono font-semibold text-base">{a.contas?.codigo}</span> <span className="text-sm text-muted-foreground">{a.contas?.nome}</span></TableCell>
                <TableCell className="py-2">{a.programas_estoque?.nome ?? a.programas?.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{a.plano}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{nf(a.credito_base)}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{periodLabel(a.periodicidade_meses)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{a.valor_parcela ? `R$ ${(Number(a.valor_parcela)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                <TableCell className="py-2 text-center">{a.dia_vencimento ?? "—"}</TableCell>
                <TableCell className="py-2">{statusLabel(a.status)}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/assinaturas/${a.id}/editar`)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
      </Card>
    </div>
  );
}
