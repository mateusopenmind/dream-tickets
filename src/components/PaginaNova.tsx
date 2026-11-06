import { Fragment, ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Navegação SEM cache: toda troca de tela abre uma "página nova".
 *
 * Como funciona, a cada mudança de rota (pathname):
 *  1) renderiza vazio por um instante → a tela anterior desmonta e solta as queries dela;
 *  2) descarta do cache do react-query tudo que ficou sem ninguém usando
 *     (o que o layout/menu ainda usa — perfil, permissões — continua);
 *  3) monta a tela nova do zero (estado zerado), que busca tudo de novo no banco.
 *
 * Clicar no menu da tela em que já se está também recarrega a tela: o NavLink manda
 * `state.paginaNova` com um carimbo novo (ver components/NavLink.tsx).
 *
 * Mudanças só de ?query (filtros da Conferência Pix) ou de `state` dentro da mesma tela
 * (ex.: Emissões limpando o state de "cobrar a emissão recém-criada") NÃO remontam.
 */
export function PaginaNova({ children }: { children: ReactNode }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const recarga = (location.state as { paginaNova?: number } | null)?.paginaNova;

  const [rotaMontada, setRotaMontada] = useState(location.pathname);
  const [ultimaRecarga, setUltimaRecarga] = useState<number | undefined>(recarga);
  const [geracao, setGeracao] = useState(0);

  const novaRecarga = recarga !== undefined && recarga !== ultimaRecarga;
  const trocar = rotaMontada !== location.pathname || novaRecarga;

  useEffect(() => {
    if (!trocar) return;
    // Aqui a tela anterior já desmontou (o render abaixo devolveu null), então as queries
    // dela estão sem observadores e podem ser descartadas.
    queryClient.removeQueries({ predicate: (q) => q.getObserversCount() === 0 });
    setRotaMontada(location.pathname);
    if (novaRecarga) setUltimaRecarga(recarga);
    setGeracao((g) => g + 1);
  }, [trocar, novaRecarga, recarga, location.pathname, queryClient]);

  if (trocar) return null;
  return <Fragment key={`${rotaMontada}#${geracao}`}>{children}</Fragment>;
}
