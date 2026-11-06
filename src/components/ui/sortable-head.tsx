import type { ReactNode } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: "asc" | "desc";
  onSort: (k: string) => void;
  className?: string;
  align?: "left" | "right" | "center";
  extra?: ReactNode; // opcional: renderizado ao lado do rótulo (ex.: dica)
}

export function SortableHead({ label, sortKey, activeKey, dir, onSort, className, align = "left", extra }: Props) {
  const active = activeKey === sortKey;
  return (
    <TableHead className={cn("h-10 select-none", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground font-semibold" : "text-muted-foreground"
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
      {extra ? <span className="ml-1 inline-flex align-middle">{extra}</span> : null}
    </TableHead>
  );
}
