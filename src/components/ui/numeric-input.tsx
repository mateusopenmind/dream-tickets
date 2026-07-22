import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

// formata inteiro com separador de milhar pt-BR: 358661 -> "358.661"
function fmtInt(n: number): string {
  if (n == null || isNaN(n)) return "";
  return Math.round(n).toLocaleString("pt-BR");
}
// formata moeda 2 casas: 9348.49 -> "9.348,49"
function fmtMoeda(n: number): string {
  if (n == null || isNaN(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// converte texto digitado em número (remove milhar, vírgula vira ponto)
function parseNum(txt: string, decimal: boolean): number {
  let s = txt.replace(/\./g, "").replace(/[^\d,-]/g, "");
  if (decimal) s = s.replace(",", ".");
  else s = s.replace(",", "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

interface Props {
  value: number;
  onChange: (n: number) => void;
  decimal?: boolean;      // false = inteiro (milhas), true = 2 casas (valores)
  prefix?: string;        // ex.: "R$ "
  placeholder?: string;
  className?: string;
  error?: boolean;
}

export function NumericInput({ value, onChange, decimal = false, prefix, placeholder, className, error }: Props) {
  const fmt = decimal ? fmtMoeda : fmtInt;
  const [text, setText] = useState(value ? fmt(value) : "");
  const [focado, setFocado] = useState(false);

  // mantém o display sincronizado quando o valor muda de fora (ex.: editar registro)
  useEffect(() => { if (!focado) setText(value ? fmt(value) : ""); }, [value, focado, decimal]);

  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{prefix}</span>}
      <Input
        className={`${prefix ? "pl-9" : ""} text-right ${error ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive" : ""} ${className ?? ""}`}
        inputMode={decimal ? "decimal" : "numeric"}
        placeholder={placeholder}
        value={text}
        onFocus={() => setFocado(true)}
        onBlur={() => { setFocado(false); setText(value ? fmt(value) : ""); }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(parseNum(raw, decimal));
        }}
      />
    </div>
  );
}
