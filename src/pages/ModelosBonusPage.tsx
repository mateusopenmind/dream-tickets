import { useState, useMemo } from "react";
import { useBonusModelos, useUpsertBonusModelo, useDeleteBonusModelo, useProgramasEstoque, etapasDoModelo, type BonusEtapa } from "@/hooks/useClubes";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchBar } from "@/components/ui/search-bar";
import { Plus, Pencil, Trash2, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const FREQUENCIAS = [
  { v: "0", l: "Única vez" }, { v: "1", l: "Todo mês" }, { v: "3", l: "A cada 3 meses" },
  { v: "6", l: "A cada 6 meses" }, { v: "12", l: "A cada 12 meses" },
];
const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
type EtapaForm = { rotulo: string; pontos: string; frequencia_meses: string; repeticoes: string };
const etapaVazia = (): EtapaForm => ({ rotulo: "", pontos: "", frequencia_meses: "3", repeticoes: "4" });
const emptyForm = { nome: "", programa_id: "", etapas: [{ ...etapaVazia(), frequencia_meses: "0", repeticoes: "1" }] as EtapaForm[] };
// Texto curto de uma etapa: "4× 10.000 a cada 3 meses"
const descEtapa = (e: BonusEtapa) => {
  const freq = e.frequencia_meses === 0 ? "única vez" : e.frequencia_meses === 1 ? "todo mês" : `a cada ${e.frequencia_meses} meses`;
  const vezes = e.frequencia_meses === 0 ? "" : `${e.repeticoes}× `;
  return `${e.rotulo ? `${e.rotulo}: ` : ""}${vezes}${nf(e.pontos)} ${freq}`;
};
// Duração em meses de uma lista de etapas (única vez conta 1 mês, como no encadeamento da assinatura)
const duracaoMeses = (etapas: BonusEtapa[]) =>
  etapas.reduce((t, e) => t + (e.frequencia_meses === 0 ? 1 : e.frequencia_meses * e.repeticoes), 0);

export default function ModelosBonusPage() {
  const { data: modelos, isLoading } = useBonusModelos();
  const { data: programas } = useProgramasEstoque();
  const upsert = useUpsertBonusModelo();
  const remove = useDeleteBonusModelo();
  const podeExcluir = usePodeExcluir();
  const rows = useMemo(() => (modelos ?? []).map((m: any) => {
    const etapas = etapasDoModelo(m);
    return { ...m, _programa: m.programas_estoque?.nome ?? m.programas?.nome ?? "Todos", _etapas: etapas, _duracao: duracaoMeses(etapas) };
  }), [modelos]);
  const { query, setQuery, filtered } = useSearch<any>(rows, ["nome", "_programa"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const set = (k: "nome" | "programa_id", v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setEtapa = (i: number, k: keyof EtapaForm, v: string) =>
    setForm((f) => ({ ...f, etapas: f.etapas.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)) }));
  const addEtapa = () => setForm((f) => ({ ...f, etapas: [...f.etapas, etapaVazia()] }));
  const removeEtapa = (i: number) => setForm((f) => ({ ...f, etapas: f.etapas.filter((_, idx) => idx !== i) }));

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      nome: m.nome ?? "", programa_id: m.programa_estoque_id ?? "",
      etapas: etapasDoModelo(m).map((e) => ({
        rotulo: e.rotulo ?? "", pontos: String(e.pontos), frequencia_meses: String(e.frequencia_meses), repeticoes: String(e.repeticoes),
      })),
    });
    setOpen(true);
  };
  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Informe um nome para o modelo."); return; }
    if (form.etapas.length === 0) { toast.error("Adicione pelo menos uma etapa."); return; }
    for (let i = 0; i < form.etapas.length; i++) {
      const e = form.etapas[i];
      if (!(Number(e.pontos) > 0)) { toast.error(`Informe os pontos da etapa ${i + 1}.`); return; }
      if (e.frequencia_meses !== "0" && !(Number(e.repeticoes) >= 1)) { toast.error(`Informe quantas vezes repete a etapa ${i + 1}.`); return; }
    }
    try {
      await upsert.mutateAsync({
        id: editing?.id, nome: form.nome, programa_estoque_id: form.programa_id || null,
        etapas: form.etapas.map((e) => ({
          rotulo: e.rotulo.trim() || null, pontos: Number(e.pontos) || 0,
          frequencia_meses: Number(e.frequencia_meses) || 0, repeticoes: Number(e.repeticoes) || 1,
        })),
      });
      toast.success(editing ? "Modelo atualizado!" : "Modelo criado!");
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar modelo"); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este modelo de bônus?")) return;
    try { await remove.mutateAsync(id); toast.success("Modelo removido!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover modelo"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Modelos de Bônus</h1><AjudaButton chave="bonus_modelos" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Modelo</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por nome..." />
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Programa" sortKey="_programa" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead>Etapas (em sequência)</TableHead>
              <SortableHead label="Duração" sortKey="_duracao" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum modelo cadastrado</TableCell></TableRow>
            ) : sorted.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="py-2 font-medium">{m.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{m._programa}</TableCell>
                <TableCell className="py-2">
                  <div className="space-y-0.5 text-sm">
                    {m._etapas.map((e: BonusEtapa, i: number) => (
                      <div key={i} className="tabular-nums">
                        {m._etapas.length > 1 && <span className="text-muted-foreground mr-1">{i + 1}.</span>}{descEtapa(e)}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="py-2 text-muted-foreground tabular-nums">{m._duracao} {m._duracao === 1 ? "mês" : "meses"}</TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Modelo de Bônus</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Bônus trimestral 5K" /></div>
            <div className="grid gap-1"><Label>Programa</Label>
              <Select value={form.programa_id || "__all"} onValueChange={(v) => set("programa_id", v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">— todos os programas —</SelectItem>
                  {(programas ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Label>Etapas *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addEtapa}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar etapa</Button>
            </div>
            <div className="grid grid-cols-[2rem_1.2fr_1fr_1.3fr_0.7fr_auto] gap-2 text-xs text-muted-foreground px-1">
              <span>#</span><span>Rótulo (opcional)</span><span>Pontos *</span><span>Frequência</span><span>Repetir</span><span></span>
            </div>
            {form.etapas.map((e, i) => (
              <div key={i} className="space-y-1">
                {i > 0 && (
                  <div className="flex items-center gap-1 pl-1 text-xs text-muted-foreground"><ArrowDown className="h-3 w-3" />quando a etapa {i} acabar</div>
                )}
                <div className="grid grid-cols-[2rem_1.2fr_1fr_1.3fr_0.7fr_auto] gap-2 items-center">
                  <span className="text-sm text-muted-foreground text-center">{i + 1}</span>
                  <Input value={e.rotulo} onChange={(ev) => setEtapa(i, "rotulo", ev.target.value)} placeholder={`Ex.: ${i + 1}º Ano`} />
                  <NumericInput value={Number(e.pontos) || 0} onChange={(n) => setEtapa(i, "pontos", n ? String(n) : "")} />
                  <Select value={e.frequencia_meses} onValueChange={(v) => setEtapa(i, "frequencia_meses", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FREQUENCIAS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={1} value={e.frequencia_meses === "0" ? "1" : e.repeticoes} disabled={e.frequencia_meses === "0"} onChange={(ev) => setEtapa(i, "repeticoes", ev.target.value)} />
                  <Button type="button" variant="ghost" size="icon" disabled={form.etapas.length === 1} onClick={() => removeEtapa(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">As etapas rodam em sequência: cada uma começa quando a anterior termina (ex.: 4× 10.000 a cada 3 meses e, depois, 6× 12.000 todo mês). Ao aplicar o modelo numa assinatura, cada etapa vira uma linha de bônus com a 1ª entrada já calculada — e tudo continua editável lá.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
