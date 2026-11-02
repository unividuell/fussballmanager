import { describe, expect, it } from "vitest";
import { sortRows, toggleSort, type SortState } from "../../src/ui/logic/sort";

type Row = { name: string; n: number };
const rows: Row[] = [{ name: "Becker", n: 2 }, { name: "Ärger", n: 9 }, { name: "Zander", n: 5 }];
const value = (r: Row, k: "name" | "n") => r[k];

describe("sort", () => {
  it("neuer Schlüssel beginnt absteigend, derselbe dreht um", () => {
    const s: SortState<"name" | "n"> = { key: "name", dir: 1 };
    expect(toggleSort(s, "n")).toEqual({ key: "n", dir: -1 });
    expect(toggleSort(s, "name")).toEqual({ key: "name", dir: -1 });
    expect(toggleSort({ key: "name", dir: -1 }, "name")).toEqual({ key: "name", dir: 1 });
  });

  it("sortiert Zahlen und deutsche Namen, ohne das Original zu verändern", () => {
    expect(sortRows(rows, { key: "n", dir: -1 }, value).map((r) => r.n)).toEqual([9, 5, 2]);
    expect(sortRows(rows, { key: "name", dir: 1 }, value).map((r) => r.name)).toEqual(["Ärger", "Becker", "Zander"]);
    expect(rows.map((r) => r.n)).toEqual([2, 9, 5]);
  });
});
