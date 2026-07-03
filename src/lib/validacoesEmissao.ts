// Validações por campo da emissão (mesmas regras da planilha / banco).
// Cada função retorna null se OK, ou a mensagem de erro.

export function vLocalizador(v: string): string | null {
  if (!v) return null; // obrigatoriedade é tratada no submit
  const semEspaco = v.replace(/\s/g, "");
  if (v !== semEspaco) return "Não use espaços.";
  if (v !== v.toUpperCase()) return "Use letras maiúsculas.";
  if (v.length !== 6 && v.length !== 13) return "Deve ter 6 ou 13 caracteres.";
  return null;
}

export function vCodigoLA(v: string, programa: string): string | null {
  const ehLatam = (programa || "").toLowerCase() === "latam";
  if (ehLatam) {
    if (!v) return "Obrigatório para Latam.";
    if (!/^LA/i.test(v)) return "O Código LA deve começar com 'LA'.";
    if (v.length !== 13) return "Código LA deve ter 13 caracteres.";
  }
  return null;
}

export function vMilhas(n: number): string | null {
  if (n == null) return null;
  if (n !== 0 && n < 1000) return "Deve ser 0 ou no mínimo 1.000.";
  return null;
}

export function vNaoNegativo(n: number): string | null {
  if (n == null) return null;
  if (n < 0) return "Não pode ser negativo.";
  return null;
}

export function vNumPax(n: number): string | null {
  if (n == null) return null;
  if (n < 1) return "Informe ao menos 1 passageiro.";
  return null;
}

export function vDataVoo(dataVoo: string, dataEmissao: string): string | null {
  if (!dataVoo || !dataEmissao) return null;
  if (dataVoo < dataEmissao) return "O voo não pode ser antes da emissão.";
  return null;
}
