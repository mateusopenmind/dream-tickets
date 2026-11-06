// Concordancia de plural nos textos da tela.
//
// O app estava cheio de "1 emissão(ões)" e "3 pagamento(s)" — o cliente reclamou, com
// razao: parece formulario de cartorio, nao produto. Como o numero SEMPRE esta ali do
// lado, nao ha ambiguidade nenhuma: da para escolher a palavra certa e pronto.
//
// Uso:
//   plural(1, "emissão", "emissões")   -> "emissão"
//   plural(3, "emissão", "emissões")   -> "emissões"
//   contar(1, "emissão", "emissões")   -> "1 emissão"
//   contar(3, "emissão", "emissões")   -> "3 emissões"
//
// Sem regra automatica de propósito: em portugues o plural tem caso demais
// (emissão→emissões, papel→papéis, cifrão→cifrões) e adivinhar erraria em silencio.
// Escrever as duas formas custa dois segundos e nunca sai errado.

export function plural(n: number, singular: string, plural: string): string {
  return Math.abs(Number(n) || 0) === 1 ? singular : plural;
}

export function contar(n: number, singular: string, formaPlural: string): string {
  const q = Number(n) || 0;
  return `${q.toLocaleString("pt-BR")} ${plural(q, singular, formaPlural)}`;
}
