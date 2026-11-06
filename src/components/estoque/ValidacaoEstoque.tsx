import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DicaCampo } from "@/components/ui/dica-campo";
import { cn } from "@/lib/utils";

// Peças comuns das telas de conferência do estoque (Compras, Transferências e
// Acompanhamento): filtro de período, card de total com a explicação do cálculo
// e o teste de data dentro do período.

/** true quando a data (yyyy-mm-dd ou yyyy-mm-ddThh:mm) está dentro de [de, ate]. Vazio = sem limite. */
export function noPeriodo(data: string | null | undefined, de: string, ate: string) {
  if (!de && !ate) return true;
  if (!data) return false;
  const d = String(data).slice(0, 10);
  if (de && d < de) return false;
  if (ate && d > ate) return false;
  return true;
}

export const isoHojeLocal = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

export function CampoFiltro({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function FiltroPeriodo({ de, ate, onDe, onAte }: { de: string; ate: string; onDe: (v: string) => void; onAte: (v: string) => void }) {
  return (
    <>
      <CampoFiltro label="De">
        <Input type="date" value={de} onChange={(e) => onDe(e.target.value)} className="w-40 h-10" />
      </CampoFiltro>
      <CampoFiltro label="Até">
        <Input type="date" value={ate} onChange={(e) => onAte(e.target.value)} className="w-40 h-10" />
      </CampoFiltro>
    </>
  );
}

/** Card de total. `dica` explica como o número é calculado (aparece no "?"). */
export function TotalCard({
  titulo, valor, dica, tom = "neutro", ativo = false, onClick,
}: {
  titulo: string;
  valor: string;
  dica: string;
  tom?: "pos" | "neg" | "neutro";
  ativo?: boolean;
  onClick?: () => void;
}) {
  const cor = tom === "pos" ? "text-emerald-600" : tom === "neg" ? "text-destructive" : "";
  return (
    <Card
      className={cn("p-3", onClick && "cursor-pointer hover:bg-muted/40 transition-colors", ativo && "ring-2 ring-primary")}
      onClick={onClick}
      title={onClick ? (ativo ? "Clique para tirar o filtro" : "Clique para filtrar a lista por este tipo") : undefined}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{titulo}</span>
        <span onClick={(e) => e.stopPropagation()}><DicaCampo texto={dica} /></span>
      </div>
      <div className={cn("text-xl font-bold tabular-nums", cor)}>{valor}</div>
    </Card>
  );
}
