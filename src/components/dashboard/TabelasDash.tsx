// Tabelas densas do Dashboard de Faturamento: programa × mês, escalas de calor,
// calendários e a matriz de % dos top 15 clientes.
//
// As células com escala de cor recebem fundo e cor de texto explícitos (o mesmo
// esquema do dashboard de referência). Célula sem valor fica transparente, para não
// virar um bloco branco no tema escuro.

import { useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import {
  escalaCor, corTexto, ddmm, DOW_CURTO, mesLabel, fmtPct1,
  type MatrizProg, type MatrizFaixa, type Calendario,
} from "@/lib/dashboardFaturamento";

const TH = "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const TD = "px-2 py-1.5 text-center text-xs tabular-nums";

/* ---------------------------------------------- ordenação das colunas */
// Clicar no cabeçalho ordena as linhas (asc → desc). Sem coluna escolhida = ordem original.
// A linha de TOTAL (tfoot) fica sempre fixa no fim.
type DirOrdem = "asc" | "desc";
export type Ordem = { key: string | null; dir: DirOrdem; toggle: (k: string) => void };
export function useOrdem(): Ordem {
  const [o, setO] = useState<{ key: string | null; dir: DirOrdem }>({ key: null, dir: "asc" });
  const toggle = (k: string) =>
    setO((p) => (p.key === k ? { key: k, dir: p.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));
  return { ...o, toggle };
}
export function ordenar<T>(itens: T[], ordem: Ordem, valor: (it: T, key: string) => string | number | null | undefined): T[] {
  const k = ordem.key;
  if (!k) return itens;
  return [...itens].sort((a, b) => {
    const va = valor(a, k), vb = valor(b, k);
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // vazios sempre por último
    if (vb == null) return -1;
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
    return ordem.dir === "asc" ? cmp : -cmp;
  });
}
export function ThOrd({ label, k, ordem, className }: { label: ReactNode; k: string; ordem: Ordem; className?: string }) {
  const ativo = ordem.key === k;
  return (
    <th className={className}>
      <button type="button" onClick={() => ordem.toggle(k)}
        className={`inline-flex items-center gap-0.5 uppercase tracking-wide transition-colors hover:text-foreground ${ativo ? "text-foreground" : ""}`}>
        {label}
        {ativo
          ? (ordem.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
          : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}

export function CardTabela({
  titulo, nota, corTopo, children,
}: {
  titulo: string;
  nota?: string;
  corTopo?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card" style={corTopo ? { borderTop: `3px solid ${corTopo}` } : undefined}>
      <div className="px-3 pt-3">
        <h3 className="text-sm font-display font-semibold">{titulo}</h3>
        {nota && <p className="mt-0.5 text-[11px] text-muted-foreground">{nota}</p>}
      </div>
      <div className="overflow-x-auto p-3">{children}</div>
    </div>
  );
}

/* ------------------------------------------------- programa × mês */

export function TabelaProgramaMes({
  matriz, fmt, cor, mostrarPct = true,
}: {
  matriz: MatrizProg;
  fmt: (v: number) => string;
  cor: (p: string, i: number) => string;
  mostrarPct?: boolean;
}) {
  const { meses, linhas, totaisMes, totalGeral } = matriz;
  const ordem = useOrdem();
  if (!linhas.length) return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no filtro.</p>;

  const pct = (v: number, base: number) => (base > 0 ? fmtPct1((v / base) * 100) : "—");
  // Índice original (i) preservado: a cor da bolinha continua a mesma depois de ordenar.
  const linhasOrd = ordenar(linhas.map((l, i) => ({ l, i })), ordem, ({ l }, k) =>
    k === "nome" ? l.chave : k === "total" ? l.total : l.celulas[Number(k.slice(1))]);

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b">
          <ThOrd label="Programa" k="nome" ordem={ordem} className={`${TH} text-left`} />
          {meses.map((m, j) => <ThOrd key={m} label={mesLabel(m)} k={`m${j}`} ordem={ordem} className={TH} />)}
          <ThOrd label="Total" k="total" ordem={ordem} className={TH} />
        </tr>
      </thead>
      <tbody>
        {linhasOrd.map(({ l, i }) => (
          <tr key={l.chave} className="border-b last:border-0">
            <td className="whitespace-nowrap px-2 py-1.5 text-xs font-medium">
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: cor(l.chave, i) }} />
              {l.chave}
            </td>
            {l.celulas.map((v, j) => (
              <td key={meses[j]} className={TD}>
                {v > 0 ? (
                  <>
                    <div className="font-semibold">{fmt(v)}</div>
                    {mostrarPct && <div className="text-[10px] text-muted-foreground">{pct(v, totaisMes[j])}</div>}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            ))}
            <td className={`${TD} bg-muted/40`}>
              <div className="font-semibold">{fmt(l.total)}</div>
              {mostrarPct && <div className="text-[10px] text-muted-foreground">{pct(l.total, totalGeral)}</div>}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-semibold">
          <td className="px-2 py-1.5 text-xs">TOTAL</td>
          {totaisMes.map((v, j) => (
            <td key={meses[j]} className={TD}>
              <div>{fmt(v)}</div>
              {mostrarPct && <div className="text-[10px] text-muted-foreground">100,0%</div>}
            </td>
          ))}
          <td className={TD}>
            <div>{fmt(totalGeral)}</div>
            {mostrarPct && <div className="text-[10px] text-muted-foreground">100,0%</div>}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

/* ------------------------------------------------ faixa × mês (calor) */

export function TabelaFaixaMes({
  matriz, rgb, fmt, mostrarPct = false, rotuloTotal = "Total", ponderado = false,
}: {
  matriz: MatrizFaixa;
  rgb: [number, number, number];
  fmt: (v: number) => string;
  mostrarPct?: boolean;
  rotuloTotal?: string;
  ponderado?: boolean;
}) {
  const { faixas, meses, celulas, totaisMes, totaisFaixa, total, min, max } = matriz;
  const usadas = faixas.map((_, i) => i).filter((i) => celulas[i].some((v) => v > 0));
  const ordem = useOrdem();
  if (!usadas.length) return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no filtro.</p>;

  // Emissões e faturamento escalam de 0 até o máximo; preço do milheiro escala de min a max
  // (a variação entre faixas é pequena, então de 0 tudo ficaria da mesma cor).
  const intensidade = (v: number) => {
    if (v <= 0) return 0;
    if (!ponderado) return max > 0 ? Math.min(1, v / max) : 0;
    return max > min ? (v - min) / (max - min) : 0.5;
  };

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b">
          <ThOrd label="Faixa" k="faixa" ordem={ordem} className={`${TH} text-left`} />
          {meses.map((m, j) => <ThOrd key={m} label={mesLabel(m)} k={`m${j}`} ordem={ordem} className={TH} />)}
          <ThOrd label={rotuloTotal} k="total" ordem={ordem} className={TH} />
        </tr>
      </thead>
      <tbody>
        {/* Faixa ordena pela sequência natural das faixas (índice), não alfabética */}
        {ordenar(usadas, ordem, (i, k) => (k === "faixa" ? i : k === "total" ? totaisFaixa[i] : celulas[i][Number(k.slice(1))])).map((i) => (
          <tr key={faixas[i]} className="border-b last:border-0">
            <td className="whitespace-nowrap px-2 py-1.5 text-xs font-medium">{faixas[i]}</td>
            {celulas[i].map((v, j) => {
              const it = intensidade(v);
              return (
                <td key={meses[j]} className={TD}
                  style={v > 0 ? { background: escalaCor(it, rgb), color: corTexto(it) } : undefined}>
                  {v > 0 ? (
                    <>
                      <div className="font-semibold">{fmt(v)}</div>
                      {mostrarPct && totaisMes[j] > 0 && (
                        <div className="text-[10px] opacity-80">{fmtPct1((v / totaisMes[j]) * 100)}</div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              );
            })}
            <td className={`${TD} bg-muted/40 font-semibold`}>{totaisFaixa[i] > 0 ? fmt(totaisFaixa[i]) : "—"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-semibold">
          <td className="px-2 py-1.5 text-xs">{ponderado ? "MÉDIA" : "TOTAL"}</td>
          {totaisMes.map((v, j) => <td key={meses[j]} className={TD}>{v > 0 ? fmt(v) : "—"}</td>)}
          <td className={TD}>{total > 0 ? fmt(total) : "—"}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/* ------------------------------------------------------- calendário */

export function CalendarioDash({
  cal, rgb, fmt, recentesPrimeiro = false,
}: {
  cal: Calendario;
  rgb: [number, number, number];
  fmt: (v: number) => string;
  /** true = semana mais recente no topo (Faturamento diário); padrão = ordem cronológica. */
  recentesPrimeiro?: boolean;
}) {
  const ordem = useOrdem();
  if (!cal.semanas.length) return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no filtro.</p>;
  const semanasOrd = ordenar(recentesPrimeiro ? [...cal.semanas].reverse() : cal.semanas, ordem, (s, k) => {
    if (k === "sem") return s.inicio;
    if (k === "total") return s.total;
    const d = s.dias[Number(k.slice(1))];
    return !d || d.foraDoPeriodo || d.semDados ? null : d.valor;
  });

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b">
          <ThOrd label="Sem" k="sem" ordem={ordem} className={TH} />
          {DOW_CURTO.map((d, j) => <ThOrd key={d} label={d} k={`d${j}`} ordem={ordem} className={TH} />)}
          <ThOrd label="Total" k="total" ordem={ordem} className={TH} />
        </tr>
      </thead>
      <tbody>
        {semanasOrd.map((s) => (
          <tr key={s.inicio} className="border-b last:border-0">
            <td className="whitespace-nowrap px-2 py-1 text-[10px] text-muted-foreground">
              {ddmm(s.inicio)}–{ddmm(s.fim)}
            </td>
            {s.dias.map((d) => {
              if (d.foraDoPeriodo) {
                return <td key={d.data} className="px-2 py-1 text-center text-muted-foreground/50">·</td>;
              }
              if (d.semDados) {
                return (
                  <td key={d.data} className="px-2 py-1 text-center align-top">
                    <div className="text-[10px] text-muted-foreground/60">{ddmm(d.data)}</div>
                    <div className="text-muted-foreground/40">—</div>
                  </td>
                );
              }
              const it = cal.max > 0 ? Math.min(1, d.valor / cal.max) : 0;
              return (
                <td key={d.data} className="px-2 py-1 text-center align-top leading-tight"
                  style={{ background: escalaCor(it, rgb), color: corTexto(it) }}>
                  <div className="text-[10px] opacity-80">{ddmm(d.data)}</div>
                  <div className="text-xs font-semibold tabular-nums">{fmt(d.valor)}</div>
                  <div className="text-[9px] opacity-80">{d.emissoes} emissões</div>
                </td>
              );
            })}
            <td className="bg-muted/40 px-2 py-1 text-center leading-tight">
              <div className="text-xs font-semibold tabular-nums">{fmt(s.total)}</div>
              <div className="text-[9px] text-muted-foreground">{s.emissoes} emissões</div>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2">
          <td className="px-2 py-1 text-center text-xs font-semibold">TOTAL</td>
          {cal.totaisDow.map((t, i) => (
            <td key={i} className="px-2 py-1 text-center leading-tight">
              <div className="text-xs font-semibold tabular-nums">{fmt(t.valor)}</div>
              <div className="text-[9px] text-muted-foreground">{t.emissoes} emissões</div>
            </td>
          ))}
          <td className="px-2 py-1 text-center leading-tight">
            <div className="text-xs font-semibold tabular-nums">{fmt(cal.total)}</div>
            <div className="text-[9px] text-muted-foreground">{cal.emissoes} emissões</div>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

/* --------------------------------------- matriz % faturamento top 15 */

export function MatrizPctClientes({
  clientes, meses, pcts, totais,
}: {
  clientes: string[];
  meses: string[];
  pcts: number[][];   // % (0-100) do cliente no faturamento do mês
  totais: number[];   // % do cliente no período
}) {
  const ordem = useOrdem();
  if (!clientes.length) return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no filtro.</p>;
  const rgb: [number, number, number] = [56, 118, 29];
  const somaMes = meses.map((_, j) => clientes.reduce((s, _c, i) => s + pcts[i][j], 0));

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b">
          <ThOrd label="Cliente" k="cliente" ordem={ordem} className={`${TH} text-left`} />
          {meses.map((m, j) => <ThOrd key={m} label={mesLabel(m)} k={`m${j}`} ordem={ordem} className={TH} />)}
          <ThOrd label="Total" k="total" ordem={ordem} className={TH} />
        </tr>
      </thead>
      <tbody>
        {ordenar(clientes.map((c, i) => ({ c, i })), ordem, ({ c, i }, k) => (k === "cliente" ? c : k === "total" ? totais[i] : pcts[i][Number(k.slice(1))])).map(({ c, i }) => (
          <tr key={c} className="border-b last:border-0">
            <td className="px-2 py-1.5 text-xs font-medium">{c}</td>
            {pcts[i].map((p, j) => {
              const it = Math.min(1, p / 20);
              return (
                <td key={meses[j]} className={TD}
                  style={p > 0 ? { background: escalaCor(it, rgb), color: corTexto(it) } : undefined}>
                  {p > 0 ? fmtPct1(p) : <span className="text-muted-foreground">—</span>}
                </td>
              );
            })}
            <td className={`${TD} bg-muted/40 font-semibold`}>{fmtPct1(totais[i])}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-semibold">
          <td className="px-2 py-1.5 text-xs">TOTAL Top 15</td>
          {somaMes.map((v, j) => <td key={meses[j]} className={TD}>{fmtPct1(v)}</td>)}
          <td className={TD}>{fmtPct1(totais.reduce((s, v) => s + v, 0))}</td>
        </tr>
      </tfoot>
    </table>
  );
}
