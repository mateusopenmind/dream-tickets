import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEstoqueCompras, useExcluirCompra } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchBar } from "@/components/ui/search-bar";
import { useSearch } from "@/hooks/useSearch";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const brl = (n: number | null | undefined) =>
  n == null ? "—" : (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export default function ComprasPage() {
  const navigate = useNavigate();
  const { data: compras, isLoading } = useEstoqueCompras();
  const excluir = useExcluirCompra();
  const podeExcluir = usePodeExcluir();

  const rows = useMemo(() => (compras ?? []).map((c: any) => ({
    ...c,
    _conta: `${c.contas?.codigo ?? ""} ${c.contas?.nome ?? ""}`.trim(),
    _estoque: c.programas_estoque?.nome ?? "",
  })), [compras]);
  const { query, setQuery, filtered } = useSearch<any>(rows, ["_conta", "_estoque", "forma_pagamento", "descricao", "operacao"]);

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir esta compra? Ela deixa de contar no estoque.")) return;
    try { await excluir.mutateAsync(id); toast.success("Compra removida."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Compras</h1>
        <Button onClick={() => navigate("/estoque-compras/nova")}><Plus className="h-4 w-4 mr-2" />Nova compra</Button>
      </div>

      <p className="text-sm text-muted-foreground">Entrada de milhas por compra/assinatura. Cada compra soma no estoque da conta e programa.</p>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por conta, programa, forma de pagamento..." />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Conta</TableHead><TableHead>Programa</TableHead>
              <TableHead className="text-right">Qtde</TableHead><TableHead className="text-right">Custo total</TableHead>
              <TableHead className="text-right">Parcelas</TableHead><TableHead>Forma pgto</TableHead>
              <TableHead className="text-right">Vlr parcela</TableHead><TableHead className="text-right">Custo milheiro</TableHead>
              <TableHead>Descrição</TableHead><TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Nenhuma compra lançada</TableCell></TableRow>
            ) : filtered.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="py-2">{fmtData(c.data)}</TableCell>
                <TableCell className="py-2"><span className="font-mono font-semibold text-base">{c.contas?.codigo}</span> <span className="text-sm text-muted-foreground">{c.contas?.nome}</span></TableCell>
                <TableCell className="py-2">{c.programas_estoque?.nome}</TableCell>
                <TableCell className="py-2 text-right tabular-nums text-emerald-600">+{nf(c.qtde)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{brl(c.custo_total)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{c.num_parcelas ?? "—"}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.forma_pagamento || "—"}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{brl(c.valor_parcela)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{c.custo_milheiro ? brl(c.custo_milheiro) : "—"}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.descricao || "—"}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/estoque-compras/${c.id}/editar`)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleExcluir(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
