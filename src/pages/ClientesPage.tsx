import { useState } from "react";
import { useClientes, useUpsertCliente, useDeleteCliente } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { SearchBar } from "@/components/ui/search-bar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePodeExcluir } from "@/hooks/usePerfil";

const emptyForm = {
  codigo: "", tipo_pessoa: "PJ", nome_fantasia: "", razao_social: "", cnpj_cpf: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "", codigo_ibge: "",
  contato: "", fone: "", email: "", origem: "", grupo: "",
};

// Países para o seletor do telefone (código do país + máscara). Brasil é o padrão.
const PAISES = [
  { code: "BR", dial: "55", nome: "Brasil", flag: "🇧🇷" },
  { code: "US", dial: "1", nome: "EUA/Canadá", flag: "🇺🇸" },
  { code: "PT", dial: "351", nome: "Portugal", flag: "🇵🇹" },
  { code: "AR", dial: "54", nome: "Argentina", flag: "🇦🇷" },
  { code: "PY", dial: "595", nome: "Paraguai", flag: "🇵🇾" },
  { code: "UY", dial: "598", nome: "Uruguai", flag: "🇺🇾" },
  { code: "CL", dial: "56", nome: "Chile", flag: "🇨🇱" },
  { code: "ES", dial: "34", nome: "Espanha", flag: "🇪🇸" },
];
const paisPorDial = (dial: string) => PAISES.find((p) => p.dial === dial);

// Aplica a máscara do telefone conforme o país. Brasil: DDD (2 dígitos) entre parênteses +
// número; se o número começar com 9, usa máscara de celular de 9 dígitos (5+4), senão fixo (4+4).
function formatarFone(pais: string, valor: string): string {
  const d = (valor || "").replace(/\D/g, "");
  if (pais === "BR") {
    const ddd = d.slice(0, 2);
    const sub = d.slice(2);
    const isCel = sub.startsWith("9");
    const s = sub.slice(0, isCel ? 9 : 8);
    const split = isCel ? 5 : 4;
    let out = "";
    if (ddd) out += "(" + ddd;
    if (d.length >= 2) out += ") ";
    out += s.length > split ? `${s.slice(0, split)}-${s.slice(split)}` : s;
    return out.trim();
  }
  if (pais === "US") {
    const t = d.slice(0, 10);
    let out = "";
    if (t.length) out += "(" + t.slice(0, 3);
    if (t.length >= 3) out += ") ";
    if (t.length > 3) out += t.slice(3, 6);
    if (t.length > 6) out += "-" + t.slice(6, 10);
    return out.trim();
  }
  // Demais países: agrupa em blocos de até 3-3-3-4, sem passar de 15 dígitos.
  return d.slice(0, 15).replace(/(\d{1,4})(?=(\d{3})+(?!\d))/g, "$1 ").trim();
}

export default function ClientesPage() {
  const { data: clientes, isLoading } = useClientes();
  const upsert = useUpsertCliente();
  const remove = useDeleteCliente();
  const podeExcluir = usePodeExcluir();
  const { query, setQuery, filtered } = useSearch<any>(clientes, ["codigo","nome_fantasia","razao_social","cnpj_cpf","contato","fone","email","municipio","uf","origem","grupo"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome_fantasia");
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [buscando, setBuscando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [fonePais, setFonePais] = useState("BR"); // país do telefone (padrão Brasil +55)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Preenche o endereço automaticamente a partir do CEP (ViaCEP — API pública gratuita).
  const buscarCep = async (cepValor?: string) => {
    const digits = (cepValor ?? form.cep).replace(/\D/g, "");
    if (digits.length !== 8) return; // só busca com CEP completo (8 dígitos)
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await resp.json();
      if (data?.erro) { toast.error("CEP não encontrado."); return; }
      setForm((f) => ({
        ...f,
        cep: digits.replace(/(\d{5})(\d{3})/, "$1-$2"),
        logradouro: data.logradouro || f.logradouro,
        bairro: data.bairro || f.bairro,
        municipio: data.localidade || f.municipio,
        uf: (data.uf || f.uf || "").toUpperCase(),
        complemento: data.complemento || f.complemento,
        codigo_ibge: data.ibge || f.codigo_ibge,
      }));
      toast.success("Endereço preenchido pelo CEP.");
    } catch {
      toast.error("Não foi possível consultar o CEP. Preencha manualmente.");
    } finally { setBuscandoCep(false); }
  };

  function proximoCodigo(): string {
    const nums = (clientes ?? [])
      .map((c: any) => /^A(\d+)$/.exec(c.codigo || ""))
      .filter(Boolean)
      .map((m: any) => parseInt(m[1], 10));
    const next = (nums.length ? Math.max(...nums) : 200) + 1;
    return "A" + next;
  }
  const openNew = () => { setEditing(null); setFonePais("BR"); setForm({ ...emptyForm, codigo: proximoCodigo() }); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    // Descobre o país do telefone pelo prefixo +DDI salvo e mostra só o número nacional formatado.
    let pais = "BR";
    let foneLocal = c.fone || "";
    const m = /^\+(\d{1,4})\s*(.*)$/.exec(foneLocal);
    if (m) { const p = paisPorDial(m[1]); if (p) { pais = p.code; foneLocal = m[2]; } }
    setFonePais(pais);
    setForm({
      ...emptyForm,
      ...Object.fromEntries(Object.keys(emptyForm).map((k) => [k, c[k] ?? (k === "tipo_pessoa" ? "PJ" : "")])),
      fone: formatarFone(pais, foneLocal),
    });
    setOpen(true);
  };

  function docDuplicado(doc: string): any | null {
    const digits = (doc || "").replace(/\D/g, "");
    if (!digits) return null;
    return (clientes ?? []).find((c: any) => c.id !== editing?.id && (c.cnpj_cpf || "").replace(/\D/g, "") === digits) || null;
  }

  const buscarReceita = async () => {
    const digits = form.cnpj_cpf.replace(/\D/g, "");
    if (digits.length !== 14) { toast.error("Para buscar na Receita, informe um CNPJ (14 dígitos)."); return; }
    const dup = docDuplicado(form.cnpj_cpf);
    if (dup) { toast.error(`Este CNPJ já está cadastrado (${dup.codigo} - ${dup.nome_fantasia}).`); return; }
    setBuscando(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", { body: { cnpj: digits } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setForm((f) => ({
        ...f, tipo_pessoa: "PJ",
        razao_social: data.razao_social ?? f.razao_social,
        nome_fantasia: f.nome_fantasia || data.nome_fantasia || "",
        cep: data.cep ?? f.cep, logradouro: data.logradouro ?? f.logradouro, numero: data.numero ?? f.numero,
        complemento: data.complemento ?? f.complemento, bairro: data.bairro ?? f.bairro,
        municipio: data.municipio ?? f.municipio, uf: data.uf ?? f.uf, codigo_ibge: data.codigo_ibge ?? f.codigo_ibge,
        email: data.email ?? f.email,
        fone: data.telefone ? formatarFone("BR", data.telefone) : f.fone,
      }));
      if (data.telefone) setFonePais("BR");
      toast.success("Dados preenchidos pela Receita.");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível consultar a Receita.");
    } finally { setBuscando(false); }
  };

  // Validação fiscal (NFS-e) adaptada por tipo de pessoa
  function validar(): string | null {
    if (!form.codigo) return "Informe o Código.";
    if (!form.nome_fantasia) return "Informe o Nome Fantasia.";
    if (!form.cnpj_cpf) return "Informe o CNPJ/CPF.";
    if (form.tipo_pessoa === "PJ" && !form.razao_social) return "Razão Social é obrigatória para CNPJ.";
    if (!form.cep) return "Informe o CEP.";
    if (!form.logradouro) return "Informe o Logradouro.";
    if (!form.numero) return "Informe o Número.";
    if (!form.bairro) return "Informe o Bairro.";
    if (!form.municipio) return "Informe o Município.";
    if (!form.uf) return "Informe a UF.";
    if (!form.email) return "Informe o E-mail (a NFS-e é enviada por e-mail).";
    if (!form.fone) return "Informe o Telefone.";
    return null;
  }

  const handleSave = async () => {
    const codDup = (clientes ?? []).find((c: any) => c.id !== editing?.id && (c.codigo || "").toLowerCase() === form.codigo.toLowerCase());
    if (codDup) { toast.error(`Já existe cliente com o código ${form.codigo}.`); return; }
    const dup = docDuplicado(form.cnpj_cpf);
    if (dup) { toast.error(`Já existe cliente com este CNPJ/CPF: ${dup.codigo} - ${dup.nome_fantasia}.`); return; }
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    try {
      // monta endereco completo legivel a partir dos campos estruturados
      const endereco = [form.logradouro, form.numero, form.complemento, form.bairro, form.municipio, form.uf]
        .filter((x) => x && x.trim()).join(", ");
      // Telefone salvo com o DDI do país selecionado (ex.: "+55 (54) 99999-9999").
      const dial = (PAISES.find((p) => p.code === fonePais) || PAISES[0]).dial;
      const foneCompleto = form.fone.trim() ? `+${dial} ${form.fone.trim()}` : "";
      await upsert.mutateAsync({ ...form, fone: foneCompleto, endereco, id: editing?.id });
      toast.success(editing ? "Cliente atualizado!" : "Cliente criado!");
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar cliente"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este cliente?")) return;
    try { await remove.mutateAsync(id); toast.success("Cliente removido!"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao remover cliente"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1"><h1 className="text-2xl font-display font-bold">Clientes</h1><AjudaButton chave="clientes" /></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
      </div>
      <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar por código, nome, CNPJ, cidade..." />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="codigo" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Nome Fantasia" sortKey="nome_fantasia" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="CNPJ/CPF" sortKey="cnpj_cpf" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Município" sortKey="municipio" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead className="w-[90px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum cliente cadastrado</TableCell></TableRow>
            ) : paged.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="py-2 font-mono text-sm">{c.codigo}</TableCell>
                <TableCell className="py-2 font-medium">{c.nome_fantasia}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.cnpj_cpf}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{c.municipio}{c.uf ? ` - ${c.uf}` : ""}</TableCell>
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
        <DialogContent className="w-[95vw] max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Cliente</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground -mb-1">Campos marcados com * são obrigatórios para emissão de NFS-e.</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="grid gap-1"><Label>Código *</Label><Input value={form.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())} /></div>
              <div className="grid gap-1">
                <Label>Tipo *</Label>
                <Select value={form.tipo_pessoa} onValueChange={(v) => set("tipo_pessoa", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PJ">CNPJ (PJ)</SelectItem><SelectItem value="PF">CPF (PF)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-1 col-span-2">
                <Label>CNPJ / CPF *</Label>
                <div className="flex gap-2">
                  <Input value={form.cnpj_cpf} onChange={(e) => set("cnpj_cpf", e.target.value)} placeholder="00.000.000/0000-00" />
                  <Button type="button" variant="outline" onClick={buscarReceita} disabled={buscando} title="Buscar na Receita">
                    {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Nome Fantasia *</Label><Input value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Razão Social {form.tipo_pessoa === "PJ" ? "*" : ""}</Label><Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="grid gap-1">
                <Label>CEP *</Label>
                <div className="relative">
                  <Input
                    value={form.cep}
                    inputMode="numeric"
                    placeholder="00000-000"
                    onChange={(e) => {
                      const v = e.target.value;
                      set("cep", v);
                      if (v.replace(/\D/g, "").length === 8) buscarCep(v);
                    }}
                    onBlur={() => buscarCep()}
                  />
                  {buscandoCep && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="grid gap-1 col-span-2"><Label>Logradouro *</Label><Input value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Número *</Label><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="grid gap-1"><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Bairro *</Label><Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Município *</Label><Input value={form.municipio} onChange={(e) => set("municipio", e.target.value)} /></div>
              <div className="grid gap-1"><Label>UF *</Label><Input maxLength={2} value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1"><Label>Contato</Label><Input value={form.contato} onChange={(e) => set("contato", e.target.value)} /></div>
              <div className="grid gap-1">
                <Label>Telefone *</Label>
                <div className="flex gap-2">
                  <Select value={fonePais} onValueChange={(v) => { setFonePais(v); set("fone", formatarFone(v, form.fone)); }}>
                    <SelectTrigger className="w-[110px] shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAISES.map((p) => (
                        <SelectItem key={p.code} value={p.code}>{p.flag} +{p.dial}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={form.fone}
                    inputMode="tel"
                    placeholder={fonePais === "BR" ? "(54) 99999-9999" : ""}
                    onChange={(e) => set("fone", formatarFone(fonePais, e.target.value))}
                  />
                </div>
              </div>
              <div className="grid gap-1"><Label>E-mail *</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Origem</Label><Input value={form.origem} onChange={(e) => set("origem", e.target.value)} /></div>
              <div className="grid gap-1"><Label>Grupo</Label><Input value={form.grupo} onChange={(e) => set("grupo", e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
