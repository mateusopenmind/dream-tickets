import { useState, useMemo, useEffect } from "react";
import { useEmissoes, useUpsertEmissao, useDeleteEmissao, useProgramas, useReembolsosPorEmissao, buscarResumoRecebimentosAvulsos } from "@/hooks/useData";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Plus, Search, Pencil, Trash2, BanknoteIcon, Send, Filter, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EmissaoFormDialog } from "@/components/EmissaoFormDialog";
import { DashboardCards } from "@/components/DashboardCards";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SortableHead } from "@/components/ui/sortable-head";
import { AjudaButton } from "@/components/AjudaButton";
import { usePerfil, useEhAdmin } from "@/hooks/usePerfil";
import { useSort } from "@/hooks/useSort";
import { format, startOfMonth, endOfMonth } from "date-fns";

// Cobrança por cartão oculta por escolha do cliente. Trocar para true para reativar.
const MOSTRAR_CARTAO = false;

export default function EmissoesPage() {
  const { data: emissoes, isLoading } = useEmissoes();
  const { data: reembMap } = useReembolsosPorEmissao("emissoes");
  const { data: perfil } = usePerfil();
  const ehAdmin = useEhAdmin();
  const { data: programas } = useProgramas();
  const upsertMutation = useUpsertEmissao();
  const deleteMutation = useDeleteEmissao();

  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterMesAtual, setFilterMesAtual] = useState(false);
  const [filterPixAberto, setFilterPixAberto] = useState(false);
  const [filterPendente, setFilterPendente] = useState(false);
  const [fPrograma, setFPrograma] = useState("__all");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [confirmCobrar, setConfirmCobrar] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [avisoRecebimentosDelete, setAvisoRecebimentosDelete] = useState<{ total: number; recebidos: number; valor_recebido: number } | null>(null);

  // Ao chegar da tela de Nova Emissão, abre direto a confirmação de cobrança da emissão recém-criada.
  useEffect(() => {
    const nova = (location.state as any)?.cobrarEmissao;
    if (nova?.id) {
      setConfirmCobrar(nova);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);
  const [enviando, setEnviando] = useState(false);
  const [formaCobranca, setFormaCobranca] = useState<"pix" | "cartao" | "link">("pix");

  const filtered = useMemo(() => {
    if (!emissoes) return [];
    let list = [...emissoes];
    if (filterMesAtual) {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      list = list.filter(e => {
        const d = new Date(e.data_emissao + "T00:00:00");
        return d >= start && d <= end;
      });
    }
    if (filterPixAberto) {
      list = list.filter(e => e.status_pix === "EM ABERTO");
    }
    if (filterPendente) {
      // cobrança ainda não gerada (sem forma escolhida)
      list = list.filter((e: any) => !e.forma_cobranca);
    }
    if (fPrograma !== "__all") {
      list = list.filter((e: any) => e.programa === fPrograma);
    }
    if (dataIni) {
      list = list.filter((e: any) => e.data_emissao && e.data_emissao >= dataIni);
    }
    if (dataFim) {
      list = list.filter((e: any) => e.data_emissao && e.data_emissao <= dataFim);
    }
    // campos planos para ordenação/busca (cliente/conta são aninhados)
    let mapped = list.map((e: any) => ({
      ...e,
      // data + hora normalizadas para ordenação cronológica correta
      _data_hora: e.data_emissao ? `${e.data_emissao} ${e.hora ? String(e.hora).slice(0, 5) : "00:00"}` : null,
      _cliente: (e.clientes as any)?.nome_fantasia ?? "",
      _conta: (e.contas as any)?.nome ?? "",
      _cliente_cod: (e.clientes as any)?.codigo ?? "",
      _conta_cod: (e.contas as any)?.codigo ?? "",
    }));
    if (search.trim()) {
      const s = search.toLowerCase();
      mapped = mapped.filter((e: any) => {
        // busca em todos os campos exibidos na tabela
        const campos = [
          e.id_emissao,
          e.data_emissao ? format(new Date(e.data_emissao + "T00:00:00"), "dd/MM/yyyy") : "",
          e.localizador,
          e.programa,
          e.nome_operacao,
          e._cliente,
          e._cliente_cod,
          e._conta,
          e._conta_cod,
          e.milhas_cobrado,
          e.total_milhas,
          e.preco_milheiro,
          e.taxas_cobrado,
          e.outros_cobrado,
          e.preco_total,
          e.status_pix,
        ];
        return campos.some((c) => String(c ?? "").toLowerCase().includes(s));
      });
    }
    return mapped;
  }, [emissoes, filterMesAtual, filterPixAberto, filterPendente, fPrograma, dataIni, dataFim, search]);

  const { sorted, key: sortKey, dir: sortDir, toggle } = useSort<any>(filtered, "_data_hora", "desc");
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);

  const openNew = () => navigate("/emissoes/nova");
  const openEdit = (e: any) => { setEditing(e); setOpen(true); };

  const handleDelete = async (e: any) => {
    try {
      await deleteMutation.mutateAsync(e.id);
      toast.success(`Emissão ${e.id_emissao} excluída definitivamente.`);
      setConfirmDelete(null);
    }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao excluir"); }
  };

  // Antes de abrir a confirmação, verifica se há recebimentos avulsos lançados para esta emissão
  // (excluir a emissão não exclui esses lançamentos — o usuário precisa saber disso antes).
  const abrirConfirmDelete = async (e: any) => {
    setConfirmDelete(e);
    setAvisoRecebimentosDelete(null);
    try {
      const resumo = await buscarResumoRecebimentosAvulsos("emissoes", e.id);
      if (resumo.total > 0) setAvisoRecebimentosDelete(resumo);
    } catch { /* se a checagem falhar, segue sem o aviso extra */ }
  };

  const handleCobrar = async (e: any) => {
    setEnviando(true);
    try {
      // Cartão/link ocultos (MOSTRAR_CARTAO=false) → cobrança é sempre Pix.
      const forma = MOSTRAR_CARTAO ? formaCobranca : "pix";
      // WhatsApp vai para o usuário logado (quem está emitindo).
      const fone_destino = (perfil as any)?.whatsapp || "";
      const { data, error } = await supabase.functions.invoke("disparar-n8n", { body: { acao: "cobrar", forma, emissao_id: e.id, fone_destino } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.n8n === "pendente") toast.warning("O processamento de cobranças ainda não foi configurado. Avise o suporte.");
      else if (data?.n8n_resposta && /sem_telefone":true/.test(data.n8n_resposta)) toast.warning("Cobrança gerada, mas seu usuário não tem WhatsApp cadastrado — a mensagem não foi enviada. Preencha o WhatsApp em Usuários.");
      else if (forma === "pix") toast.success("Cobrança Pix gerada e enviada por WhatsApp.");
      else toast.success(data?.checkout_url ? "Link de cobrança gerado." : "Cobrança gerada e enviada por WhatsApp.");
      setConfirmCobrar(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao disparar cobrança"); }
    finally { setEnviando(false); }
  };

  const fmt0 = (v: number | null) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmt2 = (v: number | null) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Cobrança já emitida = tem forma_cobranca gravada e não está cancelada. Cancelada libera cobrar de novo.
  const jaCobrada = (e: any) => !!e.forma_cobranca && e.status_pix !== "CANCELADO";
  const dataCobrancaFmt = (e: any) =>
    e.data_cobranca ? format(new Date(e.data_cobranca), "dd/MM/yyyy 'às' HH:mm") : null;

  const statusBadge = (status: string | null) => {
    switch (status) {
      case "PAGO": return <Badge className="bg-success text-success-foreground">PAGO</Badge>;
      case "CANCELADO": return <Badge className="bg-destructive text-destructive-foreground">CANCELADO</Badge>;
      default: return <Badge className="bg-warning text-warning-foreground">EM ABERTO</Badge>;
    }
  };

  // Emissão que já tem reembolso não pode mais ser editada por operador — só admin/super admin.
  const bloqueadaPorReembolso = (e: any) => !!reembMap?.[e.id] && !ehAdmin;

  // Status da emissão: verde "Ativa" quando existe; amarelo com o tipo quando vinculada a um reembolso.
  const statusEmissaoBadge = (e: any) => {
    const tipo = reembMap?.[e.id];
    if (!tipo) return <Badge className="bg-success text-success-foreground">Ativa</Badge>;
    const label = tipo === "parcial" ? "Reembolso Parcial" : tipo === "taxas" ? "Reembolso Taxas" : "Reembolso Total";
    return <Badge className="bg-warning text-warning-foreground">{label}</Badge>;
  };

  const formatCurrency = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div>
      <DashboardCards emissoes={emissoes} />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Emissões</h1>
          <AjudaButton chave="emissoes" />
        </div>
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
          <BanknoteIcon className="h-3 w-3 mr-1" />Cobrança em Aberto
        </Button>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar em toda a tabela..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
      </div>

      {/* Filtros: programa e período */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={fPrograma} onValueChange={setFPrograma}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Programa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os programas</SelectItem>
            {(programas ?? []).map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">De</span>
          <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="w-40" />
          <span className="text-muted-foreground">até</span>
          <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
        </div>
        {(fPrograma !== "__all" || dataIni || dataFim) && (
          <Button variant="ghost" size="sm" onClick={() => { setFPrograma("__all"); setDataIni(""); setDataFim(""); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela completa — telas largas (lg+) */}
      <div className="hidden lg:block rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="ID" sortKey="id_emissao" activeKey={sortKey} dir={sortDir} onSort={toggle} className="whitespace-nowrap" />
              <SortableHead label="Data/Hora" sortKey="_data_hora" activeKey={sortKey} dir={sortDir} onSort={toggle} className="whitespace-nowrap" />
              <SortableHead label="Localizador" sortKey="localizador" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Programa" sortKey="programa" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Operação" sortKey="nome_operacao" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Cliente" sortKey="_cliente_cod" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Conta" sortKey="_conta_cod" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <SortableHead label="Total Milhas" sortKey="total_milhas" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right" className="text-right" />
              <SortableHead label="Total" sortKey="preco_total" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right" className="text-right" />
              <SortableHead label="Cobrança" sortKey="status_pix" activeKey={sortKey} dir={sortDir} onSort={toggle} />
              <TableHead>Status</TableHead>
              <TableHead className="w-[130px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : total === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Nenhuma emissão encontrada</TableCell></TableRow>
            ) : paged.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-sm whitespace-nowrap">{e.id_emissao || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{e.data_emissao ? format(new Date(e.data_emissao + "T00:00:00"), "dd/MM/yyyy") : "—"}{e.hora ? ` ${String(e.hora).slice(0, 5)}` : ""}</TableCell>
                <TableCell className="font-mono text-sm font-semibold">{e.localizador}</TableCell>
                <TableCell>{e.programa || "—"}</TableCell>
                <TableCell>{e.nome_operacao || "—"}</TableCell>
                <TableCell className="font-mono text-sm">{(e.clientes as any)?.codigo || "—"}</TableCell>
                <TableCell className="font-mono text-sm">{(e.contas as any)?.codigo || "—"}</TableCell>
                <TableCell className="text-right font-mono whitespace-nowrap">{fmt0(e.total_milhas ?? e.milhas_cobrado)}</TableCell>
                <TableCell className="text-right font-mono whitespace-nowrap">{formatCurrency(e.preco_total)}</TableCell>
                <TableCell>{statusBadge(e.status_pix)}</TableCell>
                <TableCell>{statusEmissaoBadge(e)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {bloqueadaPorReembolso(e) ? (
                      <Button variant="ghost" size="icon" disabled title="Emissão com reembolso — somente administradores podem editar">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => abrirConfirmDelete(e)} title="Deletar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    {jaCobrada(e) ? (
                      <span className="inline-flex items-center text-xs text-success gap-1 px-1" title={`Cobrança emitida${dataCobrancaFmt(e) ? " em " + dataCobrancaFmt(e) : ""}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => { setFormaCobranca("pix"); setConfirmCobrar(e); }} title="Cobrar"><Send className="h-4 w-4 text-primary" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
      </div>

      {/* Cards empilhados — telas estreitas (abaixo de lg) */}
      <div className="lg:hidden space-y-3">
        {isLoading ? (
          <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">Carregando...</div>
        ) : total === 0 ? (
          <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">Nenhuma emissão encontrada</div>
        ) : paged.map(e => (
          <div key={e.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-mono font-semibold text-base">{e.localizador}</div>
                <div className="text-xs text-muted-foreground font-mono">{e.id_emissao || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {e.data_emissao ? format(new Date(e.data_emissao + "T00:00:00"), "dd/MM/yyyy") : "—"}{e.hora ? ` ${String(e.hora).slice(0, 5)}` : ""} · {e.programa || "—"} · {e.nome_operacao || "—"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {statusBadge(e.status_pix)}
                {statusEmissaoBadge(e)}
              </div>
            </div>
            <div className="text-sm space-y-0.5 mb-3">
              <div><span className="text-muted-foreground">Cliente:</span> <span className="font-mono">{(e.clientes as any)?.codigo || "—"}</span></div>
              <div><span className="text-muted-foreground">Conta:</span> <span className="font-mono">{(e.contas as any)?.codigo || "—"}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border-t pt-2 mb-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Milhas</span><span className="font-mono">{fmt0(e.total_milhas ?? e.milhas_cobrado)}</span></div>
              <div className="flex justify-between col-span-2 border-t pt-1 font-semibold"><span>Total</span><span className="font-mono">{formatCurrency(e.preco_total)}</span></div>
            </div>
            {jaCobrada(e) && (
              <div className="text-xs text-success flex items-center gap-1 mb-2"><CheckCircle2 className="h-3.5 w-3.5" /> Cobrança emitida{dataCobrancaFmt(e) ? ` em ${dataCobrancaFmt(e)}` : ""}</div>
            )}
            <div className="flex gap-1 justify-end">
              {bloqueadaPorReembolso(e) ? (
                <Button variant="ghost" size="icon" disabled title="Emissão com reembolso — somente administradores podem editar"><Lock className="h-4 w-4 text-muted-foreground" /></Button>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => openEdit(e)} title="Editar"><Pencil className="h-4 w-4" /></Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => abrirConfirmDelete(e)} title="Deletar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              {!jaCobrada(e) && (
                <Button variant="ghost" size="icon" onClick={() => { setFormaCobranca("pix"); setConfirmCobrar(e); }} title="Cobrar"><Send className="h-4 w-4 text-primary" /></Button>
              )}
            </div>
          </div>
        ))}
        {total > 0 && (
          <div className="rounded-lg border bg-card">
            <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
          </div>
        )}
      </div>

      <EmissaoFormDialog open={open} onOpenChange={setOpen} editing={editing} />

      <Dialog open={!!confirmCobrar} onOpenChange={(o) => { if (!o) setConfirmCobrar(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar cobrança</DialogTitle>
          </DialogHeader>
          {confirmCobrar && (
            <div className="space-y-1.5 text-sm">
              <div>🆔 <span className="text-muted-foreground">Emissão:</span> <span className="font-mono font-semibold">{confirmCobrar.id_emissao}</span></div>
              <div>🔖 <span className="text-muted-foreground">Localizador:</span> <span className="font-mono">{confirmCobrar.localizador}</span></div>
              <div>🏷️ <span className="text-muted-foreground">Programa:</span> {confirmCobrar.programa || "—"}</div>
              <div>📌 <span className="text-muted-foreground">Operação:</span> {confirmCobrar.nome_operacao || "—"}</div>
              <div>✈️ <span className="text-muted-foreground">Milhas:</span> {fmt0(confirmCobrar.milhas_cobrado)}</div>
              <div>🌽 <span className="text-muted-foreground">Milheiro:</span> R$ {fmt2(confirmCobrar.preco_milheiro)}</div>
              <div>💲 <span className="text-muted-foreground">Taxas:</span> {(confirmCobrar as any).taxas_tipo === "milhas" ? `${fmt0(confirmCobrar.taxas_cobrado)} milhas` : `R$ ${fmt2(confirmCobrar.taxas_cobrado)}`}</div>
              {Number(confirmCobrar.bagagens_cobrado) > 0 && <div>🧳 <span className="text-muted-foreground">Bagagens:</span> {(confirmCobrar as any).bagagens_tipo === "milhas" ? `${fmt0(confirmCobrar.bagagens_cobrado)} milhas` : `R$ ${fmt2(confirmCobrar.bagagens_cobrado)}`}</div>}
              {Number(confirmCobrar.assentos_cobrado) > 0 && <div>💺 <span className="text-muted-foreground">Assentos:</span> {(confirmCobrar as any).assentos_tipo === "milhas" ? `${fmt0(confirmCobrar.assentos_cobrado)} milhas` : `R$ ${fmt2(confirmCobrar.assentos_cobrado)}`}</div>}
              {Number(confirmCobrar.outros_cobrado) > 0 && <div>➕ <span className="text-muted-foreground">Outros:</span> R$ {fmt2(confirmCobrar.outros_cobrado)}</div>}
              <div className="pt-1 border-t mt-2 text-base">💰 <span className="font-bold">TOTAL: R$ {fmt2(confirmCobrar.preco_total)}</span></div>

              {/* Forma de cobrança — cartão/link ocultos por escolha do cliente (reativar trocando MOSTRAR_CARTAO para true) */}
              {MOSTRAR_CARTAO && (
                <div className="pt-3">
                  <div className="text-xs text-muted-foreground mb-1.5">Forma de cobrança</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button type="button" variant={formaCobranca === "pix" ? "default" : "outline"} onClick={() => setFormaCobranca("pix")} disabled={enviando}>
                      Pix
                    </Button>
                    <Button type="button" variant={formaCobranca === "cartao" ? "default" : "outline"} onClick={() => setFormaCobranca("cartao")} disabled={enviando} title="Link de pagamento por cartão (C6 Pay)">
                      Cartão
                    </Button>
                    <Button type="button" variant={formaCobranca === "link" ? "default" : "outline"} onClick={() => setFormaCobranca("link")} disabled={enviando} title="Link onde o cliente escolhe Pix ou cartão">
                      Link (escolha)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { const e = confirmCobrar; setConfirmCobrar(null); openEdit(e); }}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button onClick={() => handleCobrar(confirmCobrar)} disabled={enviando}>
              {enviando ? "Enviando..." : "Confirmar e enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) { setConfirmDelete(null); setAvisoPagamentosDelete(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir emissão?</DialogTitle>
          </DialogHeader>
          {confirmDelete && (
            <p className="text-sm">
              A emissão <b className="font-mono">{confirmDelete.id_emissao}</b> será excluída <b>definitivamente</b> e não poderá ser recuperada. Tem certeza?
            </p>
          )}
          {avisoRecebimentosDelete && (
            <p className="text-sm rounded-md border border-warning/40 bg-warning/10 text-warning px-3 py-2">
              ⚠️ Há {avisoRecebimentosDelete.total} parcela(s) de recebimento avulso lançada(s) para esta emissão
              {avisoRecebimentosDelete.recebidos > 0 ? `, sendo ${avisoRecebimentosDelete.recebidos} já recebida(s) (R$ ${avisoRecebimentosDelete.valor_recebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})` : ""}.
              Excluir a emissão NÃO exclui esses lançamentos — confira a tela Recebimentos Avulsos depois.
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setConfirmDelete(null); setAvisoPagamentosDelete(null); }} disabled={deleteMutation.isPending}>Não</Button>
            <Button variant="destructive" onClick={() => handleDelete(confirmDelete)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo..." : "Sim, excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
