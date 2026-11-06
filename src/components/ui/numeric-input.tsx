import { useState, useEffect, useLayoutEffect, useRef } from "react";
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

// Máscara aplicada ENQUANTO digita: ponto de milhar na parte inteira (1.000 / 1.000.000 / 1.000.000.000).
// Nos campos decimais a vírgula e as casas digitadas ficam como estão — o arredondamento para 2 casas
// só acontece ao sair do campo.
function mascarar(raw: string, decimal: boolean): string {
  const neg = raw.trim().startsWith("-");
  const s = raw.replace(/[^\d,]/g, "");
  let inteiro = s;
  let casas: string | null = null;
  if (decimal) {
    const i = s.indexOf(",");
    if (i >= 0) { inteiro = s.slice(0, i); casas = s.slice(i + 1).replace(/,/g, ""); }
  } else {
    inteiro = s.replace(/,/g, "");
  }
  inteiro = inteiro.replace(/^0+(?=\d)/, "");
  let out = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (casas !== null) out = (out || "0") + "," + casas;
  return (neg ? "-" : "") + out;
}

interface Props {
  value: number;
  onChange: (n: number) => void;
  decimal?: boolean;      // false = inteiro (milhas), true = 2 casas (valores)
  prefix?: string;        // ex.: "R$ "
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
}

export function NumericInput({ value, onChange, decimal = false, prefix, placeholder, className, error, disabled }: Props) {
  const fmt = decimal ? fmtMoeda : fmtInt;
  const [text, setText] = useState(value ? fmt(value) : "");
  const [focado, setFocado] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);

  // mantém o display sincronizado quando o valor muda de fora (ex.: editar registro)
  useEffect(() => { if (!focado) setText(value ? fmt(value) : ""); }, [value, focado, decimal]);

  // depois de reformatar, devolve o cursor para o mesmo dígito em que o usuário estava
  useLayoutEffect(() => {
    const el = ref.current;
    if (cursor.current != null && el && document.activeElement === el) el.setSelectionRange(cursor.current, cursor.current);
    cursor.current = null;
  }, [text]);

  // caracteres que "contam" para localizar o cursor (o ponto de milhar não conta)
  const ehSig = (ch: string) => /\d/.test(ch) || ch === "-" || (decimal && ch === ",");
  const contaSig = (str: string) => [...str].filter(ehSig).length;

  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{prefix}</span>}
      <Input
        ref={ref}
        className={`${prefix ? "pl-9" : ""} text-right ${error ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive" : ""} ${className ?? ""}`}
        inputMode={decimal ? "decimal" : "numeric"}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onFocus={() => setFocado(true)}
        onBlur={() => { setFocado(false); setText(value ? fmt(value) : ""); }}
        onChange={(e) => {
          let raw = e.target.value;
          let pos = e.target.selectionStart ?? raw.length;
          // Apagou só um ponto de milhar (Backspace/Delete em cima dele): apaga o dígito vizinho,
          // senão a máscara recolocaria o ponto e pareceria que a tecla não funcionou.
          if (raw.length < text.length && contaSig(raw) === contaSig(text)) {
            const praFrente = (e.nativeEvent as InputEvent).inputType === "deleteContentForward";
            if (praFrente && pos < raw.length) raw = raw.slice(0, pos) + raw.slice(pos + 1);
            else if (!praFrente && pos > 0) { raw = raw.slice(0, pos - 1) + raw.slice(pos); pos -= 1; }
          }
          const antes = contaSig(raw.slice(0, pos));
          const novo = mascarar(raw, decimal);
          let p = 0, n = 0;
          while (p < novo.length && n < antes) { if (ehSig(novo[p])) n++; p++; }
          cursor.current = p;
          setText(novo);
          onChange(parseNum(novo, decimal));
        }}
      />
    </div>
  );
}
