import { useState, useMemo } from "react";
import { useProgramas, useOperacoes, useOperacoesPerdas, useOperacoesCompras, useOrigens, useEmissores, useOrigensClientes, useBancos, useTaxasQueimaCpf, useUpsertTaxaQueimaCpf, useDeleteTaxaQueimaCpf, useMoedas } from "@/hooks/useData";
import { useProgramasEstoque, useUpsertProgramaEstoque, useDeleteProgramaEstoque, useProgramasComEstoque } from "@/hooks/useClubes";
import { useConversoesEstoque, useSalvarConversaoEstoque, useRemoverConversaoEstoque, mapaConversoes, DESTINATARIOS } from "@/hooks/useConversoesEstoque";
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
import { REGRAS, REGRAS_POR_GRUPO } from "@/lib/regrasPrograma";

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
              {/* Só programas com a regra "Taxa de Queima de CPF" ligada (Programas > aba Regras).
                  O programa já cadastrado continua aparecendo, para não sumir na edição. */}
              <SearchSelect
                value={programa}
                onChange={setPrograma}
                options={(programas ?? []).filter((p: any) => p.regra_taxa_queima_cpf === true || p.nome === programa).map((p) => ({ value: p.nome, label: p.nome }))}
                placeholder="Selecione o programa"
              />
              <p className="text-xs text-muted-foreground">A lista mostra apenas os programas com a regra "Taxa de Queima de CPF" ligada.</p>
            </div>
            <div className="grid gap-1.5">
              <Label>Valor por CPF/pax</Label>
              <NumericInput value={valor} onChange={setValor} decimal prefix="R$" />
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

// CRUD das moedas estrangeiras aceitas nas emissões.
// O spread é o que se soma à cotação de mercado na hora de converter para reais.
function MoedasCrud() {
  const qc = useQueryClient();
  const { data: moedas, isLoading } = useMoedas();
  const podeExcluir = usePodeExcluir();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [spread, setSpread] = useState(8);
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["moedas"] });

  const openNew = () => { setEditing(null); setCodigo(""); setNome(""); setSpread(8); setAtivo(true); setDialogOpen(true); };
  const openEdit = (m: any) => {
    setEditing(m); setCodigo(m.codigo); setNome(m.nome);
    setSpread(Number(m.spread_percentual) || 0); setAtivo(m.ativo !== false); setDialogOpen(true);
  };

  const handleSave = async () => {
    const cod = codigo.trim().toUpperCase();
    if (cod.length !== 3) { toast.error("O código da moeda tem 3 letras (ex.: USD, EUR)."); return; }
    if (!nome.trim()) { toast.error("Informe o nome da moeda."); return; }
    if (!isFinite(spread) || spread < 0) { toast.error("O spread não pode ser negativo."); return; }
    setSaving(true);
    try {
      const payload = { codigo: cod, nome: nome.trim(), spread_percentual: spread, ativo };
      const { error } = editing
        ? await (supabase as any).from("moedas").update(payload).eq("id", editing.id)
        : await (supabase as any).from("moedas").insert(payload);
      if (error) throw error;
      invalidar();
      toast.success(editing ? "Moeda atualizada" : "Moeda adicionada");
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(String(e?.message || "").includes("duplicate") ? "Essa moeda já está cadastrada." : (e?.message || "Erro ao salvar."));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta moeda? As emissões já lançadas com ela não mudam.")) return;
    try {
      const { error } = await (supabase as any).from("moedas").delete().eq("id", id);
      if (error) throw error;
      invalidar();
      toast.success("Excluído com sucesso");
    } catch (e: any) { toast.error(e?.message || "Erro ao excluir."); }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm text-muted-foreground">
          Moedas aceitas nas emissões e o percentual somado à cotação de mercado na conversão para reais.
          Só aparecem na emissão os programas com a regra "Permite valores em outra moeda" ligada.
        </p>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right w-24">Spread</TableHead>
                <TableHead className="w-20">Ativa</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(moedas ?? []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="py-2 font-medium">{m.codigo}</TableCell>
                  <TableCell className="py-2">{m.nome}</TableCell>
                  <TableCell className="py-2 text-right">{(Number(m.spread_percentual) || 0).toLocaleString("pt-BR")}%</TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">{m.ativo !== false ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      {podeExcluir && <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!moedas || moedas.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma moeda cadastrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Moeda</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label>Código</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
              <p className="text-xs text-muted-foreground">Código de 3 letras usado para buscar a cotação (USD, EUR, GBP, CHF...).</p>
            </div>
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Dólar americano" />
            </div>
            <div className="grid gap-1.5">
              <Label>Spread (%)</Label>
              <NumericInput value={spread} onChange={setSpread} decimal />
              <p className="text-xs text-muted-foreground">Somado à cotação de mercado. Ex.: cotação 5,17 com 8% vira 5,58 na conversão.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <span className="text-sm">Ativa (aparece no seletor da emissão)</span>
            </label>
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

type LookupTable = "programas" | "operacoes" | "operacoes_perdas" | "operacoes_compras" | "origens" | "emissores" | "origens_clientes" | "bancos";

interface LookupItem {
  id: string;
  nome: string;
  observacao?: string | null;
}

function LookupCrud({ table, queryKey, items, isLoading, descricao }: { table: LookupTable; queryKey: string; items: LookupItem[] | undefined; isLoading: boolean; descricao?: string }) {
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
        const { error } = await (supabase as any).from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Atualizado com sucesso");
      } else {
        const { error } = await (supabase as any).from(table).insert(payload);
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
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
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
      {descricao && <p className="text-sm text-muted-foreground mb-3">{descricao}</p>}

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

// Cada programa de estoque é um Banco, uma Cia. Aérea ou um Hotel
const TIPOS_ESTOQUE = [
  { v: "banco", l: "Banco" },
  { v: "cia_aerea", l: "Cia. Aérea" },
  { v: "hotel", l: "Hotel" },
];
const TIPO_ESTOQUE_LABEL: Record<string, string> = Object.fromEntries(TIPOS_ESTOQUE.map((t) => [t.v, t.l]));

// Conversões de saída de um programa de estoque: o que sai daqui (origem) e entra lá (destino),
// e quantos pontos daqui valem 1 ponto/milha de lá.
function ConversoesDoPrograma({ origem }: { origem: any }) {
  const { data: estoques } = useProgramasEstoque();
  const { data: conversoes } = useConversoesEstoque();
  const salvar = useSalvarConversaoEstoque();
  const remover = useRemoverConversaoEstoque();
  const [rascunho, setRascunho] = useState<Record<string, string>>({});

  const mapa = useMemo(() => mapaConversoes(conversoes), [conversoes]);
  const destinos = useMemo(
    () => (estoques ?? []).filter((e: any) => e.ativo !== false)
      .slice().sort((a: any, b: any) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR")),
    [estoques]
  );

  const gravar = async (destinoId: string, texto: string) => {
    setRascunho((r) => { const { [destinoId]: _, ...resto } = r; return resto; });
    const atual = mapa.get(`${origem.id}|${destinoId}`);
    if (!texto.trim()) {
      if (atual) {
        try { await remover.mutateAsync({ origem_id: origem.id, destino_id: destinoId }); }
        catch (e: any) { toast.error(e?.message || "Erro ao remover a conversão."); }
      }
      return;
    }
    const n = Number(texto.replace(/\./g, "").replace(",", "."));
    if (!(n > 0)) { toast.error("Informe um fator maior que zero (ou deixe vazio para não converter)."); return; }
    if (atual && Number(atual.fator) === n) return;
    try { await salvar.mutateAsync({ origem_id: origem.id, destino_id: destinoId, fator: n, destinatario: atual?.destinatario ?? "mesmo_cpf" }); }
    catch (e: any) { toast.error(e?.message || "Erro ao salvar a conversão."); }
  };

  // Troca de conta: destino do mesmo CPF ou de qualquer CPF
  const gravarDestinatario = async (destinoId: string, valor: string) => {
    const atual = mapa.get(`${origem.id}|${destinoId}`);
    if (!atual) { toast.error("Informe primeiro quantos pontos valem 1 neste destino."); return; }
    try { await salvar.mutateAsync({ origem_id: origem.id, destino_id: destinoId, fator: Number(atual.fator) || 1, destinatario: valor as any }); }
    catch (e: any) { toast.error(e?.message || "Erro ao salvar a regra."); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Sai de <strong>{origem.nome}</strong> e entra no destino: quantos pontos de {origem.nome} valem <strong>1</strong> ponto/milha de cada programa abaixo, na paridade padrão (sem bônus).
        Ex.: 3,5 significa 3,5 pontos por 1. Deixe vazio quando não houver transferência para aquele destino.
      </p>
      <Card className="overflow-hidden max-h-[45vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destino (entra)</TableHead>
              <TableHead className="w-28 text-right">Pontos por 1</TableHead>
              <TableHead className="w-40">Troca de conta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {destinos.map((d: any) => {
              const regra = mapa.get(`${origem.id}|${d.id}`);
              return (
                <TableRow key={d.id}>
                  <TableCell className="py-1 font-medium">
                    {d.nome}
                    <span className="text-xs text-muted-foreground"> · {TIPO_ESTOQUE_LABEL[d.tipo] ?? "—"}</span>
                  </TableCell>
                  <TableCell className="py-1 text-right">
                    <Input
                      className="h-8 w-24 text-right ml-auto"
                      inputMode="decimal"
                      placeholder="—"
                      value={rascunho[d.id] ?? String(regra?.fator ?? "").replace(".", ",")}
                      onChange={(e) => setRascunho((r) => ({ ...r, [d.id]: e.target.value }))}
                      onBlur={(e) => gravar(d.id, e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="py-1">
                    <Select value={regra?.destinatario ?? "mesmo_cpf"} onValueChange={(v) => gravarDestinatario(d.id, v)} disabled={!regra}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DESTINATARIOS.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// CRUD do cadastro de Programas Estoque (onde as milhas moram)
function ProgramasEstoqueCrud() {
  const { data: itens, isLoading } = useProgramasEstoque();
  const upsert = useUpsertProgramaEstoque();
  const del = useDeleteProgramaEstoque();
  const podeExcluir = usePodeExcluir();
  const linhas = useMemo(() => (itens ?? []).map((i: any) => ({ ...i, _tipo: TIPO_ESTOQUE_LABEL[i.tipo] ?? "—" })), [itens]);
  const { query, setQuery, filtered } = useSearch<any>(linhas, ["nome", "_tipo"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [ativo, setAtivo] = useState("true");
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setNome(""); setTipo(""); setAtivo("true"); setDialogOpen(true); };
  const openEdit = (i: any) => { setEditing(i); setNome(i.nome); setTipo(i.tipo ?? ""); setAtivo(i.ativo === false ? "false" : "true"); setDialogOpen(true); };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      await upsert.mutateAsync({ id: editing?.id, nome: nome.trim(), tipo: tipo || null, ativo: ativo === "true" });
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
                <SortableHead label="Tipo" sortKey="_tipo" activeKey={key} dir={dir} onSort={toggle} />
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="py-2 font-medium">{item.nome}</TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">{item._tipo}</TableCell>
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
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum estoque cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Programa Estoque</DialogTitle></DialogHeader>
          <Tabs defaultValue="dados">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="conversoes" disabled={!editing}>Conversões</TabsTrigger>
            </TabsList>
            <TabsContent value="dados" className="mt-3">
              <div className="space-y-3">
                <div className="grid gap-1.5"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Azul" autoFocus /></div>
                <div className="grid gap-1.5"><Label>Tipo</Label>
                  <Select value={tipo || "__none"} onValueChange={(v) => setTipo(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— não definido —</SelectItem>
                      {TIPOS_ESTOQUE.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
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
            </TabsContent>
            <TabsContent value="conversoes" className="mt-3">
              {editing
                ? <ConversoesDoPrograma origem={editing} />
                : <p className="text-sm text-muted-foreground">Salve o programa primeiro para cadastrar as conversões.</p>}
            </TabsContent>
          </Tabs>
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
  // Flags das regras de emissão deste programa (uma por coluna regra_* de `programas`).
  const [regras, setRegras] = useState<Record<string, boolean>>({});

  // Moedas estrangeiras que este programa aceita (ids de `moedas`).
  const { data: moedasCad } = useMoedas();
  const [moedasSel, setMoedasSel] = useState<string[]>([]);

  // Programa novo já nasce sem regra nenhuma, exceto o Campo Aberto (senão o emissor
  // fica sem como justificar uma diferença entre Reais e Cobrados) e o Aceita Reais,
  // que é o comportamento normal — só se desliga em Iberia e afins.
  const regrasPadrao = () => Object.fromEntries(REGRAS.map((r) => [r.coluna, r.key === "ajuste_campo_aberto" || r.key === "aceita_reais"])) as Record<string, boolean>;
  const regrasDo = (p: any) => Object.fromEntries(REGRAS.map((r) => [r.coluna, p?.[r.coluna] === true])) as Record<string, boolean>;

  const carregarMoedas = async (programaId?: string) => {
    if (!programaId) return setMoedasSel([]);
    const { data } = await (supabase as any).from("programa_moedas").select("moeda_id").eq("programa_id", programaId);
    setMoedasSel(((data ?? []) as any[]).map((r) => r.moeda_id));
  };

  const openNew = () => { setEditing(null); setNome(""); setObs(""); setEstoqueId(""); setUsarEmissoes(true); setRegras(regrasPadrao()); setMoedasSel([]); setDialogOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setNome(p.nome); setObs(p.observacao ?? ""); setEstoqueId(p.programa_estoque_id ?? ""); setUsarEmissoes(p.usar_nas_emissoes !== false); setRegras(regrasDo(p)); carregarMoedas(p.id); setDialogOpen(true); };

  // Reescreve o vínculo programa x moedas: apaga o que saiu, insere o que entrou.
  const salvarMoedas = async (programaId: string) => {
    const { data } = await (supabase as any).from("programa_moedas").select("moeda_id").eq("programa_id", programaId);
    const atuais: string[] = ((data ?? []) as any[]).map((r) => r.moeda_id);
    const remover = atuais.filter((id) => !moedasSel.includes(id));
    const inserir = moedasSel.filter((id) => !atuais.includes(id));
    if (remover.length) {
      const { error } = await (supabase as any).from("programa_moedas").delete().eq("programa_id", programaId).in("moeda_id", remover);
      if (error) throw error;
    }
    if (inserir.length) {
      const { error } = await (supabase as any).from("programa_moedas").insert(inserir.map((moeda_id) => ({ programa_id: programaId, moeda_id })));
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    // Sem moeda cadastrada não há o que lançar em moeda estrangeira — e o emissor
    // ficaria sem opção nenhuma no campo.
    if (moedasSel.length === 0 && regras["regra_aceita_reais"] === false) {
      toast.error('Este programa não aceita reais e não tem moeda cadastrada — o emissor ficaria sem opção. Marque ao menos uma moeda na aba "Moedas" ou volte a aceitar reais.');
      return;
    }
    setSaving(true);
    try {
      const payload: any = { nome: nome.trim(), observacao: obs.trim() || null, programa_estoque_id: estoqueId || null, usar_nas_emissoes: usarEmissoes, ...regras };
      let programaId = editing?.id;
      if (editing) {
        const { error } = await (supabase as any).from("programas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("programas").insert(payload).select("id").single();
        if (error) throw error;
        programaId = data?.id;
      }
      if (programaId) await salvarMoedas(programaId);
      qc.invalidateQueries({ queryKey: ["programas-com-estoque"] });
      qc.invalidateQueries({ queryKey: ["programas"] });
      qc.invalidateQueries({ queryKey: ["programa_moedas"] });
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
                <TableHead className="text-center">Regras</TableHead>
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
                  <TableCell className="py-2 text-center text-sm text-muted-foreground" title={REGRAS.filter((r) => p[r.coluna] === true).map((r) => r.titulo).join("\n") || "Nenhuma regra ligada"}>
                    {REGRAS.filter((r) => p[r.coluna] === true).length}/{REGRAS.length}
                  </TableCell>
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
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum programa cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Programa de Emissão{nome ? ` — ${nome}` : ""}</DialogTitle></DialogHeader>
          <Tabs defaultValue="geral" className="w-full flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="regras">Regras ({REGRAS.filter((r) => regras[r.coluna]).length}/{REGRAS.length})</TabsTrigger>
              <TabsTrigger value="moedas">Moedas{moedasSel.length > 0 ? ` (${moedasSel.length})` : ""}</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-2 mt-4 min-h-0">
              <TabsContent value="geral" className="mt-0 space-y-3">
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
              </TabsContent>

              {/* Regras: cada campo/comportamento da emissão que este programa usa.
                  Desligado = o campo nem aparece para o emissor. */}
              <TabsContent value="regras" className="mt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ligue apenas o que este programa usa. O que estiver desligado <strong>não aparece</strong> na tela de emissão —
                  menos campo inútil, menos erro de preenchimento.
                </p>
                {REGRAS_POR_GRUPO.map(({ grupo, regras: doGrupo }) => (
                  <div key={grupo} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{grupo}</h4>
                    <div className="rounded-md border divide-y">
                      {doGrupo.map((r) => (
                        <div key={r.key} className="flex items-start justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <Label className="cursor-default">{r.titulo}</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">{r.descricao}</p>
                          </div>
                          <Switch
                            className="mt-0.5 shrink-0"
                            checked={regras[r.coluna] === true}
                            onCheckedChange={(v) => setRegras((s) => ({ ...s, [r.coluna]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* Moedas: quais o emissor pode escolher nos campos de valor deste programa.
                  Nenhuma marcada = programa só em R$/Milhas, como sempre foi. */}
              <TabsContent value="moedas" className="mt-0 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Marque as moedas em que este programa é pago. Na emissão, o seletor mostra <strong>só essas</strong>.
                  Com uma única moeda marcada, ela já vem preenchida e o emissor nem precisa escolher.
                </p>
                <div className="rounded-md border divide-y">
                  {(moedasCad ?? []).filter((m: any) => m.ativo !== false).map((m: any) => (
                    <label key={m.id} className="flex items-center justify-between gap-3 p-3 cursor-pointer select-none">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{m.codigo}</span>
                        <span className="text-xs text-muted-foreground ml-2">{m.nome} · spread {(Number(m.spread_percentual) || 0).toLocaleString("pt-BR")}%</span>
                      </div>
                      <Switch
                        className="shrink-0"
                        checked={moedasSel.includes(m.id)}
                        onCheckedChange={(v) => setMoedasSel((s) => (v ? [...s, m.id] : s.filter((x) => x !== m.id)))}
                      />
                    </label>
                  ))}
                  {(moedasCad ?? []).filter((m: any) => m.ativo !== false).length === 0 && (
                    <p className="p-3 text-sm text-muted-foreground">Nenhuma moeda ativa. Cadastre em Configurações → Moedas.</p>
                  )}
                </div>
                {moedasSel.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sem moeda marcada, este programa aceita apenas R$ e Milhas — a opção "Moeda" nem aparece na emissão.
                  </p>
                )}
              </TabsContent>
            </div>
          </Tabs>
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
  const operacoesPerdas = useOperacoesPerdas();
  const operacoesCompras = useOperacoesCompras();
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
          <TabsTrigger value="operacoes_perdas">Operações Perdas</TabsTrigger>
          <TabsTrigger value="operacoes_compras">Operações Compras</TabsTrigger>
          <TabsTrigger value="emissores">Emissores</TabsTrigger>
          <TabsTrigger value="origens">Origens Emissões</TabsTrigger>
          <TabsTrigger value="origens_clientes">Origens Clientes</TabsTrigger>
          <TabsTrigger value="bancos">Bancos</TabsTrigger>
          <TabsTrigger value="queima_cpf">Taxa Queima CPF</TabsTrigger>
          <TabsTrigger value="moedas">Moedas</TabsTrigger>
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
        <TabsContent value="operacoes_perdas" className="mt-4">
          <LookupCrud table="operacoes_perdas" queryKey="operacoes_perdas" items={operacoesPerdas.data as any} isLoading={operacoesPerdas.isLoading} descricao="Motivos usados no campo Operação do lançamento de Perdas de estoque. Ex.: Expiração, Estorno, Bloqueio." />
        </TabsContent>
        <TabsContent value="operacoes_compras" className="mt-4">
          <LookupCrud table="operacoes_compras" queryKey="operacoes_compras" items={operacoesCompras.data as any} isLoading={operacoesCompras.isLoading} descricao="Tipos usados no campo Operação do lançamento de Compras de estoque. Ex.: Assinatura de clube, Compra avulsa, Transferência bonificada." />
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
        <TabsContent value="moedas" className="mt-4">
          <MoedasCrud />
        </TabsContent>
      </Tabs>
    </div>
  );
}
