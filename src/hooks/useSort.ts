import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export function useSort<T>(items: T[] | undefined, initialKey: string | null = null, initialDir: SortDir = "asc") {
  const [key, setKey] = useState<string | null>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);

  function toggle(k: string) {
    if (key === k) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKey(k);
      setDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const arr = [...(items ?? [])];
    if (!key) return arr;
    arr.sort((a: any, b: any) => {
      const va = a?.[key];
      const vb = b?.[key];
      // nulos por último
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [items, key, dir]);

  return { sorted, key, dir, toggle };
}
