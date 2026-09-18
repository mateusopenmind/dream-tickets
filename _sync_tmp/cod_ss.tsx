import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Texto extra usado só na busca (ex.: nome da conta), sem aparecer no rótulo exibido. */
  searchText?: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  /** Altura máxima da lista de opções (Tailwind, ex.: "max-h-60"). Padrão: max-h-60. Use algo maior em telas com poucos campos, para facilitar a seleção. */
  listClassName?: string;
  /** Deixa cada opção maior (mais espaçamento e fonte um pouco maior) — útil quando o combobox é o elemento principal da tela/dialog. */
  optionsLarge?: boolean;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione",
  emptyText = "Nenhum resultado",
  className,
  listClassName = "max-h-60",
  optionsLarge = false,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.searchText ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  // Fecha ao clicar fora
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setQuery("");
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary",
          optionsLarge ? "h-12 text-base" : "h-10"
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 opacity-50 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar..."
              className={cn("flex w-full bg-transparent px-2 outline-none placeholder:text-muted-foreground", optionsLarge ? "h-11 text-base" : "h-9 text-sm")}
            />
          </div>
          <div className={cn(listClassName, "overflow-y-auto p-1")}>
            {filtered.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm text-left hover:bg-accent hover:text-accent-foreground",
                  optionsLarge ? "px-3 py-2.5 text-base" : "px-2 py-1.5 text-sm",
                  o.value === value && "bg-accent/60 text-accent-foreground font-medium"
                )}
              >
                <Check className={cn("h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
