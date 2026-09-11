import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Undo2, HandCoins, DollarSign, CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, subDays, startOfDay, endOfDay } from "date-fns";

interface Props {
  reembolsos: any[] | undefined;
}

const fmt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground">sem dados</span>;
  if (previous === 0) return <span className="text-xs text-success flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />novo</span>;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0, isDown = pct < 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isUp ? "text-success" : isDown ? "text-destructive" : "text-muted-foreground"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}% vs anterior
    </span>
  );
}

export function ReembolsosDashboard({ reembolsos }: Props) {
  const stats = useMemo(() => {
    if (!reembolsos) return null;
    const now = new Date();
    const mesIni = startOfMonth(now), mesFim = endOfMonth(now);
    const antIni = startOfMonth(subMonths(now, 1)), antFim = endOfMonth(subMonths(now, 1));
    const hojeIni = startOfDay(now), hojeFim = endOfDay(now);
    const ontemIni = startOfDay(subDays(now, 1)), ontemFim = endOfDay(subDays(now, 1));
    const inRange = (d: string, s: Date, e: Date) => { const x = new Date(d); return x >= s && x <= e; };

    const mes = reembolsos.filter((r) => inRange(r.created_at, mesIni, mesFim));
    const ant = reembolsos.filter((r) => inRange(r.created_at, antIni, antFim));
    const hoje = reembolsos.filter((r) => inRange(r.created_at, hojeIni, hojeFim));
    const ontem = reembolsos.filter((r) => inRange(r.created_at, ontemIni, ontemFim));

    const aReembolsar = reembolsos
      .filter((r) => r.sentido === "reembolsar" && !r.pago)
      .reduce((a, r) => a + (Number(r.total_liquidacao) || 0), 0);
    const aCobrar = reembolsos
      .filter((r) => r.sentido === "cobrar" && r.status_pix !== "PAGO" && r.status_pix !== "CANCELADO")
      .reduce((a, r) => a + Math.abs(Number(r.total_liquidacao) || 0), 0);

    return {
      total: reembolsos.length,
      mes: mes.length, ant: ant.length,
      hoje: hoje.length, ontem: ontem.length,
      aReembolsar, aCobrar,
    };
  }, [reembolsos]);

  if (!stats) return null;

  const cards = [
    { title: "Reembolsos do Mês", value: String(stats.mes), subtitle: `${stats.total} total`, icon: Undo2, tone: "bg-pastel-rose", iconBg: "bg-pastel-rose-fg", trend: <TrendBadge current={stats.mes} previous={stats.ant} /> },
    { title: "A Reembolsar (pendente)", value: fmt(stats.aReembolsar), subtitle: "Pagar ao cliente", icon: HandCoins, tone: "bg-pastel-green", iconBg: "bg-pastel-green-fg", trend: <span className="text-xs text-muted-foreground">controle de pagamento</span> },
    { title: "A Cobrar do Cliente", value: fmt(stats.aCobrar), subtitle: "Pix em aberto", icon: DollarSign, tone: "bg-pastel-lilac", iconBg: "bg-pastel-lilac-fg", trend: <span className="text-xs text-muted-foreground">aguardando pagamento</span> },
    { title: "Reembolsos Hoje", value: String(stats.hoje), subtitle: `${stats.total} total`, icon: CalendarDays, tone: "bg-pastel-peach", iconBg: "bg-pastel-peach-fg", trend: <TrendBadge current={stats.hoje} previous={stats.ontem} /> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title} className={`border-0 shadow-card ${card.tone}`}>
          <CardContent className="p-5">
            <div className="flex flex-col gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${card.iconBg}`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-2xl font-display font-bold truncate text-foreground">{card.value}</p>
                <p className="text-sm font-medium text-foreground/70">{card.title}</p>
                <p className="text-xs text-foreground/50">{card.subtitle}</p>
                <div className="pt-1">{card.trend}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
