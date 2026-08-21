import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEstoquePerdas, useExcluirPerda } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchBar } from "@/components/ui/search-bar";
import { useSearch } from "@/hooks/useSearch";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export default function PerdasPage() {
  const navigate = useNavigate();
  const { data: perdas, isLoading } = useEstoquePerdas();
  const excluir = useExcluirPerda();
  const podeExcluir = usePodeExcluir();

  const rows = useMemo(() => (perdas ?? []).map((p: any) => ({
    ...p,
    _conta: `${p.contas?.codigo ?? ""} ${p.contas?.nome ?? ""}`.trim(),
    _estoque: p.programas_estoque?.nome ?? "",
  })), [perdas]);
  const { query, setQuery, filtered } = useSearch<any>(rows, ["_conta", "_estoque", "descricao", "operacao"]);

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir esta perda? Ela deixa de contar no estoque.")) return;
    try { await excluir.mutateAsync(id); toast.success("Perda removida."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Perdas</h1>
        <Button onClick={() => navigate("/estoque-perdas/nova")}><Plus className="h-4 w-4 mr-2" />Nova perda</Button>
      </div>

      <p className="text-sm text-muted-foreground">Saída de milhas por perda/expiração/estorno. Cada perda diminui o estoque da conta e programa.</p>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por conta, programa, motivo..." />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Conta</TableHead><TableHead>Programa</TableHead>
              <TableHead>Operação</TableHead><TableHead>Descrição</TableHead>
              <TableHead className="text-right">Qtde</TableHead><TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma perda lançada</TableCell></TableRow>
            ) : filtered.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="py-2">{fmtData(p.data)}</TableCell>
                <TableCell className="py-2"><span className="font-mono text-xs text-muted-foreground">{p.contas?.codigo}</span></TableCell>
                <TableCell className="py-2">{p.programas_estoque?.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{p.operacao || "—"}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{p.descricao || "—"}</TableCell>
                <TableCell className="py-2 text-right tabular-nums text-destructive">-{nf(p.qtde)}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/estoque-perdas/${p.id}/editar`)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleExcluir(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
