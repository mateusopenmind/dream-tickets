import { useMemo, useState } from "react";
import {
  useCobrancasEmAberto, useCobrancasAgrupadasAbertas, useAcaoCobrancaAgrupada,
  type CobrancaAberta, type CobrancaAgrupada,
} from "@/hooks/useData";
import { useMinhasTelas, usePerfil } from "@/hooks/usePerfil";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/ui/search-select";
import { AjudaButton } from "@/components/AjudaButton";
import { Printer, Loader2, Layers, Send, Unlink, Link2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const ALL = "__all";
const APP_URL = "https://app.dreamticketsbr.com";
const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => {
  if (!d) return "—";
  // Aceita tanto "YYYY-MM-DD" quanto timestamp completo (created_at) sem quebrar.
  const dt = new Date(d.length > 10 ? d : d + "T00:00:00");
  return isNaN(dt.getTime()) ? "—" : format(dt, "dd/MM/yyyy");
};
const fmtDataHora = (r: CobrancaAberta) =>
  `${fmtData(r.data_emissao)}${r.hora ? ` ${String(r.hora).slice(0, 5)}` : ""}`;
const chaveItem = (r: CobrancaAberta) => `${r.tabela_origem}:${r.id}`;
const nomeBanco = (b: string | null) => ({ sicoob: "Sicoob", sicredi: "Sicredi" } as Record<string, string>)[String(b || "").toLowerCase()] || b || "—";

// Só cobrança Pix (ou ainda não cobrada) pode entrar num agrupamento. Recebimento avulso
// (parcelas) tem valor pendente diferente do preço total e fica de fora.
const podeSelecionar = (r: CobrancaAberta) => !r.cobranca_agrupada_id && (!r.forma_cobranca || r.forma_cobranca === "pix");

export default function CobrancasAbertasPage() {
  const { data: cobrancas, isLoading } = useCobrancasEmAberto();
  const { data: grupos } = useCobrancasAgrupadasAbertas();
  const { data: minhasTelas } = useMinhasTelas();
  const { data: perfil } = usePerfil();
  const acao = useAcaoCobrancaAgrupada();
  const podeAgrupar = !!minhasTelas?.has("cobrancas_agrupar");

  const [cliente, setCliente] = useState(ALL);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmarAgrupar, setConfirmarAgrupar] = useState(false);
  const [confirmarDesagrupar, setConfirmarDesagrupar] = useState<CobrancaAgrupada | null>(null);
  const [executando, setExecutando] = useState<string | null>(null);

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

  // Grupos abertos do filtro + seus itens. Item cujo grupo não veio (ex.: grupo de outro
  // usuário que o RLS esconde) aparece como linha normal, só com a etiqueta.
  const gruposMap = useMemo(() => new Map((grupos ?? []).map((g) => [g.id, g])), [grupos]);
  const blocos = useMemo(() => {
    const porGrupo = new Map<string, CobrancaAberta[]>();
    const soltos: CobrancaAberta[] = [];
    for (const r of rows) {
      if (r.cobranca_agrupada_id && gruposMap.has(r.cobranca_agrupada_id)) {
        const l = porGrupo.get(r.cobranca_agrupada_id) ?? [];
        l.push(r);
        porGrupo.set(r.cobranca_agrupada_id, l);
      } else soltos.push(r);
    }
    const gs = Array.from(porGrupo.entries()).map(([id, itens]) => ({ grupo: gruposMap.get(id)!, itens }));
    return { gs, soltos };
  }, [rows, gruposMap]);

  const totalGeral = rows.reduce((a, r) => a + r.preco_total, 0);
  const clienteLabel = opcoesClientes.find((o) => o.value === cliente)?.label ?? "";

  const mostrarSelecao = podeAgrupar && cliente !== ALL;
  const itensSelecionados = rows.filter((r) => selecionados.has(chaveItem(r)) && podeSelecionar(r));
  const totalSelecionado = itensSelecionados.reduce((a, r) => a + r.preco_total, 0);
  const selecionaveis = blocos.soltos.filter(podeSelecionar);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((r) => selecionados.has(chaveItem(r)));

  const trocarCliente = (v: string) => { setCliente(v); setSelecionados(new Set()); };
  const alternar = (r: CobrancaAberta) => {
    setSelecionados((s) => {
      const n = new Set(s);
      const k = chaveItem(r);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };
  const alternarTodos = () => {
    setSelecionados(todosMarcados ? new Set() : new Set(selecionaveis.map(chaveItem)));
  };

  const avisarWhatsapp = (d: any, ok: string) => {
    if (d?.sem_telefone) toast.warning(`${ok} Seu usuário não tem WhatsApp cadastrado — a mensagem não foi enviada.`);
    else if (d?.janela_fechada) toast.warning(`${ok} Mas a janela de 24h do seu WhatsApp está fechada: mande um "oi" para o WhatsApp da DreamTickets e use Reenviar.`);
    else toast.success(ok);
  };

  const agrupar = async () => {
    setExecutando("agrupar");
    try {
      const d = await acao.mutateAsync({
        acao: "agrupar",
        itens: itensSelecionados.map((r) => ({ tabela: r.tabela_origem, id: r.id })),
        fone_destino: perfil?.whatsapp || "",
      });
      if (d?.ok === false) {
        toast.error(d.erro || "Não foi possível agrupar.", { duration: 10000 });
        if (d?.recobrando?.length) toast.info(`Gerando de novo o Pix individual de: ${d.recobrando.join(", ")}.`, { duration: 10000 });
      } else {
        avisarWhatsapp(d, `Cobrança agrupada ${d?.codigo ?? ""} gerada (Pix ${nomeBanco(d?.banco)}) e enviada por WhatsApp.`);
      }
      setSelecionados(new Set());
      setConfirmarAgrupar(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao agrupar", { duration: 10000 });
    } finally { setExecutando(null); }
  };

  const desagrupar = async (g: CobrancaAgrupada) => {
    setExecutando(`desagrupar:${g.id}`);
    try {
      const d = await acao.mutateAsync({ acao: "desagrupar", grupo_id: g.id, fone_destino: perfil?.whatsapp || "" });
      if (d?.ok === false) toast.error(d.erro || "Não foi possível desagrupar.", { duration: 10000 });
      else toast.success(`Cobrança agrupada ${g.codigo} desfeita. ${d?.recobrando?.length ? `Gerando o Pix individual de ${d.recobrando.length} cobrança(s) — as mensagens chegam no seu WhatsApp em instantes.` : ""}`, { duration: 8000 });
      setConfirmarDesagrupar(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao desagrupar", { duration: 10000 });
    } finally { setExecutando(null); }
  };

  const reenviar = async (g: CobrancaAgrupada) => {
    setExecutando(`reenviar:${g.id}`);
    try {
      const d = await acao.mutateAsync({ acao: "reenviar", grupo_id: g.id, fone_destino: perfil?.whatsapp || "" });
      if (d?.ok === false) toast.error(d.erro || "Não foi possível reenviar.");
      else avisarWhatsapp(d, `Cobrança agrupada ${g.codigo} reenviada por WhatsApp.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reenviar");
    } finally { setExecutando(null); }
  };

  const copiarLink = (g: CobrancaAgrupada) => {
    if (!g.pix_txid) return;
    navigator.clipboard?.writeText(`${APP_URL}/pix/${g.pix_txid}`);
    toast.success("Link do Pix copiado.");
  };

  const imprimir = () => {
    const linha = (r: CobrancaAberta, grupo?: CobrancaAgrupada) => `<tr>
          <td>${r.id_emissao}${grupo ? `<br><small>Agrupada ${grupo.codigo}</small>` : ""}</td>
          <td>${fmtDataHora(r)}</td>
          <td>${r.localizador || "—"}</td>
          <td>${r.programa || "—"}</td>
          <td>${r.nome_operacao || "—"}</td>
          <td>${fmtData(r.data_voo_ida)}</td>
          <td class="r">${brl(r.preco_total)}</td>
        </tr>`;
    const linhas = [
      ...blocos.gs.flatMap(({ grupo, itens }) => [
        `<tr class="g"><td colspan="6">Cobrança agrupada ${grupo.codigo} — ${itens.length} itens (um Pix só)</td><td class="r">${brl(grupo.preco_total)}</td></tr>`,
        ...itens.map((r) => linha(r, grupo)),
      ]),
      ...blocos.soltos.map((r) => linha(r)),
    ].join("");
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
        tr.g td{background:#eef2ff;font-weight:bold}
        small{color:#555}
        tfoot td{font-weight:bold;background:#f3f4f6}
      </style></head><body>
      <h1>Cobranças em Aberto</h1>
      <div class="sub">${cliente === ALL ? "Todos os clientes" : clienteLabel} · emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      <table>
        <thead><tr><th>ID</th><th>Data/Hora</th><th>Localizador</th><th>Programa</th><th>Operação</th><th>Data Voo Ida</th><th class="r">Preço Total</th></tr></thead>
        <tbody>${linhas || `<tr><td colspan="7">Nenhuma cobrança em aberto.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="6">TOTAL GERAL (${rows.length} ${rows.length === 1 ? "emissão" : "emissões"})</td><td class="r">${brl(totalGeral)}</td></tr></tfoot>
      </table>
      </body></html>`;
    const w = window.open("", "_blank", "width=1024,height=768");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const colunas = mostrarSelecao ? 8 : 7;

  const linhaItem = (r: CobrancaAberta, dentroDeGrupo: boolean) => {
    const k = chaveItem(r);
    const sel = podeSelecionar(r);
    return (
      <TableRow key={`${r.tabela_origem}-${r.id}`} className={dentroDeGrupo ? "bg-primary/5" : undefined}>
        {mostrarSelecao && (
          <TableCell className="w-8">
            {!dentroDeGrupo && (
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary disabled:opacity-40"
                checked={selecionados.has(k)}
                disabled={!sel}
                title={sel ? "Selecionar para agrupar" : "Tem recebimento avulso lançado — não pode ser agrupada"}
                onChange={() => alternar(r)}
              />
            )}
          </TableCell>
        )}
        <TableCell className={`font-mono text-xs whitespace-nowrap ${dentroDeGrupo ? "pl-6" : ""}`}>
          {r.id_emissao}
          {r.cobranca_agrupada_id && !dentroDeGrupo && <Badge variant="secondary" className="ml-1 text-[10px]">Agrupada</Badge>}
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm">{fmtDataHora(r)}</TableCell>
        <TableCell className="whitespace-nowrap">{r.localizador || "—"}</TableCell>
        <TableCell className="whitespace-nowrap">{r.programa || "—"}</TableCell>
        <TableCell className="whitespace-nowrap">{r.nome_operacao || "—"}</TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground">{fmtData(r.data_voo_ida)}</TableCell>
        <TableCell className="text-right font-mono">{brl(r.preco_total)}</TableCell>
      </TableRow>
    );
  };

  const linhaGrupo = (g: CobrancaAgrupada, itens: CobrancaAberta[]) => {
    const gerando = g.status_pix === "GERANDO";
    return (
      <TableRow key={`grupo-${g.id}`} className="bg-primary/10 hover:bg-primary/10 border-t-2">
        <TableCell colSpan={colunas - 1} className="py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-semibold">Cobrança agrupada {g.codigo}</span>
            <span className="text-xs text-muted-foreground">{itens.length} {itens.length === 1 ? "item" : "itens"} · um Pix só</span>
            {gerando ? (
              <Badge className="bg-warning text-warning-foreground"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Gerando Pix…</Badge>
            ) : (
              <Badge variant="outline">Pix {nomeBanco(g.pix_banco)}{g.data_cobranca ? ` · ${format(new Date(g.data_cobranca), "dd/MM HH:mm")}` : ""}</Badge>
            )}
            <div className="ml-auto flex flex-wrap gap-1">
              {!gerando && g.pix_txid && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => copiarLink(g)} title="Copiar o link do Pix">
                    <Link2 className="h-4 w-4 mr-1" />Link
                  </Button>
                  <Button size="sm" variant="outline" disabled={executando !== null} onClick={() => reenviar(g)}>
                    <Send className="h-4 w-4 mr-1" />{executando === `reenviar:${g.id}` ? "..." : "Reenviar"}
                  </Button>
                </>
              )}
              {podeAgrupar && (
                <Button size="sm" variant="outline" className="text-destructive" disabled={executando !== null} onClick={() => setConfirmarDesagrupar(g)}>
                  <Unlink className="h-4 w-4 mr-1" />Desagrupar
                </Button>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono font-bold">{brl(g.preco_total)}</TableCell>
      </TableRow>
    );
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
              onChange={trocarCliente}
              placeholder="Selecione o cliente"
              className="w-[360px]"
            />
          </div>
          {podeAgrupar && (
            <div className="ml-auto flex items-center gap-3">
              {cliente === ALL ? (
                <span className="text-xs text-muted-foreground">Selecione um cliente para agrupar cobranças num Pix só.</span>
              ) : (
                <>
                  {itensSelecionados.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {itensSelecionados.length} selecionada(s) · <b>{brl(totalSelecionado)}</b>
                    </span>
                  )}
                  <Button disabled={itensSelecionados.length < 2 || executando !== null} onClick={() => setConfirmarAgrupar(true)}>
                    <Layers className="h-4 w-4 mr-2" />Agrupar e gerar Pix
                  </Button>
                </>
              )}
            </div>
          )}
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
                  {mostrarSelecao && (
                    <TableHead className="w-8">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={todosMarcados} disabled={selecionaveis.length === 0} onChange={alternarTodos} title="Selecionar todas" />
                    </TableHead>
                  )}
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
                  <TableRow><TableCell colSpan={colunas} className="text-center text-muted-foreground py-6">Nenhuma cobrança em aberto.</TableCell></TableRow>
                ) : (
                  <>
                    {blocos.gs.map(({ grupo, itens }) => [linhaGrupo(grupo, itens), ...itens.map((r) => linhaItem(r, true))])}
                    {blocos.soltos.map((r) => linhaItem(r, false))}
                  </>
                )}
              </TableBody>
              {rows.length > 0 && (
                <tfoot className="sticky bottom-0 bg-card">
                  <TableRow className="border-t-2">
                    <TableCell colSpan={colunas - 1} className="font-display font-bold">
                      TOTAL GERAL ({rows.length} {rows.length === 1 ? "emissão" : "emissões"})
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">{brl(totalGeral)}</TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </Card>
      )}

      {/* Confirmar agrupamento */}
      <Dialog open={confirmarAgrupar} onOpenChange={(o) => { if (!executando) setConfirmarAgrupar(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agrupar em um Pix só</DialogTitle>
            <DialogDescription>
              Os Pix individuais destas cobranças serão cancelados no banco e um Pix novo, com o total, será gerado e enviado para o seu WhatsApp.
              Se algum Pix individual já tiver sido pago, nada é alterado.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-auto rounded border">
            <Table className="[&_td]:py-1">
              <TableBody>
                {itensSelecionados.map((r) => (
                  <TableRow key={chaveItem(r)}>
                    <TableCell className="font-mono text-xs">{r.id_emissao}</TableCell>
                    <TableCell>{r.localizador || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.nome_operacao || r.programa}</TableCell>
                    <TableCell className="text-right font-mono">{brl(r.preco_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Total do Pix ({itensSelecionados.length} cobranças)</span>
            <span className="font-mono">{brl(totalSelecionado)}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={executando !== null} onClick={() => setConfirmarAgrupar(false)}>Voltar</Button>
            <Button disabled={executando !== null || itensSelecionados.length < 2} onClick={agrupar}>
              {executando === "agrupar" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</> : <><Layers className="h-4 w-4 mr-2" />Agrupar e gerar Pix</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar desagrupamento */}
      <Dialog open={!!confirmarDesagrupar} onOpenChange={(o) => { if (!o && !executando) setConfirmarDesagrupar(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desagrupar {confirmarDesagrupar?.codigo}?</DialogTitle>
            <DialogDescription>
              O Pix do grupo ({brl(confirmarDesagrupar?.preco_total ?? 0)}) será cancelado no banco e cada cobrança volta a ter o seu próprio Pix,
              gerado automaticamente e enviado para o seu WhatsApp (uma mensagem por cobrança).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={executando !== null} onClick={() => setConfirmarDesagrupar(null)}>Voltar</Button>
            <Button variant="destructive" disabled={executando !== null} onClick={() => confirmarDesagrupar && desagrupar(confirmarDesagrupar)}>
              {executando?.startsWith("desagrupar") ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Desagrupando…</> : <><Unlink className="h-4 w-4 mr-2" />Desagrupar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
