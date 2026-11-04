import type { GameState } from "../engine/model";
import { isObject } from "./guards";
import { DAMAGED, NOT_A_SAVE, TOO_NEW } from "./messages";
import { migrate } from "./migrate";
import { validateState } from "./validate";

export { DAMAGED, NOT_A_SAVE, TOO_NEW };

export const SAVE_FORMAT = "fussballmanager-spielstand";

export interface SaveMeta {
  managers: string[];
  season: number;
  /** z. B. „5. Spieltag“, erzeugt vom Aufrufer */
  label: string;
  /** ISO-Zeitpunkt */
  savedAt: string;
}

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  meta: SaveMeta;
  state: GameState;
}

export type Decoded = { ok: true; file: SaveFile } | { ok: false; error: string };

export function makeMeta(state: GameState, label: string, now: Date): SaveMeta {
  return { managers: state.managers.map((m) => m.name), season: state.season, label, savedAt: now.toISOString() };
}

export function parseMeta(raw: unknown): SaveMeta | null {
  if (!isObject(raw)) return null;
  const { managers, season, label, savedAt } = raw;
  if (!Array.isArray(managers) || !managers.every((m) => typeof m === "string")) return null;
  if (!Number.isInteger(season) || typeof label !== "string" || typeof savedAt !== "string") return null;
  return { managers: [...managers], season: season as number, label, savedAt };
}

export function encodeSave(state: GameState, meta: SaveMeta): string {
  const file: SaveFile = { format: SAVE_FORMAT, meta, state };
  return JSON.stringify(file);
}

/** Text → geprüfter, auf die aktuelle Version migrierter Spielstand. */
export function decodeSave(text: string): Decoded {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: DAMAGED };
  }
  if (!isObject(raw) || raw.format !== SAVE_FORMAT) return { ok: false, error: NOT_A_SAVE };
  const meta = parseMeta(raw.meta);
  if (!meta) return { ok: false, error: DAMAGED };
  const m = migrate(raw.state);
  if (!m.ok) return m;
  const problem = validateState(m.state);
  if (problem) return { ok: false, error: `${DAMAGED} (${problem})` };
  return { ok: true, file: { format: SAVE_FORMAT, meta, state: m.state } };
}
