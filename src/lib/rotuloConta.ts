// Rótulo padrão de uma conta em qualquer lista/seleção do sistema: "C0BE - Elisabeth Vasques da Costa"
// (mesmo formato das telas de Emissão). Sem nome ou sem código, mostra o que existir.
export function rotuloConta(c: { codigo?: string | null; nome?: string | null } | null | undefined): string {
  if (!c) return "";
  const cod = (c.codigo ?? "").trim();
  const nome = (c.nome ?? "").trim();
  return cod && nome ? `${cod} - ${nome}` : cod || nome;
}
