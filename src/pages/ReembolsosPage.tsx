import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReembolsos, useDeleteReembolso } from "@/hooks/useData";
import { usePodeExcluir } from "@/hooks/usePerfil";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchBar } from "@/components/ui/search-bar";
import { SortableHead } from "@/components/ui/sortable-head";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { useSearch } from "@/hooks/useSearch";
import { useSort } from "@/hooks/useSort";
import { usePagination } from "@/hooks/usePagination";
import { AjudaButton } from "@/components/AjudaButton";
import { ReembolsosDashboard } from "@/components/ReembolsosDashboard";
import { ReembolsoFormDialog } from "@/components/ReembolsoFormDialog";
import { Plus, Pencil, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

const TIPO_LABEL: Record<string, string> = {
  total: "Total",
  parcial: "Parcial",
  taxas: "Taxas",
};
const MOTIVO_LABEL: Record<string, string> = {
  mudanca_planos: "Mudança de planos",
  atestado_medico: "Atestado médico",
  alteracao_cia: "Alteração/cancelamento Cia.",
  erro_emissao: "Erro na emissão",
};

const fmtMoeda = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMilhas = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
const fmtDataHora = (s?: string | null) =>
  s ? `${new Date(s).toLocaleDateString("pt-BR")} ${new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—";

export default function ReembolsosPage() {
  const navigate = useNavigate();
  const { data: reembolsos, isLoading } = useReembolsos();
  const deleteMutation = useDeleteReembolso();
  const podeExcluir = usePodeExcluir(); // só admin/super admin

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  // Não lista reembolsos cuja cobrança Pix foi cancelada (status_pix = CANCELADO).
  const visiveis = (reembolsos ?? []).filter((r: any) => r.status_pix !== "CANCELADO");
  const { query, setQuery, filtered } = useSearch(visiveis, ["reembolso_id", "id_emissao", "localizador", "programa", "conta", "tipo", "motivo"]);
  // padrão: Data/Hora com o mais novo primeiro
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "created_at", "desc");
  const { page, setPage, totalPages, paged, total, from, to } = usePagination(sorted, 100);

  const openNew = () => navigate("/reembolsos/novo");
  const openEdit = (r: any) => { setEditing(r); setOpen(true); };

  // Cobrança ativa = tem Pix gerado e não está cancelada (mesma regra das emissões).
  const temCobrancaAtiva = (r: any) => !!r.forma_cobranca && r.status_pix !== "CANCELADO";

  const handleDelete = async (r: any) => {
    try {
      await deleteMutation.mutateAsync(r.id);
      toast.success("Reembolso excluído.");
      setConfirmDelete(null);
    } catch (e: any) {
      // A RLS bloqueia a exclusão quando há cobrança ativa e o usuário não é admin.
      const msg = /row-level security|permission|violates|policy/i.test(String(e?.message || ""))
        ? "Sem permissão para excluir: este reembolso tem cobrança ativa. Cancele a cobrança primeiro, ou peça a um administrador."
        : (e?.message || "Erro ao excluir.");
      toast.error(msg);
    }
  };

  const clienteLabel = (r: any) => (r.clientes ? `${r.clientes.codigo} - ${r.clientes.nome_fantasia}` : "—");

  // Badge de situação (Cobrança), no mesmo padrão das emissões.
  const statusBadge = (r: any) => {
    if (r.sentido === "cobrar") {
      if (r.status_pix === "PAGO") return <Badge className="bg-success text-success-foreground">PAGO</Badge>;
      if (r.status_pix === "CANCELADO") return <Badge className="bg-destructive text-destructive-foreground">CANCELADO</Badge>;
      if (r.status_pix === "EM ABERTO") return <Badge className="bg-warning text-warning-foreground">EM ABERTO</Badge>;
      return <Badge variant="outline">A COBRAR</Badge>;
    }
    return r.pago
      ? <Badge className="bg-success text-success-foreground">PAGO</Badge>
      : <Badge className="bg-warning text-warning-foreground">A REEMBOLSAR</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Undo2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Reembolsos</h1>
          <AjudaButton chave="reembolsos" />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Reembolso</Button>
      </div>

      <ReembolsosDashboard reembolsos={reembolsos} />

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar por localizador, ID, tipo ou motivo..." />

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="ID" sortKey="reembolso_id" activeKey={key} dir={dir} onSort={toggle} className="whitespace-nowrap" />
                  <SortableHead label="Data/Hora" sortKey="created_at" activeKey={key} dir={dir} onSort={toggle} className="whitespace-nowrap" />
                  <SortableHead label="Localizador" sortKey="localizador" activeKey={key} dir={dir} onSort={toggle} />
                  <SortableHead label="Programa" sortKey="programa" activeKey={key} dir={dir} onSort={toggle} />
                  <TableHead>Operação</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Total Milhas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <SortableHead label="Tipo" sortKey="tipo" activeKey={key} dir={dir} onSort={toggle} />
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Reemb. Cliente</TableHead>
                  <TableHead className="text-right">Reemb. Dream</TableHead>
                  <TableHead className="w-20 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-2 font-mono text-sm whitespace-nowrap">{r.reembolso_id || "—"}</TableCell>
                    <TableCell className="py-2 whitespace-nowrap text-sm">{fmtDataHora(r.created_at)}</TableCell>
                    <TableCell className="py-2 font-mono text-sm font-semibold">{r.localizador || "—"}</TableCell>
                    <TableCell className="py-2">{r.programa || "—"}</TableCell>
                    <TableCell className="py-2">{r.operacao || "—"}</TableCell>
                    <TableCell className="py-2 font-mono text-sm">{r.clientes?.codigo || "—"}</TableCell>
                    <TableCell className="py-2 font-mono text-sm">{r.conta || "—"}</TableCell>
                    <TableCell className="py-2 text-right font-mono whitespace-nowrap">{fmtMilhas(r.total_milhas)}</TableCell>
                    <TableCell className="py-2 text-right font-mono whitespace-nowrap">{fmtMoeda(r.emissao_total)}</TableCell>
                    <TableCell className="py-2">{statusBadge(r)}</TableCell>
                    <TableCell className="py-2">{TIPO_LABEL[r.tipo] ?? r.tipo}{r.tipo === "parcial" && r.pax_qtd ? ` (${r.pax_qtd} pax)` : ""}</TableCell>
                    <TableCell className="py-2 text-sm">{MOTIVO_LABEL[r.motivo] ?? r.motivo ?? "—"}</TableCell>
                    <TableCell className="py-2 text-right">{fmtMoeda(r.total_cliente)}</TableCell>
                    <TableCell className="py-2 text-right">{fmtMoeda(r.total_dream)}</TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        {podeExcluir && <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(r)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {total === 0 && (
                  <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-6">Nenhum reembolso registrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
          </Card>

          {/* Mobile */}
          <div className="lg:hidden space-y-3">
            {paged.map((r: any) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.localizador || "—"} <span className="text-xs font-mono text-muted-foreground">{r.reembolso_id || ""}</span></p>
                    <p className="text-xs text-muted-foreground">{fmtDataHora(r.created_at)} · {r.programa || "—"}{r.operacao ? ` · ${r.operacao}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{clienteLabel(r)}{r.conta ? ` · Conta ${r.conta}` : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {statusBadge(r)}
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      {podeExcluir && <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(r)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <span>Total Milhas: {fmtMilhas(r.total_milhas)}</span>
                  <span>Total: {fmtMoeda(r.emissao_total)}</span>
                  <span>Tipo: <strong>{TIPO_LABEL[r.tipo] ?? r.tipo}</strong></span>
                  <span>Motivo: {MOTIVO_LABEL[r.motivo] ?? r.motivo ?? "—"}</span>
                  <span>Reemb. Cliente: {fmtMoeda(r.total_cliente)}</span>
                  <span>Reemb. Dream: {fmtMoeda(r.total_dream)}</span>
                </div>
              </Card>
            ))}
            {total === 0 && <p className="text-center text-muted-foreground py-6">Nenhum reembolso registrado</p>}
            <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
          </div>
        </>
      )}

      <ReembolsoFormDialog open={open} onOpenChange={setOpen} editing={editing} />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(null)}>
          <Card className="max-w-sm p-4 m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">Excluir reembolso?</h3>
            <p className="text-sm text-muted-foreground mb-3">Esta ação não pode ser desfeita. A emissão original não é afetada.</p>
            {temCobrancaAtiva(confirmDelete) && (
              <p className="text-sm rounded-md border border-warning/40 bg-warning/10 text-warning px-3 py-2 mb-3">
                ⚠️ Este reembolso tem cobrança Pix ativa. Só é possível excluir depois de cancelar a cobrança — ou por um administrador.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => handleDelete(confirmDelete)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Excluindo..." : "Excluir"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
