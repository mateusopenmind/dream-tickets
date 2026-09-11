// Entrada de um valor em moeda estrangeira (Taxas, Bagagens, Assentos, Outros).
//
// O emissor escolhe a moeda, digita o valor e clica na setinha: buscamos a
// cotação do momento, aplicamos o spread cadastrado na moeda e preenchemos o
// valor em reais — que continua editável, porque às vezes o câmbio real da
// fatura difere do de mercado.
//
// Quem grava é o formulário: além do valor em R$ (coluna que já existia),
// guardamos moeda / valor na moeda / cotação efetiva para auditoria depois.

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput } from "@/components/ui/numeric-input";
import { useMoedasAtivas } from "@/hooks/useData";
import { buscarCotacao, converterParaReais } from "@/lib/cambio";
import { toast } from "sonner";

export type ValorMoedaPatch = {
  moeda: string;
  valorMoeda: number;
  cotacao: number;
  valorReais: number;
};

interface Props {
  /** Códigos que o programa aceita. Uma só = já vem escolhida e o seletor some. */
  moedasPermitidas?: string[];
  moeda: string | null | undefined;
  valorMoeda: number | null | undefined;
  cotacao: number | null | undefined;
  valorReais: number;
  onChange: (patch: ValorMoedaPatch) => void;
  disabled?: boolean;
}

export function ValorMoedaInput({ moedasPermitidas, moeda, valorMoeda, cotacao, valorReais, onChange, disabled }: Props) {
  const { data: todas } = useMoedasAtivas();
  const [buscando, setBuscando] = useState(false);

  // Só as moedas que o programa aceita.
  const moedas = moedasPermitidas?.length
    ? (todas ?? []).filter((m) => moedasPermitidas.includes(m.codigo))
    : (todas ?? []);

  const cod = moeda ?? "";
  const vMoeda = Number(valorMoeda) || 0;
  const cot = Number(cotacao) || 0;

  const emitir = (p: Partial<ValorMoedaPatch>) =>
    onChange({ moeda: cod, valorMoeda: vMoeda, cotacao: cot, valorReais, ...p });

  // Programa de moeda única (ex.: Flying Blue só em dólar): já vem escolhida,
  // o emissor não precisa selecionar nada.
  const unica = moedas.length === 1 ? moedas[0] : null;
  useEffect(() => {
    if (unica && cod !== unica.codigo) emitir({ moeda: unica.codigo, cotacao: 0, valorReais: 0 });
    // Moeda guardada que o programa não aceita mais: limpa para o emissor reescolher.
    else if (!unica && cod && moedas.length > 0 && !moedas.some((m) => m.codigo === cod)) {
      emitir({ moeda: "", cotacao: 0, valorReais: 0 });
    }
  }, [unica?.codigo, cod, moedas.length]);

  async function atualizarCotacao() {
    if (!cod) return toast.error("Escolha a moeda primeiro.");
    const cad = moedas.find((m) => m.codigo === cod);
    setBuscando(true);
    try {
      const c = await buscarCotacao(cod, Number(cad?.spread_percentual ?? 8));
      emitir({ cotacao: c.efetiva, valorReais: converterParaReais(vMoeda, c.efetiva) });
      toast.success(
        `${cod}: ${c.base.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} + ${c.spread}% = ${c.efetiva.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui buscar a cotação.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {unica ? (
          <div className="w-[86px] shrink-0 h-10 flex items-center justify-center rounded-md border bg-muted text-sm font-medium" title={unica.nome}>
            {unica.codigo}
          </div>
        ) : (
          <Select
            value={cod}
            disabled={disabled}
            onValueChange={(v) => {
              // Trocou de moeda: a cotação antiga não vale mais, e o valor em R$
              // que veio dela também não — deixar na tela seria enganoso.
              emitir({ moeda: v, cotacao: 0, valorReais: 0 });
            }}
          >
            <SelectTrigger className="w-[86px] shrink-0">
              <SelectValue placeholder="Moeda" />
            </SelectTrigger>
            <SelectContent>
              {moedas.map((m) => (
                <SelectItem key={m.id} value={m.codigo}>
                  {m.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <NumericInput
          value={vMoeda}
          decimal
         
          className="min-w-0"
          onChange={(n) => emitir({ valorMoeda: n, valorReais: cot > 0 ? converterParaReais(n, cot) : valorReais })}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={disabled || buscando || !cod}
          onClick={atualizarCotacao}
          title="Buscar cotação do momento e converter para reais"
        >
          <RefreshCw className={`h-4 w-4 ${buscando ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <NumericInput
        value={valorReais}
        decimal
        prefix="R$"
       
        onChange={(n) => emitir({ valorReais: n })}
      />

      <p className="text-[11px] text-muted-foreground leading-tight">
        {cot > 0
          ? `Cotação usada: ${cot.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} (já com o spread)`
          : "Clique na setinha para buscar a cotação."}
      </p>
    </div>
  );
}
