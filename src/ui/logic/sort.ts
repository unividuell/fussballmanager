export interface SortState<K extends string> {
  key: K;
  dir: 1 | -1;
}

export function toggleSort<K extends string>(s: SortState<K>, key: K): SortState<K> {
  return s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 };
}

export function sortRows<T, K extends string>(rows: readonly T[], s: SortState<K>, value: (row: T, key: K) => number | string): T[] {
  return [...rows].sort((a, b) => {
    const va = value(a, s.key);
    const vb = value(b, s.key);
    const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "de");
    return c * s.dir;
  });
}
