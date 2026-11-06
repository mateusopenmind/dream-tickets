// Busca livre das listas (campo "Buscar em toda a tabela...").
// Cada palavra digitada precisa aparecer em ALGUMA coluna da linha (ordem livre),
// tanto no formato mostrado na tela (32.828 · R$ 981,45 · 01/10/2026 21:18)
// quanto no formato cru (32828 · 981.45). Ignora maiúsculas/minúsculas e acentos.

export function normalizarBusca(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const fmtNum = (n: number, casas: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Um valor numérico em todas as formas que o usuário pode digitar. casas = 2 para dinheiro. */
export function formasNumero(v: number | string | null | undefined, casas = 0): string[] {
  if (v == null || v === "") return [];
  const n = Number(v);
  if (!Number.isFinite(n)) return [String(v)];
  const formas = [String(v), fmtNum(n, casas)];
  if (casas > 0) formas.push(n.toFixed(casas), `R$ ${fmtNum(n, casas)}`, `R$${fmtNum(n, casas)}`);
  return formas;
}

/** true se TODAS as palavras do termo aparecem em algum dos campos da linha. */
export function casaBusca(termo: string, campos: unknown[]): boolean {
  const palavras = normalizarBusca(termo).split(" ").filter(Boolean);
  if (palavras.length === 0) return true;
  const texto = (campos as unknown[]).flat().map(normalizarBusca).join(" | ");
  return palavras.every((p) => texto.includes(p));
}
