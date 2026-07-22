// Regra de senha forte do DreamTickets.
// Mínimo 8 caracteres, com ao menos: 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial.
export function validarSenhaForte(senha: string): string | null {
  if (!senha || senha.length < 8) return "A senha deve ter ao menos 8 caracteres.";
  if (!/[A-Z]/.test(senha)) return "A senha deve ter ao menos 1 letra maiúscula.";
  if (!/[a-z]/.test(senha)) return "A senha deve ter ao menos 1 letra minúscula.";
  if (!/[0-9]/.test(senha)) return "A senha deve ter ao menos 1 número.";
  if (!/[^A-Za-z0-9]/.test(senha)) return "A senha deve ter ao menos 1 caractere especial (ex.: @ # ! $ %).";
  return null;
}

export const SENHA_REGRA_TEXTO =
  "Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.";
