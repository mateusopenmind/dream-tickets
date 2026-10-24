// Dashboard › Faturamento diário — o calendário "Faturamento diário — semana × dia da
// semana" do Dashboard de Faturamento, numa tela própria, com os MESMOS filtros
// (components/dashboard/FiltrosFaturamento.tsx é a fonte única das duas telas).

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AjudaButton } from "@/components/AjudaButton";
import { Download, Loader2 } from "lucide-react";
import { exportarExcel, type ColunaExcel } from "@/lib/exportarExcel";
import { CardTabela, CalendarioDash } from "@/components/dashboard/TabelasDash";
import { FiltrosFaturamento, useFiltrosFaturamento, useRegistrosDash } from "@/components/dashboard/FiltrosFaturamento";
import { calendario, porDia, indiceDow, fmtBRL, DOW_LABELS, RGB_VERDE } from "@/lib/dashboardFaturamento";

export default function DashboardFaturamentoDiarioPage() {
  const { data: registros, isLoading } = useRegistrosDash();
  const base = registros ?? [];
  const filtros = useFiltrosFaturamento(base);
  const { rows, limites } = filtros;

  const calGeral = useMemo(() => calendario(rows, "faturamento", limites), [rows, limites]);
  // Série contínua (dias sem venda entram zerados) — usada na exportação.
  const dias = useMemo(() => porDia(rows, limites), [rows, limites]);

  const exportar = () => {
    // Mesma ordem da tela: dia mais recente primeiro.
    const linhas = [...dias].reverse().map((d) => ({
      data: d.data,
      dia_semana: DOW_LABELS[indiceDow(d.data)],
      faturamento: d.total,
      emissoes: d.emissoes,
    }));
    const cols: ColunaExcel[] = [
      { header: "Data", key: "data", tipo: "data" },
      { header: "Dia da semana", key: "dia_semana" },
      { header: "Faturamento", key: "faturamento", tipo: "moeda" },
      { header: "Emissões", key: "emissoes", tipo: "inteiro" },
    ];
    exportarExcel("faturamento-diario", cols, linhas);
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Loader2 className="inline h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-display font-bold">Faturamento diário</h1>
          <AjudaButton chave="dashboard_faturamento_diario" />
        </div>
        <Button variant="outline" onClick={exportar} disabled={!dias.length}>
          <Download className="mr-2 h-4 w-4" />Exportar Excel
        </Button>
      </div>

      <FiltrosFaturamento f={filtros} />

      <CardTabela titulo="Faturamento diário — semana × dia da semana">
        <CalendarioDash cal={calGeral} rgb={RGB_VERDE} fmt={fmtBRL} recentesPrimeiro />
      </CardTabela>
    </div>
  );
}
