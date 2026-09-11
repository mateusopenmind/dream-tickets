import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEstoqueTransferencias, useExcluirTransferencia } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchBar } from "@/components/ui/search-bar";
import { useSearch } from "@/hooks/useSearch";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const pct = (frac: number) => `${((Number(frac) || 0) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export default function TransferenciasPage() {
  const navigate = useNavigate();
  const { data: transfers, isLoading } = useEstoqueTransferencias();
  const excluir = useExcluirTransferencia();
  const podeExcluir = usePodeExcluir();

  const rows = useMemo(() => (transfers ?? []).map((t: any) => ({
    ...t,
    _origem: `${t.remetente?.codigo ?? ""} ${t.remetente?.nome ?? ""} ${t.prog_remetente?.nome ?? ""}`.trim(),
    _destino: `${t.recebedora?.codigo ?? ""} ${t.recebedora?.nome ?? ""} ${t.prog_recebedor?.nome ?? ""}`.trim(),
  })), [transfers]);
  const { query, setQuery, filtered } = useSearch<any>(rows, ["_origem", "_destino", "descricao"]);

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir esta transferência? Ela deixa de contar no estoque.")) return;
    try { await excluir.mutateAsync(id); toast.success("Transferência removida."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Transferências</h1>
        <Button onClick={() => navigate("/estoque-transferencias/nova")}><Plus className="h-4 w-4 mr-2" />Nova transferência</Button>
      </div>

      <p className="text-sm text-muted-foreground">A transferência sai de um programa e entra em outro: diminui a origem e soma no destino (já com o bônus).</p>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por conta ou programa..." />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Origem (−)</TableHead><TableHead>Destino (+)</TableHead>
              <TableHead className="text-right">Transferida</TableHead><TableHead className="text-right">Bônus</TableHead>
              <TableHead className="text-right">Recebida</TableHead><TableHead>Descrição</TableHead>
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhuma transferência lançada</TableCell></TableRow>
            ) : filtered.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="py-2">{fmtData(t.data)}</TableCell>
                <TableCell className="py-2">
                  <span className="font-mono font-semibold text-base">{t.remetente?.codigo}</span>
                  <span className="text-muted-foreground"> · {t.prog_remetente?.nome}</span>
                </TableCell>
                <TableCell className="py-2">
                  <span className="font-mono font-semibold text-base">{t.recebedora?.codigo}</span>
                  <span className="text-muted-foreground"> · {t.prog_recebedor?.nome}</span>
                </TableCell>
                <TableCell className="py-2 text-right tabular-nums text-destructive">-{nf(t.qtde_transferida)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{t.bonus ? pct(t.bonus) : "—"}</TableCell>
                <TableCell className="py-2 text-right tabular-nums text-emerald-600">+{nf(t.qtde_recebida)}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{t.descricao || "—"}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/estoque-transferencias/${t.id}/editar`)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleExcluir(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
