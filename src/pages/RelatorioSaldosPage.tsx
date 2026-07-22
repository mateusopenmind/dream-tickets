import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHead } from "@/components/ui/sortable-head";
import { AjudaButton } from "@/components/AjudaButton";
import { useSort } from "@/hooks/useSort";
import { usePagination } from "@/hooks/usePagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Search, Download, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface LinhaSaldo {
  id: string;
  conta_codigo: string;
  conta_nome: string;
  conta_tipo: string;
  programa: string;
  ativo: boolean;
  saldo: number;
  data_ref: string | null;      // data de referência do saldo ("Saldo em DD/MM" do e-mail / coluna da planilha)
  email_em: string | null;      // data/hora de emissão do e-mail (Smiles) — hora real da atualização
  atualizado_em: string | null; // timestamp da gravação no banco (fallback)
}

export default function RelatorioSaldosPage() {
  const [search, setSearch] = useState("");
  const [fPrograma, setFPrograma] = useState("__all");
  const [fTipo, setFTipo] = useState("__all");
  const [fAtivo, setFAtivo] = useState("ativo"); // all | ativo | inativo — abre só ativos por padrão
  const [fComSaldo, setFComSaldo] = useState("com"); // all | com | sem — abre só com saldo por padrão
  const [atualizando, setAtualizando] = useState(false);

  // Dispara a atualização de saldos (Latam + Smiles) no n8n e recarrega a tela ao concluir.
  const atualizarAgora = async () => {
    setAtualizando(true);
    const tid = toast.loading("Atualizando saldos (Latam + Smiles)… pode levar alguns segundos.");
    try {
      const { error } = await supabase.functions.invoke("atualizar-saldos");
      if (error) throw error;
      toast.success("Saldos atualizados! Recarregando…", { id: tid });
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      toast.error("Não foi possível atualizar agora: " + (e?.message || e), { id: tid });
      setAtualizando(false);
    }
  };

  const { data: linhas, isLoading } = useQuery({
    queryKey: ["relatorio-saldos"],
    queryFn: async (): Promise<LinhaSaldo[]> => {
      const { data, error } = await supabase
        .from("conta_programas")
        .select("id, saldo_milhas, saldo_data_ref, saldo_email_em, saldo_atualizado_em, ativo, contas(codigo, nome, tipo), programas_estoque(nome)")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        conta_codigo: (r.contas as any)?.codigo ?? "",
        conta_nome: (r.contas as any)?.nome ?? "",
        conta_tipo: (r.contas as any)?.tipo ?? "",
        programa: (r.programas_estoque as any)?.nome ?? "",
        ativo: r.ativo ?? true,
        saldo: r.saldo_milhas ?? 0,
        data_ref: r.saldo_data_ref,
        email_em: r.saldo_email_em,
        atualizado_em: r.saldo_atualizado_em,
      }));
    },
  });

  const programasUnicos = useMemo(
    () => Array.from(new Set((linhas ?? []).map((l) => l.programa))).filter(Boolean).sort(),
    [linhas]
  );

  const filtered = useMemo(() => {
    let list = [...(linhas ?? [])];
    if (fPrograma !== "__all") list = list.filter((l) => l.programa === fPrograma);
    if (fTipo !== "__all") list = list.filter((l) => l.conta_tipo === fTipo);
    if (fAtivo !== "__all") list = list.filter((l) => (fAtivo === "ativo" ? l.ativo : !l.ativo));
    if (fComSaldo !== "__all") list = list.filter((l) => (fComSaldo === "com" ? l.saldo > 0 : l.saldo <= 0));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((l) =>
        [l.conta_codigo, l.conta_nome, l.conta_tipo, l.programa, l.saldo].some((c) =>
          String(c ?? "").toLowerCase().includes(s)
        )
      );
    }
    return list;
  }, [linhas, fPrograma, fTipo, fAtivo, fComSaldo, search]);

  const { sorted, key, dir, toggle } = useSort<any>(filtered);
  const { page, setPage, totalPages, paged, total, from, to } = usePagination<any>(sorted, 100);

  const totalMilhas = useMemo(() => filtered.reduce((a, l) => a + (l.saldo || 0), 0), [filtered]);
  const totalAtivas = useMemo(() => filtered.filter((l) => l.ativo).reduce((a, l) => a + (l.saldo || 0), 0), [filtered]);
  const totalInativas = useMemo(() => filtered.filter((l) => !l.ativo).reduce((a, l) => a + (l.saldo || 0), 0), [filtered]);
  // milhas "paradas": em programas inativos mas com saldo > 0
  const inativosComSaldo = useMemo(() => filtered.filter((l) => !l.ativo && l.saldo > 0).length, [filtered]);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  // Data do saldo: mostra a data e HORA da atualização.
  // Prioriza a hora de emissão do e-mail (Smiles); depois o carimbo de gravação; por fim só a data de referência.
  const dataSaldo = (l: LinhaSaldo): string => {
    if (l.email_em) return format(new Date(l.email_em), "dd/MM/yyyy HH:mm");
    if (l.atualizado_em) return format(new Date(l.atualizado_em), "dd/MM/yyyy HH:mm");
    if (l.data_ref) return format(new Date(l.data_ref + "T00:00:00"), "dd/MM/yyyy");
    return "—";
  };

  const exportarCSV = () => {
    const head = ["Codigo", "Conta", "Tipo", "Programa", "Status", "Saldo", "Data do saldo"];
    const linhasCsv = sorted.map((l: LinhaSaldo) => [
      l.conta_codigo, l.conta_nome, l.conta_tipo, l.programa,
      l.ativo ? "Ativo" : "Inativo", l.saldo,
      dataSaldo(l) === "—" ? "" : dataSaldo(l),
    ]);
    const csv = [head, ...linhasCsv]
      .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saldos-milhas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Relatório de Saldos</h1>
          <AjudaButton chave="relatorio_saldos" />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={atualizarAgora} disabled={atualizando} title="Atualiza os saldos de Latam e Smiles no momento">
            {atualizando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {atualizando ? "Atualizando…" : "Atualizar agora"}
          </Button>
          <Button variant="outline" onClick={exportarCSV} disabled={sorted.length === 0}>
            <Download className="h-4 w-4 mr-2" />Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={fPrograma} onValueChange={setFPrograma}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Programa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os programas</SelectItem>
            {programasUnicos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os tipos</SelectItem>
            <SelectItem value="Própria">Própria</SelectItem>
            <SelectItem value="Terceiro">Terceiro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fAtivo} onValueChange={(v) => { setFAtivo(v); if (v === "inativo") setFComSaldo("__all"); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Ativos e inativos</SelectItem>
            <SelectItem value="ativo">Só ativos</SelectItem>
            <SelectItem value="inativo">Só inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fComSaldo} onValueChange={setFComSaldo}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Saldo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Com e sem saldo</SelectItem>
            <SelectItem value="com">Só com saldo</SelectItem>
            <SelectItem value="sem">Saldo zerado</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar conta, programa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
      </div>

      {inativosComSaldo > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-center gap-2">
          <span className="font-medium">Atenção:</span>
          {inativosComSaldo} programa(s) inativo(s) ainda com saldo &mdash; {fmt(totalInativas)} milhas paradas (conta não participa mais, mas o saldo segue gravado).
        </div>
      )}

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Código" sortKey="conta_codigo" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Conta" sortKey="conta_nome" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Tipo" sortKey="conta_tipo" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Programa" sortKey="programa" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Status" sortKey="ativo" activeKey={key} dir={dir} onSort={toggle} />
              <SortableHead label="Saldo (milhas)" sortKey="saldo" activeKey={key} dir={dir} onSort={toggle} align="right" className="text-right" />
              <SortableHead label="Data do saldo" sortKey="data_ref" activeKey={key} dir={dir} onSort={toggle} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum saldo encontrado com os filtros atuais.</TableCell></TableRow>
            ) : paged.map((l: LinhaSaldo) => (
              <TableRow key={l.id} className={!l.ativo && l.saldo > 0 ? "bg-amber-50/60" : undefined}>
                <TableCell className="py-2 font-mono text-sm">{l.conta_codigo}</TableCell>
                <TableCell className="py-2 font-medium">{l.conta_nome}</TableCell>
                <TableCell className="py-2 text-muted-foreground">{l.conta_tipo}</TableCell>
                <TableCell className="py-2">{l.programa}</TableCell>
                <TableCell className="py-2">
                  <Badge variant={l.ativo ? "default" : "secondary"} className={l.ativo ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                    {l.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className={`py-2 text-right font-mono ${!l.ativo && l.saldo > 0 ? "text-amber-700 font-semibold" : ""}`}>{fmt(l.saldo)}</TableCell>
                <TableCell className="py-2 text-muted-foreground text-sm whitespace-nowrap">
                  {dataSaldo(l)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={page} totalPages={totalPages} from={from} to={to} total={total} onPage={setPage} />
        {sorted.length > 0 && (
          <div className="flex flex-wrap justify-between items-center gap-x-6 gap-y-1 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">{sorted.length} registro(s)</span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="text-success">Ativas: <span className="font-mono font-medium">{fmt(totalAtivas)}</span></span>
              <span className="text-amber-700">Inativas: <span className="font-mono font-medium">{fmt(totalInativas)}</span></span>
              <span className="font-semibold">Total: <span className="font-mono">{fmt(totalMilhas)}</span> milhas</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
