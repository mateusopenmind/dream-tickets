// Gráficos do Dashboard de Faturamento, em SVG puro.
//
// Feitos à mão de propósito: o dashboard de referência usava Chart.js por CDN, que não
// funciona no build do app. Aqui não entra dependência nova — só SVG + Tailwind.
// O valor de cada barra/ponto aparece no tooltip nativo (<title>).

import { useId } from "react";

export interface Serie {
  label: string;
  cor: string;
  valores: number[];
}

interface BaseProps {
  labels: string[];
  series: Serie[];
  fmt: (v: number) => string;
  altura?: number;
  tituloEixo?: string;
}

const EIXO = "text-muted-foreground";
const LINHA_GRADE = "stroke-border";

/**
 * Curva suave (Catmull-Rom convertida em Bézier) ligando os pontos, para a linha
 * ficar contínua e fluida em vez de serrilhada. `yMin`/`yMax` limitam os pontos de
 * controle à área do gráfico, senão a curva "estoura" para fora nos picos.
 */
function caminhoSuave(pts: [number, number][], yMin: number, yMax: number, tensao = 0.35) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`;
  const trava = (v: number) => Math.max(yMin, Math.min(yMax, v));
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) * tensao) / 2;
    const c1y = trava(p1[1] + ((p2[1] - p0[1]) * tensao) / 2);
    const c2x = p2[0] - ((p3[0] - p1[0]) * tensao) / 2;
    const c2y = trava(p2[1] - ((p3[1] - p1[1]) * tensao) / 2);
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Escala "bonita" para o topo do eixo. */
function topo(max: number) {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / exp;
  const passo = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return passo * exp;
}

function Legenda({ series }: { series: Serie[] }) {
  if (series.length <= 1) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 text-[11px] text-muted-foreground">
      {series.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function SemDados({ altura }: { altura: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: altura }}>
      Sem dados no filtro.
    </div>
  );
}

/* ------------------------------------------- colunas verticais empilhadas */

export function ColunasEmpilhadas({ labels, series, fmt, altura = 320, tituloEixo }: BaseProps) {
  const id = useId();
  if (!labels.length || !series.length) return <SemDados altura={altura} />;

  const totais = labels.map((_, i) => series.reduce((s, se) => s + (se.valores[i] || 0), 0));
  const max = topo(Math.max(...totais, 0));
  const L = 64, R = 12, T = 10, B = 46;
  const W = 760, H = altura;
  const iw = W - L - R, ih = H - T - B;
  const passo = iw / labels.length;
  const larg = Math.min(52, passo * 0.62);
  const y = (v: number) => T + ih - (v / max) * ih;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: altura }} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className={LINHA_GRADE} strokeWidth={1} />
            <text x={L - 8} y={y(max * f) + 4} textAnchor="end" className={EIXO} fill="currentColor" fontSize={11}>
              {fmt(max * f)}
            </text>
          </g>
        ))}
        {labels.map((lb, i) => {
          let acc = 0;
          const x = L + i * passo + (passo - larg) / 2;
          return (
            <g key={`${id}-${lb}-${i}`}>
              {series.map((s) => {
                const v = s.valores[i] || 0;
                if (v <= 0) return null;
                const y1 = y(acc + v);
                const h = y(acc) - y1;
                acc += v;
                return (
                  <rect key={s.label} x={x} y={y1} width={larg} height={Math.max(0, h)} fill={s.cor}>
                    <title>{`${s.label} — ${lb}: ${fmt(v)}`}</title>
                  </rect>
                );
              })}
              <text x={x + larg / 2} y={H - B + 16} textAnchor="middle" className={EIXO} fill="currentColor" fontSize={11}>
                {lb}
              </text>
              <text x={x + larg / 2} y={H - B + 30} textAnchor="middle" className={EIXO} fill="currentColor" fontSize={10} opacity={0.75}>
                {fmt(totais[i])}
              </text>
            </g>
          );
        })}
        {tituloEixo && (
          <text x={12} y={T + ih / 2} textAnchor="middle" className={EIXO} fill="currentColor" fontSize={11}
            transform={`rotate(-90 12 ${T + ih / 2})`}>
            {tituloEixo}
          </text>
        )}
      </svg>
      <Legenda series={series} />
    </div>
  );
}

/* ---------------------------------------- barras horizontais (empilhadas) */

export function BarrasHorizontais({ labels, series, fmt, tituloEixo }: BaseProps) {
  if (!labels.length || !series.length) return <SemDados altura={280} />;

  const totais = labels.map((_, i) => series.reduce((s, se) => s + (se.valores[i] || 0), 0));
  const max = topo(Math.max(...totais, 0));
  const linha = 26;
  const L = 118, R = 70, T = 8, B = 34;
  const W = 760, H = T + B + labels.length * linha;
  const iw = W - L - R;
  const x = (v: number) => L + (v / max) * iw;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={x(max * f)} x2={x(max * f)} y1={T} y2={H - B} className={LINHA_GRADE} strokeWidth={1} />
            <text x={x(max * f)} y={H - B + 16} textAnchor="middle" className={EIXO} fill="currentColor" fontSize={11}>
              {fmt(max * f)}
            </text>
          </g>
        ))}
        {labels.map((lb, i) => {
          let acc = 0;
          const y = T + i * linha;
          return (
            <g key={`${lb}-${i}`}>
              <text x={L - 8} y={y + linha / 2 + 4} textAnchor="end" className={EIXO} fill="currentColor" fontSize={11}>
                {lb.length > 18 ? lb.slice(0, 17) + "…" : lb}
              </text>
              {series.map((s) => {
                const v = s.valores[i] || 0;
                if (v <= 0) return null;
                const x1 = x(acc);
                const w = x(acc + v) - x1;
                acc += v;
                return (
                  <rect key={s.label} x={x1} y={y + 4} width={Math.max(0, w)} height={linha - 9} fill={s.cor}>
                    <title>{`${s.label} — ${lb}: ${fmt(v)}`}</title>
                  </rect>
                );
              })}
              <text x={x(totais[i]) + 6} y={y + linha / 2 + 4} className={EIXO} fill="currentColor" fontSize={11}>
                {fmt(totais[i])}
              </text>
            </g>
          );
        })}
        {tituloEixo && (
          <text x={W / 2} y={H - 4} textAnchor="middle" className={EIXO} fill="currentColor" fontSize={11}>
            {tituloEixo}
          </text>
        )}
      </svg>
      <Legenda series={series} />
    </div>
  );
}

/* ------------------------------------------------- colunas simples (1 série) */

export function Colunas({
  labels, valores, cores, fmt, altura = 260, subLabels,
}: {
  labels: string[];
  valores: number[];
  cores: string[];
  fmt: (v: number) => string;
  altura?: number;
  subLabels?: string[];
}) {
  if (!labels.length) return <SemDados altura={altura} />;
  const max = topo(Math.max(...valores, 0));
  const L = 64, R = 12, T = 10, B = subLabels ? 46 : 34;
  const W = 760, H = altura;
  const iw = W - L - R, ih = H - T - B;
  const passo = iw / labels.length;
  const larg = Math.min(64, passo * 0.6);
  const y = (v: number) => T + ih - (v / max) * ih;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: altura }} role="img">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className={LINHA_GRADE} strokeWidth={1} />
          <text x={L - 8} y={y(max * f) + 4} textAnchor="end" className={EIXO} fill="currentColor" fontSize={11}>
            {fmt(max * f)}
          </text>
        </g>
      ))}
      {labels.map((lb, i) => {
        const v = valores[i] || 0;
        const x = L + i * passo + (passo - larg) / 2;
        return (
          <g key={`${lb}-${i}`}>
            <rect x={x} y={y(v)} width={larg} height={Math.max(0, T + ih - y(v))} fill={cores[i % cores.length]} rx={3}>
              <title>{`${lb}: ${fmt(v)}`}</title>
            </rect>
            <text x={x + larg / 2} y={y(v) - 5} textAnchor="middle" className={EIXO} fill="currentColor" fontSize={11}>
              {fmt(v)}
            </text>
            <text x={x + larg / 2} y={H - B + 16} textAnchor="middle" className={EIXO} fill="currentColor" fontSize={11}>
              {lb}
            </text>
            {subLabels && (
              <text x={x + larg / 2} y={H - B + 30} textAnchor="middle" className={EIXO} fill="currentColor" fontSize={10} opacity={0.75}>
                {subLabels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ linha + área */

export function LinhaArea({
  labels, valores, fmt, cor = "#2E75B6", altura = 300, tooltips, larguraPonto = 26,
}: {
  labels: string[];
  valores: number[];
  fmt: (v: number) => string;
  cor?: string;
  altura?: number;
  tooltips?: string[];
  /** Pixels por ponto: define a largura total e, com ela, a rolagem horizontal. */
  larguraPonto?: number;
}) {
  const id = useId();
  if (!labels.length) return <SemDados altura={altura} />;
  const max = topo(Math.max(...valores, 0));
  const L = 78, R = 20, T = 12, B = 64;
  const n = labels.length;
  // A largura acompanha a quantidade de pontos: a série fica contínua e legível,
  // e o card ganha barra de rolagem horizontal quando não couber na tela.
  const iw = Math.max(660, (n - 1) * larguraPonto);
  const W = L + iw + R, H = altura;
  const ih = H - T - B;
  const x = (i: number) => (n === 1 ? L + iw / 2 : L + (i / (n - 1)) * iw);
  const y = (v: number) => T + ih - (v / max) * ih;

  const pts: [number, number][] = valores.map((v, i) => [x(i), y(v)]);
  const linha = caminhoSuave(pts, T, T + ih);
  const area = `${linha} L ${x(n - 1)},${T + ih} L ${L},${T + ih} Z`;
  // Espaço mínimo por rótulo girado; se não couber, pula de N em N.
  const passoLabel = Math.max(1, Math.ceil(16 / (iw / Math.max(1, n - 1))));
  const raio = n > 120 ? 1.8 : n > 60 ? 2.4 : 3.5;

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W }} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className={LINHA_GRADE} strokeWidth={1} />
            <text x={L - 8} y={y(max * f) + 4} textAnchor="end" className={EIXO} fill="currentColor" fontSize={11}>
              {fmt(max * f)}
            </text>
          </g>
        ))}
        <path d={area} fill={cor} fillOpacity={0.18} />
        <path d={linha} fill="none" stroke={cor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {valores.map((v, i) => (
          <g key={`${id}-${i}`}>
            <circle cx={x(i)} cy={y(v)} r={raio} fill={cor} />
            <rect x={x(i) - larguraPonto / 2} y={T} width={larguraPonto} height={ih} fill="transparent">
              <title>{tooltips?.[i] ?? `${labels[i]}: ${fmt(v)}`}</title>
            </rect>
            {i % passoLabel === 0 && (
              <text x={x(i)} y={H - B + 14} textAnchor="end" className={EIXO} fill="currentColor" fontSize={10}
                transform={`rotate(-45 ${x(i)} ${H - B + 14})`}>
                {labels[i]}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
