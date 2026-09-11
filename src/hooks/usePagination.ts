import { useEffect, useMemo, useState } from "react";

// Pagina uma lista no client. Aplique DEPOIS de busca/filtro/ordenação.
export function usePagination<T>(items: T[] | undefined, pageSize: number = 100) {
  const [page, setPage] = useState(1);
  const total = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // se a lista encolher (filtro) e a página atual não existir mais, volta para a última válida
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (items ?? []).slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return { page, setPage, totalPages, paged, total, from, to, pageSize };
}
