import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPage: (p: number) => void;
  className?: string;
}

// Gera a sequência de páginas com reticências: 1 … 4 5 [6] 7 8 … 20
function paginas(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  const ini = Math.max(2, page - 1);
  const fim = Math.min(totalPages - 1, page + 1);
  if (ini > 2) out.push("...");
  for (let i = ini; i <= fim; i++) out.push(i);
  if (fim < totalPages - 1) out.push("...");
  out.push(totalPages);
  return out;
}

export function PaginationBar({ page, totalPages, from, to, total, onPage, className }: Props) {
  if (total === 0) return null;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm border-t ${className ?? ""}`}>
      <span className="text-muted-foreground">
        {from}–{to} de {total.toLocaleString("pt-BR")} registro(s)
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {paginas(page, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => onPage(p)}
              >
                {p}
              </Button>
            )
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
