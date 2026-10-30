// Seletor compacto de tipo de valor — usado em Taxas/Bagagens/Assentos/Outros,
// tanto nos Valores Cobrados quanto nos Reais.
//
// Quais opções aparecem depende do Programa (moedas marcadas no cadastro e a
// regra "Aceita valores em reais"). Passe as opções desejadas em `opcoes`.
export type TipoValor = "reais" | "milhas" | "moeda";

const ROTULO: Record<TipoValor, string> = {
  reais: "R$",
  milhas: "Milhas",
  moeda: "Moeda",
};

export function TipoValorToggle({
  value,
  onChange,
  opcoes = ["reais", "milhas"],
}: {
  value: TipoValor | string;
  onChange: (v: TipoValor) => void;
  opcoes?: TipoValor[];
}) {
  return (
    <div className="inline-flex rounded-md border overflow-hidden text-[11px] leading-none select-none">
      {opcoes.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`px-1.5 py-1 transition-colors ${value === t ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}
        >
          {ROTULO[t]}
        </button>
      ))}
    </div>
  );
}
