// Seleção múltipla com o mesmo visual do <Select> (trigger h-10, lista com check).
// A lista fica aberta enquanto se marca/desmarca; fecha ao clicar fora ou com Esc.
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
  /** Opções disponíveis. */
  options: string[];
  /** Opções marcadas. */
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Rótulo quando tudo está marcado (ex.: "Todos status"). Também é o item "marcar/desmarcar tudo". */
  allLabel: string;
  /** Rótulo quando nada está marcado. */
  noneLabel?: string;
  className?: string;
}

function Item({ ativo, label, onClick }: { ativo: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <span className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
        ativo ? "bg-primary text-primary-foreground" : "bg-background",
      )}>
        {ativo && <Check className="h-3 w-3" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export function MultiSelect({ options, selected, onChange, allLabel, noneLabel = "Nenhum", className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const marcadas = options.filter((o) => selected.includes(o));
  const desmarcadas = options.filter((o) => !selected.includes(o));
  const tudo = desmarcadas.length === 0;

  let rotulo: string;
  if (tudo) rotulo = allLabel;
  else if (marcadas.length === 0) rotulo = noneLabel;
  else if (marcadas.length <= 2) rotulo = marcadas.join(", ");
  else if (desmarcadas.length === 1) rotulo = `Exceto ${desmarcadas[0]}`;
  else rotulo = `${marcadas.length} selecionados`;

  const alternar = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={tudo ? allLabel : marcadas.join(", ") || noneLabel}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={cn("truncate", marcadas.length === 0 && "text-muted-foreground")}>{rotulo}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-full w-max max-w-xs rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <Item ativo={tudo} label={allLabel} onClick={() => onChange(tudo ? [] : [...options])} />
          <div className="my-1 h-px bg-border" />
          <div className="max-h-60 overflow-y-auto">
            {options.map((o) => <Item key={o} ativo={selected.includes(o)} label={o} onClick={() => alternar(o)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
