// Seletor compacto de tipo de valor (R$ ou Milhas) — usado em Bagagens/Assentos dos Valores Cobrados.
export type TipoValor = "reais" | "milhas";

export function TipoValorToggle({ value, onChange }: { value: TipoValor | string; onChange: (v: TipoValor) => void }) {
  return (
    <div className="inline-flex rounded-md border overflow-hidden text-[11px] leading-none select-none">
      {(["reais", "milhas"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`px-1.5 py-1 transition-colors ${value === t ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}
        >
          {t === "reais" ? "R$" : "Milhas"}
        </button>
      ))}
    </div>
  );
}
