import { useMemo, useState } from "react";

// Filtra uma lista buscando o termo em TODOS os valores do objeto (qualquer campo).
export function useSearch<T>(items: T[] | undefined, keys?: string[]) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = items ?? [];
    if (!q) return arr;
    return arr.filter((item: any) => {
      const campos = keys ?? Object.keys(item ?? {});
      return campos.some((k) => {
        const v = item?.[k];
        return v != null && String(v).toLowerCase().includes(q);
      });
    });
  }, [items, query, keys]);
  return { query, setQuery, filtered };
}
