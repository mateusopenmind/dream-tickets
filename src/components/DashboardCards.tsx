import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Plane, DollarSign, AlertCircle, CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";

interface DashboardCardsProps {
  emissoes: any[] | undefined;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TrendBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground">sem dados</span>;
  if (previous === 0) return <span className="text-xs text-success flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />novo</span>;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0;
  const isDown = pct < 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isUp ? "text-success" : isDown ? "text-destructive" : "text-muted-foreground"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}% vs anterior
    </span>
  );
}

export function DashboardCards({ emissoes }: DashboardCardsProps) {
  const stats = useMemo(() => {
    if (!emissoes) return null;

    const now = new Date();
    const mesAtualStart = startOfMonth(now);
    const mesAtualEnd = endOfMonth(now);
    const mesAnteriorStart = startOfMonth(subMonths(now, 1));
    const mesAnteriorEnd = endOfMonth(subMonths(now, 1));
    const hojeStart = startOfDay(now);
    const hojeEnd = endOfDay(now);
    const ontemStart = startOfDay(subMonths(now, 0));
    ontemStart.setDate(ontemStart.getDate() - 1);
    const ontemEnd = endOfDay(new Date(ontemStart));

    const inRange = (d: string, s: Date, e: Date) => {
      const date = new Date(d + "T00:00:00");
      return date >= s && date <= e;
    };

    const mesAtual = emissoes.filter(e => inRange(e.data_emissao, mesAtualStart, mesAtualEnd));
    const mesAnterior = emissoes.filter(e => inRange(e.data_emissao, mesAnteriorStart, mesAnteriorEnd));
    const hoje = emissoes.filter(e => inRange(e.data_emissao, hojeStart, hojeEnd));
    const ontem = emissoes.filter(e => {
      const date = new Date(e.data_emissao + "T00:00:00");
      return date >= ontemStart && date <= ontemEnd;
    });

    const sum = (arr: any[]) => arr.reduce((a, e) => a + (e.preco_total || 0), 0);
    const pixAberto = (arr: any[]) => arr.filter(e => e.status_pix === "EM ABERTO");
    const pixAbertoSum = (arr: any[]) => pixAberto(arr).reduce((a, e) => a + (e.preco_total || 0), 0);

    return {
      totalEmissoes: emissoes.length,
      totalEmissoesMes: mesAtual.length,
      totalEmissoesMesAnterior: mesAnterior.length,
      valorTotalMes: sum(mesAtual),
      valorTotalMesAnterior: sum(mesAnterior),
      pixAbertoCount: pixAberto(emissoes).length,
      pixAbertoValor: pixAbertoSum(emissoes),
      pixAbertoMes: pixAbertoSum(mesAtual),
      pixAbertoMesAnterior: pixAbertoSum(mesAnterior),
      valorHoje: sum(hoje),
      valorOntem: sum(ontem),
      pixHoje: pixAbertoSum(hoje),
      pixOntem: pixAbertoSum(ontem),
      emissoesDia: hoje.length,
      emissoesOntem: ontem.length,
    };
  }, [emissoes]);

  if (!stats) return null;

  const cards = [
    {
      title: "Emissões do Mês",
      value: stats.totalEmissoesMes.toString(),
      subtitle: `${stats.totalEmissoes} total`,
      icon: Plane,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      trend: <TrendBadge current={stats.totalEmissoesMes} previous={stats.totalEmissoesMesAnterior} label="mês" />,
    },
    {
      title: "Faturamento Mensal",
      value: formatCurrency(stats.valorTotalMes),
      subtitle: `Hoje: ${formatCurrency(stats.valorHoje)}`,
      icon: DollarSign,
      iconColor: "text-success",
      iconBg: "bg-success/10",
      trend: <TrendBadge current={stats.valorTotalMes} previous={stats.valorTotalMesAnterior} label="mês" />,
    },
    {
      title: "Pix em Aberto",
      value: formatCurrency(stats.pixAbertoValor),
      subtitle: `${stats.pixAbertoCount} pendentes`,
      icon: AlertCircle,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
      trend: <TrendBadge current={stats.pixAbertoMes} previous={stats.pixAbertoMesAnterior} label="mês" />,
    },
    {
      title: "Emissões Hoje",
      value: stats.emissoesDia.toString(),
      subtitle: `Pix hoje: ${formatCurrency(stats.pixHoje)}`,
      icon: CalendarDays,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      trend: <TrendBadge current={stats.emissoesDia} previous={stats.emissoesOntem} label="dia" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-display font-bold truncate">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                <div className="pt-1">{card.trend}</div>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
