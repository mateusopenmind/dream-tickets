import { useState, useMemo } from "react";
import { useContas, useUpsertConta, useDeleteConta, useContaProgramas } from "@/hooks/useData";
import { useProgramasEstoque } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { SearchBar } from "@/components/ui/search-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NumericInput } from "@/components/ui/numeric-input";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir, usePerfil } from "@/hooks/usePerfil";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const emptyForm = { codigo: "", nome: "", nascimento: "", cpf: "", fone: "", email: "", tipo: "Própria", pix_envio: "", numero_smiles: "" };

// programas (estoque) marcados de uma conta: { [programa_estoque_id]: { ativo, saldo } }
type ProgMap = Record<string, { ativo: boolean; saldo: number }>;

export default function ContasPage() {
  const { data: contas, isLoading } = useContas();
  const { data: programasEstoque } = useProgramasEstoque();
  const upsert = useUpsertConta();
  const remove = useDeleteConta();
  const podeExcluir = usePodeExcluir();
  const { data: perfil } = usePerfil();
  const isSuper = perfil?.papel === "super_admin";
  const qc = useQueryClient();
  const { data: contaProgramas } = useContaProgramas();
  const { query, setQuery, filtered } = useSearch<any>(contas);
  const [fTipo, setFTipo] = useState("__all");
  const [fPrograma, setFPrograma] = useState("__all");
  const [fComSaldo, setFComSaldo] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [progMap, setProgMap] = useState<ProgMap>({});
  const [progSel, setProgSel] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Saldos por conta (para exibir resumo na lista)
  const saldos = useQuery({
    queryKey: ["conta-programas-todos"],
    queryFn: async () => {
      // só vínculos com saldo > 0 (o resumo só exibe esses); evita o limite de 1000 linhas do PostgREST
      const { data } = await supabase
        .from("conta_programas")
        .select("conta_id, saldo_milhas, ativo, programas_estoque(nome)")
        .gt("saldo_milhas", 0)
        .limit(5000);
      const map: Record<string, { nome: string; saldo: number; ativo: boolean }[]> = {};
      (data ?? []).forEach((r: any) => {
        (map[r.conta_id] ||= []).push({ nome: (r.programas_estoque as any)?.nome ?? "", saldo: r.saldo_milhas ?? 0, ativo: r.ativo ?? true });
      });
      return map;
    },
  });

  // aplica filtros (tipo, programa, com saldo) sobre o resultado da busca
  const filtradas = useMemo(() => {
    let list = filtered ?? [];
    if (fTipo !== "__all") list = list.filter((c: any) => c.tipo === fTipo);
    if (fPrograma !== "__all") list = list.filter((c: any) => contaProgramas?.[c.id]?.has(fPrograma));
    if (fComSaldo) list = list.filter((c: any) => (saldos.data?.[c.id]?.length ?? 0) > 0);
    return list;
  }, [filtered, fTipo, fPrograma, fComSaldo, contaProgramas, saldos.data]);
  const { sorted, key, dir, toggle } = useSort<any>(filtradas, "nome");
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);

  const openNew = () => { setEditing(null); setForm(emptyForm); setProgMap({}); setProgSel(""); setOpen(true); };

  const openEdit = async (c: any) => {
    setEditing(c);
    setForm({
      codigo: c.codigo ?? "", nome: c.nome ?? "", nascimento: c.nascimento ?? "", cpf: c.cpf ?? "",
      fone: c.fone ?? "", email: c.email ?? "", tipo: c.tipo ?? "Própria", pix_envio: c.pix_envio ?? "",
      numero_smiles: c.numero_smiles ?? "",
    });
    // carrega todos os vínculos da conta (ativos e inativos, mantendo o saldo)
    const { data } = await supabase.from("conta_programas").select("programa_estoque_id, saldo_milhas, ativo").eq("conta_id", c.id);
    const m: ProgMap = {};
    (data ?? []).forEach((r: any) => { if (r.programa_estoque_id) m[r.programa_estoque_id] = { ativo: r.ativo ?? true, saldo: r.saldo_milhas ?? 0 }; });
    setProgMap(m);
    setOpen(true);
  };

  const toggleProg = (id: string) => setProgMap((p) => ({ ...p, [id]: { ativo: !p[id]?.ativo, saldo: p[id]?.saldo ?? 0 } }));
  const setSaldoProg = (id: string, saldo: number) => setProgMap((p) => ({ ...p, [id]: { ativo: p[id]?.ativo ?? true, saldo } }));
  // adicionar/remover programa da conta
  const adicionarProg = (id: string) => { if (!id) return; setProgMap((p) => p[id] ? p : ({ ...p, [id]: { ativo: true, saldo: 0 } })); setProgSel(""); };
  // Não pode remover programa que já tem emissão nesta conta — só inativar.
  const removerProg = async (id: string) => {
    const estoque = (programasEstoque ?? []).find((p: any) => p.id === id);
    if (editing?.id && estoque) {
      // bloqueia remoção se alguma emissão da conta usa um programa ligado a este estoque
      const { data: progsEmissao } = await supabase.from("programas").select("id").eq("programa_estoque_id", id);
      const idsEmissao = (progsEmissao ?? []).map((p: any) => p.id);
      if (idsEmissao.length > 0) {
        const { count } = await supabase
          .from("emissoes")
          .select("id", { count: "exact", head: true })
          .eq("conta_id", editing.id)
          .in("programa_id", idsEmissao);
        if ((count ?? 0) > 0) {
          toast.error(`Não é possível remover "${estoque.nome}": já existe emissão desta conta nesse programa. Desmarque para Inativar.`);
          return;
        }
      }
    }
    setProgMap((p) => { const n = { ...p }; delete n[id]; return n; });
  };
  // programas ainda não adicionados a esta conta (para o seletor)
  const progsDisponiveis = (programasEstoque ?? []).filter((p: any) => p.ativo !== false && !progMap[p.id]);

  const handleSave = async () => {
    if (!form.codigo || !form.nome) { toast.error("Código e Nome são obrigatórios."); return; }
    const codDup = (contas ?? []).find((x: any) => x.id !== editing?.id && (x.codigo || "").toLowerCase() === form.codigo.toLowerCase());
    if (codDup) { toast.error(`Já existe conta com o código ${form.codigo}.`); return; }
    setSalvando(true);
    try {
      const saved: any = await upsert.mutateAsync({ ...form, id: editing?.id });
      const contaId = editing?.id || saved?.id || saved?.[0]?.id;
      if (contaId) {
        // 1) Remove do banco os vínculos que saíram do progMap (programa removido da conta)
        const idsNoForm = Object.keys(progMap);
        const { data: atuais } = await supabase.from("conta_programas").select("id, programa_estoque_id").eq("conta_id", contaId);
        for (const r of (atuais ?? [])) {
          if (!idsNoForm.includes((r as any).programa_estoque_id)) {
            await supabase.from("conta_programas").delete().eq("id", (r as any).id);
          }
        }
        // 2) Upsert dos programas adicionados. Desmarcar NÃO apaga: só marca ativo=false (preserva saldo).
        for (const [pid, v] of Object.entries(progMap)) {
          await supabase.from("conta_programas").upsert(
            { conta_id: contaId, programa_estoque_id: pid, ativo: v.ativo, saldo_milhas: Math.round(v.saldo || 0), saldo_atualizado_em: new Date().toISOString() },
            { onConflict: "conta_id,programa_estoque_id" }
          );
        }
      }
      qc.invalidateQueries({ queryKey: ["conta-programas-todos"] }); qc.invalidateQueries({ queryKey: ["conta-programas-map"] });
      toast.success(editing ? "Conta atualizada!" : "Conta criada!");
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar conta"); }
    finally { setSalvando(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta?")) return;
    try { await remove.mutateAsync(id); qc.invalidateQueries({ queryKey: ["conta-programas-todos"] }); qc.invalidateQueries({ queryKey: ["conta-programas-map"] }); toast.success("Conta removida!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover conta"); }
  };

  const fmtMilhas = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Contas</h1><AjudaButton chave="contas" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por código, nome, CPF, e-mail..." />
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os tipos</SelectItem>
            <SelectItem value="Própria">Própria</SelectItem>
            <SelectItem value="Terceiro">Terceiro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fPrograma} onValueChange={setFPrograma}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Programa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os programas</SelectItem>
            {(programasEstoque ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={fComSaldo ? "default" : "outline"} size="sm" onClick={() => setFComSaldo(!fComSaldo)}>
          Com saldo
        </Button>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="codigo" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Tipo" sortKey="tipo" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead>Saldos de milhas</TableHead>
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma conta</TableCell></TableRow>
            ) : paged.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="py-2 font-mono text-sm">{c.codigo}</TableCell>
                <TableCell className="py-2 font-medium">{c.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.tipo}</TableCell>
                <TableCell className="py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      // só programas com saldo > 0, ordenados do maior para o menor
                      const vis = (saldos.data?.[c.id] ?? [])
                        .filter((p) => p.saldo > 0)
                        .sort((a, b) => b.saldo - a.saldo);
                      if (vis.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
                      return vis.map((p, i) => (
                        <span key={i} className={`text-xs rounded px-1.5 py-0.5 ${p.ativo ? "bg-muted" : "bg-muted/50 text-muted-foreground"}`}>
                          {p.nome}: <span className="font-mono font-medium">{fmtMilhas(p.saldo)}</span>{!p.ativo && " (inativo)"}
                        </span>
                      ));
                    })()}
                  </div>
                </TableCell>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Conta</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Código *</Label><Input value={form.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())} placeholder="C001" /></div>
              <div className="grid gap-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Própria">Própria</SelectItem><SelectItem value="Terceiro">Terceiro</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>CPF</Label><Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Nascimento</Label><Input type="date" value={form.nascimento} onChange={(e) => set("nascimento", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Telefone</Label><Input value={form.fone} onChange={(e) => set("fone", e.target.value)} /></div>
              <div className="grid gap-1"><Label>E-mail</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Chave Pix (envio)</Label><Input value={form.pix_envio} onChange={(e) => set("pix_envio", e.target.value)} placeholder="CPF, e-mail, telefone..." /></div>
              <div className="grid gap-1"><Label>Nº Smiles</Label><Input value={form.numero_smiles} onChange={(e) => set("numero_smiles", e.target.value)} placeholder="login/número Smiles" /></div>
            </div>

            {/* Programas que a conta participa — adicione via seletor; marcar = ativo, desmarcar = inativo */}
            <div className="grid gap-2 border-t pt-3">
              <Label>Programas que a conta participa</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Selecione um programa e clique em "Adicionar". Depois, marque/desmarque para Ativar/Inativar. Só programas adicionados podem ser usados nesta conta.
                {isSuper && " (Como super admin, você pode editar o saldo para teste.)"}
              </p>

              {/* Seletor + Adicionar */}
              <div className="flex items-center gap-2">
                <Select value={progSel} onValueChange={setProgSel}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={progsDisponiveis.length ? "Selecione um programa..." : "Todos os programas já adicionados"} /></SelectTrigger>
                  <SelectContent>
                    {progsDisponiveis.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => adicionarProg(progSel)} disabled={!progSel}>
                  <Plus className="h-4 w-4 mr-1" />Adicionar
                </Button>
              </div>

              {Object.keys(progMap).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum programa adicionado a esta conta.</p>
              ) : (
                <div className="rounded-md border">
                  <div className="grid grid-cols-[1fr_72px_120px_36px] items-center gap-2 px-3 py-1.5 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
                    <span>Programa</span>
                    <span className="text-center">Status</span>
                    <span className="text-right">Saldo</span>
                    <span></span>
                  </div>
                  <div className="divide-y">
                    {(programasEstoque ?? []).filter((p: any) => progMap[p.id]).map((p: any) => {
                      const cur = progMap[p.id];
                      const ativo = !!cur?.ativo;
                      const saldo = cur?.saldo ?? 0;
                      return (
                        <div key={p.id} className="grid grid-cols-[1fr_72px_120px_36px] items-center gap-2 px-3 py-1.5">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={ativo} onChange={() => toggleProg(p.id)} />
                            {p.nome}
                          </label>
                          <span className={`justify-self-center text-xs font-medium px-1.5 py-0.5 rounded ${ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                            {ativo ? "Ativo" : "Inativo"}
                          </span>
                          {isSuper ? (
                            <NumericInput value={saldo} onChange={(n) => setSaldoProg(p.id, n)} placeholder="0" className="text-right" />
                          ) : (
                            <span className="text-right font-mono font-medium text-sm">{saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                          )}
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 justify-self-end" onClick={() => removerProg(p.id)} title="Remover programa da conta">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSave} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
