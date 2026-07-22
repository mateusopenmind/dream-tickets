// Fonte única do agrupamento de telas — espelha os grupos do menu lateral (AppSidebar).
// SEMPRE que precisar exibir/organizar telas ou permissões (ex.: diálogo "Telas
// liberadas"), agrupe por aqui para manter a mesma ordem e nomes do menu.
// Ao criar um grupo/tela nova no menu, adicione a chave correspondente abaixo.

export const GRUPOS_MENU: { label: string; chaves: string[] }[] = [
  { label: "Dashboard", chaves: ["dashboard"] },
  { label: "Emissões", chaves: ["emissoes", "emissoes_terceirizadas", "buscar_emissao", "relatorio_emissoes"] },
  { label: "Reembolsos", chaves: ["reembolsos", "reembolso_milhas", "reembolso_valores"] },
  { label: "Recebimentos", chaves: ["cobrancas_abertas", "reprocessamento", "recebimentos_avulsos", "relatorio_recebimentos"] },
  { label: "Pagamentos", chaves: ["pagamento_facial", "pagamento_fornecedores", "pagamento_reembolsos"] },
  { label: "Saldos & Automações", chaves: ["relatorio_saldos"] },
  { label: "Clubes", chaves: ["assinaturas", "planos_clube", "bonus_modelos", "estoque"] },
  { label: "Estoque", chaves: ["estoque_milhas", "estoque_compras", "estoque_transferencias", "estoque_perdas", "estoque_ajuste"] },
  { label: "Cadastros", chaves: ["clientes", "contas", "cartoes", "fornecedores", "listas", "usuarios"] },
];

export const GRUPO_OUTROS = "Outros";

// Agrupa uma lista de telas (com campo `chave`) na ordem do menu.
// Telas cuja chave não está mapeada caem no grupo "Outros", ao final.
export function agruparTelasPorMenu<T extends { chave: string }>(
  telas: T[],
): { label: string; telas: T[] }[] {
  const porChave = new Map<string, T>();
  for (const t of telas) porChave.set(t.chave, t);

  const usados = new Set<string>();
  const grupos: { label: string; telas: T[] }[] = [];

  for (const g of GRUPOS_MENU) {
    const itens: T[] = [];
    for (const chave of g.chaves) {
      const t = porChave.get(chave);
      if (t) { itens.push(t); usados.add(chave); }
    }
    if (itens.length) grupos.push({ label: g.label, telas: itens });
  }

  const restantes = telas.filter((t) => !usados.has(t.chave));
  if (restantes.length) grupos.push({ label: GRUPO_OUTROS, telas: restantes });

  return grupos;
}
