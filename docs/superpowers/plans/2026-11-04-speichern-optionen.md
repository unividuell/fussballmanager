# Speichern, Optionen und Browser-Tests – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spielstände bleiben erhalten (Autosave, 3 Slots, Export/Import mit Versionsprüfung). Die Optionen Scanlines, Konferenz-Tempo und Ton sind einstellbar. Ein Engine-Fehler am Spieltag lässt sich wiederholen. Playwright testet die wichtigsten Abläufe im echten Browser.

**Architecture:**
- **Speicher (`src/storage/`):** reines TypeScript ohne UI-Importe.
  - `migrate.ts`: Migrationskette über `version`.
  - `validate.ts`: Konsistenzprüfung.
  - `savefile.ts`: Dateiformat mit Metadaten.
  - `store.ts`: `SaveStore` über eine übergebene `IDBFactory`.
- **Session:** bekommt einen `autosave`-Hook. Er feuert, wenn nach einem Spieltag oder nach dem Saisonende die Manager-Runden beginnen.
- **Gespeichert wird nur der `GameState`.** Beim Laden entsteht daraus eine neue Session, die bei „Manager-Runden, alle Manager dran“ beginnt.
- **Controller:** bekommt Abhängigkeiten per Konstruktor (Speicher, Optionsspeicher, Ton). Die Tests übergeben `fake-indexeddb` bzw. Attrappen.

**Tech Stack:**
- Vorhanden: Svelte 5.57.3 (Runes), TypeScript 5.6.3, Vite 8.3.5, Vitest 5.0.5, @testing-library/svelte 5.4.2, user-event 14.6.8, jsdom 30.1.3.
- Neu: `fake-indexeddb` 6.2.6 (nur Tests), `@playwright/test` 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-31-fussballmanager-design.md`. Relevant sind:
- Abschnitt 4: Optionen.
- Abschnitt 3.2 Punkt 8: Autosave.
- Abschnitt 5.1: Speicher-Schicht.
- Abschnitt 10: Speichern.
- Abschnitt 11: „Spieltag erneut versuchen“.
- Abschnitt 12: Speichertests und Playwright.

## Global Constraints

- `src/engine/` bleibt unverändert. Dort gibt es weiterhin weder `Math.random` noch `Date.now`.
- `src/storage/` importiert nichts aus `src/ui/` und nichts aus Svelte. Zeitpunkte bekommt es als `Date`-Parameter.
- Der Spielstand ist JSON. Er hat `version` (aktuell `1`).
- Spielstände aus einer neueren Version werden mit einer Meldung abgelehnt. Migrationen laufen nacheinander, v1 → v2 → …
- Pro Slot werden Metadaten gespeichert: Manager, Saison, Spieltag und Datum. Es gibt einen Autosave-Slot und 3 manuelle Slots.
- Ist ein Spielstand beschädigt, wird das gemeldet und der Autosave angeboten.
- Optionen:
  - Scanlines, standardmäßig **aus**.
  - Konferenz-Tempo: die 3 Stufen aus `TEMPOS`, standardmäßig `DEFAULT_TEMPO`.
  - Ton an/aus, standardmäßig **an**: kurze Chiptune-Effekte für Tor und Abpfiff.
  - Gespeichert werden sie in `localStorage` unter `fussballmanager.optionen`. Sie gehören zum Gerät, nicht zum Spielstand.
- Alle Texte der Oberfläche sind deutsch.
- Jeder `keydown`-Handler am Fenster beginnt mit `if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;`.
- Esc-Regel: Ist ein Dialog offen, schließt Esc nur den Dialog. Das erledigt der Handler des Bildschirms, `Dialog.svelte` hat keinen eigenen Esc-Handler.
- In Dateien mit `$state` heißt keine lokale Variable `state` (stattdessen `gs`). Statt eine NodeList zu spreaden, nimm `Array.from`.
- In jsdom-Tests:
  - Ausgegraute Knöpfe prüfst du mit `userEvent`, nicht mit `fireEvent.click`, denn `fireEvent` löst auch ausgegraute Knöpfe aus.
  - Nach `controller.open(...)` und vor Prüfungen am DOM kommt `await tick()`.
- Versionen in `package.json` sind exakt gepinnt (ohne `^`).
- Der Debug-Schalter für Playwright gibt es nur im Vite-Modus `e2e`. Im Produktions-Build darf er nicht enthalten sein.
- Commit-Nachrichten sind deutsch im Stil `feat(storage): …` und enden mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Fremde oder kaputte JSON-Datei beim Import, während ein Spiel läuft:** Es erscheint eine deutsche Meldung, das laufende Spiel bleibt unverändert, nichts stürzt ab. *Test in Task 3.*
2. **IndexedDB schlägt fehl** (privates Fenster, Speicher voll): Das Spiel bleibt spielbar. Der Autosave meldet „Autosave fehlgeschlagen.“, und es bleibt keine unbehandelte Promise-Ablehnung übrig. *Test in Task 3.*
3. **`localStorage` wirft beim Lesen oder Schreiben** (Safari, privat): Es gelten die Standardoptionen, nichts stürzt ab. *Test in Task 5.*
4. **Speichern mitten in einer Hot-Seat-Runde,** wenn Manager 2 dran ist: Nach dem Laden ist wieder Manager 1 dran, und die Änderungen von Manager 1 sind erhalten. *Test in Task 3.*
5. **Die Konsistenzprüfung lehnt einen echten, von der Engine erzeugten Spielstand ab** (Fehlalarm, etwa nach Transfers, Karriereenden oder Auf- und Abstieg). Erwartet: Jeder Stand aus dem Spiel lässt sich laden. *Test in Task 1: Prüfung in jeder Saison des 10-Saisons-Langzeittests.*

---

## Dateien

| Datei | Aufgabe |
|---|---|
| `src/storage/guards.ts` | `isObject` |
| `src/storage/messages.ts` | gemeinsame Fehlertexte |
| `src/storage/migrate.ts` | `CURRENT_VERSION`, `MIGRATIONS`, `migrate` |
| `src/storage/validate.ts` | `validateState`: alle IDs auflösbar, jeder Verein hat einen Kader |
| `src/storage/savefile.ts` | `SaveMeta`, `makeMeta`, `parseMeta`, `encodeSave`, `decodeSave` |
| `src/storage/store.ts` | `SaveStore` (IndexedDB), `SlotId`, `SlotInfo` |
| `src/session/session.ts` | `SessionHooks.autosave` |
| `src/ui/controller.svelte.ts` | Abhängigkeiten, Slots, Speichern/Laden/Import/Export, Autosave, Fehlerfall, Optionen, Ton |
| `src/ui/logic/options.ts` | `Options`, `loadOptions`, `saveOptions`, `TEMPO_LABELS` |
| `src/ui/logic/saves.ts` | `slotName`, `formatSavedAt` |
| `src/ui/logic/ticker.ts` | zusätzlich `soundsFor` |
| `src/ui/sound.ts` | `Sound`, `silentSound`, `createChiptune` |
| `src/ui/screens/Options.svelte` | Optionen-Bildschirm |
| `src/ui/screens/SaveLoad.svelte` | Slots, Speichern, Laden, Import, Export |
| `src/ui/screens/FailureDialog.svelte` | „Spieltag erneut versuchen“ |
| `src/ui/screens/NewGame.svelte`, `MainMenu.svelte`, `Conference.svelte` | Einstiege, Tempo, Ton |
| `src/App.svelte`, `src/main.ts`, `src/vite-env.d.ts` | Verdrahtung, Debug-Schalter |
| `src/debug.ts` | `playToSeasonEnd` (nur für Tests) |
| `playwright.config.ts`, `tests/e2e/*.spec.ts` | Browser-Tests |

---

### Task 1: Spielstand-Datei, Migration und Konsistenzprüfung

**Files:**
- Create: `src/storage/guards.ts`, `src/storage/messages.ts`, `src/storage/migrate.ts`, `src/storage/validate.ts`, `src/storage/savefile.ts`
- Create: `tests/storage/savefile.test.ts`, `tests/storage/fixtures/save-v1.json` (wird erzeugt)
- Modify: `tests/longrun/seasons.test.ts`

**Interfaces:**
- Consumes:
  - `GameState`, `Club`, `Player` aus `src/engine/model.ts`.
  - `Session` aus `src/session/session.ts` (nur im Test).
  - `newTestGame(names, seed)` aus `tests/ui/game.ts`.
- Produces:
  - `isObject(x: unknown): x is Record<string, unknown>`
  - `CURRENT_VERSION = 1`
  - `type Migration = (raw: Record<string, unknown>) => Record<string, unknown>`
  - `MIGRATIONS: Record<number, Migration>`
  - `migrate(raw: unknown, migrations?, current?): MigrateResult`
  - `validateState(raw: unknown): string | null`
  - `interface SaveMeta { managers: string[]; season: number; label: string; savedAt: string }`
  - `makeMeta(state: GameState, label: string, now: Date): SaveMeta`
  - `parseMeta(raw: unknown): SaveMeta | null`
  - `encodeSave(state: GameState, meta: SaveMeta): string`
  - `type Decoded = { ok: true; file: SaveFile } | { ok: false; error: string }`
  - `decodeSave(text: string): Decoded`
  - Konstanten `DAMAGED`, `NOT_A_SAVE`, `TOO_NEW`

- [ ] **Step 1: Tests schreiben**

`tests/storage/savefile.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GameState } from "../../src/engine/model";
import { Session } from "../../src/session/session";
import { migrate, type Migration } from "../../src/storage/migrate";
import { DAMAGED, decodeSave, encodeSave, makeMeta, NOT_A_SAVE, parseMeta, TOO_NEW } from "../../src/storage/savefile";
import { validateState } from "../../src/storage/validate";
import { newTestGame } from "../ui/game";

const META = { managers: ["Anna"], season: 1, label: "1. Spieltag", savedAt: "2026-11-04T12:00:00.000Z" };

function playMatchday(session: Session): void {
  const start = session.snapshot.state.calendarIndex;
  do {
    const p = session.snapshot.phase;
    if (p.kind === "managerTurns" || p.kind === "halftime") expect(session.dispatch({ type: "endTurn", managerId: p.pending[0] })).toBeNull();
    else expect(session.advance()).toBeNull();
  } while (!(session.snapshot.phase.kind === "managerTurns" && session.snapshot.state.calendarIndex > start));
}

describe("Spielstand-Datei", () => {
  it("übersteht Speichern und Laden unverändert", () => {
    const s = newTestGame(["Anna", "Ben"]);
    const r = decodeSave(encodeSave(s, META));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.state).toEqual(s);
    expect(r.file.meta).toEqual(META);
  });

  it("makeMeta nimmt Manager, Saison, Spieltag und Zeitpunkt auf", () => {
    const s = newTestGame(["Anna", "Ben"]);
    expect(makeMeta(s, "1. Spieltag", new Date("2026-11-04T12:00:00.000Z"))).toEqual({
      managers: ["Anna", "Ben"],
      season: 1,
      label: "1. Spieltag",
      savedAt: "2026-11-04T12:00:00.000Z",
    });
  });

  it("parseMeta lehnt unvollständige Metadaten ab", () => {
    expect(parseMeta(META)).toEqual(META);
    expect(parseMeta({ ...META, managers: [1] })).toBeNull();
    expect(parseMeta({ ...META, season: "1" })).toBeNull();
    expect(parseMeta(null)).toBeNull();
  });

  it("meldet kaputtes JSON als beschädigt", () => {
    expect(decodeSave("{kaputt")).toEqual({ ok: false, error: DAMAGED });
  });

  it("erkennt fremde Dateien", () => {
    expect(decodeSave(JSON.stringify({ hallo: 1 }))).toEqual({ ok: false, error: NOT_A_SAVE });
  });

  it("lehnt Spielstände aus einer neueren Version ab", () => {
    const s = { ...newTestGame(), version: 2 } as unknown as GameState;
    expect(decodeSave(encodeSave(s, META))).toEqual({ ok: false, error: TOO_NEW });
  });

  it("meldet einen fehlenden Spieler im Kader", () => {
    const s = newTestGame();
    const club = Object.values(s.clubs)[0];
    delete s.players[club.squad[0]];
    const r = decodeSave(encodeSave(s, META));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^Der Spielstand ist beschädigt\. \(Spieler .+ fehlt\)$/);
  });

  it("meldet einen Verein ohne Kader", () => {
    const s = newTestGame();
    const club = Object.values(s.clubs)[0];
    club.squad = [];
    expect(validateState(s)).toBe(`Verein ${club.id} hat keinen Kader`);
  });

  it("meldet einen Manager, dessen Verein fehlt", () => {
    const s = newTestGame();
    s.managers[0].clubId = "gibtsnicht";
    expect(validateState(s)).toBe("Verein gibtsnicht fehlt");
  });

  it("ein frisch gestartetes Spiel ist gültig", () => {
    expect(validateState(newTestGame(["Anna", "Ben", "Cem", "Dana"]))).toBeNull();
  });
});

describe("Migration", () => {
  const raw = () => JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown>;

  it("lässt den aktuellen Stand unverändert", () => {
    const s = raw();
    const r = migrate(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(s);
  });

  it("führt die Schritte der Reihe nach bis zur aktuellen Version aus", () => {
    const order: number[] = [];
    const steps: Record<number, Migration> = {
      1: (s) => (order.push(1), { ...s, version: 2, eins: true }),
      2: (s) => (order.push(2), { ...s, version: 3, zwei: s.eins === true }),
    };
    const r = migrate(raw(), steps, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(order).toEqual([1, 2]);
    expect(r.state.version).toBe(3);
    expect((r.state as unknown as Record<string, unknown>).zwei).toBe(true);
  });

  it("meldet einen fehlenden Migrationsschritt", () => {
    expect(migrate(raw(), {}, 2)).toEqual({ ok: false, error: "Für Version 1 gibt es keine Migration." });
  });

  it("meldet einen Schritt, der die Version nicht erhöht", () => {
    expect(migrate(raw(), { 1: (s) => s }, 2)).toEqual({ ok: false, error: "Die Migration von Version 1 ist fehlerhaft." });
  });

  it("meldet einen Stand ohne gültige Version als beschädigt", () => {
    expect(migrate({ clubs: {} })).toEqual({ ok: false, error: DAMAGED });
    expect(migrate("text")).toEqual({ ok: false, error: DAMAGED });
  });
});

describe("v1-Testdatei", () => {
  it("lässt sich laden und weiterspielen", () => {
    const r = decodeSave(readFileSync("tests/storage/fixtures/save-v1.json", "utf8"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.state.version).toBe(1);
    expect(r.file.meta).toEqual({ managers: ["Anna", "Ben"], season: 1, label: "2. Spieltag", savedAt: "2026-11-04T12:00:00.000Z" });
    expect(r.file.state.calendarIndex).toBe(1);
    const session = new Session(r.file.state);
    playMatchday(session);
    expect(session.snapshot.state.calendarIndex).toBe(2);
    expect(validateState(session.snapshot.state)).toBeNull();
  });
});
```

- [ ] **Step 2: Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/storage/savefile.test.ts`
Expected: FAIL, weil die Module unter `src/storage/` fehlen.

- [ ] **Step 3: `guards.ts`, `messages.ts` und `migrate.ts` schreiben**

`src/storage/guards.ts`:

```ts
export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
```

`src/storage/migrate.ts`:

```ts
import type { GameState } from "../engine/model";
import { isObject } from "./guards";
import { DAMAGED, TOO_NEW } from "./messages";

/** Version des Spielstand-Schemas, die dieses Spiel schreibt. */
export const CURRENT_VERSION = 1;

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[v] hebt einen Spielstand von Version v auf v + 1. */
export const MIGRATIONS: Record<number, Migration> = {};

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
```

`src/storage/messages.ts`. Die Texte liegen hier, damit `migrate.ts` und `savefile.ts` sie teilen, ohne sich gegenseitig zu importieren:

```ts
export const DAMAGED = "Der Spielstand ist beschädigt.";
export const NOT_A_SAVE = "Das ist kein Spielstand dieses Spiels.";
export const TOO_NEW = "Dieser Spielstand stammt aus einer neueren Version des Spiels und kann nicht geladen werden.";
```

- [ ] **Step 4: `validate.ts` schreiben**

Geprüft wird nach Spec 10: Alle IDs sind auflösbar, und jeder Verein hat einen Kader. Bewusst *nicht* geprüft wird:
- ob die Aufstellung nur Kaderspieler enthält, denn `prepareMatchday` ergänzt sie vor dem Anpfiff;
- die Chronik, abgeschlossene Verhandlungen und Angebote sowie alte Nachrichten, denn `pruneRetired` darf darin genannte Spieler gelöscht haben.

```ts
import { isObject } from "./guards";

const OBJECTS = ["clubs", "players", "competitions"] as const;
const ARRAYS = ["managers", "calendar", "history", "negotiations", "transferOffers", "messages"] as const;
const COUNTERS = ["season", "calendarIndex", "nextId"] as const;

/** Grundlegende Konsistenz eines geladenen Spielstands. null = in Ordnung, sonst eine kurze deutsche Beschreibung des ersten Fehlers. */
export function validateState(raw: unknown): string | null {
  if (!isObject(raw)) return "kein Spielstand";
  for (const key of OBJECTS) if (!isObject(raw[key])) return `${key} fehlt`;
  for (const key of ARRAYS) if (!Array.isArray(raw[key])) return `${key} fehlt`;
  for (const key of COUNTERS) if (!Number.isInteger(raw[key])) return `${key} fehlt`;
  if (!isObject(raw.rngState)) return "Zufallszustand fehlt";

  const clubs = raw.clubs as Record<string, Record<string, unknown>>;
  const players = raw.players as Record<string, Record<string, unknown>>;
  const managers = raw.managers as Record<string, unknown>[];
  const hasClub = (id: unknown) => typeof id === "string" && Object.hasOwn(clubs, id);
  const hasPlayer = (id: unknown) => typeof id === "string" && Object.hasOwn(players, id);
  const ids = (x: unknown): unknown[] => (Array.isArray(x) ? x : [null]);

  if ((raw.calendarIndex as number) < 0 || (raw.calendarIndex as number) > (raw.calendar as unknown[]).length) return "Kalender passt nicht";

  for (const [id, p] of Object.entries(players)) {
    if (!isObject(p) || p.id !== id) return `Spieler ${id} fehlerhaft`;
    if (p.clubId !== null && !hasClub(p.clubId)) return `Verein ${String(p.clubId)} fehlt`;
  }

  for (const [id, c] of Object.entries(clubs)) {
    if (!isObject(c) || c.id !== id) return `Verein ${id} fehlerhaft`;
    if (!Array.isArray(c.squad) || c.squad.length === 0) return `Verein ${id} hat keinen Kader`;
    for (const pid of c.squad) {
      if (!hasPlayer(pid)) return `Spieler ${String(pid)} fehlt`;
      if (players[pid as string].clubId !== id) return `Spieler ${String(pid)} gehört nicht zu ${id}`;
    }
    const lineup = isObject(c.lineup) ? c.lineup : {};
    const training = isObject(c.training) ? c.training : {};
    for (const pid of [...ids(lineup.starters), ...ids(lineup.bench), ...ids(training.individual)]) {
      if (!hasPlayer(pid)) return `Spieler ${String(pid)} fehlt`;
    }
    if (c.managerId !== null && !managers.some((m) => isObject(m) && m.id === c.managerId)) return `Manager ${String(c.managerId)} fehlt`;
  }

  for (const m of managers) {
    if (!isObject(m) || typeof m.id !== "string") return "Manager fehlerhaft";
    if (m.clubId !== null) {
      if (!hasClub(m.clubId)) return `Verein ${String(m.clubId)} fehlt`;
      if (clubs[m.clubId as string].managerId !== m.id) return `Verein ${String(m.clubId)} gehört nicht zu ${m.id}`;
    }
    for (const cid of ids(m.jobOffers)) if (!hasClub(cid)) return `Verein ${String(cid)} fehlt`;
  }

  for (const [id, comp] of Object.entries(raw.competitions as Record<string, unknown>)) {
    if (!isObject(comp) || !Array.isArray(comp.clubs) || !Array.isArray(comp.matches)) return `Wettbewerb ${id} fehlerhaft`;
    for (const cid of comp.clubs) if (!hasClub(cid)) return `Verein ${String(cid)} fehlt`;
    for (const match of comp.matches) {
      if (!isObject(match) || !hasClub(match.home) || !hasClub(match.away)) return `Spiel in ${id} fehlerhaft`;
    }
  }

  for (const n of raw.negotiations as unknown[]) {
    if (isObject(n) && n.status === "open" && !hasPlayer(n.playerId)) return `Spieler ${String(n.playerId)} fehlt`;
  }
  for (const o of raw.transferOffers as unknown[]) {
    if (isObject(o) && o.status === "open" && (!hasPlayer(o.playerId) || !hasClub(o.fromClub))) return "Transferangebot fehlerhaft";
  }
  return null;
}
```

- [ ] **Step 5: `savefile.ts` schreiben**

```ts
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
```

- [ ] **Step 6: Die v1-Testdatei erzeugen (einmalig)**

Lege die temporäre Datei `tests/storage/make-fixture.tmp.test.ts` an:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { Session } from "../../src/session/session";
import { encodeSave } from "../../src/storage/savefile";
import { newTestGame } from "../ui/game";

it("erzeugt save-v1.json", () => {
  const session = new Session(newTestGame(["Anna", "Ben"], 42));
  do {
    const p = session.snapshot.phase;
    if (p.kind === "managerTurns" || p.kind === "halftime") session.dispatch({ type: "endTurn", managerId: p.pending[0] });
    else session.advance();
  } while (!(session.snapshot.phase.kind === "managerTurns" && session.snapshot.state.calendarIndex === 1));
  mkdirSync("tests/storage/fixtures", { recursive: true });
  writeFileSync(
    "tests/storage/fixtures/save-v1.json",
    encodeSave(session.snapshot.state, { managers: ["Anna", "Ben"], season: 1, label: "2. Spieltag", savedAt: "2026-11-04T12:00:00.000Z" }),
  );
});
```

Run: `npx vitest run tests/storage/make-fixture.tmp.test.ts && rm tests/storage/make-fixture.tmp.test.ts`
Expected: Die Datei `tests/storage/fixtures/save-v1.json` existiert, etwa 0,5 MB. Sie wird nie neu erzeugt, sondern ist ab jetzt der feste v1-Stand für alle künftigen Migrationen.

- [ ] **Step 7: Konsistenzprüfung in den Langzeittest aufnehmen**

In `tests/longrun/seasons.test.ts`:
- Ergänze den Import `import { validateState } from "../../src/storage/validate";`.
- Füge in der Saisonschleife direkt vor `s = next;` die Zeile `expect(validateState(next)).toBeNull();` ein.
- Füge nach `expect(s.history).toHaveLength(10);` noch `expect(validateState(s)).toBeNull();` ein.

**Falls das fehlschlägt:** Die Engine erzeugt dann Stände, die die Prüfung ablehnt. Lockere nicht pauschal. Entferne nur die *eine* Regel, die anschlägt, notiere im Report, welche es ist und warum die Engine so einen Stand erzeugt, und lass den Langzeittest grün werden.

- [ ] **Step 8: Tests laufen lassen**

Run: `npx vitest run tests/storage tests/longrun/seasons.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/storage tests/storage tests/longrun/seasons.test.ts
git commit -m "feat(storage): Spielstand-Datei mit Migration und Konsistenzprüfung"
```

---

### Task 2: IndexedDB-Speicher mit Autosave und 3 Slots

**Files:**
- Create: `src/storage/store.ts`, `tests/storage/store.test.ts`
- Modify: `package.json` (devDependency `"fake-indexeddb": "6.2.6"`)

**Interfaces:**
- Consumes: `SaveMeta`, `makeMeta`, `parseMeta`, `encodeSave`, `decodeSave`, `Decoded` aus Task 1.
- Produces:
  - `type SlotId = "auto" | "slot1" | "slot2" | "slot3"`
  - `type ManualSlot = Exclude<SlotId, "auto">`
  - `SLOTS: SlotId[]`
  - `interface SlotInfo { slot: SlotId; meta: SaveMeta | null; damaged: boolean }`
  - `class SaveStore`:
    - `constructor(factory: IDBFactory)`
    - `list(): Promise<SlotInfo[]>`
    - `save(slot: SlotId, state: GameState, label: string, now: Date): Promise<void>`
    - `load(slot: SlotId): Promise<Decoded>`
    - `put(slot: SlotId, meta: unknown, data: string): Promise<void>`
  - `EMPTY_SLOT = "Dieser Slot ist leer."`

- [ ] **Step 1: Abhängigkeit installieren**

Run: `npm install --save-dev --save-exact fake-indexeddb@6.2.6`
Expected: `package.json` enthält `"fake-indexeddb": "6.2.6"`.

- [ ] **Step 2: Tests schreiben**

`tests/storage/store.test.ts`:

```ts
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { DAMAGED } from "../../src/storage/savefile";
import { EMPTY_SLOT, SaveStore } from "../../src/storage/store";
import { newTestGame } from "../ui/game";

const NOW = new Date("2026-11-04T12:00:00.000Z");

describe("SaveStore", () => {
  it("listet ohne Spielstände vier leere Slots", async () => {
    const store = new SaveStore(new IDBFactory());
    expect(await store.list()).toEqual([
      { slot: "auto", meta: null, damaged: false },
      { slot: "slot1", meta: null, damaged: false },
      { slot: "slot2", meta: null, damaged: false },
      { slot: "slot3", meta: null, damaged: false },
    ]);
  });

  it("speichert und lädt einen Slot mit Metadaten", async () => {
    const store = new SaveStore(new IDBFactory());
    const s = newTestGame(["Anna", "Ben"]);
    await store.save("slot2", s, "1. Spieltag", NOW);
    const slots = await store.list();
    expect(slots[2]).toEqual({
      slot: "slot2",
      meta: { managers: ["Anna", "Ben"], season: 1, label: "1. Spieltag", savedAt: NOW.toISOString() },
      damaged: false,
    });
    const r = await store.load("slot2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.state).toEqual(s);
  });

  it("überschreibt einen Slot", async () => {
    const store = new SaveStore(new IDBFactory());
    const s = newTestGame();
    await store.save("auto", s, "1. Spieltag", NOW);
    await store.save("auto", { ...s, calendarIndex: 3 }, "4. Spieltag", NOW);
    const r = await store.load("auto");
    expect(r.ok && r.file.state.calendarIndex).toBe(3);
    expect((await store.list())[0].meta?.label).toBe("4. Spieltag");
  });

  it("meldet einen leeren Slot", async () => {
    expect(await new SaveStore(new IDBFactory()).load("slot1")).toEqual({ ok: false, error: EMPTY_SLOT });
  });

  it("meldet beschädigte Daten beim Laden und beschädigte Metadaten in der Liste", async () => {
    const store = new SaveStore(new IDBFactory());
    await store.put("slot1", { managers: ["Anna"], season: 1, label: "x", savedAt: NOW.toISOString() }, "{kaputt");
    await store.put("slot3", "unsinn", "{}");
    expect(await store.load("slot1")).toEqual({ ok: false, error: DAMAGED });
    const slots = await store.list();
    expect(slots[1].damaged).toBe(false);
    expect(slots[3]).toEqual({ slot: "slot3", meta: null, damaged: true });
  });

  it("die Daten überdauern eine neue Verbindung zur selben Datenbank", async () => {
    const factory = new IDBFactory();
    await new SaveStore(factory).save("slot1", newTestGame(), "1. Spieltag", NOW);
    expect((await new SaveStore(factory).load("slot1")).ok).toBe(true);
  });
});
```

- [ ] **Step 3: Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/storage/store.test.ts`
Expected: FAIL, weil `store.ts` fehlt.

- [ ] **Step 4: `store.ts` schreiben**

```ts
import type { GameState } from "../engine/model";
import { decodeSave, encodeSave, makeMeta, parseMeta, type Decoded, type SaveMeta } from "./savefile";

export type SlotId = "auto" | "slot1" | "slot2" | "slot3";
export type ManualSlot = Exclude<SlotId, "auto">;
export const SLOTS: SlotId[] = ["auto", "slot1", "slot2", "slot3"];

export interface SlotInfo {
  slot: SlotId;
  /** null = leer oder beschädigt */
  meta: SaveMeta | null;
  damaged: boolean;
}

export const EMPTY_SLOT = "Dieser Slot ist leer.";

const DB_NAME = "fussballmanager";
const DB_VERSION = 1;
const STORE = "spielstaende";

interface SaveRecord {
  slot: SlotId;
  meta: unknown;
  /** der Spielstand als JSON-Text (encodeSave) */
  data: string;
}

function result<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaktion abgebrochen"));
  });
}

/** Spielstände in IndexedDB: ein Autosave und 3 manuelle Slots. */
export class SaveStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  async list(): Promise<SlotInfo[]> {
    const db = await this.open();
    const records = await result(db.transaction(STORE).objectStore(STORE).getAll() as IDBRequest<SaveRecord[]>);
    return SLOTS.map((slot) => {
      const rec = records.find((r) => r.slot === slot);
      if (!rec) return { slot, meta: null, damaged: false };
      const meta = parseMeta(rec.meta);
      return { slot, meta, damaged: meta === null };
    });
  }

  save(slot: SlotId, state: GameState, label: string, now: Date): Promise<void> {
    const meta = makeMeta(state, label, now);
    return this.put(slot, meta, encodeSave(state, meta));
  }

  async load(slot: SlotId): Promise<Decoded> {
    const db = await this.open();
    const rec = await result(db.transaction(STORE).objectStore(STORE).get(slot) as IDBRequest<SaveRecord | undefined>);
    if (!rec) return { ok: false, error: EMPTY_SLOT };
    return decodeSave(rec.data);
  }

  /** Schreibt einen Datensatz unverändert – für save() und für Tests mit beschädigten Daten. */
  async put(slot: SlotId, meta: unknown, data: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, "readwrite");
    const record: SaveRecord = { slot, meta, data };
    tx.objectStore(STORE).put(record);
    await done(tx);
  }

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise<IDBDatabase>((resolve, reject) => {
        const req = this.factory.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "slot" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("Datenbank blockiert"));
      });
      // Scheitert das Öffnen, versucht es der nächste Aufruf erneut.
      this.db.catch(() => (this.db = null));
    }
    return this.db;
  }
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run tests/storage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/storage/store.ts tests/storage/store.test.ts
git commit -m "feat(storage): IndexedDB-Speicher mit Autosave und drei Slots"
```

---

### Task 3: Autosave in der Session und Speichern, Laden, Import, Export im Controller

**Files:**
- Modify: `src/session/session.ts`, `src/ui/controller.svelte.ts`
- Test: `tests/session/session.test.ts` (ergänzen), `tests/ui/persist.test.ts` (neu)

**Interfaces:**
- Consumes:
  - `SaveStore`, `SlotId`, `ManualSlot`, `SlotInfo` aus Task 2.
  - `decodeSave`, `encodeSave`, `makeMeta` aus Task 1.
  - `matchdayLabel(state)` aus `src/ui/logic/format.ts`.
- Produces:
  - Session:
    - `interface SessionHooks { autosave?: (state: GameState) => void }`
    - `new Session(state, mode?, hooks?)`
  - Controller:
    - `type StartScreen = "newGame" | "loadGame" | "startOptions"`
    - `TurnScreen` zusätzlich `"save" | "options"`
    - View zusätzlich `{ kind: "loadGame" } | { kind: "startOptions" }`
    - `interface ControllerDeps { store?: SaveStore | null }` (Task 5 und 6 erweitern sie)
    - `new GameController(deps?)`
    - Felder: `startScreen`, `slots: SlotInfo[]`, `lastAutosave: Promise<void>`
    - Methoden: `openStart(s)`, `refreshSlots()`, `saveTo(slot: ManualSlot): Promise<boolean>`, `loadFrom(slot: SlotId): Promise<boolean>`, `importText(text): boolean`, `exportFile(): { name: string; text: string } | null`
    - `hasStore: boolean` (Getter)
    - Konstanten `NO_STORE`, `SAVE_ONLY_BEFORE`

- [ ] **Step 1: Session-Tests ergänzen**

Am Ende von `tests/session/session.test.ts` anfügen. Die Helfer `twoManagers` und `playMatchday` gibt es dort schon.

```ts
describe("Session-Autosave", () => {
  it("speichert, wenn nach einem Spieltag die Manager-Runden beginnen – nicht beim Erzeugen", () => {
    const saved: GameState[] = [];
    const session = new Session(twoManagers(), "hotseat", { autosave: (s) => saved.push(s) });
    expect(saved).toHaveLength(0);
    playMatchday(session);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toBe(session.snapshot.state);
    expect(saved[0].calendarIndex).toBe(1);
  });

  it("speichert nach dem Saisonende den Stand der neuen Saison", () => {
    const saved: GameState[] = [];
    const session = new Session(twoManagers(), "hotseat", { autosave: (s) => saved.push(s) });
    for (let i = 0; i < 36; i++) playMatchday(session);
    expect(session.snapshot.phase.kind).toBe("seasonEnd");
    expect(saved).toHaveLength(35);
    session.advance();
    expect(saved).toHaveLength(36);
    expect(saved[35].season).toBe(2);
    expect(saved[35].calendarIndex).toBe(0);
  });
});
```

- [ ] **Step 2: Session-Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/session/session.test.ts`
Expected: FAIL, weil der Hook nie aufgerufen wird.

- [ ] **Step 3: Session erweitern**

In `src/session/session.ts`:

```ts
export interface SessionHooks {
  /** Wird aufgerufen, wenn nach einem Spieltag oder nach dem Saisonende die Manager-Runden beginnen. */
  autosave?: (state: GameState) => void;
}
```

Konstruktor:

```ts
  constructor(
    state: GameState,
    private readonly mode: Mode = "hotseat",
    private readonly hooks: SessionHooks = {},
  ) {
    this.snap = { state, phase: { kind: "managerTurns", pending: [] }, lives: [], notices: [] };
    this.beginTurns(false);
  }
```

In `advance()` werden die beiden Aufrufe `this.beginTurns()` zu `this.beginTurns(true)`, und `beginTurns` bekommt den Parameter:

```ts
  private beginTurns(autosave: boolean): void {
    const pending = this.snap.state.managers.map((m) => m.id);
    this.set({ lives: [], notices: [], phase: { kind: "managerTurns", pending } });
    if (autosave) this.hooks.autosave?.(this.snap.state);
    if (pending.length === 0) this.startMatchday();
  }
```

Run: `npx vitest run tests/session`
Expected: PASS

- [ ] **Step 4: Controller-Tests schreiben**

`tests/ui/persist.test.ts`:

```ts
// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { SaveStore } from "../../src/storage/store";
import { GameController, NO_STORE, SAVE_ONLY_BEFORE } from "../../src/ui/controller.svelte";

function setup(names = ["Anna", "Ben"], store: SaveStore | null = new SaveStore(new IDBFactory())) {
  const c = new GameController({ store });
  const world = generateWorld(7);
  const ids = Object.keys(world.clubs);
  const error = c.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  if (error) throw new Error(error);
  return { c, store: store! };
}

async function playMatchday(c: GameController): Promise<void> {
  const start = c.snapshot!.state.calendarIndex;
  while (!(c.snapshot!.phase.kind === "managerTurns" && c.snapshot!.state.calendarIndex > start)) {
    const p = c.snapshot!.phase;
    if (p.kind === "managerTurns" || p.kind === "halftime") await c.endTurn(p.pending[0]);
    else c.advance();
  }
}

describe("Controller: Speichern und Laden", () => {
  it("legt beim Spielstart einen Autosave an und kennt danach die Slots", async () => {
    const { c, store } = setup();
    await c.lastAutosave;
    const auto = (await store.list())[0];
    expect(auto.meta?.managers).toEqual(["Anna", "Ben"]);
    expect(auto.meta?.label).toBe("1. Spieltag");
    expect(c.slots[0].meta?.label).toBe("1. Spieltag");
  });

  it("überschreibt den Autosave nach jedem Spieltag", async () => {
    const { c, store } = setup();
    await playMatchday(c);
    await c.lastAutosave;
    const r = await store.load("auto");
    expect(r.ok && r.file.state.calendarIndex).toBe(1);
  });

  it("speichert in einen Slot und lädt ihn wieder", async () => {
    const { c } = setup();
    expect(await c.saveTo("slot2")).toBe(true);
    expect(c.message).toBe("Gespeichert.");
    expect(c.slots[2].meta?.season).toBe(1);
    await playMatchday(c);
    expect(await c.loadFrom("slot2")).toBe(true);
    const anna = c.snapshot!.state.managers[0];
    expect(c.snapshot!.state.calendarIndex).toBe(0);
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
  });

  it("mitten in der Hot-Seat-Runde gespeichert: nach dem Laden ist wieder Manager 1 dran, seine Änderungen bleiben", async () => {
    const { c } = setup();
    const [anna, ben] = c.snapshot!.state.managers;
    const clubId = anna.clubId!;
    const price = c.snapshot!.state.clubs[clubId].finance.ticketPrice + 1;
    expect(await c.send({ type: "setTicketPrice", managerId: anna.id, price })).toBe(true);
    await c.endTurn(anna.id);
    expect(c.view).toEqual({ kind: "turnStart", managerId: ben.id });
    expect(await c.saveTo("slot1")).toBe(true);
    expect(await c.loadFrom("slot1")).toBe(true);
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
    expect(c.snapshot!.state.clubs[clubId].finance.ticketPrice).toBe(price);
  });

  it("speichert nicht während der Konferenz", async () => {
    const { c } = setup(["Anna"]);
    await c.endTurn(c.snapshot!.state.managers[0].id);
    expect(c.view.kind).toBe("conference");
    expect(await c.saveTo("slot1")).toBe(false);
    expect(c.message).toBe(SAVE_ONLY_BEFORE);
  });

  it("ein leerer Slot lässt das laufende Spiel unverändert", async () => {
    const { c } = setup();
    const before = c.snapshot;
    expect(await c.loadFrom("slot3")).toBe(false);
    expect(c.message).toBe("Dieser Slot ist leer.");
    expect(c.snapshot).toBe(before);
  });

  it("Export und Import ergeben denselben Spielstand", () => {
    const { c } = setup();
    const file = c.exportFile()!;
    expect(file.name).toBe("fussballmanager-s1-t1.json");
    const other = new GameController();
    expect(other.importText(file.text)).toBe(true);
    expect(other.snapshot!.state).toEqual(c.snapshot!.state);
    expect(other.view.kind).toBe("turnStart");
  });

  it("ein kaputter Import lässt das laufende Spiel unverändert", () => {
    const { c } = setup();
    const before = c.snapshot;
    expect(c.importText("kaputt")).toBe(false);
    expect(c.message).toBe("Der Spielstand ist beschädigt.");
    expect(c.snapshot).toBe(before);
    expect(c.importText(JSON.stringify({ hallo: 1 }))).toBe(false);
    expect(c.message).toBe("Das ist kein Spielstand dieses Spiels.");
  });

  it("scheitert der Autosave, gibt es eine Meldung und das Spiel geht weiter", async () => {
    const store = new SaveStore(new IDBFactory());
    vi.spyOn(store, "save").mockRejectedValue(new Error("voll"));
    const { c } = setup(["Anna"], store);
    await c.lastAutosave;
    expect(c.message).toBe("Autosave fehlgeschlagen.");
    await playMatchday(c);
    await c.lastAutosave;
    expect(c.snapshot!.state.calendarIndex).toBe(1);
  });

  it("ohne Speicher melden Speichern und Laden das", async () => {
    const { c } = setup(["Anna"], null);
    expect(c.hasStore).toBe(false);
    expect(await c.saveTo("slot1")).toBe(false);
    expect(c.message).toBe(NO_STORE);
    expect(await c.loadFrom("auto")).toBe(false);
    expect(c.message).toBe(NO_STORE);
    expect(c.slots).toEqual([]);
  });

  it("openStart wechselt den Bildschirm vor dem Spiel", () => {
    const c = new GameController();
    expect(c.view).toEqual({ kind: "newGame" });
    c.openStart("loadGame");
    expect(c.view).toEqual({ kind: "loadGame" });
  });
});
```

Der Test „mitten in der Hot-Seat-Runde“ braucht einen gültigen Eintrittspreis. Prüfe in `validateTicketPrice` (in `src/engine/economy/`), ob `aktueller Preis + 1` erlaubt ist. Falls nicht, nimm einen anderen gültigen Wert, der vom aktuellen abweicht.

- [ ] **Step 5: Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/ui/persist.test.ts`
Expected: FAIL, weil Konstruktor, Methoden und Konstanten fehlen.

- [ ] **Step 6: Controller erweitern**

Änderungen in `src/ui/controller.svelte.ts`:

```ts
import type { ClubId, GameState, ManagerId } from "../engine/model";
import { startNewGame } from "../engine/season";
import { Session, type SessionCommand, type Snapshot } from "../session/session";
import { decodeSave, encodeSave, makeMeta, type Decoded } from "../storage/savefile";
import type { ManualSlot, SaveStore, SlotId, SlotInfo } from "../storage/store";
import { LocalTransport } from "../transport/transport";
import { matchdayLabel } from "./logic/format";

export type TurnScreen =
  | "turnStart" | "menu" | "squad" | "tables" | "training" | "contracts"
  | "transfers" | "finance" | "messages" | "jobs" | "save" | "options";

export type StartScreen = "newGame" | "loadGame" | "startOptions";

/** Bildschirme, die auch ohne Verein funktionieren. */
const WITHOUT_CLUB: TurnScreen[] = ["turnStart", "jobs", "messages", "tables", "save", "options"];

export type View =
  | { kind: StartScreen }
  | { kind: TurnScreen; managerId: ManagerId }
  | { kind: "conference"; half: 1 | 2 }
  | { kind: "halftime"; managerId: ManagerId }
  | { kind: "results" }
  | { kind: "resultsTables" }
  | { kind: "seasonEnd" };

export const NO_STORE = "Speichern ist in diesem Browser nicht möglich.";
export const SAVE_ONLY_BEFORE = "Speichern geht nur vor dem Spieltag.";

export interface ControllerDeps {
  store?: SaveStore | null;
}
```

Den `TurnScreen`-Typ in der Datei so formatieren wie bisher, also ein Wert pro Zeile.

Neue Felder und Methoden in `GameController` (die bestehenden bleiben):

```ts
  startScreen = $state<StartScreen>("newGame");
  slots = $state.raw<SlotInfo[]>([]);
  /** Für Tests: der zuletzt angestoßene Autosave. */
  lastAutosave: Promise<void> = Promise.resolve();

  private readonly store: SaveStore | null;
  private unsubscribe: (() => void) | null = null;

  constructor(deps: ControllerDeps = {}) {
    this.store = deps.store ?? null;
    void this.refreshSlots();
  }

  get hasStore(): boolean {
    return this.store !== null;
  }

  startGame(world: GameState, managers: { name: string; clubId: ClubId }[]): string | null {
    const r = startNewGame(world, managers);
    if (!r.ok) return r.error;
    this.begin(r.state);
    this.lastAutosave = this.autosave(r.state);
    return null;
  }

  openStart(s: StartScreen): void {
    this.startScreen = s;
    this.message = null;
  }

  async refreshSlots(): Promise<void> {
    if (!this.store) return;
    try {
      this.slots = await this.store.list();
    } catch {
      this.slots = [];
    }
  }

  async saveTo(slot: ManualSlot): Promise<boolean> {
    const snap = this.snapshot;
    if (!this.store) return this.fail(NO_STORE);
    if (!snap || snap.phase.kind !== "managerTurns") return this.fail(SAVE_ONLY_BEFORE);
    try {
      await this.store.save(slot, snap.state, matchdayLabel(snap.state), new Date());
    } catch {
      return this.fail("Speichern fehlgeschlagen.");
    }
    await this.refreshSlots();
    this.message = "Gespeichert.";
    return true;
  }

  async loadFrom(slot: SlotId): Promise<boolean> {
    if (!this.store) return this.fail(NO_STORE);
    let r: Decoded;
    try {
      r = await this.store.load(slot);
    } catch {
      r = { ok: false, error: "Laden fehlgeschlagen." };
    }
    if (!r.ok) return this.fail(r.error);
    this.begin(r.file.state);
    return true;
  }

  importText(text: string): boolean {
    const r = decodeSave(text);
    if (!r.ok) return this.fail(r.error);
    this.begin(r.file.state);
    return true;
  }

  exportFile(): { name: string; text: string } | null {
    const gs = this.snapshot?.state;
    if (!gs) return null;
    return {
      name: `fussballmanager-s${gs.season}-t${gs.calendarIndex + 1}.json`,
      text: encodeSave(gs, makeMeta(gs, matchdayLabel(gs), new Date())),
    };
  }

  /** Startet eine Session auf einem neuen oder geladenen Spielstand; eine alte Session wird abgehängt. */
  private begin(gs: GameState): void {
    this.unsubscribe?.();
    this.session = new Session(gs, "hotseat", { autosave: (s) => (this.lastAutosave = this.autosave(s)) });
    this.transport = new LocalTransport(this.session);
    this.lastKey = "";
    this.unsubscribe = this.transport.subscribe((s) => this.receive(s));
  }

  private async autosave(gs: GameState): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.save("auto", gs, matchdayLabel(gs), new Date());
    } catch {
      this.message = "Autosave fehlgeschlagen.";
      return;
    }
    await this.refreshSlots();
  }

  private fail(message: string): false {
    this.message = message;
    return false;
  }
```

Weitere Änderungen:
- Der bisherige Körper von `startGame` (`new Session` / `new LocalTransport` / `subscribe`) entfällt, das macht jetzt `begin`.
- In `computeView` wird `if (!s) return { kind: "newGame" };` zu `if (!s) return { kind: this.startScreen };`.

`App.svelte` bekommt in diesem Task noch keine neuen Zweige. Die kommen in Task 5 und 7.

- [ ] **Step 7: Tests laufen lassen**

Run: `npx vitest run tests/ui tests/session && npm run check`
Expected: PASS, svelte-check meldet 0 Fehler. Die bestehenden Controller-Tests (`new GameController()` ohne Argumente) laufen unverändert.

- [ ] **Step 8: Commit**

```bash
git add src/session/session.ts src/ui/controller.svelte.ts tests/session/session.test.ts tests/ui/persist.test.ts
git commit -m "feat(ui): Autosave, Slots, Import und Export im Controller"
```

---

### Task 4: Fehler am Spieltag – „Spieltag erneut versuchen“

**Files:**
- Create: `src/ui/screens/FailureDialog.svelte`, `tests/ui/failure.test.ts`
- Modify: `src/ui/controller.svelte.ts`, `src/App.svelte`

**Interfaces:**
- Consumes: `loadFrom`, `hasStore`, `slots` aus Task 3.
- Produces:
  - Controller-Feld `failure: { retry: () => void } | null`
  - `retryFailure(): void`
  - `loadAutosaveAfterFailure(): Promise<void>`

Spec 11: Eine unerwartete Exception der Engine während eines Spieltags bricht ab, und der Zustand vor dem Spieltag bleibt erhalten. Die Session ruft `set()` erst nach erfolgreicher Berechnung auf, deshalb lässt eine Exception den Snapshot unverändert. Der Controller fängt sie ab und bietet „Spieltag erneut versuchen“ an. Ist ein Autosave vorhanden, bietet er zusätzlich „Autosave laden“ an.

Der Dialog hat bewusst **keine** Tastenbedienung und kein „Schließen“:
- Enter würde gleichzeitig die Enter-Handler des Bildschirms darunter auslösen, also doppelt senden.
- Nach dem Schließen hinge der Bildschirm. Konferenz und Ergebnisse setzen vor dem Weiterschalten ein `advanced`-Flag, „Weiter“ ginge dann nicht mehr.

- [ ] **Step 1: Tests schreiben**

`tests/ui/failure.test.ts`:

```ts
// @vitest-environment jsdom
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { Session } from "../../src/session/session";
import { GameController } from "../../src/ui/controller.svelte";

function started(): GameController {
  const c = new GameController();
  const world = generateWorld(3);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  return c;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Fehler am Spieltag", () => {
  it("advance: Zustand bleibt, „erneut versuchen“ wiederholt den Schritt", async () => {
    const c = started();
    await c.endTurn(c.snapshot!.state.managers[0].id);
    const before = c.snapshot;
    vi.spyOn(Session.prototype, "advance").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    c.advance();
    expect(c.failure).not.toBeNull();
    expect(c.snapshot).toBe(before);
    expect(c.view).toEqual({ kind: "conference", half: 1 });
    c.retryFailure();
    expect(c.failure).toBeNull();
    expect(c.view.kind).toBe("halftime");
  });

  it("send: ein Fehler beim Anpfiff lässt den Manager dran, „erneut versuchen“ startet den Spieltag", async () => {
    const c = started();
    const anna = c.snapshot!.state.managers[0];
    vi.spyOn(Session.prototype, "dispatch").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    expect(await c.endTurn(anna.id)).toBe(false);
    expect(c.failure).not.toBeNull();
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
    c.retryFailure();
    await new Promise((r) => setTimeout(r, 0));
    expect(c.view).toEqual({ kind: "conference", half: 1 });
  });

  it("zeigt den Fehlerdialog und wiederholt per Klick", async () => {
    const c = started();
    await c.endTurn(c.snapshot!.state.managers[0].id);
    vi.spyOn(Session.prototype, "advance").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    render(App, { controller: c });
    c.advance();
    await tick();
    expect(screen.getByRole("dialog", { name: "FEHLER" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Autosave laden" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Spieltag erneut versuchen" }));
    expect(screen.queryByRole("dialog", { name: "FEHLER" })).toBeNull();
    expect(c.view.kind).toBe("halftime");
  });
});
```

- [ ] **Step 2: Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/ui/failure.test.ts`
Expected: FAIL, weil die Exception ungefangen bleibt und `failure` fehlt.

- [ ] **Step 3: Controller anpassen**

```ts
  failure = $state<{ retry: () => void } | null>(null);

  async send(cmd: SessionCommand): Promise<boolean> {
    if (!this.transport) return false;
    let error: string | null;
    try {
      error = await this.transport.send(cmd);
    } catch (e) {
      this.crashed(e, () => void this.send(cmd));
      return false;
    }
    this.message = error;
    return error === null;
  }

  advance(): void {
    if (!this.session) return;
    try {
      this.message = this.session.advance();
    } catch (e) {
      this.crashed(e, () => this.advance());
    }
  }

  retryFailure(): void {
    const f = this.failure;
    this.failure = null;
    f?.retry();
  }

  async loadAutosaveAfterFailure(): Promise<void> {
    if (await this.loadFrom("auto")) this.failure = null;
  }

  private crashed(e: unknown, retry: () => void): void {
    console.error("Fehler beim Berechnen des Spieltags:", e);
    this.failure = { retry };
  }
```

Außerdem setzt `begin()` am Anfang `this.failure = null;`, denn ein geladener Stand beendet den Fehlerfall.

- [ ] **Step 4: `FailureDialog.svelte` schreiben**

```svelte
<script lang="ts">
  import type { GameController } from "../controller.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();
  const canLoadAuto = $derived(controller.hasStore && controller.slots.some((s) => s.slot === "auto" && s.meta !== null));
</script>

<!-- Ohne Tasten und ohne „Schließen“: siehe Plan 4, Task 4. -->
<div class="overlay" role="dialog" aria-modal="true" aria-label="FEHLER">
  <Panel title="FEHLER">
    <p>Beim Berechnen ist ein Fehler aufgetreten. Der Spielstand vor diesem Schritt ist erhalten.</p>
    {#if controller.message}<p class="msg">{controller.message}</p>{/if}
    <div class="row">
      <button class="btn primary" onclick={() => controller.retryFailure()}>Spieltag erneut versuchen</button>
      {#if canLoadAuto}<button class="btn" onclick={() => void controller.loadAutosaveAfterFailure()}>Autosave laden</button>{/if}
    </div>
  </Panel>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    background: var(--shade);
  }
  p { margin: 0 0 8px; max-width: 400px; font-size: 17px; }
  .row { display: flex; gap: 8px; justify-content: flex-end; }
</style>
```

- [ ] **Step 5: In `App.svelte` einbinden**

Importiere `FailureDialog` und ergänze direkt vor `</Screen>`, nach dem `{/if}` der Bildschirmkette:

```svelte
  {#if controller.failure}<FailureDialog {controller} />{/if}
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run tests/ui && npm run check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/controller.svelte.ts src/ui/screens/FailureDialog.svelte src/App.svelte tests/ui/failure.test.ts
git commit -m "feat(ui): Fehler am Spieltag lassen sich wiederholen"
```

---

### Task 5: Optionen – Scanlines und Konferenz-Tempo

**Files:**
- Create: `src/ui/logic/options.ts`, `src/ui/screens/Options.svelte`, `tests/ui/options.test.ts`
- Modify: `src/ui/controller.svelte.ts`, `src/App.svelte`, `src/main.ts`, `src/ui/screens/Conference.svelte`, `src/ui/screens/NewGame.svelte`, `src/ui/screens/MainMenu.svelte`

**Interfaces:**
- Consumes:
  - `TEMPOS`, `DEFAULT_TEMPO` aus `src/ui/logic/ticker.ts`.
  - `StartScreen` `"startOptions"` und `TurnScreen` `"options"` aus Task 3.
- Produces:
  - `interface Options { scanlines: boolean; tempo: number; sound: boolean }`
  - `DEFAULT_OPTIONS`, `OPTIONS_KEY = "fussballmanager.optionen"`
  - `type PrefsStorage = Pick<Storage, "getItem" | "setItem">`
  - `loadOptions(prefs: PrefsStorage | null): Options`
  - `saveOptions(prefs, o): void`
  - `TEMPO_LABELS = ["langsam", "normal", "schnell"]`
  - `ControllerDeps.prefs?: PrefsStorage | null`
  - Controller-Feld `options`, `setOptions(patch: Partial<Options>): void`

Der Ton (`sound`) ist schon Teil von `Options` und dem Bildschirm. Abgespielt wird er erst ab Task 6.

- [ ] **Step 1: Tests schreiben**

`tests/ui/options.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { DEFAULT_OPTIONS, loadOptions, OPTIONS_KEY, saveOptions, type PrefsStorage } from "../../src/ui/logic/options";

function memory(initial: Record<string, string> = {}): PrefsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const broken: PrefsStorage = {
  getItem: () => {
    throw new Error("gesperrt");
  },
  setItem: () => {
    throw new Error("gesperrt");
  },
};

describe("Optionen laden und speichern", () => {
  it("Standard: Scanlines aus, normales Tempo, Ton an", () => {
    expect(DEFAULT_OPTIONS).toEqual({ scanlines: false, tempo: 1, sound: true });
    expect(loadOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(loadOptions(memory())).toEqual(DEFAULT_OPTIONS);
  });

  it("liest gespeicherte Werte und ersetzt ungültige durch den Standard", () => {
    const prefs = memory({ [OPTIONS_KEY]: JSON.stringify({ scanlines: true, tempo: 7, sound: "ja" }) });
    expect(loadOptions(prefs)).toEqual({ scanlines: true, tempo: 1, sound: true });
    expect(loadOptions(memory({ [OPTIONS_KEY]: "{kaputt" }))).toEqual(DEFAULT_OPTIONS);
  });

  it("speichert als JSON und übersteht einen gesperrten Speicher", () => {
    const prefs = memory();
    saveOptions(prefs, { scanlines: true, tempo: 2, sound: false });
    expect(loadOptions(prefs)).toEqual({ scanlines: true, tempo: 2, sound: false });
    expect(() => saveOptions(broken, DEFAULT_OPTIONS)).not.toThrow();
    expect(loadOptions(broken)).toEqual(DEFAULT_OPTIONS);
  });

  it("der Controller merkt sich Änderungen", () => {
    const prefs = memory();
    const c = new GameController({ prefs });
    c.setOptions({ scanlines: true });
    expect(c.options.scanlines).toBe(true);
    expect(new GameController({ prefs }).options.scanlines).toBe(true);
  });
});

describe("Optionen-Bildschirm", () => {
  it("vor dem Spiel: Scanlines einschalten und zurück zu „Neues Spiel“", async () => {
    const c = new GameController({ prefs: memory() });
    render(App, { controller: c });
    await userEvent.click(screen.getByRole("button", { name: "Optionen" }));
    expect(screen.getByText("OPTIONEN")).toBeTruthy();
    expect(document.querySelector(".screen.scanlines")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Scanlines an" }));
    expect(document.querySelector(".screen.scanlines")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Scanlines an" }).getAttribute("aria-pressed")).toBe("true");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByText("NEUES SPIEL")).toBeTruthy();
  });

  it("im Spiel: Taste O öffnet die Optionen, Esc führt ins Hauptmenü zurück", async () => {
    const c = new GameController({ prefs: memory() });
    const world = generateWorld(3);
    c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
    c.open("menu");
    render(App, { controller: c });
    await tick();
    await fireEvent.keyDown(window, { key: "o" });
    expect(c.view.kind).toBe("options");
    await userEvent.click(screen.getByRole("button", { name: "Tempo schnell" }));
    expect(c.options.tempo).toBe(2);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });

  it("die Konferenz startet im eingestellten Tempo und merkt sich + und −", async () => {
    const c = new GameController({ prefs: memory() });
    c.setOptions({ tempo: 0 });
    const world = generateWorld(3);
    c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
    await c.endTurn(c.snapshot!.state.managers[0].id);
    render(App, { controller: c });
    await tick();
    expect(screen.getByText("Tempo 1/3")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "+" });
    expect(c.options.tempo).toBe(1);
    expect(screen.getByText("Tempo 2/3")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/ui/options.test.ts`
Expected: FAIL

- [ ] **Step 3: `src/ui/logic/options.ts` schreiben**

```ts
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
```

- [ ] **Step 4: Controller erweitern**

```ts
import { loadOptions, saveOptions, type Options, type PrefsStorage } from "./logic/options";

export interface ControllerDeps {
  store?: SaveStore | null;
  prefs?: PrefsStorage | null;
}

  // Felder:
  options = $state.raw<Options>(loadOptions(null));
  private readonly prefs: PrefsStorage | null;

  // im Konstruktor, vor refreshSlots:
  this.prefs = deps.prefs ?? null;
  this.options = loadOptions(this.prefs);

  setOptions(patch: Partial<Options>): void {
    this.options = { ...this.options, ...patch };
    saveOptions(this.prefs, this.options);
  }
```

- [ ] **Step 5: `Options.svelte` schreiben**

```svelte
<script lang="ts">
  import type { GameController } from "../controller.svelte";
  import { TEMPO_LABELS } from "../logic/options";
  import Panel from "../theme/Panel.svelte";

  let { controller, onBack }: { controller: GameController; onBack: () => void } = $props();
  const o = $derived(controller.options);

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onBack();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="options">
  <Panel title="OPTIONEN">
    <div class="row">
      <span class="label">Scanlines</span>
      <button class="btn" class:selected={o.scanlines} aria-pressed={o.scanlines} aria-label="Scanlines an" onclick={() => controller.setOptions({ scanlines: true })}>An</button>
      <button class="btn" class:selected={!o.scanlines} aria-pressed={!o.scanlines} aria-label="Scanlines aus" onclick={() => controller.setOptions({ scanlines: false })}>Aus</button>
    </div>
    <div class="row">
      <span class="label">Konferenz-Tempo</span>
      {#each TEMPO_LABELS as label, i (label)}
        <button class="btn" class:selected={o.tempo === i} aria-pressed={o.tempo === i} aria-label="Tempo {label}" onclick={() => controller.setOptions({ tempo: i })}>{label}</button>
      {/each}
    </div>
    <div class="row">
      <span class="label">Ton</span>
      <button class="btn" class:selected={o.sound} aria-pressed={o.sound} aria-label="Ton an" onclick={() => controller.setOptions({ sound: true })}>An</button>
      <button class="btn" class:selected={!o.sound} aria-pressed={!o.sound} aria-label="Ton aus" onclick={() => controller.setOptions({ sound: false })}>Aus</button>
    </div>
    <p class="hint">Ton: kurze Signale bei Toren der Manager-Vereine und beim Abpfiff.</p>
  </Panel>
  <div class="foot">
    <span class="spacer"></span>
    <button class="btn" onclick={onBack}>Zurück (Esc)</button>
  </div>
</div>

<style>
  .options { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 12px; box-sizing: border-box; }
  .row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .label { width: 160px; color: var(--leaf); }
  .hint { margin: 0; color: var(--leaf); }
  .foot { display: flex; margin-top: auto; }
  .spacer { flex: 1; }
</style>
```

- [ ] **Step 6: Einbinden**

**`App.svelte`:**
- `<Screen>` wird zu `<Screen scanlines={controller.options.scanlines}>`.
- `Options` importieren und in die Kette aufnehmen:

```svelte
  {:else if view.kind === "startOptions"}
    <Options {controller} onBack={() => controller.openStart("newGame")} />
  {:else if view.kind === "options"}
    <Options {controller} onBack={() => controller.open("menu")} />
```

**`NewGame.svelte`:** Eine neue Leiste oberhalb der ersten `<Panel>`. Task 7 ergänzt hier „Weiterspielen“ und „Spiel laden“.

```svelte
  <div class="start">
    <button class="btn" onclick={() => controller.openStart("startOptions")}>Optionen</button>
  </div>
```

Dazu die CSS-Regel `.start { display: flex; gap: 6px; justify-content: flex-end; }`.

**`MainMenu.svelte`:**
- Unter dem Raster, vor der Meldung, eine Leiste:

```svelte
  <div class="extra">
    <button class="btn" onclick={() => controller.open("options")}>Optionen (O)</button>
  </div>
```

  Dazu die CSS-Regel `.extra { display: flex; gap: 6px; justify-content: flex-end; padding: 0 12px 6px; }`.
- In `onKey` nach der Enter-Prüfung:

```ts
    if (e.key.toLowerCase() === "o") {
      e.preventDefault();
      controller.open("options");
      return;
    }
```

**`Conference.svelte`:**
- `let tempo = $state(DEFAULT_TEMPO);` wird zu `const tempo = $derived(controller.options.tempo);`.
- Die Änderung läuft über eine Funktion:

```ts
  function setTempo(t: number): void {
    controller.setOptions({ tempo: Math.max(0, Math.min(TEMPOS.length - 1, t)) });
  }
```

- Alle bisherigen Zuweisungen `tempo = …` (Tasten `+`/`-` und die Knöpfe) rufen stattdessen `setTempo(tempo + 1)` bzw. `setTempo(tempo - 1)` auf.
- Den nicht mehr gebrauchten Import `DEFAULT_TEMPO` entfernen.

**`main.ts`:**

```ts
import type { PrefsStorage } from "./ui/logic/options";

function localPrefs(): PrefsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

mount(App, { target: document.getElementById("app")!, props: { controller: new GameController({ prefs: localPrefs() }) } });
```

- [ ] **Step 7: Tests laufen lassen**

Run: `npx vitest run tests/ui && npm run check`
Expected: PASS. Bestehende Tests im Hauptmenü, die die Knöpfe zählen, müssen den neuen Knopf „Optionen (O)“ berücksichtigen. Passe nur die Zählung an, keine Verhaltensprüfung.

- [ ] **Step 8: Commit**

```bash
git add src/ui src/App.svelte src/main.ts tests/ui
git commit -m "feat(ui): Optionen für Scanlines, Konferenz-Tempo und Ton"
```

---

### Task 6: Ton bei Toren und Abpfiff

**Files:**
- Create: `src/ui/sound.ts`, `tests/ui/sound.test.ts`
- Modify: `src/ui/logic/ticker.ts`, `src/ui/controller.svelte.ts`, `src/ui/screens/Conference.svelte`, `src/main.ts`

**Interfaces:**
- Consumes: `Options.sound` aus Task 5. Dazu `LiveMatch` und `halfBounds` aus dem Bestand.
- Produces:
  - `type SoundKind = "goal" | "whistle"`
  - `interface Sound { play(kind: SoundKind): void }`
  - `silentSound`, `createChiptune(): Sound`
  - `soundsFor(state, lives, from, to, end): SoundKind[]`
  - `ControllerDeps.sound?: Sound`
  - `playSound(kind)`

Regeln:
- **Tor-Ton:** nur für Tore in Spielen mit einem Manager-Verein. Er erklingt nur, wenn die Uhr normal eine Minute weiterzählt, nicht beim Überspringen.
- **Pfiff:** erklingt, sobald die Halbzeit ihr Ende erreicht, auch nach dem Überspringen.

- [ ] **Step 1: Tests schreiben**

`tests/ui/sound.test.ts`:

```ts
// @vitest-environment jsdom
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import type { LiveMatch } from "../../src/engine/match/simulate";
import { GameController } from "../../src/ui/controller.svelte";
import { soundsFor } from "../../src/ui/logic/ticker";
import type { Sound } from "../../src/ui/sound";

async function atConference(sound: Sound) {
  const c = new GameController({ sound });
  const world = generateWorld(3);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  await c.endTurn(c.snapshot!.state.managers[0].id);
  return c;
}

describe("soundsFor", () => {
  it("Tor eines Manager-Vereins beim Weiterzählen, keins beim Überspringen, Pfiff am Ende", async () => {
    const c = await atConference({ play: () => {} });
    const gs = c.snapshot!.state;
    const lives: LiveMatch[] = structuredClone(c.snapshot!.lives);
    const managed = lives.find((l) => gs.clubs[l.home.club].managerId !== null || gs.clubs[l.away.club].managerId !== null)!;
    const other = lives.find((l) => l !== managed)!;
    for (const l of lives) l.events = [];
    managed.events.push({ minute: 10, type: "goal", club: managed.home.club, player: managed.home.played[9] });
    other.events.push({ minute: 20, type: "goal", club: other.home.club, player: other.home.played[9] });

    expect(soundsFor(gs, lives, 9, 10, 45)).toEqual(["goal"]);
    expect(soundsFor(gs, lives, 19, 20, 45)).toEqual([]);
    expect(soundsFor(gs, lives, 5, 45, 45)).toEqual(["whistle"]);
    expect(soundsFor(gs, lives, 44, 45, 45)).toEqual(["whistle"]);
    expect(soundsFor(gs, lives, 45, 45, 45)).toEqual([]);
  });
});

describe("Ton in der Konferenz", () => {
  it("pfeift nach dem Überspringen ab, wenn der Ton an ist", async () => {
    const play = vi.fn();
    const c = await atConference({ play });
    render(App, { controller: c });
    await tick();
    await userEvent.click(screen.getByRole("button", { name: /Überspringen/ }));
    expect(play).toHaveBeenCalledWith("whistle");
  });

  it("bleibt stumm, wenn der Ton aus ist", async () => {
    const play = vi.fn();
    const c = await atConference({ play });
    c.setOptions({ sound: false });
    render(App, { controller: c });
    await tick();
    await userEvent.click(screen.getByRole("button", { name: /Überspringen/ }));
    expect(play).not.toHaveBeenCalled();
  });
});
```

Prüfe in `src/engine/match/simulate.ts`, wie die Aufstellung in `LiveMatch` heißt (`home.played`). Heißt das Feld anders, nimm einen beliebigen Spieler des Vereins. Für `soundsFor` zählt nur das Tor-Ereignis.

- [ ] **Step 2: Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/ui/sound.test.ts`
Expected: FAIL

- [ ] **Step 3: `src/ui/sound.ts` schreiben**

```ts
export type SoundKind = "goal" | "whistle";

export interface Sound {
  play(kind: SoundKind): void;
}

export const silentSound: Sound = { play: () => {} };

/** Frequenz in Hz (0 = Pause) und Dauer in Sekunden. */
const TUNES: Record<SoundKind, [number, number][]> = {
  goal: [[523, 0.08], [659, 0.08], [784, 0.18]],
  whistle: [[1760, 0.22], [0, 0.08], [1760, 0.45]],
};

/** Kurze Rechteck-Töne wie aus einem Heimcomputer der 90er. Ohne Web Audio bleibt es still. */
export function createChiptune(): Sound {
  let ctx: AudioContext | null = null;
  return {
    play(kind) {
      try {
        if (typeof AudioContext === "undefined") return;
        ctx ??= new AudioContext();
        if (ctx.state === "suspended") void ctx.resume();
        let t = ctx.currentTime;
        for (const [freq, dur] of TUNES[kind]) {
          if (freq > 0) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "square";
            osc.frequency.value = freq;
            gain.gain.value = 0.05;
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + dur);
          }
          t += dur;
        }
      } catch {
        // ohne Ton weiterspielen
      }
    },
  };
}
```

- [ ] **Step 4: `soundsFor` in `ticker.ts` ergänzen**

```ts
import type { SoundKind } from "../sound";

/** Töne beim Sprung der Uhr von `from` auf `to`: Tor eines Manager-Vereins (nur beim Weiterzählen um eine Minute) und der Pfiff am Ende der Halbzeit. */
export function soundsFor(state: GameState, lives: LiveMatch[], from: number, to: number, end: number): SoundKind[] {
  const out: SoundKind[] = [];
  const managed = (l: LiveMatch) => state.clubs[l.home.club].managerId !== null || state.clubs[l.away.club].managerId !== null;
  if (to === from + 1 && lives.some((l) => managed(l) && l.events.some((e) => e.type === "goal" && e.minute > from && e.minute <= to))) out.push("goal");
  if (from < end && to >= end) out.push("whistle");
  return out;
}
```

- [ ] **Step 5: Controller und Konferenz**

Controller:

```ts
import { silentSound, type Sound, type SoundKind } from "./sound";

export interface ControllerDeps {
  store?: SaveStore | null;
  prefs?: PrefsStorage | null;
  sound?: Sound;
}

  private readonly sound: Sound;
  // im Konstruktor:
  this.sound = deps.sound ?? silentSound;

  playSound(kind: SoundKind): void {
    if (this.options.sound) this.sound.play(kind);
  }
```

`Conference.svelte`: Die Uhr läuft nur noch über `step`.

```ts
  function step(next: number): void {
    const sounds = soundsFor(gs, lives, minute, next, bounds.to);
    minute = next;
    for (const k of sounds) controller.playSound(k);
  }
```

- Im `$effect`-Timer wird `minute = Math.min(bounds.to, minute + 1)` zu `step(Math.min(bounds.to, minute + 1))`.
- In `skip()` wird `minute = bounds.to` zu `step(bounds.to)`.
- Den Import von `soundsFor` ergänzen.

`main.ts`: `new GameController({ prefs: localPrefs(), sound: createChiptune() })`.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run tests/ui && npm run check`
Expected: PASS. Bestehende Konferenz-Tests laufen weiter, denn ohne `sound` bleibt es still.

- [ ] **Step 7: Commit**

```bash
git add src/ui src/main.ts tests/ui/sound.test.ts
git commit -m "feat(ui): Chiptune-Töne für Tore und Abpfiff"
```

---

### Task 7: Bildschirm „Speichern & Laden“, Weiterspielen, Import und Export

**Files:**
- Create: `src/ui/logic/saves.ts`, `src/ui/screens/SaveLoad.svelte`, `tests/ui/saveload.test.ts`
- Modify: `src/App.svelte`, `src/main.ts`, `src/ui/screens/NewGame.svelte`, `src/ui/screens/MainMenu.svelte`

**Interfaces:**
- Consumes:
  - `slots`, `refreshSlots`, `saveTo`, `loadFrom`, `importText`, `exportFile`, `hasStore`, `openStart` aus Task 3.
  - `SlotId`, `SlotInfo`, `ManualSlot` aus Task 2.
  - `Dialog.svelte` (Props `title`, `children`, `onClose`).
- Produces:
  - `slotName(slot: SlotId): string`: „Autosave“, „Slot 1“ usw.
  - `formatSavedAt(iso: string): string`: „04.11.2026 14:05“, bei ungültiger Eingabe `""`.

- [ ] **Step 1: Tests schreiben**

`tests/ui/saveload.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { SaveStore } from "../../src/storage/store";
import { GameController } from "../../src/ui/controller.svelte";
import { formatSavedAt, slotName } from "../../src/ui/logic/saves";

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await tick();
  }
};

function startIn(store: SaveStore): GameController {
  const c = new GameController({ store });
  const world = generateWorld(3);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  return c;
}

afterEach(() => vi.restoreAllMocks());

describe("Hilfen", () => {
  it("benennt Slots und formatiert das Datum", () => {
    expect(slotName("auto")).toBe("Autosave");
    expect(slotName("slot2")).toBe("Slot 2");
    expect(formatSavedAt(new Date(2026, 10, 4, 14, 5).toISOString())).toBe("04.11.2026 14:05");
    expect(formatSavedAt("Unsinn")).toBe("");
  });
});

describe("Speichern & Laden", () => {
  it("vor dem Spiel: „Spiel laden“ zeigt leere Slots, Esc führt zurück", async () => {
    const c = new GameController({ store: new SaveStore(new IDBFactory()) });
    render(App, { controller: c });
    await settle();
    expect(screen.queryByRole("button", { name: "Weiterspielen" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Spiel laden" }));
    await settle();
    expect(screen.getByText("SPIEL LADEN")).toBeTruthy();
    expect(screen.getAllByText("– leer –")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /speichern$/ })).toBeNull();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByText("NEUES SPIEL")).toBeTruthy();
  });

  it("„Weiterspielen“ lädt den Autosave", async () => {
    const store = new SaveStore(new IDBFactory());
    await startIn(store).lastAutosave;
    const c = new GameController({ store });
    render(App, { controller: c });
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Weiterspielen" }));
    await settle();
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
  });

  it("im Spiel: Taste S, in Slot 1 speichern, beim Überschreiben nachfragen", async () => {
    const c = startIn(new SaveStore(new IDBFactory()));
    c.open("menu");
    render(App, { controller: c });
    await settle();
    await fireEvent.keyDown(window, { key: "s" });
    await settle();
    expect(screen.getByText("SPEICHERN & LADEN")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "In Slot 1 speichern" }));
    await settle();
    expect(screen.getByText("Gespeichert.")).toBeTruthy();
    expect(screen.getAllByText(/Anna · Saison 1 · 1\. Spieltag/).length).toBeGreaterThanOrEqual(2);
    await userEvent.click(screen.getByRole("button", { name: "In Slot 1 speichern" }));
    expect(screen.getByText("Slot 1 überschreiben?")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Slot 1 überschreiben?")).toBeNull();
    expect(screen.getByText("SPEICHERN & LADEN")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });

  it("im Spiel: Laden fragt nach und wechselt dann zum geladenen Stand", async () => {
    const c = startIn(new SaveStore(new IDBFactory()));
    await c.lastAutosave;
    c.open("save");
    render(App, { controller: c });
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Autosave laden" }));
    expect(screen.getByText(/Nicht gespeicherter Fortschritt geht verloren/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ja" }));
    await settle();
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
  });

  it("Import einer Datei startet das Spiel; eine kaputte Datei bietet den Autosave an", async () => {
    const store = new SaveStore(new IDBFactory());
    const source = startIn(store);
    await source.lastAutosave;
    const good = source.exportFile()!.text;
    const c = new GameController({ store });
    c.openStart("loadGame");
    render(App, { controller: c });
    await settle();
    const input = screen.getByLabelText("Datei importieren") as HTMLInputElement;
    await userEvent.upload(input, new File(["kaputt"], "x.json", { type: "application/json" }));
    await settle();
    expect(screen.getByText("Der Spielstand ist beschädigt.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Autosave laden" }).length).toBe(2);
    await userEvent.upload(input, new File([good], "gut.json", { type: "application/json" }));
    await settle();
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
  });

  it("Export lädt eine JSON-Datei herunter", async () => {
    const created: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((b: Blob) => (created.push(b), "blob:x")),
      revokeObjectURL: vi.fn(),
    });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const c = startIn(new SaveStore(new IDBFactory()));
    c.open("save");
    render(App, { controller: c });
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Exportieren" }));
    expect(created).toHaveLength(1);
    expect(clicked).toHaveBeenCalled();
    expect(JSON.parse(await created[0].text()).format).toBe("fussballmanager-spielstand");
  });
});
```

- [ ] **Step 2: Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/ui/saveload.test.ts`
Expected: FAIL

- [ ] **Step 3: `src/ui/logic/saves.ts` schreiben**

```ts
import type { SlotId } from "../../storage/store";

export function slotName(slot: SlotId): string {
  return slot === "auto" ? "Autosave" : `Slot ${slot.slice(4)}`;
}

export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
```

- [ ] **Step 4: `SaveLoad.svelte` schreiben**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import type { ManagerId } from "../../engine/model";
  import type { ManualSlot, SlotId, SlotInfo } from "../../storage/store";
  import type { GameController } from "../controller.svelte";
  import { formatSavedAt, slotName } from "../logic/saves";
  import Dialog from "../theme/Dialog.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller, managerId, onBack }: { controller: GameController; managerId: ManagerId | null; onBack: () => void } = $props();

  const inGame = $derived(managerId !== null);
  const autoUsable = $derived(controller.slots.some((s) => s.slot === "auto" && s.meta !== null));
  let confirm = $state<{ text: string; action: () => Promise<unknown> } | null>(null);
  /** true, nachdem Laden oder Import gescheitert ist – dann wird der Autosave angeboten. */
  let failed = $state(false);

  onMount(() => {
    void controller.refreshSlots();
  });

  async function load(slot: SlotId): Promise<void> {
    failed = !(await controller.loadFrom(slot)) && slot !== "auto";
  }

  function askLoad(info: SlotInfo): void {
    if (inGame) confirm = { text: `${slotName(info.slot)} laden? Nicht gespeicherter Fortschritt geht verloren.`, action: () => load(info.slot) };
    else void load(info.slot);
  }

  function askSave(slot: ManualSlot, info: SlotInfo): void {
    if (info.meta || info.damaged) confirm = { text: `${slotName(slot)} überschreiben?`, action: () => controller.saveTo(slot) };
    else void controller.saveTo(slot);
  }

  async function runConfirm(): Promise<void> {
    const c = confirm;
    confirm = null;
    await c?.action();
  }

  async function importFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      controller.message = "Die Datei konnte nicht gelesen werden.";
      failed = true;
      return;
    }
    failed = !controller.importText(text);
  }

  function exportGame(): void {
    const f = controller.exportFile();
    if (!f) return;
    const url = URL.createObjectURL(new Blob([f.text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (confirm) confirm = null;
      else onBack();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="saveload">
  <Panel title={inGame ? "SPEICHERN & LADEN" : "SPIEL LADEN"}>
    {#if !controller.hasStore}
      <p>Speichern ist in diesem Browser nicht möglich. Import und Export gehen trotzdem.</p>
    {:else}
      <table>
        <tbody>
          {#each controller.slots as info (info.slot)}
            <tr>
              <td class="name">{slotName(info.slot)}</td>
              <td class="meta">
                {#if info.meta}{info.meta.managers.join(", ")} · Saison {info.meta.season} · {info.meta.label}{:else if info.damaged}beschädigt{:else}– leer –{/if}
              </td>
              <td class="date">{info.meta ? formatSavedAt(info.meta.savedAt) : ""}</td>
              <td class="actions">
                <button class="btn" aria-label="{slotName(info.slot)} laden" disabled={!info.meta} onclick={() => askLoad(info)}>Laden</button>
                {#if inGame && info.slot !== "auto"}
                  {@const slot = info.slot}
                  <button class="btn" aria-label="In {slotName(slot)} speichern" onclick={() => askSave(slot, info)}>Speichern</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </Panel>
  <div class="foot">
    <label class="btn file">Datei importieren<input type="file" accept=".json,application/json" onchange={(e) => void importFile(e)} /></label>
    {#if inGame}<button class="btn" onclick={exportGame}>Exportieren</button>{/if}
    {#if failed && autoUsable}<button class="btn" onclick={() => void load("auto")}>Autosave laden</button>{/if}
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={onBack}>Zurück (Esc)</button>
  </div>
</div>

{#if confirm}
  <Dialog title="BESTÄTIGEN" onClose={() => (confirm = null)}>
    <p>{confirm.text}</p>
    <div class="row">
      <button class="btn primary" onclick={() => void runConfirm()}>Ja</button>
      <button class="btn" onclick={() => (confirm = null)}>Nein</button>
    </div>
  </Dialog>
{/if}

<style>
  .saveload { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 12px; box-sizing: border-box; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 4px; font-size: 17px; }
  .name { color: var(--gold); width: 80px; }
  .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }
  .date { color: var(--leaf); white-space: nowrap; }
  .actions { text-align: right; white-space: nowrap; }
  .foot { display: flex; align-items: center; gap: 6px; margin-top: auto; }
  .file input { display: none; }
  .spacer { flex: 1; }
  .row { display: flex; gap: 8px; justify-content: flex-end; }
  p { margin: 0 0 8px; }
</style>
```

**Was der Test „Import … kaputte Datei“ erwartet:** Nach dem gescheiterten Import gibt es zwei Knöpfe „Autosave laden“. Der eine steht in der Slot-Zeile mit `aria-label`, der andere ist der Angebotsknopf in der Fußleiste. Beide laden denselben Stand.

- [ ] **Step 5: Einbinden**

**`App.svelte`:**

```svelte
  {:else if view.kind === "loadGame"}
    <SaveLoad {controller} managerId={null} onBack={() => controller.openStart("newGame")} />
  {:else if view.kind === "save"}
    <SaveLoad {controller} managerId={view.managerId} onBack={() => controller.open("menu")} />
```

**`NewGame.svelte`:**
- Die Leiste `.start` aus Task 5 wird zu:

```svelte
  <div class="start">
    {#if canContinue}<button class="btn primary" onclick={() => void controller.loadFrom("auto")}>Weiterspielen</button>{/if}
    <button class="btn" onclick={() => controller.openStart("loadGame")}>Spiel laden</button>
    <button class="btn" onclick={() => controller.openStart("startOptions")}>Optionen</button>
  </div>
```

- Im Skript kommt dazu: `const canContinue = $derived(controller.slots.some((s) => s.slot === "auto" && s.meta !== null));`
- In der Fußleiste wird `{#if error}<span class="msg">{error}</span>{/if}` zu `{#if error ?? controller.message}<span class="msg">{error ?? controller.message}</span>{/if}`. So erscheint eine Fehlermeldung von „Weiterspielen“.

**`MainMenu.svelte`:**
- In der Leiste `.extra` vor „Optionen (O)“ ergänzen: `<button class="btn" onclick={() => controller.open("save")}>Speichern (S)</button>`.
- In `onKey` zusätzlich zur Taste `o` die Taste `s` → `controller.open("save")`, nach demselben Muster.

**`main.ts`:**

```ts
import { SaveStore } from "./storage/store";

function browserStore(): SaveStore | null {
  try {
    return typeof indexedDB === "undefined" ? null : new SaveStore(indexedDB);
  } catch {
    return null;
  }
}
```

Den Controller erzeugst du mit `new GameController({ store: browserStore(), prefs: localPrefs(), sound: createChiptune() })`.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run tests/ui && npm run check && npm run build`
Expected: PASS, 0 Fehler, Build OK.

- [ ] **Step 7: Commit**

```bash
git add src tests/ui
git commit -m "feat(ui): Speichern & Laden mit Slots, Weiterspielen, Import und Export"
```

---

### Task 8: Debug-Schalter und Playwright-Tests

**Files:**
- Create: `src/debug.ts`, `tests/ui/debug.test.ts`, `playwright.config.ts`
- Create: `tests/e2e/helpers.ts`, `tests/e2e/season.spec.ts`, `tests/e2e/dialogs.spec.ts`, `tests/e2e/save.spec.ts`
- Modify: `src/main.ts`, `src/vite-env.d.ts`, `package.json`, `.gitignore`

**Interfaces:**
- Consumes:
  - `GameController`: `snapshot`, `endTurn`, `advance`.
  - Alle Bildschirme mit ihren Knopftexten:
    - „Anpfiff!“
    - „Los geht's (Enter)“
    - „Weiter (Enter)“
    - „Fertig (Enter)“
    - „Überspringen (Leertaste)“
    - „Neue Saison (Enter)“
    - „Verhandlung beginnen“
    - „Bieten“
    - „Abbrechen“
    - „Spiel laden“
    - „In Slot 1 speichern“
    - „Slot 1 laden“
    - „Optionen“
    - „Scanlines an“
- Produces:
  - `playToSeasonEnd(c: GameController, maxSteps?: number): Promise<boolean>`
  - Im Modus `e2e`: `window.__fm = { controller, playToSeasonEnd: () => Promise<boolean> }`

- [ ] **Step 1: Test für `playToSeasonEnd` schreiben**

`tests/ui/debug.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { playToSeasonEnd } from "../../src/debug";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

describe("playToSeasonEnd", () => {
  it("spielt ohne Eingaben bis zum Saisonende", async () => {
    const c = new GameController();
    const world = generateWorld(5);
    const ids = Object.keys(world.clubs);
    c.startGame(world, [{ name: "Anna", clubId: ids[0] }, { name: "Ben", clubId: ids[20] }]);
    expect(await playToSeasonEnd(c)).toBe(true);
    expect(c.view.kind).toBe("seasonEnd");
    expect(c.snapshot!.state.season).toBe(2);
  });

  it("ohne Spiel meldet es false", async () => {
    expect(await playToSeasonEnd(new GameController())).toBe(false);
  });
});
```

Run: `npx vitest run tests/ui/debug.test.ts`
Expected: FAIL, weil `src/debug.ts` fehlt.

- [ ] **Step 2: `src/debug.ts` schreiben**

```ts
import type { GameController } from "./ui/controller.svelte";

/** Nur für Browser-Tests (Vite-Modus „e2e“): spielt ohne Eingaben weiter, bis die Saison zu Ende ist. */
export async function playToSeasonEnd(c: GameController, maxSteps = 10_000): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    const p = c.snapshot?.phase;
    if (!p) return false;
    if (p.kind === "seasonEnd") return true;
    if (p.kind === "managerTurns" || p.kind === "halftime") {
      if (!(await c.endTurn(p.pending[0]))) return false;
    } else c.advance();
  }
  return false;
}
```

Run: `npx vitest run tests/ui/debug.test.ts`
Expected: PASS

- [ ] **Step 3: Debug-Schalter in `main.ts`**

`src/vite-env.d.ts` bekommt als erste Zeile `/// <reference types="vite/client" />`.

`main.ts`: Den Controller in eine Konstante `controller` legen und an `mount` übergeben. Danach:

```ts
if (import.meta.env.MODE === "e2e") {
  void import("./debug").then(({ playToSeasonEnd }) => {
    Object.assign(window, { __fm: { controller, playToSeasonEnd: () => playToSeasonEnd(controller) } });
  });
}
```

Prüfe es so:

Run: `npm run build && ! grep -rl "playToSeasonEnd\|__fm" dist/assets`
Expected: Der Build ist OK, und `grep` findet nichts. Im Produktions-Build fehlt der Schalter also.

- [ ] **Step 4: Playwright einrichten**

Run: `npm install --save-dev --save-exact @playwright/test@1.64.1`

In `package.json` unter `scripts`: `"test:e2e": "playwright test"`.

`.gitignore` bekommt zwei Zeilen dazu: `test-results/` und `playwright-report/`.

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 5179;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        // Optional: vorhandenes Chromium nutzen, z. B. PW_CHROMIUM=/opt/pw-browsers/chromium
        launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
      },
    },
  ],
  webServer: {
    command: `npx vite --mode e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
```

Vitest bleibt bei `tests/**/*.test.ts`. Die Playwright-Dateien heißen `*.spec.ts` und laufen deshalb nicht in Vitest.

- [ ] **Step 5: E2E-Helfer und Tests schreiben**

`tests/e2e/helpers.ts`:

```ts
import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __fm?: { playToSeasonEnd: () => Promise<boolean> };
  }
}

/** Neues Spiel; Manager 1 nimmt den ersten Verein der Liste, Manager 2 den 25. (2. Liga). */
export async function startGame(page: Page, names: string[]): Promise<void> {
  await page.goto("/");
  await expect(page.getByText("NEUES SPIEL")).toBeVisible();
  await page.getByRole("button", { name: String(names.length), exact: true }).click();
  for (const [i, name] of names.entries()) {
    await page.getByLabel(`Name Manager ${i + 1}`).fill(name);
    await page.getByLabel(`Verein Manager ${i + 1}`).selectOption({ index: i === 0 ? 1 : 25 });
  }
  await page.getByRole("button", { name: "Anpfiff!" }).click();
  await expect(page.getByText(`${names[0].toUpperCase()} IST DRAN`)).toBeVisible();
}
```

`tests/e2e/season.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { startGame } from "./helpers";

test("zwei Manager: ein Spieltag mit Halbzeit, dann Saisonende im Schnellvorlauf", async ({ page }) => {
  await startGame(page, ["Anna", "Ben"]);
  for (const name of ["ANNA", "BEN"]) {
    await expect(page.getByText(`${name} IST DRAN`)).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.press("8");
  }
  await expect(page.getByText(/KONFERENZ/)).toBeVisible();
  await page.keyboard.press(" ");
  await expect(page.getByText("HALBZEIT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Weiter (Enter)" }).click();

  for (let i = 0; i < 2; i++) {
    await expect(page.getByText("AUF DEM PLATZ")).toBeVisible();
    await page.getByRole("button", { name: "Fertig (Enter)" }).click();
  }

  await expect(page.getByText(/2\. Halbzeit/)).toBeVisible();
  await page.keyboard.press(" ");
  await expect(page.getByText("ABPFIFF")).toBeVisible();
  await page.getByRole("button", { name: "Weiter (Enter)" }).click();
  await page.getByRole("button", { name: "Weiter (Enter)" }).click();
  await expect(page.getByText("ANNA IST DRAN")).toBeVisible();
  await expect(page.getByText(/2\. Spieltag/)).toBeVisible();

  expect(await page.evaluate(() => window.__fm!.playToSeasonEnd())).toBe(true);
  await expect(page.getByText("SAISON 1 BEENDET")).toBeVisible();
  await page.getByRole("button", { name: "Neue Saison (Enter)" }).click();
  await expect(page.getByText("ANNA IST DRAN")).toBeVisible();
  await expect(page.getByText(/Saison 2/)).toBeVisible();
});
```

`tests/e2e/dialogs.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { startGame } from "./helpers";

test("Vertragsdialog und Transferdialog", async ({ page }) => {
  await startGame(page, ["Anna"]);
  await page.keyboard.press("Enter");

  await page.keyboard.press("3");
  await page.getByRole("button", { name: /verlängern$/ }).first().click();
  const contract = page.getByRole("dialog");
  await expect(contract).toBeVisible();
  await contract.getByRole("button", { name: "Verhandlung beginnen" }).click();
  await expect(contract.getByRole("button", { name: "Bieten" })).toBeVisible();
  await contract.getByRole("button", { name: "Abbrechen" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.keyboard.press("4");
  await page.getByRole("button", { name: /verhandeln$/ }).first().click();
  const transfer = page.getByRole("dialog");
  await expect(transfer).toBeVisible();
  await transfer.getByRole("button", { name: "Verhandlung beginnen" }).click();
  await expect(transfer.getByRole("button", { name: "Bieten" })).toBeVisible();
  await transfer.getByRole("button", { name: "Abbrechen" }).click();
});
```

Ob der Dialog nach „Abbrechen“ offen bleibt (mit Hinweis) oder sich schließt, und was er zeigt, bestimmt `NegotiationDialog.svelte`. Prüfe das beim ersten Lauf und passe die Zeilen nach „Abbrechen“ an das tatsächliche Verhalten an. Lehnt der Markt zum 1. Spieltag eine Ablöseverhandlung ab, nimm einen vereinslosen Spieler (Filter in `Transfers.svelte`). Ziel ist, dass beide Dialoge im echten Browser öffnen, eine Verhandlung beginnen und sich bedienen lassen.

`tests/e2e/save.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { startGame } from "./helpers";

test("speichern, neu laden, Slot laden", async ({ page }) => {
  await startGame(page, ["Anna"]);
  await page.keyboard.press("Enter");
  await page.keyboard.press("s");
  await page.getByRole("button", { name: "In Slot 1 speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Weiterspielen" })).toBeVisible();
  await page.getByRole("button", { name: "Spiel laden" }).click();
  await page.getByRole("button", { name: "Slot 1 laden" }).click();
  await expect(page.getByText("ANNA IST DRAN")).toBeVisible();
});

test("Scanlines bleiben nach dem Neuladen eingeschaltet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Optionen" }).click();
  await page.getByRole("button", { name: "Scanlines an" }).click();
  await page.reload();
  await expect(page.locator(".screen.scanlines")).toHaveCount(1);
});
```

- [ ] **Step 6: Playwright laufen lassen**

Run: `npx playwright install chromium && npm run test:e2e`
Expected: 4 Tests PASS.

Falls der Browser-Download in dieser Umgebung nicht möglich ist:
- Mit vorhandenem Chromium: `PW_CHROMIUM=<Pfad> npm run test:e2e`.
- Ohne Browser: Melde `DONE_WITH_CONCERNS` und schreibe den genauen Fehler in den Report. Der Nutzer führt die Tests dann lokal aus. `npx tsc --noEmit -p tsconfig.json` bzw. `npm run check` muss für die Spec-Dateien trotzdem grün sein.

- [ ] **Step 7: Gesamtprüfung**

Run: `npm test && npm run check && npm run build`
Expected: Alle Vitest-Tests PASS, svelte-check meldet 0 Fehler und 0 Warnungen, Build OK.

- [ ] **Step 8: Commit**

```bash
git add src/debug.ts src/main.ts src/vite-env.d.ts package.json package-lock.json .gitignore playwright.config.ts tests/ui/debug.test.ts tests/e2e
git commit -m "test(e2e): Playwright-Tests für Saison, Dialoge und Speichern"
```
