import type { GameState } from "../engine/model";
import { isObject } from "./guards";
import { DAMAGED, TOO_NEW } from "./messages";
import { v1ToV2 } from "./migrations";

/** Version des Spielstand-Schemas, die dieses Spiel schreibt. */
export const CURRENT_VERSION = 2;

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[v] hebt einen Spielstand von Version v auf v + 1. */
export const MIGRATIONS: Record<number, Migration> = { 1: v1ToV2 };

export type MigrateResult = { ok: true; state: GameState } | { ok: false; error: string };

export function migrate(raw: unknown, migrations: Record<number, Migration> = MIGRATIONS, current: number = CURRENT_VERSION): MigrateResult {
  if (!isObject(raw) || !Number.isInteger(raw.version) || (raw.version as number) < 1) return { ok: false, error: DAMAGED };
  let s = raw;
  if ((s.version as number) > current) return { ok: false, error: TOO_NEW };
  while ((s.version as number) < current) {
    const from = s.version as number;
    const step = migrations[from];
    if (!step) return { ok: false, error: `Für Version ${from} gibt es keine Migration.` };
    const next = step(structuredClone(s));
    if (!isObject(next) || next.version !== from + 1) return { ok: false, error: `Die Migration von Version ${from} ist fehlerhaft.` };
    s = next;
  }
  return { ok: true, state: s as unknown as GameState };
}
