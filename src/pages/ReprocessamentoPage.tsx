import { useState, useMemo } from "react";
import { useEmissoes, useEmissoesTerceirizadas } from "@/hooks/useData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, RefreshCw, Filter, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SortableHead } from "@/components/ui/sortable-head";
import { AjudaButton } from "@/components/AjudaButton";
import { usePerfil } from "@/hooks/usePerfil";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSort } from "@/hooks/useSort";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function ReprocessamentoPage() {
  const { data: emissoes, isLoading: carregandoDiretas } = useEmissoes();
  const { data: terceirizadas, isLoading: carregandoTerceirizadas } = useEmissoesTerceirizadas();
  const isLoading = carregandoDiretas || carregandoTerceirizadas;
  const { data: perfil } = usePerfil();

  const [search, setSearch] = useState("");
  const [filterMesAtual, setFilterMesAtual] = useState(true);
  const [filterTabela, setFilterTabela] = useState<"todas" | "emissoes" | "emissoes_terceirizadas">("todas");
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const [confirmUm, setConfirmUm] = useState<any>(null);
  const [confirmLote, setConfirmLote] = useState(false);
  const [enviandoLote, setEnviandoLote] = useState(false);

  // Junta Emissões diretas e Terceirizadas numa lista só, marcando de qual tabela cada uma veio
  // (usado depois pra saber pra qual tabela mandar o reenvio via disparar-n8n).
  const combinadas = useMemo(() => [
    ...((emissoes as any[]) ?? []).map((e) => ({ ...e, _tabela: "emissoes" as const })),
    ...((terceirizadas as any[]) ?? []).map((e) => ({ ...e, _tabela: "emissoes_terceirizadas" as const })),
  ], [emissoes, terceirizadas]);

  const filtered = useMemo(() => {
    // Somente emissões com cobrança gerada (Pix ou Cartão) e ainda EM ABERTO
    let list = combinadas.filter(
      (e) => e.forma_cobranca && e.status_pix === "EM ABERTO"
    );
    if (filterTabela !== "todas") {
      list = list.filter((e) => e._tabela === filterTabela);
    }
    if (filterMesAtual) {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      list = list.filter((e) => {
        const d = new Date(e.data_emissao + "T00:00:00");
        return d >= start && d <= end;
      });
    }
    let mapped = list.map((e: any) => ({
      ...e,
      _cliente: (e.clientes as any)?.codigo ?? "",
      _conta: (e.contas as any)?.nome ?? "",
    }));
    if (search.trim()) {
      const s = search.toLowerCase();
      mapped = mapped.filter((e: any) => {
        const campos = [
          e.id_emissao,
          e.data_emissao ? format(new Date(e.data_emissao + "T00:00:00"), "dd/MM/yyyy") : "",
          e.localizador, e.programa, e.nome_operacao, e._cliente, e._conta, e.preco_total,
        ];
        return campos.some((c) => String(c ?? "").toLowerCase().includes(s));
      });
    }
    return mapped;
  }, [combinadas, filterTabela, filterMesAtual, search]);

  const { sorted, key: sortKey, dir: sortDir, toggle } = useSort<any>(filtered);
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);

  async function reenviarUm(e: any) {
    const { data, error } = await supabase.functions.invoke("disparar-n8n", {
      body: { acao: "reenviar", emissao_id: e.id, tabela: e._tabela, fone_destino: (perfil as any)?.whatsapp || "" },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    if (data?.n8n === "pendente") throw new Error(data.aviso || "Webhook de reenvio não configurado.");
  }

  const handleReenviarUm = async (e: any) => {
    setReenviandoId(e.id);
    try {
      await reenviarUm(e);
      toast.success(`Emissão ${e.id_emissao}: cobrança reenviada por WhatsApp.`);
      setConfirmUm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reenviar");
    } finally {
      setReenviandoId(null);
    }
  };

  const handleReenviarLote = async () => {
    setEnviandoLote(true);
    let ok = 0, falhas = 0;
    for (const e of sorted) {
      try { await reenviarUm(e); ok++; } catch { falhas++; }
    }
    setEnviandoLote(false);
    setConfirmLote(false);
    toast.success(`Reenvio em lote concluído: ${ok} enviada(s)${falhas ? `, ${falhas} falha(s)` : ""}.`);
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Reprocessamento</h1>
          <AjudaButton chave="reprocessamento" />
        </div>
        <Button onClick={() => setConfirmLote(true)} disabled={enviandoLote || sorted.length === 0}>
          <Send className="h-4 w-4 mr-2" />
          Reenviar todas ({sorted.length})
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Reenvia a cobrança por WhatsApp das emissões com cobrança gerada (Pix ou Cartão) e ainda em aberto, usando a mesma forma escolhida. Não gera uma nova cobrança.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button variant={filterMesAtual ? "default" : "outline"} size="sm" onClick={() => setFilterMesAtual(!filterMesAtual)}>
          <Filter className="h-3 w-3 mr-1" />Mês Atual
        </Button>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button variant={filterTabela === "todas" ? "default" : "ghost"} size="sm" className="h-7" onClick={() => setFilterTabela("todas")}>Todas</Button>
          <Button variant={filterTabela === "emissoes" ? "default" : "ghost"} size="sm" className="h-7" onClick={() => setFilterTabela("emissoes")}>Contas Próprias</Button>
          <Button variant={filterTabela === "emissoes_terceirizadas" ? "default" : "ghost"} size="sm" className="h-7" onClick={() => setFilterTabela("emissoes_terceirizadas")}>Terceirizada</Button>
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
      </div>

      {/* Tabela — telas largas */}
      <div className="hidden lg:block rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="ID" sortKey="id_emissao" activeKey={sortKey} dir={sortDir} onSort={toggle} className="whitespace-nowrap" />
              <SortableHead label="Data" sortKey="data_emissao" activeKey={sortKey} dir={sortDir} onSort={toggle} className="whitespace-nowrap" />
              <SortableHead label="Localizador" sortKey="localizador" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Programa" sortKey="programa" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Cliente" sortKey="_cliente" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Tipo" sortKey="_tabela" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Forma" sortKey="forma_cobranca" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Total" sortKey="preco_total" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right" className="text-right" />
              <SortableHead label="Status" sortKey="status_pix" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <TableHead className="w-[130px]">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Nenhuma emissão com Pix em aberto.</TableCell></TableRow>
            ) : paged.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-sm whitespace-nowrap">{e.id_emissao || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{e.data_emissao ? format(new Date(e.data_emissao + "T00:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="font-mono text-sm font-semibold">{e.localizador}</TableCell>
                <TableCell>{e.programa || "—"}</TableCell>
                <TableCell className="font-mono text-sm">{(e.clientes as any)?.codigo || "—"}</TableCell>
                <TableCell><Badge variant={e._tabela === "emissoes_terceirizadas" ? "outline" : "secondary"}>{e._tabela === "emissoes_terceirizadas" ? "Terceirizada" : "Contas Próprias"}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{e.forma_cobranca === "cartao" ? "Cartão" : "Pix"}</Badge></TableCell>
                <TableCell className="text-right font-mono whitespace-nowrap">{formatCurrency(e.preco_total)}</TableCell>
                <TableCell>{statusBadge(e.status_pix)}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setConfirmUm(e)} disabled={reenviandoId === e.id}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${reenviandoId === e.id ? "animate-spin" : ""}`} />
                    Reenviar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
      </div>

      {/* Cards — telas estreitas */}
      <div className="lg:hidden space-y-3">
        {isLoading ? (
          <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">Carregando...</div>
        ) : sorted.length === 0 ? (
          <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">Nenhuma emissão com Pix em aberto.</div>
        ) : paged.map(e => (
          <div key={e.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-mono font-semibold text-base">{e.localizador}</div>
                <div className="text-xs text-muted-foreground font-mono">{e.id_emissao || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {e.data_emissao ? format(new Date(e.data_emissao + "T00:00:00"), "dd/MM/yyyy") : "—"} · {e.programa || "—"}
                </div>
              </div>
              {statusBadge(e.status_pix)}
            </div>
            <div className="text-sm space-y-0.5 mb-3">
              <div><span className="text-muted-foreground">Cliente:</span> <span className="font-mono">{(e.clientes as any)?.codigo || "—"}</span></div>
              <div><span className="text-muted-foreground">Tipo:</span> <Badge variant={e._tabela === "emissoes_terceirizadas" ? "outline" : "secondary"} className="ml-1">{e._tabela === "emissoes_terceirizadas" ? "Terceirizada" : "Contas Próprias"}</Badge></div>
              <div><span className="text-muted-foreground">Forma:</span> {e.forma_cobranca === "cartao" ? "Cartão" : "Pix"}</div>
              <div className="font-semibold"><span className="text-muted-foreground font-normal">Total:</span> {formatCurrency(e.preco_total)}</div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setConfirmUm(e)} disabled={reenviandoId === e.id}>
              <RefreshCw className={`h-4 w-4 mr-1 ${reenviandoId === e.id ? "animate-spin" : ""}`} />
              Reenviar por WhatsApp
            </Button>
          </div>
        ))}
        {total > 0 && (
          <div className="rounded-lg border bg-card">
            <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Confirmar reenvio individual */}
      <Dialog open={!!confirmUm} onOpenChange={(o) => { if (!o) setConfirmUm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reenviar cobrança por WhatsApp?</DialogTitle></DialogHeader>
          {confirmUm && (
            <p className="text-sm text-muted-foreground">
              Será reenviada a cobrança Pix da emissão <b>{confirmUm.id_emissao}</b> ({formatCurrency(confirmUm.preco_total)}). O mesmo Pix será reaproveitado (nenhum Pix novo é gerado).
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmUm(null)} disabled={!!reenviandoId}>Cancelar</Button>
            <Button onClick={() => handleReenviarUm(confirmUm)} disabled={!!reenviandoId}>
              {reenviandoId ? "Reenviando..." : "Reenviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar reenvio em lote */}
      <Dialog open={confirmLote} onOpenChange={(o) => { if (!o) setConfirmLote(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reenviar todas as cobranças?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Serão reenviadas <b>{sorted.length}</b> cobrança(s) Pix por WhatsApp (as que estão na lista filtrada). Nenhum Pix novo é gerado.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmLote(false)} disabled={enviandoLote}>Cancelar</Button>
            <Button onClick={handleReenviarLote} disabled={enviandoLote}>
              {enviandoLote ? "Reenviando..." : `Reenviar ${sorted.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
