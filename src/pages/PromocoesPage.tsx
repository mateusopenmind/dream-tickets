import { useState, useMemo } from "react";
import { usePromocoes, useSalvarPromocao, useExcluirPromocao, promocaoVigente, programasDaPromocao, nomesProgramasDaPromocao } from "@/hooks/usePromocoes";
import { vData } from "@/lib/validacoesData";
import { useProgramasEstoque } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchBar } from "@/components/ui/search-bar";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const TIPOS = [{ v: "compra", l: "Compra" }, { v: "transferencia", l: "Transferência" }];
const tipoLabel = (t: string) => TIPOS.find((x) => x.v === t)?.l ?? t;
// "2026-09-08T14:30:00" -> "08/09/2026 14:30"
const fmtDataHora = (iso: string | null) => {
  if (!iso) return "—";
  const [d, h] = String(iso).replace("Z", "").split("T");
  return `${d.split("-").reverse().join("/")}${h ? ` ${h.slice(0, 5)}` : ""}`;
};
// valor do <input type="datetime-local">
const paraInput = (iso: string | null) => (iso ? String(iso).replace("Z", "").slice(0, 16) : "");

const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const pct = (frac: number) => `${((Number(frac) || 0) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const emptyForm = {
  nome: "", tipo: "compra",
  programa_estoque_id: "", origens: [] as string[], destinos: [] as string[],
  bonus_pct: 0, bonus_maximo: 0,
  vigencia_inicio: "", vigencia_fim: "", link_regulamento: "", informacoes: "", ativo: true,
};
// Atalhos de seleção: marcam de uma vez todos os programas daquele tipo
const GRUPOS_TIPO = [
  { tipo: "banco", label: "Todos Bancos" },
  { tipo: "cia_aerea", label: "Todas Cias. Aéreas" },
  { tipo: "hotel", label: "Todos Hotéis" },
];

export default function PromocoesPage() {
  const { data: promocoes, isLoading } = usePromocoes();
  const { data: estoques } = useProgramasEstoque();
  const salvar = useSalvarPromocao();
  const excluir = useExcluirPromocao();
  const podeExcluir = usePodeExcluir();

  const estoqueOptions = useMemo(
    () => (estoques ?? []).filter((e: any) => e.ativo !== false).map((e: any) => ({ id: e.id, nome: e.nome })),
    [estoques]
  );

  const rows = useMemo(() => (promocoes ?? []).map((p: any) => ({
    ...p,
    _tipo: tipoLabel(p.tipo),
    _programas: p.tipo === "compra"
      ? (p.programa?.nome ?? "Todos")
      : `${nomesProgramasDaPromocao(p, "origem")} → ${nomesProgramasDaPromocao(p, "destino")}`,
    _vigente: promocaoVigente(p),
  })), [promocoes]);
  const { query, setQuery, filtered } = useSearch<any>(rows, ["nome", "_tipo", "_programas", "informacoes"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const ehCompra = form.tipo === "compra";

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      nome: p.nome ?? "", tipo: p.tipo ?? "compra",
      programa_estoque_id: p.programa_estoque_id ?? "",
      origens: programasDaPromocao(p, "origem"),
      destinos: programasDaPromocao(p, "destino"),
      bonus_pct: Number(p.bonus_pct || 0) * 100, bonus_maximo: Number(p.bonus_maximo || 0),
      vigencia_inicio: paraInput(p.vigencia_inicio), vigencia_fim: paraInput(p.vigencia_fim),
      link_regulamento: p.link_regulamento ?? "", informacoes: p.informacoes ?? "", ativo: p.ativo !== false,
    });
    setOpen(true);
  };

  // Marca/desmarca um programa na lista de origem ou destino
  const togglePrograma = (campo: "origens" | "destinos", id: string, marcado: boolean) =>
    setForm((f: any) => ({
      ...f,
      [campo]: marcado ? [...f[campo], id] : f[campo].filter((x: string) => x !== id),
    }));
  // Atalho "Todos Bancos / Todas Cias. Aéreas / Todos Hotéis"
  const toggleGrupo = (campo: "origens" | "destinos", tipo: string, marcado: boolean) => {
    const ids = (estoques ?? []).filter((e: any) => e.ativo !== false && e.tipo === tipo).map((e: any) => e.id);
    setForm((f: any) => ({
      ...f,
      [campo]: marcado
        ? Array.from(new Set([...f[campo], ...ids]))
        : f[campo].filter((x: string) => !ids.includes(x)),
    }));
  };
  const grupoMarcado = (campo: "origens" | "destinos", tipo: string) => {
    const ids = (estoques ?? []).filter((e: any) => e.ativo !== false && e.tipo === tipo).map((e: any) => e.id);
    return ids.length > 0 && ids.every((id: string) => form[campo].includes(id));
  };

  // Lista de programas com os atalhos por tipo. Nada marcado = vale para todos.
  const ListaProgramas = ({ titulo, campo }: { titulo: string; campo: "origens" | "destinos" }) => (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label>{titulo}</Label>
        {form[campo].length > 0 && (
          <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => set(campo, [])}>limpar (todos)</button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 pb-1 border-b">
        {GRUPOS_TIPO.map((g) => (
          <label key={g.tipo} className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]"
              checked={grupoMarcado(campo, g.tipo)} onChange={(e) => toggleGrupo(campo, g.tipo, e.target.checked)} />
            {g.label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pt-1">
        {(estoques ?? []).filter((e: any) => e.ativo !== false)
          .slice().sort((a: any, b: any) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR"))
          .map((e: any) => (
            <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]"
                checked={form[campo].includes(e.id)} onChange={(ev) => togglePrograma(campo, e.id, ev.target.checked)} />
              {e.nome}
            </label>
          ))}
      </div>
      {form[campo].length === 0 && <p className="text-xs text-muted-foreground">Nada marcado = vale para todos os programas.</p>}
    </div>
  );

  const handleSave = async () => {
    // Todos os campos são obrigatórios (o teto de bônus aceita 0 = sem teto)
    if (!form.nome.trim()) { toast.error("Informe o nome da promoção."); return; }
    // Programa vazio = vale para todos
    if (!ehCompra && !(Number(form.bonus_pct) > 0)) { toast.error("Informe o % de bônus da promoção."); return; }
    if (!form.vigencia_inicio) { toast.error("Informe o início da vigência."); return; }
    if (!form.vigencia_fim) { toast.error("Informe o fim da vigência."); return; }
    const erroIni = vData(form.vigencia_inicio.slice(0, 10), "data de início");
    if (erroIni) { toast.error(erroIni); return; }
    const erroFim = vData(form.vigencia_fim.slice(0, 10), "data de fim");
    if (erroFim) { toast.error(erroFim); return; }
    if (form.vigencia_fim < form.vigencia_inicio) { toast.error("O fim da vigência não pode ser antes do início."); return; }
    if (!form.link_regulamento.trim()) { toast.error("Informe o link do regulamento."); return; }
    if (!form.informacoes.trim()) { toast.error("Preencha as informações da promoção."); return; }
    try {
      await salvar.mutateAsync({
        ...form,
        id: editing?.id,
        bonus_pct: (Number(form.bonus_pct) || 0) / 100,
        bonus_maximo: Number(form.bonus_maximo) > 0 ? Math.round(Number(form.bonus_maximo)) : null,
      });
      toast.success(editing ? "Promoção atualizada!" : "Promoção cadastrada!");
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar promoção"); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta promoção? O histórico dela some.")) return;
    try { await excluir.mutateAsync(id); toast.success("Promoção removida!"); }
    catch (err) {
      toast.error(String((err as any)?.message || "").match(/foreign|violates|referenced/i)
        ? "Há compras ou transferências vinculadas a esta promoção."
        : (err instanceof Error ? err.message : "Erro ao remover promoção"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Promoções</h1><AjudaButton chave="promocoes" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Promoção</Button>
      </div>

      <p className="text-sm text-muted-foreground">Histórico das promoções de compra e de transferência. Depois de cadastrada, a promoção pode ser vinculada a cada lançamento.</p>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por nome, tipo, programa ou banco..." />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Tipo" sortKey="_tipo" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead>Programas</TableHead>
              <TableHead className="text-right">Bônus</TableHead>
              <SortableHead label="Vigência" sortKey="vigencia_inicio" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead>Regulamento</TableHead>
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma promoção cadastrada</TableCell></TableRow>
            ) : sorted.map((p: any) => (
              <TableRow key={p.id} className={p.ativo === false ? "opacity-60" : undefined}>
                <TableCell className="py-2 font-medium">
                  {p.nome}
                  {p._vigente && p.ativo !== false && (
                    <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">vigente</span>
                  )}
                  {p.ativo === false && <span className="ml-2 text-xs text-muted-foreground">(inativa)</span>}
                </TableCell>
                <TableCell className="py-2">{p._tipo}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{p._programas}</TableCell>
                <TableCell className="py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {p.tipo === "compra" ? "—" : <>{pct(p.bonus_pct)}{p.bonus_maximo ? <span className="text-xs"> · teto {nf(p.bonus_maximo)}</span> : null}</>}
                </TableCell>
                <TableCell className="py-2 text-muted-foreground whitespace-nowrap">{fmtDataHora(p.vigencia_inicio)} → {fmtDataHora(p.vigencia_fim)}</TableCell>
                <TableCell className="py-2">
                  {p.link_regulamento
                    ? <a href={p.link_regulamento} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">abrir <ExternalLink className="h-3 w-3" /></a>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Promoção</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1 sm:col-span-2"><Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Livelo 100% de bônus para Latam" />
              </div>
              <div className="grid gap-1"><Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {ehCompra ? (
              <div className="grid gap-1 sm:max-w-sm"><Label>Programa</Label>
                <Select value={form.programa_estoque_id || "__all"} onValueChange={(v) => set("programa_estoque_id", v === "__all" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todos</SelectItem>
                    {estoqueOptions.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ListaProgramas titulo="Programas de origem" campo="origens" />
                <ListaProgramas titulo="Programas de destino" campo="destinos" />
              </div>
            )}

            {!ehCompra && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1"><Label>% Bônus *</Label>
                  <NumericInput decimal value={Number(form.bonus_pct) || 0} onChange={(n) => set("bonus_pct", n)} />
                  <p className="text-xs text-muted-foreground">Puxado automaticamente na transferência (dá para editar lá).</p>
                </div>
                <div className="grid gap-1"><Label>Bônus máximo (milhas)</Label>
                  <NumericInput value={Number(form.bonus_maximo) || 0} onChange={(n) => set("bonus_maximo", n)} />
                  <p className="text-xs text-muted-foreground">Teto de milhas bonificadas por conta, somando todas as transferências da promoção. 0 = sem teto.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Início da vigência *</Label>
                <Input type="datetime-local" value={form.vigencia_inicio} onChange={(e) => set("vigencia_inicio", e.target.value)} />
              </div>
              <div className="grid gap-1"><Label>Fim da vigência *</Label>
                <Input type="datetime-local" value={form.vigencia_fim} onChange={(e) => set("vigencia_fim", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-1"><Label>Link do regulamento *</Label>
              <Input value={form.link_regulamento} onChange={(e) => set("link_regulamento", e.target.value)} placeholder="https://..." />
            </div>
            <div className="grid gap-1"><Label>Mais informações *</Label>
              <Textarea value={form.informacoes} onChange={(e) => set("informacoes", e.target.value)} rows={3} placeholder="Regras, limites, observações da campanha..." />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="pr-3">
                <Label>Ativa</Label>
                <p className="text-xs text-muted-foreground">Promoção inativa continua no histórico, mas não é oferecida nos lançamentos.</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
