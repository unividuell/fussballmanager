import { DEFAULT_TEMPO, TEMPOS } from "./ticker";

/** Einstellungen dieses Geräts – nicht Teil des Spielstands. */
export interface Options {
  scanlines: boolean;
  /** Index in TEMPOS */
  tempo: number;
  sound: boolean;
}

export const DEFAULT_OPTIONS: Options = { scanlines: false, tempo: DEFAULT_TEMPO, sound: true };
export const OPTIONS_KEY = "fussballmanager.optionen";
export const TEMPO_LABELS = ["langsam", "normal", "schnell"] as const;

export type PrefsStorage = Pick<Storage, "getItem" | "setItem">;

export function loadOptions(prefs: PrefsStorage | null): Options {
  let raw: unknown = null;
  try {
    const text = prefs?.getItem(OPTIONS_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  const o = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const tempo = o.tempo;
  return {
    scanlines: typeof o.scanlines === "boolean" ? o.scanlines : DEFAULT_OPTIONS.scanlines,
    tempo: Number.isInteger(tempo) && (tempo as number) >= 0 && (tempo as number) < TEMPOS.length ? (tempo as number) : DEFAULT_OPTIONS.tempo,
    sound: typeof o.sound === "boolean" ? o.sound : DEFAULT_OPTIONS.sound,
  };
}

export function saveOptions(prefs: PrefsStorage | null, o: Options): void {
  try {
    prefs?.setItem(OPTIONS_KEY, JSON.stringify(o));
  } catch {
    // Speicher gesperrt oder voll: Die Optionen gelten dann nur bis zum Neuladen.
  }
}
