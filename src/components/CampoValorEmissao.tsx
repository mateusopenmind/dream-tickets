// Um campo de valor da emissão (Taxas, Bagagens, Assentos ou Outros), com o
// seletor R$ | Milhas | Moeda em cima e o input certo embaixo.
//
// Existem 8 campos assim em cada formulário (4 campos x 2 blocos: Cobrado e
// Real) e 4 formulários — por isso a lógica mora aqui, e não repetida em cada
// tela. As chaves do form são derivadas de `campo` + `bloco`:
//
//   cobrado -> taxas_tipo      | taxas_cobrado | taxas_moeda      | taxas_valor_moeda      | taxas_cotacao
//   real    -> taxas_real_tipo | taxas_real    | taxas_real_moeda | taxas_real_valor_moeda | taxas_real_cotacao
//
// "Moeda" só aparece quando o Programa tem moedas marcadas (Configurações >
// Programas > aba Moedas), e o R$ some quando a regra "Aceita valores em reais"
// está desligada. O valor em R$ é sempre o que fica nas colunas antigas, então
// relatórios e somas não mudam.

import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { TipoValorToggle, type TipoValor } from "@/components/ui/tipo-valor-toggle";
import { ValorMoedaInput } from "@/components/ValorMoedaInput";

export type CampoValor = "taxas" | "bagagens" | "assentos" | "outros";
export type BlocoValor = "cobrado" | "real";

export function chavesCampoValor(campo: CampoValor, bloco: BlocoValor) {
  const base = bloco === "real" ? `${campo}_real` : campo;
  return {
    tipo: `${base}_tipo`,
    valor: bloco === "real" ? `${campo}_real` : `${campo}_cobrado`,
    moeda: `${base}_moeda`,
    valorMoeda: `${base}_valor_moeda`,
    cotacao: `${base}_cotacao`,
  } as const;
}

interface Props {
  label: string;
  campo: CampoValor;
  bloco: BlocoValor;
  form: any;
  setForm: (fn: (f: any) => any) => void;
  /** Milhas não faz sentido em "Outros". */
  permiteMilhas?: boolean;
  /** Moedas que o programa aceita (Configurações > Programas > aba Moedas). Vazio = só R$/Milhas. */
  moedas?: string[];
  /** False nos programas que nunca são pagos em reais (Iberia, Flying Blue). */
  aceitaReais?: boolean;
  /** True enquanto as moedas do programa ainda não chegaram do banco. */
  carregando?: boolean;
}

export function CampoValorEmissao({ label, campo, bloco, form, setForm, permiteMilhas = true, moedas = [], aceitaReais = true, carregando = false }: Props) {
  const k = chavesCampoValor(campo, bloco);
  const tipo: string = form[k.tipo] ?? "reais";

  const permiteMoeda = moedas.length > 0;
  // Sem moeda cadastrada não dá para esconder o R$ — o emissor ficaria sem opção.
  const mostraReais = aceitaReais || !permiteMoeda;

  // Moeda antes de Milhas quando não há R$: é ela o caminho normal nesses programas.
  const opcoes: TipoValor[] = mostraReais
    ? ["reais", ...(permiteMilhas ? (["milhas"] as TipoValor[]) : []), ...(permiteMoeda ? (["moeda"] as TipoValor[]) : [])]
    : [...(permiteMoeda ? (["moeda"] as TipoValor[]) : []), ...(permiteMilhas ? (["milhas"] as TipoValor[]) : [])];

  // O tipo guardado pode não ser mais válido (trocaram o programa depois de
  // lançar): "moeda" num programa sem moedas, ou "reais" num que não aceita reais.
  // Enquanto o programa não carregou, nada é inválido — senão um campo em moeda
  // seria "corrigido" para reais na abertura da edição, apagando o câmbio.
  const tipoInvalido = !carregando && !opcoes.includes(tipo as TipoValor);
  // Para onde cair: R$ quando existe, senão Moeda. Nunca Milhas por acidente —
  // milhas multiplicam pelo preço do milheiro e bagunçariam o total.
  const tipoPadrao: TipoValor = mostraReais ? "reais" : permiteMoeda ? "moeda" : opcoes[0];
  const tipoEfetivo = tipoInvalido ? tipoPadrao : (tipo as TipoValor);

  // Sincroniza o form com o que a tela mostra: senão o estado fica divergente e
  // a comparação Reais x Cobrados acusa uma diferença que não existe. Não limpa
  // moeda/valor/cotação — isso é decisão do emissor (trocarTipo) e o save já cuida.
  useEffect(() => {
    if (!tipoInvalido || !tipoEfetivo) return;
    setForm((f: any) => (f[k.tipo] === tipoEfetivo ? f : { ...f, [k.tipo]: tipoEfetivo }));
  }, [tipoInvalido, tipoEfetivo, k.tipo, setForm]);

  const trocarTipo = (t: TipoValor) =>
    setForm((f: any) => {
      if (f[k.tipo] === t) return f;
      const novo = { ...f, [k.tipo]: t };
      // Sair de "moeda" descarta o rastro; entrar zera o valor para não herdar
      // um número em reais como se fosse dólar.
      if (t !== "moeda") {
        novo[k.moeda] = null;
        novo[k.valorMoeda] = null;
        novo[k.cotacao] = null;
      } else {
        novo[k.valor] = 0;
      }
      return novo;
    });

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {opcoes.length > 1 && <TipoValorToggle value={tipoEfetivo} onChange={trocarTipo} opcoes={opcoes} />}
      </div>

      {tipoEfetivo === "moeda" ? (
        <ValorMoedaInput
          moedasPermitidas={moedas}
          moeda={form[k.moeda]}
          valorMoeda={form[k.valorMoeda]}
          cotacao={form[k.cotacao]}
          valorReais={Number(form[k.valor]) || 0}
          onChange={(p) =>
            setForm((f: any) => ({
              ...f,
              [k.moeda]: p.moeda || null,
              [k.valorMoeda]: p.valorMoeda,
              [k.cotacao]: p.cotacao || null,
              [k.valor]: p.valorReais,
            }))
          }
        />
      ) : (
        <NumericInput
          value={Number(form[k.valor]) || 0}
          onChange={(n) => setForm((f: any) => ({ ...f, [k.valor]: n }))}
          decimal={tipoEfetivo === "reais"}
          prefix={tipoEfetivo === "reais" ? "R$" : undefined}
          placeholder={tipoEfetivo === "reais" ? "0,00" : "0"}
        />
      )}
    </div>
  );
}

/**
 * Campos de câmbio a gravar no banco para um formulário inteiro.
 * Quem não está em moeda grava null — não deixa rastro velho para trás.
 */
export function camposCambioParaSalvar(form: any, permiteMoeda: boolean) {
  const out: Record<string, any> = {};
  const campos: CampoValor[] = ["taxas", "bagagens", "assentos", "outros"];
  const blocos: BlocoValor[] = ["cobrado", "real"];
  for (const campo of campos) {
    for (const bloco of blocos) {
      const k = chavesCampoValor(campo, bloco);
      const emMoeda = permiteMoeda && form[k.tipo] === "moeda";
      out[k.tipo] = emMoeda ? "moeda" : (form[k.tipo] === "milhas" ? "milhas" : "reais");
      out[k.moeda] = emMoeda ? (form[k.moeda] || null) : null;
      out[k.valorMoeda] = emMoeda ? (Number(form[k.valorMoeda]) || null) : null;
      out[k.cotacao] = emMoeda ? (Number(form[k.cotacao]) || null) : null;
    }
  }
  return out;
}

const ROTULO: Record<CampoValor, string> = {
  taxas: "Taxas",
  bagagens: "Bagagens",
  assentos: "Assentos",
  outros: "Outros",
};

/**
 * Valida os campos que estão em moeda estrangeira: precisam de moeda escolhida
 * e cotação buscada. Retorna a mensagem de erro ou null.
 */
export function vCamposEmMoeda(form: any, permiteMoeda: boolean): string | null {
  if (!permiteMoeda) return null;
  const campos: CampoValor[] = ["taxas", "bagagens", "assentos", "outros"];
  const blocos: BlocoValor[] = ["cobrado", "real"];
  for (const bloco of blocos) {
    for (const campo of campos) {
      const k = chavesCampoValor(campo, bloco);
      if (form[k.tipo] !== "moeda") continue;
      // Campo zerado é campo não usado (comum em programas que não aceitam reais,
      // onde tudo abre em moeda). Só cobra o preenchimento de quem começou a usar.
      const vazio = !(Number(form[k.valorMoeda]) > 0) && !(Number(form[k.valor]) > 0);
      if (vazio) continue;
      const onde = `${ROTULO[campo]} (Valores ${bloco === "real" ? "Reais" : "Cobrados"})`;
      if (!form[k.moeda]) return `${onde}: escolha a moeda.`;
      if (!(Number(form[k.valorMoeda]) > 0)) return `${onde}: informe o valor na moeda escolhida.`;
      if (!(Number(form[k.cotacao]) > 0)) return `${onde}: busque a cotação (botão da setinha) para converter em reais.`;
      if (!(Number(form[k.valor]) > 0)) return `${onde}: o valor convertido em reais ficou zerado — busque a cotação de novo.`;
    }
  }
  return null;
}

/**
 * Valor que entra no Preço Total: em milhas converte pelo preço do milheiro;
 * em reais e em moeda o valor já está em reais.
 */
export function valorEmReais(form: any, campo: CampoValor, bloco: BlocoValor, precoMilheiro: number): number {
  const k = chavesCampoValor(campo, bloco);
  const v = Number(form[k.valor]) || 0;
  return form[k.tipo] === "milhas" ? (v * (Number(precoMilheiro) || 0)) / 1000 : v;
}
