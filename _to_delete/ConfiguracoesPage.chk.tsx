import { useState } from "react";
import { useProgramas, useOperacoes, useOrigens, useEmissores, useOrigensClientes, useBancos, useTaxasQueimaCpf, useUpsertTaxaQueimaCpf, useDeleteTaxaQueimaCpf } from "@/hooks/useData";
import { useProgramasEstoque, useUpsertProgramaEstoque, useDeleteProgramaEstoque, useProgramasComEstoque } from "@/hooks/useClubes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { SearchBar } from "@/components/ui/search-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { SearchSelect } from "@/components/ui/search-select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const fmtMoeda = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// CRUD da Taxa Queima CPF (programa + valor por CPF/pax)
function TaxaQueimaCpfCrud() {
  const { data: taxas, isLoading } = useTaxasQueimaCpf();
  const { data: programas } = useProgramas();
  const upsert = useUpsertTaxaQueimaCpf();
  const del = useDeleteTaxaQueimaCpf();
  const podeExcluir = usePodeExcluir();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [programa, setPrograma] = useState("");
  const [valor, setValor] = useState(0);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setPrograma(""); setValor(0); setDialogOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setPrograma(t.programa); setValor(Number(t.valor) || 0); setDialogOpen(true); };

  const handleSave = async () => {
    if (!programa.trim()) { toast.error("Selecione ou informe o programa."); return; }
    setSaving(true);
    try {
      await upsert.mutateAsync({ id: editing?.id, programa: programa.trim(), valor });
      toast.success(editing ? "Taxa atualizada" : "Taxa adicionada");
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(String(e?.message || "").includes("duplicate") ? "Já existe uma taxa para esse programa." : (e?.message || "Erro ao salvar."));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir?")) return;
    try { await del.mutateAsync(id); toast.success("Excluído com sucesso"); }
    catch (e: any) { toast.error(e?.message || "Erro ao excluir."); }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm text-muted-foreground">Valor da queima de CPF por passageiro, por programa. Usado no cálculo do reembolso.</p>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Programa</TableHead>
                <TableHead className="text-right">Valor por CPF/pax</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(taxas ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="py-2 font-medium">{t.programa}</TableCell>
                  <TableCell className="py-2 text-right">{fmtMoeda(t.valor)}</TableCell>
                  <TableCell className="text-right py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!taxas || taxas.length === 0) && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhuma taxa cadastrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Taxa Queima CPF</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label>Programa</Label>
              <SearchSelect value={programa} onChange={setPrograma} options={(programas ?? []).map((p) => ({ value: p.nome, label: p.nome }))} placeholder="Selecione o programa" />
            </div>
            <div className="grid gap-1.5">
              <Label>Valor por CPF/pax</Label>
              <NumericInput value={valor} onChange={setValor} decimal prefix="R$" placeholder="0,00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type LookupTable = "programas" | "operacoes" | "origens" | "emissores" | "origens_clientes" | "bancos";

interface LookupItem {
  id: string;
  nome: string;
  observacao?: string | null;
}

function LookupCrud({ table, queryKey, items, isLoading }: { table: LookupTable; queryKey: string; items: LookupItem[] | undefined; isLoading: boolean }) {
  const qc = useQueryClient();
  const podeExcluir = usePodeExcluir();
  const temObs = table === "programas"; // só programas têm observação
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LookupItem | null>(null);
  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const { query, setQuery, filtered } = useSearch<LookupItem>(items, ["nome"]);
  const { sorted, key, dir, toggle } = useSort<LookupItem>(filtered, "nome");

  const openNew = () => { setEditing(null); setNome(""); setObs(""); setDialogOpen(true); };
  const openEdit = (item: LookupItem) => { setEditing(item); setNome(item.nome); setObs(item.observacao ?? ""); setDialogOpen(true); };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = { nome: nome.trim() };
      if (temObs) payload.observacao = obs.trim() || null;
      if (editing) {
        const { error } = await supabase.from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Atualizado com sucesso");
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        toast.success("Adicionado com sucesso");
      }
      qc.invalidateQueries({ queryKey: [queryKey] });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir?")) return;
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído com sucesso");
      qc.invalidateQueries({ queryKey: [queryKey] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar..." />
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              {temObs && <TableHead>Observação</TableHead>}
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="py-2 font-medium">{item.nome}</TableCell>
                {temObs && <TableCell className="py-2 text-sm text-muted-foreground max-w-md truncate" title={item.observacao ?? ""}>{item.observacao || "—"}</TableCell>}
                <TableCell className="text-right py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {podeExcluir && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!items || items.length === 0) && (
              <TableRow>
                <TableCell colSpan={temObs ? 3 : 2} className="text-center text-muted-foreground">Nenhum item cadastrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Novo"} item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" autoFocus />
            </div>
            {temObs && (
              <div className="grid gap-1.5">
                <Label>Observação</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={4} placeholder="Detalhes/lembretes do programa: regras, prazos, particularidades..." />
                <p className="text-xs text-muted-foreground">Uso interno — fica registrado para consulta futura no cadastro do programa.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// CRUD do cadastro de Programas Estoque (onde as milhas moram)
function ProgramasEstoqueCrud() {
  const { data: itens, isLoading } = useProgramasEstoque();
  const upsert = useUpsertProgramaEstoque();
  const del = useDeleteProgramaEstoque();
  const podeExcluir = usePodeExcluir();
  const { query, setQuery, filtered } = useSearch<any>(itens, ["nome"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState("true");
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setNome(""); setAtivo("true"); setDialogOpen(true); };
  const openEdit = (i: any) => { setEditing(i); setNome(i.nome); setAtivo(i.ativo === false ? "false" : "true"); setDialogOpen(true); };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      await upsert.mutateAsync({ id: editing?.id, nome: nome.trim(), ativo: ativo === "true" });
      toast.success(editing ? "Atualizado com sucesso" : "Adicionado com sucesso");
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(String(e?.message || "").includes("duplicate") ? "Já existe um estoque com esse nome." : (e?.message || "Erro ao salvar."));
    } finally { setSaving(false); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este estoque? Só é possível se nada estiver vinculado a ele.")) return;
    try { await del.mutateAsync(id); toast.success("Excluído com sucesso"); }
    catch (e: any) { toast.error(String(e?.message || "").match(/foreign|violates|referenced/i) ? "Há programas ou movimentos usando este estoque." : (e?.message || "Erro ao excluir.")); }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar..." />
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-3">Onde as milhas moram (saldo e consumo). Ex.: "Azul" agrupa Azul Liminar, Azul Viagens e Interline; os demais são 1:1.</p>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="py-2 font-medium">{item.nome}</TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">{item.ativo === false ? "Inativo" : "Ativo"}</TableCell>
                  <TableCell className="text-right py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                      {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!itens || itens.length === 0) && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum estoque cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Programa Estoque</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Azul" autoFocus /></div>
            <div className="grid gap-1.5"><Label>Status</Label>
              <Select value={ativo} onValueChange={setAtivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// CRUD dos Programas de Emissão (o que existe hoje) + vínculo com o Programa Estoque
function ProgramasEmissaoCrud() {
  const { data: programas, isLoading } = useProgramasComEstoque();
  const { data: estoques } = useProgramasEstoque();
  const qc = useQueryClient();
  const podeExcluir = usePodeExcluir();
  const { query, setQuery, filtered } = useSearch<any>(programas, ["nome"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");
  const [estoqueId, setEstoqueId] = useState("");
  const [usarEmissoes, setUsarEmissoes] = useState(true);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setNome(""); setObs(""); setEstoqueId(""); setUsarEmissoes(true); setDialogOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setNome(p.nome); setObs(p.observacao ?? ""); setEstoqueId(p.programa_estoque_id ?? ""); setUsarEmissoes(p.usar_nas_emissoes !== false); setDialogOpen(true); };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = { nome: nome.trim(), observacao: obs.trim() || null, programa_estoque_id: estoqueId || null, usar_nas_emissoes: usarEmissoes };
      if (editing) {
        const { error } = await (supabase as any).from("programas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("programas").insert(payload);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["programas-com-estoque"] });
      qc.invalidateQueries({ queryKey: ["programas"] });
      toast.success(editing ? "Atualizado com sucesso" : "Adicionado com sucesso");
      setDialogOpen(false);
    } catch (e: any) { toast.error(e?.message || "Erro ao salvar."); } finally { setSaving(false); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir?")) return;
    try {
      const { error } = await (supabase as any).from("programas").delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["programas-com-estoque"] });
      qc.invalidateQueries({ queryKey: ["programas"] });
      toast.success("Excluído com sucesso");
    } catch (e: any) { toast.error(e?.message || "Erro ao excluir."); }
  };
  const handleToggleUsar = async (p: any, checked: boolean) => {
    try {
      const { error } = await (supabase as any).from("programas").update({ usar_nas_emissoes: checked }).eq("id", p.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["programas-com-estoque"] });
      qc.invalidateQueries({ queryKey: ["programas"] });
    } catch (e: any) { toast.error(e?.message || "Erro ao atualizar."); }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar..." />
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-3">Programas usados na emissão. O <strong>Estoque</strong> define de qual pool de milhas cada um consome (ex.: Azul Liminar → Azul).</p>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
                <TableHead>Estoque</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-center">Usar nas Emissões</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="py-2 font-medium">{p.nome}</TableCell>
                  <TableCell className="py-2 text-sm">{p.programas_estoque?.nome ?? <span className="text-destructive">— sem estoque —</span>}</TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground max-w-xs truncate" title={p.observacao ?? ""}>{p.observacao || "—"}</TableCell>
                  <TableCell className="py-2 text-center">
                    <Switch checked={p.usar_nas_emissoes !== false} onCheckedChange={(v) => handleToggleUsar(p, v)} />
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!programas || programas.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum programa cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Programa de Emissão</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Azul Viagens" autoFocus /></div>
            <div className="grid gap-1.5"><Label>Estoque</Label>
              <Select value={estoqueId || "__none"} onValueChange={(v) => setEstoqueId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o estoque" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— sem estoque —</SelectItem>
                  {(estoques ?? []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">De qual pool este programa consome milhas.</p>
            </div>
            <div className="grid gap-1.5"><Label>Observação</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Detalhes/lembretes do programa..." />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="pr-3">
                <Label>Usar nas emissões</Label>
                <p className="text-xs text-muted-foreground">Quando desligado, este programa não aparece nas emissões (própria e terceirizada).</p>
              </div>
              <Switch checked={usarEmissoes} onCheckedChange={setUsarEmissoes} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const programas = useProgramas();
  const operacoes = useOperacoes();
  const origens = useOrigens();
  const emissores = useEmissores();
  const origensClientes = useOrigensClientes();
  const bancos = useBancos();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
      </div>

      <Tabs defaultValue="programas">
        <TabsList>
          <TabsTrigger value="programas">Programas</TabsTrigger>
          <TabsTrigger value="programas_estoque">Programas Estoque</TabsTrigger>
          <TabsTrigger value="operacoes">Operações</TabsTrigger>
          <TabsTrigger value="emissores">Emissores</TabsTrigger>
          <TabsTrigger value="origens">Origens Emissões</TabsTrigger>
          <TabsTrigger value="origens_clientes">Origens Clientes</TabsTrigger>
          <TabsTrigger value="bancos">Bancos</TabsTrigger>
          <TabsTrigger value="queima_cpf">Taxa Queima CPF</TabsTrigger>
        </TabsList>

        <TabsContent value="programas" className="mt-4">
          <ProgramasEmissaoCrud />
        </TabsContent>
        <TabsContent value="programas_estoque" className="mt-4">
          <ProgramasEstoqueCrud />
        </TabsContent>
        <TabsContent value="operacoes" className="mt-4">
          <LookupCrud table="operacoes" queryKey="operacoes" items={operacoes.data} isLoading={operacoes.isLoading} />
        </TabsContent>
        <TabsContent value="emissores" className="mt-4">
          <LookupCrud table="emissores" queryKey="emissores" items={emissores.data} isLoading={emissores.isLoading} />
        </TabsContent>
        <TabsContent value="origens" className="mt-4">
          <LookupCrud table="origens" queryKey="origens" items={origens.data} isLoading={origens.isLoading} />
        </TabsContent>
        <TabsContent value="origens_clientes" className="mt-4">
          <LookupCrud table="origens_clientes" queryKey="origens_clientes" items={origensClientes.data} isLoading={origensClientes.isLoading} />
        </TabsContent>
        <TabsContent value="bancos" className="mt-4">
          <LookupCrud table="bancos" queryKey="bancos" items={bancos.data} isLoading={bancos.isLoading} />
        </TabsContent>
        <TabsContent value="queima_cpf" className="mt-4">
          <TaxaQueimaCpfCrud />
        </TabsContent>
      </Tabs>
    </div>
  );
}
