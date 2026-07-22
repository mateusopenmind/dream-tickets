import { useMemo, useState } from "react";
import { useCobrancasEmAberto, type CobrancaAberta } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchSelect } from "@/components/ui/search-select";
import { AjudaButton } from "@/components/AjudaButton";
import { Printer, Loader2 } from "lucide-react";
import { format } from "date-fns";

const ALL = "__all";
const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => {
  if (!d) return "—";
  // Aceita tanto "YYYY-MM-DD" quanto timestamp completo (created_at) sem quebrar.
  const dt = new Date(d.length > 10 ? d : d + "T00:00:00");
  return isNaN(dt.getTime()) ? "—" : format(dt, "dd/MM/yyyy");
};
const fmtDataHora = (r: CobrancaAberta) =>
  `${fmtData(r.data_emissao)}${r.hora ? ` ${String(r.hora).slice(0, 5)}` : ""}`;

export default function CobrancasAbertasPage() {
  const { data: cobrancas, isLoading } = useCobrancasEmAberto();
  const [cliente, setCliente] = useState(ALL);

  // apenas clientes que possuem cobranças em aberto
  const opcoesClientes = useMemo(() => {
    const m = new Map<string, string>();
    (cobrancas ?? []).forEach((c) => {
      const cod = c.cliente_codigo || "(sem código)";
      if (!m.has(cod)) m.set(cod, c.cliente_nome || "");
    });
    return [
      { value: ALL, label: "Todos os clientes" },
      ...Array.from(m.entries())
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
        .map(([cod, nome]) => ({ value: cod, label: `${cod} — ${nome}` })),
    ];
  }, [cobrancas]);

  const rows = useMemo(
    () => (cobrancas ?? []).filter((c) => cliente === ALL || c.cliente_codigo === cliente),
    [cobrancas, cliente]
  );

  const totalGeral = rows.reduce((a, r) => a + r.preco_total, 0);
  const clienteLabel = opcoesClientes.find((o) => o.value === cliente)?.label ?? "";

  const imprimir = () => {
    const linhas = rows
      .map(
        (r) => `<tr>
          <td>${r.id_emissao}</td>
          <td>${fmtDataHora(r)}</td>
          <td>${r.localizador || "—"}</td>
          <td>${r.programa || "—"}</td>
          <td>${r.nome_operacao || "—"}</td>
          <td>${fmtData(r.data_voo_ida)}</td>
          <td class="r">${brl(r.preco_total)}</td>
        </tr>`
      )
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Cobranças em Aberto</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}
        h1{font-size:18px;margin:0 0 4px}
        .sub{font-size:12px;color:#555;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f3f4f6}
        td.r,th.r{text-align:right}
        tfoot td{font-weight:bold;background:#f3f4f6}
      </style></head><body>
      <h1>Cobranças em Aberto</h1>
      <div class="sub">${cliente === ALL ? "Todos os clientes" : clienteLabel} · emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      <table>
        <thead><tr><th>ID</th><th>Data/Hora</th><th>Localizador</th><th>Programa</th><th>Operação</th><th>Data Voo Ida</th><th class="r">Preço Total</th></tr></thead>
        <tbody>${linhas || `<tr><td colspan="7">Nenhuma cobrança em aberto.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="6">TOTAL GERAL (${rows.length} emissão${rows.length === 1 ? "" : "ões"})</td><td class="r">${brl(totalGeral)}</td></tr></tfoot>
      </table>
      </body></html>`;
    const w = window.open("", "_blank", "width=1024,height=768");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Cobranças em Aberto</h1>
          <AjudaButton chave="cobrancas_abertas" />
        </div>
        <Button variant="outline" onClick={imprimir} disabled={rows.length === 0}>
          <Printer className="h-4 w-4 mr-2" />Imprimir
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Cliente</label>
            <SearchSelect
              options={opcoesClientes}
              value={cliente}
              onChange={setCliente}
              placeholder="Selecione o cliente"
              className="w-[360px]"
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[calc(100vh-14rem)] overflow-auto">
            <Table className="[&_td]:py-1.5 [&_th]:h-9">
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Localizador</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Data Voo Ida</TableHead>
                  <TableHead className="text-right">Preço Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma cobrança em aberto.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={`${r.tabela_origem}-${r.id}`}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{r.id_emissao}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDataHora(r)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.localizador || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.programa || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.nome_operacao || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtData(r.data_voo_ida)}</TableCell>
                    <TableCell className="text-right font-mono">{brl(r.preco_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {rows.length > 0 && (
                <tfoot className="sticky bottom-0 bg-card">
                  <TableRow className="border-t-2">
                    <TableCell colSpan={6} className="font-display font-bold">
                      TOTAL GERAL ({rows.length} emissão{rows.length === 1 ? "" : "ões"})
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">{brl(totalGeral)}</TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
