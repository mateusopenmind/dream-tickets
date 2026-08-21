import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useMinhasTelas } from "@/hooks/usePerfil";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { validarSenhaForte, SENHA_REGRA_TEXTO } from "@/lib/validacaoSenha";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHead } from "@/components/ui/sortable-head";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { SearchBar } from "@/components/ui/search-bar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Pencil, ShieldCheck, Loader2, KeyRound, KeySquare, Copy } from "lucide-react";
import { agruparTelasPorMenu } from "@/lib/menuGrupos";
import { toast } from "sonner";

async function callAdmin(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-usuarios", {
    body: { action, ...body },
  });
  if (error) {
    // tenta extrair mensagem do corpo
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const PAPEL_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operador: "Operador",
};

export default function UsuariosPage() {
  const { data: perfil } = usePerfil();
  const { data: minhasTelas } = useMinhasTelas();
  const qc = useQueryClient();
  const isSuper = perfil?.papel === "super_admin";
  const isAdmin = perfil?.papel === "admin" || isSuper;

  const usuarios = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: () => callAdmin("list").then((d) => d.usuarios as any[]),
  });
  const { query, setQuery, filtered } = useSearch<any>(usuarios.data, ["nome","email","gl_id","whatsapp","papel"]);
  const { sorted, key, dir, toggle } = useSort<any>(filtered, "nome");

  // ----- dialog de criar/editar -----
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", email: "", papel: "operador", gl_id: "", whatsapp: "" });
  const [saving, setSaving] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [minhaSenhaOpen, setMinhaSenhaOpen] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confSenha, setConfSenha] = useState("");
  const [trocando, setTrocando] = useState(false);
  const trocarMinhaSenha = async () => {
    const erroSenha = validarSenhaForte(novaSenha);
    if (erroSenha) { toast.error(erroSenha); return; }
    if (novaSenha !== confSenha) { toast.error("As senhas não conferem."); return; }
    setTrocando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha, data: { deve_trocar_senha: false } });
      if (error) throw error;
      toast.success("Sua senha foi alterada!");
      setMinhaSenhaOpen(false); setNovaSenha(""); setConfSenha("");
    } catch (e: any) { toast.error(e.message); } finally { setTrocando(false); }
  };

  const openNew = () => { setEditing(null); setForm({ nome: "", email: "", papel: "operador", gl_id: "", whatsapp: "" }); setOpen(true); };
  const openEdit = (u: any) => { setEditing(u); setForm({ nome: u.nome, email: u.email, papel: u.papel, gl_id: u.gl_id, whatsapp: u.whatsapp }); setOpen(true); };

  const save = async () => {
    if (!form.nome || !form.email || !form.gl_id || !form.whatsapp) { toast.error("Preencha nome, e-mail, ID Padrão e WhatsApp."); return; }
    setSaving(true);
    try {
      if (editing) {
        await callAdmin("update", { id: editing.id, nome: form.nome, papel: form.papel, gl_id: form.gl_id, whatsapp: form.whatsapp });
        toast.success("Usuário atualizado.");
      } else {
        const r = await callAdmin("create", { ...form });
        qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
        setOpen(false);
        setSenhaGerada(r.senha_temporaria);
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const toggleAtivo = async (u: any) => {
    try {
      await callAdmin("update", { id: u.id, ativo: !u.ativo });
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const resetSenha = async (u: any) => {
    if (!confirm(`Gerar nova senha temporária para ${u.nome}?`)) return;
    try {
      const r = await callAdmin("reset_senha", { id: u.id });
      setSenhaGerada(r.senha_temporaria);
    } catch (e: any) { toast.error(e.message); }
  };

  // ----- dialog de telas (super admin: todas; admin: só as que ele tem acesso) -----
  const [telasOpen, setTelasOpen] = useState(false);
  const [telasUser, setTelasUser] = useState<any>(null);
  const telasCatalogo = useQuery({
    queryKey: ["telas-catalogo"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("telas").select("id, chave, nome, fase, pronta").order("fase").order("ordem");
      return data ?? [];
    },
  });
  // Admin só pode liberar as telas que ele próprio possui; super admin vê todas.
  // Só telas prontas. A ordem/rótulo dos grupos espelha o menu lateral.
  const telasLiberaveis = (telasCatalogo.data ?? [])
    .filter((t: any) => t.pronta && (isSuper || (minhasTelas?.has(t.chave) ?? false)));
  const telasAgrupadas = agruparTelasPorMenu(telasLiberaveis as any[]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [marcadasOriginais, setMarcadasOriginais] = useState<Set<string>>(new Set());
  const [savingTelas, setSavingTelas] = useState(false);

  const openTelas = async (u: any) => {
    setTelasUser(u); setTelasOpen(true);
    const d = await callAdmin("get_telas", { id: u.id });
    setMarcadas(new Set(d.tela_ids));
    setMarcadasOriginais(new Set(d.tela_ids));
  };
  const salvarTelas = async () => {
    setSavingTelas(true);
    try {
      // IDs que o admin pode gerenciar (todas, se super admin)
      const liberaveisIds = new Set(telasLiberaveis.map((t: any) => t.id));
      // Preserva telas que o usuário já tinha e que estão fora do alcance deste admin
      const preservadas = [...marcadasOriginais].filter((id) => !liberaveisIds.has(id));
      // Das gerenciáveis, mantém só as marcadas
      const gerenciadas = [...marcadas].filter((id) => liberaveisIds.has(id));
      const final = [...new Set([...preservadas, ...gerenciadas])];
      await callAdmin("set_telas", { id: telasUser.id, tela_ids: final });
      toast.success("Telas atualizadas.");
      setTelasOpen(false);
    } catch (e: any) { toast.error(e.message); } finally { setSavingTelas(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Usuários e Permissões</h1>
        <AjudaButton chave="usuarios" />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setMinhaSenhaOpen(true)} size="sm"><KeySquare className="h-4 w-4 mr-1" /> Alterar minha senha</Button>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo usuário</Button>
      </div>
      <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar usuário..." />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nome" sortKey="nome" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="E-mail" sortKey="email" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="ID Padrão" sortKey="gl_id" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead>WhatsApp</TableHead>
              <SortableHead label="Papel" sortKey="papel" activeKey={key} dir={dir} onSort={toggle} />
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            )}
            {sorted.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="py-2 font-medium">{u.nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{u.email}</TableCell>
                <TableCell className="py-2">{u.gl_id}</TableCell>
                <TableCell className="py-2">{u.whatsapp}</TableCell>
                <TableCell className="py-2"><Badge variant={u.papel === "operador" ? "secondary" : "default"}>{PAPEL_LABEL[u.papel] ?? u.papel}</Badge></TableCell>
                <TableCell className="py-2 text-center">
                  <Switch checked={u.ativo} onCheckedChange={() => toggleAtivo(u)} disabled={u.papel === "super_admin"} />
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => resetSenha(u)} title="Gerar nova senha"><KeyRound className="h-4 w-4" /></Button>
                    {(isSuper || (isAdmin && u.papel === "operador")) && (
                      <Button variant="ghost" size="icon" onClick={() => openTelas(u)} title="Liberar telas"><ShieldCheck className="h-4 w-4 text-primary" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {isAdmin && !isSuper && (
        <p className="text-xs text-muted-foreground">Você pode liberar telas para operadores, limitado às telas a que você tem acesso.</p>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} disabled={!!editing} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {!editing && <p className="text-xs text-muted-foreground">O e-mail será o login do usuário.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>ID Padrão</Label><Input placeholder="GL00001" value={form.gl_id} onChange={(e) => setForm({ ...form, gl_id: e.target.value.toUpperCase() })} /></div>
              <div className="space-y-1"><Label>WhatsApp</Label><Input placeholder="5554999990001" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={form.papel} onValueChange={(v) => setForm({ ...form, papel: v })} disabled={!isSuper}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  {isSuper && <SelectItem value="admin">Admin</SelectItem>}
                </SelectContent>
              </Select>
              {!isSuper && <p className="text-xs text-muted-foreground">Admin só cadastra operadores.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Salvar" : "Criar usuário"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog telas (super admin) */}
      <Dialog open={telasOpen} onOpenChange={setTelasOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Telas liberadas — {telasUser?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {telasAgrupadas.map((grupo) => {
              const idsGrupo = grupo.telas.map((t: any) => t.id);
              const todasMarcadas = idsGrupo.every((id) => marcadas.has(id));
              const toggleGrupo = () => {
                const next = new Set(marcadas);
                if (todasMarcadas) idsGrupo.forEach((id) => next.delete(id));
                else idsGrupo.forEach((id) => next.add(id));
                setMarcadas(next);
              };
              return (
                <div key={grupo.label} className="space-y-2">
                  <button
                    type="button"
                    onClick={toggleGrupo}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    title={todasMarcadas ? "Desmarcar grupo" : "Marcar grupo"}
                  >
                    {grupo.label}
                  </button>
                  <div className="space-y-2 pl-1">
                    {grupo.telas.map((t: any) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                          checked={marcadas.has(t.id)}
                          onChange={(e) => {
                            const next = new Set(marcadas);
                            e.target.checked ? next.add(t.id) : next.delete(t.id);
                            setMarcadas(next);
                          }}
                        />
                        <span>{t.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTelasOpen(false)}>Cancelar</Button>
            <Button onClick={salvarTelas} disabled={savingTelas}>{savingTelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar telas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Senha temporaria gerada */}
      <Dialog open={!!senhaGerada} onOpenChange={(o) => !o && setSenhaGerada(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Senha temporária</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Copie e envie esta senha ao usuário. Ele poderá trocá-la depois.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-lg tracking-wide select-all">{senhaGerada}</code>
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(senhaGerada || ""); toast.success("Senha copiada!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setSenhaGerada(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={minhaSenhaOpen} onOpenChange={setMinhaSenhaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Alterar minha senha</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label>Nova senha</Label><Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Senha forte" /><p className="text-xs text-muted-foreground">{SENHA_REGRA_TEXTO}</p></div>
            <div className="space-y-1"><Label>Confirmar nova senha</Label><Input type="password" value={confSenha} onChange={(e) => setConfSenha(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMinhaSenhaOpen(false)}>Cancelar</Button>
            <Button onClick={trocarMinhaSenha} disabled={trocando}>{trocando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
