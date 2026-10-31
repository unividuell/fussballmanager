# Engine-Kern (Plan 1 von 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine vollständig getestete, UI-freie Spiel-Engine, mit der sich beliebig viele Saisons mit 2 Ligen (je 18 Vereine), Spielsimulation inklusive Halbzeit, Auf- und Abstieg sowie Relegation durchspielen lassen. Dazu kommt eine Session, die die Phasen eines Spieltags im Hot-Seat-Modus steuert.

**Architecture:** Die Engine ist reines TypeScript in `src/engine/`, ohne DOM- oder Browser-Abhängigkeiten. Jede Änderung arbeitet nach dem Muster „kopieren, dann verändern“ (`structuredClone` des `GameState`, danach wird die Kopie verändert). Der Zufall kommt aus einem seed-basierten sfc32-Generator, dessen Zustand im `GameState` liegt. Die Session (`src/session/`) hält den Spielstand, steuert die Phasen und nimmt Befehle über eine austauschbare `Transport`-Schnittstelle an.

**Tech Stack:** TypeScript 5.6.3, Vite 5.4.21, Svelte 5.20.5 (Svelte nur fürs Grundgerüst), Vitest 2.1.9, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-31-fussballmanager-design.md`

**Gesamtaufteilung von Schritt 1 der Spec:**
- **Plan 1 (dieser):** Engine-Kern und Session
- **Plan 2:** Oberfläche Hot-Seat (Stil „Rasen & Holztafel“, alle Bildschirme für Mannschaft, Tabelle, Konferenz und Saisonende)
- **Plan 3:** Wirtschaft (Training, Finanzen, Verträge, Transfers, Vorstand, KI-Wirtschaft, Nachrichten) samt Menüs
- **Plan 4:** Speichern, Laden und Optionen, Playwright-Tests

Jeder Plan liefert für sich lauffähige, getestete Software.

## Global Constraints

- **Abhängigkeiten:** Versionen exakt pinnen (`--save-exact`). Keine weiteren Laufzeit-Abhängigkeiten außer `svelte`.
- **Engine:** Unter `src/engine/` sind keine Imports aus `svelte`, `src/ui`, `src/session` oder Browser-APIs erlaubt.
- **Determinismus:** Gleicher Spielstand plus gleicher Befehl ergibt das gleiche Ergebnis. `Math.random()` und `Date.now()` sind in der Engine verboten.
- **Unveränderlichkeit:** Öffentliche Engine-Funktionen, die einen `GameState` zurückgeben, verändern ihr Argument nie.
- **Serialisierbarkeit:** Alles im `GameState` ist reines JSON, also ohne Klassen, `Map`, `Set` oder `undefined` als Wert. Für fehlende Werte wird `null` verwendet.
- **Sprache:** Code-Bezeichner sind englisch, alle für Menschen sichtbaren Texte (Fehlermeldungen) deutsch.
- **Ligen:** Es gibt 2 Ligen mit je 18 Vereinen (`LEAGUE_SIZE = 18`) und 34 Spieltagen.
- **Auf- und Abstieg:** je 2 direkte Auf- und Absteiger.
- **Relegation:** Der 16. der 1. Liga spielt gegen den 3. der 2. Liga in Hin- und Rückspiel. Ist das Gesamtergebnis gleich, folgt direkt ein Elfmeterschießen, ohne Auswärtstorregel und ohne Verlängerung.
- **Stärke:** 1–99, intern als Gleitkommazahl. Angezeigt wird `Math.round`.
- **Kader:** Startelf 11 Spieler, bis zu 9 Ersatzspieler, 5 Wechsel.
- **Positionsfaktoren:** gleich 1,0, benachbart 0,85, entfernt 0,65, Torwart ↔ Feldspieler 0,3.
- **Effektive Stärke:** `strength × Positionsfaktor × (1 + 0,03 × form) × (0,7 + 0,3 × fitness/100)`.
- **Spielweise:** offensiv Angriff ×1,10 und Abwehr ×0,90, defensiv umgekehrt. Bei Härte „hart“ Mittelfeld ×1,05.
- **Kalibrierung** (über 5000 Spiele, gleich starke Teams):
  - 2,6–3,0 Tore pro Spiel.
  - Heimsiege 45 % ±5, Unentschieden 27 % ±5, Auswärtssiege 28 % ±5.
  - Ein 10 Punkte schwächeres Team gewinnt 15–25 % seiner Spiele.
- **Gelbe Karten:** 5 gelbe Karten bedeuten 1 Spiel Sperre.
- **Abweichung von Spec Abschnitt 6:** `phase` liegt nicht im `GameState`, sondern in der Session. Gespeichert wird später nur zwischen Spieltagen (Plan 4), und dort ist die Phase immer der Beginn der Manager-Runden.

## Review Focus

1. **Spieler fallen aus, bis weniger als 11 einsatzfähig sind** (Verletzungen und Sperren häufen sich): Das Spiel ergänzt automatisch Amateurspieler und stürzt nie ab. Abgesichert in Task 9 (`ensureMinimumSquad`).
2. **Torwart fliegt vom Platz oder verletzt sich ohne Wechsel und ohne Ersatz-Torwart:** Ein Feldspieler geht ins Tor (Faktor 0,3), und das Spiel läuft weiter. Abgesichert in Task 8.
3. **Manager-Aufstellung enthält einen inzwischen verletzten oder gesperrten Spieler:** Vor dem Anpfiff wird nur dieser Platz ersetzt, der Rest der Aufstellung bleibt. Abgesichert in Task 3 (`repairLineup`) und Task 10.
4. **Relegation endet mit gleichem Gesamtergebnis:** Das Elfmeterschießen entscheidet, und es gibt immer genau einen Sieger. Abgesichert in Task 11.
5. **Halbzeitwechsel mit ungültigen Daten** (6. Wechsel, Spieler nicht auf der Bank, bereits ausgewechselter Spieler, Spieler eines fremden Vereins): wird abgelehnt, der Spielstand bleibt unverändert. Abgesichert in Task 8 und Task 13.

## Dateistruktur

```
fussballmanager/
├─ package.json, tsconfig.json, vite.config.ts, svelte.config.js, index.html
├─ src/
│  ├─ main.ts, App.svelte            # Platzhalter, damit `npm run build` läuft (UI folgt in Plan 2)
│  ├─ engine/
│  │  ├─ rng.ts                      # sfc32-Zufallsgenerator mit serialisierbarem Zustand
│  │  ├─ model.ts                    # alle Datentypen, Konstanten, kleine Hilfsfunktionen
│  │  ├─ lineup.ts                   # Positionsfaktor, Prüfung, Reparatur, Auto-Aufstellung
│  │  ├─ competition/schedule.ts     # Kreisverfahren, Liga anlegen
│  │  ├─ competition/standings.ts    # Tabelle und Tiebreaker
│  │  ├─ names.ts                    # Namenslisten (Städte, Präfixe, Vor- und Nachnamen, Farben)
│  │  ├─ generator.ts                # Vereine und Spieler erzeugen
│  │  ├─ match/strength.ts           # effektive Spieler- und Teamstärke
│  │  ├─ match/simulate.ts           # LiveMatch, simulateHalf, Wechsel, Elfmeterschießen
│  │  ├─ squad.ts                    # Mindestkader sichern (Amateure)
│  │  ├─ season.ts                   # neues Spiel, Saisonstart, Spieltag, Saisonende
│  │  ├─ ai.ts                       # KI: Formation, Aufstellung, Halbzeit
│  │  └─ commands.ts                 # Befehle prüfen und anwenden
│  ├─ session/session.ts             # Phasen-Zustandsmaschine, Hot-Seat
│  └─ transport/transport.ts         # Transport-Schnittstelle + LocalTransport
└─ tests/
   ├─ engine/…                       # ein Test pro Engine-Modul
   ├─ engine/fixtures.ts             # Test-Hilfen
   ├─ session/session.test.ts
   └─ longrun/seasons.test.ts
```

---

### Task 1: Projekt-Setup und Zufallsgenerator

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/App.svelte`
- Create: `src/engine/rng.ts`
- Test: `tests/engine/rng.test.ts`

**Interfaces:**
- Produces: `interface RngState { a: number; b: number; c: number; d: number }`; `class Rng` mit `static fromSeed(seed: number): Rng`, `static fromState(s: RngState): Rng`, `state(): RngState`, `next(): number` ([0,1)), `int(min, max): number` (beide inklusive), `chance(p): boolean`, `pick<T>(arr: readonly T[]): T`, `weighted<T>(items: readonly T[], weight: (t: T) => number): T`, `normal(mean, sd): number`, `shuffle<T>(arr: readonly T[]): T[]` (neue Liste).

- [ ] **Step 1: Projekt anlegen**

```bash
cd /home/claude/projects/fussballmanager
npm init -y >/dev/null
npm install --save-exact svelte@5.20.5
npm install --save-exact -D vite@5.4.21 @sveltejs/vite-plugin-svelte@4.0.4 typescript@5.6.3 vitest@2.1.9 @tsconfig/svelte@5.0.4 svelte-check@4.1.4
```

`package.json` danach so anpassen (Abhängigkeiten aus dem Install übernehmen):

```json
{
  "name": "fussballmanager",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "svelte-check --tsconfig ./tsconfig.json"
  }
}
```

`tsconfig.json`:

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "tests/**/*.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  base: "./",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
```

`svelte.config.js`:

```js
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default { preprocess: vitePreprocess() };
```

`index.html`:

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fussballmanager</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:

```ts
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
```

`src/App.svelte`:

```svelte
<main>Fussballmanager – die Oberfläche folgt in Plan 2.</main>
```

- [ ] **Step 2: Failing Test für den Zufallsgenerator schreiben**

`tests/engine/rng.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Rng } from "../../src/engine/rng";

describe("Rng", () => {
  it("liefert bei gleichem Seed dieselbe Folge", () => {
    const a = Rng.fromSeed(42);
    const b = Rng.fromSeed(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("liefert bei verschiedenem Seed verschiedene Folgen", () => {
    expect(Rng.fromSeed(1).next()).not.toBe(Rng.fromSeed(2).next());
  });

  it("setzt nach state()/fromState() exakt fort", () => {
    const a = Rng.fromSeed(7);
    a.next();
    a.next();
    const b = Rng.fromState(JSON.parse(JSON.stringify(a.state())));
    for (let i = 0; i < 50; i++) expect(b.next()).toBe(a.next());
  });

  it("next() liegt in [0, 1)", () => {
    const r = Rng.fromSeed(3);
    for (let i = 0; i < 10_000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("int() trifft beide Grenzen und nichts außerhalb", () => {
    const r = Rng.fromSeed(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(r.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("weighted() wählt nie Gewicht 0", () => {
    const r = Rng.fromSeed(9);
    for (let i = 0; i < 1000; i++) {
      expect(r.weighted(["a", "b", "c"], (x) => (x === "b" ? 0 : 1))).not.toBe("b");
    }
  });

  it("normal() hat ungefähr den gewünschten Mittelwert", () => {
    const r = Rng.fromSeed(11);
    let sum = 0;
    for (let i = 0; i < 20_000; i++) sum += r.normal(50, 10);
    expect(sum / 20_000).toBeGreaterThan(49.5);
    expect(sum / 20_000).toBeLessThan(50.5);
  });

  it("shuffle() verändert das Original nicht und behält alle Elemente", () => {
    const r = Rng.fromSeed(13);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const s = r.shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...s].sort()).toEqual(arr);
  });
});
```

- [ ] **Step 3: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/rng.test.ts`
Expected: FAIL mit „Failed to resolve import ../../src/engine/rng“

- [ ] **Step 4: Zufallsgenerator implementieren**

`src/engine/rng.ts`:

```ts
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    z ^= z >>> 16;
    return z >>> 0;
  };
}

/** sfc32 – kleiner, schneller, seed-basierter Zufallsgenerator mit serialisierbarem Zustand. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  private constructor(s: RngState) {
    this.a = s.a | 0;
    this.b = s.b | 0;
    this.c = s.c | 0;
    this.d = s.d | 0;
  }

  static fromSeed(seed: number): Rng {
    const sm = splitmix32(seed);
    const rng = new Rng({ a: sm(), b: sm(), c: sm(), d: sm() });
    for (let i = 0; i < 15; i++) rng.next();
    return rng;
  }

  static fromState(s: RngState): Rng {
    return new Rng(s);
  }

  state(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick() auf leerer Liste");
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const weights = items.map(weight);
    const total = weights.reduce((x, y) => x + y, 0);
    if (total <= 0) throw new Error("weighted() ohne positives Gewicht");
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      if (weights[i] <= 0) continue;
      r -= weights[i];
      if (r < 0) return items[i];
    }
    for (let i = items.length - 1; i >= 0; i--) if (weights[i] > 0) return items[i];
    throw new Error("unreachable");
  }

  normal(mean: number, sd: number): number {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
```

- [ ] **Step 5: Tests und Build laufen lassen**

Run: `npx vitest run tests/engine/rng.test.ts && npm run build`
Expected: 8 Tests PASS, der Build erzeugt `dist/index.html`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts svelte.config.js index.html src tests
git commit -m "chore: Projekt-Setup und seed-basierter Zufallsgenerator"
```

---

### Task 2: Datenmodell

**Files:**
- Create: `src/engine/model.ts`
- Create: `tests/engine/fixtures.ts`
- Test: `tests/engine/model.test.ts`

**Interfaces:**
- Consumes: `RngState` (Task 1)
- Produces: alle Typen und Konstanten unten, dazu `slotPositions(f)`, `newId(state, prefix)`, `isAvailable(p)`, `displayStrength(p)`, `clubOf(state, managerId)`; Test-Hilfen `makePlayer`, `makeSquad`, `makeState`.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FORMATION_LIST, FORMATIONS, isAvailable, newId, slotPositions } from "../../src/engine/model";
import { makePlayer, makeSquad, makeState } from "./fixtures";

describe("model", () => {
  it("jede Formation hat 10 Feldspieler und 11 Plätze, Torwart zuerst", () => {
    for (const f of FORMATION_LIST) {
      const c = FORMATIONS[f];
      expect(c.DF + c.MF + c.FW).toBe(10);
      const slots = slotPositions(f);
      expect(slots).toHaveLength(11);
      expect(slots[0]).toBe("GK");
      expect(slots.filter((s) => s === "GK")).toHaveLength(1);
    }
  });

  it("slotPositions ordnet Abwehr, Mittelfeld, Sturm", () => {
    expect(slotPositions("3-5-2")).toEqual(["GK", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW", "FW"]);
  });

  it("newId zählt hoch", () => {
    const s = makeState([]);
    expect(newId(s, "p")).toBe("p1");
    expect(newId(s, "p")).toBe("p2");
  });

  it("isAvailable erkennt Verletzung und Sperre", () => {
    expect(isAvailable(makePlayer("a", "MF", 50))).toBe(true);
    expect(isAvailable(makePlayer("a", "MF", 50, { injury: { matchesLeft: 2 } }))).toBe(false);
    expect(isAvailable(makePlayer("a", "MF", 50, { suspension: { matchesLeft: 1 } }))).toBe(false);
  });

  it("makeSquad erzeugt 3 TW, 8 ABW, 8 MF, 6 ST", () => {
    const sq = makeSquad("c1", 60);
    expect(sq.filter((p) => p.position === "GK")).toHaveLength(3);
    expect(sq.filter((p) => p.position === "DF")).toHaveLength(8);
    expect(sq.filter((p) => p.position === "MF")).toHaveLength(8);
    expect(sq.filter((p) => p.position === "FW")).toHaveLength(6);
  });
});
```

`tests/engine/fixtures.ts`:

```ts
import { Rng } from "../../src/engine/rng";
import type { Club, GameState, Player, Position } from "../../src/engine/model";

export function makePlayer(id: string, position: Position, strength: number, extra: Partial<Player> = {}): Player {
  return {
    id,
    firstName: "Test",
    lastName: id,
    age: 25,
    position,
    strength,
    potential: strength,
    form: 0,
    fitness: 100,
    injury: null,
    suspension: null,
    yellowCards: 0,
    clubId: null,
    stats: { apps: 0, goals: 0 },
    ...extra,
  };
}

/** 25 Spieler: 3 TW, 8 ABW, 8 MF, 6 ST, alle mit gleicher Stärke. */
export function makeSquad(clubId: string, strength: number): Player[] {
  const plan: [Position, number][] = [["GK", 3], ["DF", 8], ["MF", 8], ["FW", 6]];
  const out: Player[] = [];
  for (const [pos, n] of plan) {
    for (let i = 1; i <= n; i++) out.push(makePlayer(`${clubId}-${pos}${i}`, pos, strength, { clubId }));
  }
  return out;
}

export function makeClub(id: string, squad: Player[], extra: Partial<Club> = {}): Club {
  return {
    id,
    name: `Verein ${id}`,
    shortName: id,
    colors: ["#ffffff", "#000000"],
    crest: "plain",
    reputation: 50,
    managerId: null,
    squad: squad.map((p) => p.id),
    lineup: { starters: [], bench: [] },
    tactics: { formation: "4-4-2", style: "normal", hardness: "normal" },
    ...extra,
  };
}

/** Minimaler Spielstand mit den übergebenen Vereinen (je mit eigenem Kader). */
export function makeState(clubs: { id: string; strength: number }[], seed = 1): GameState {
  const state: GameState = {
    version: 1,
    rngState: Rng.fromSeed(seed).state(),
    season: 1,
    calendar: [],
    calendarIndex: 0,
    managers: [],
    clubs: {},
    players: {},
    competitions: {},
    history: [],
    nextId: 1,
  };
  for (const c of clubs) {
    const squad = makeSquad(c.id, c.strength);
    for (const p of squad) state.players[p.id] = p;
    state.clubs[c.id] = makeClub(c.id, squad);
  }
  return state;
}
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/model.test.ts`
Expected: FAIL mit „Failed to resolve import ../../src/engine/model“

- [ ] **Step 3: Datenmodell implementieren**

`src/engine/model.ts`:

```ts
import type { RngState } from "./rng";

export type ClubId = string;
export type PlayerId = string;
export type ManagerId = string;
export type CompetitionId = string;
export type MatchId = string;

export type Position = "GK" | "DF" | "MF" | "FW";

export type Formation = "4-4-2" | "4-3-3" | "3-5-2" | "5-3-2" | "4-5-1" | "4-2-4";
export const FORMATIONS: Record<Formation, { DF: number; MF: number; FW: number }> = {
  "4-4-2": { DF: 4, MF: 4, FW: 2 },
  "4-3-3": { DF: 4, MF: 3, FW: 3 },
  "3-5-2": { DF: 3, MF: 5, FW: 2 },
  "5-3-2": { DF: 5, MF: 3, FW: 2 },
  "4-5-1": { DF: 4, MF: 5, FW: 1 },
  "4-2-4": { DF: 4, MF: 2, FW: 4 },
};
export const FORMATION_LIST = Object.keys(FORMATIONS) as Formation[];

/** Positionen der 11 Startplätze: Index 0 = Torwart, dann Abwehr, Mittelfeld, Sturm. */
export function slotPositions(f: Formation): Position[] {
  const c = FORMATIONS[f];
  return [
    "GK",
    ...Array<Position>(c.DF).fill("DF"),
    ...Array<Position>(c.MF).fill("MF"),
    ...Array<Position>(c.FW).fill("FW"),
  ];
}

export type Style = "defensive" | "normal" | "offensive";
export type Hardness = "fair" | "normal" | "hard";
export interface Tactics {
  formation: Formation;
  style: Style;
  hardness: Hardness;
}

/** starters[i] spielt auf slotPositions(formation)[i]. */
export interface Lineup {
  starters: PlayerId[];
  bench: PlayerId[];
}
export const STARTERS = 11;
export const BENCH_SIZE = 9;
export const MAX_SUBS = 5;
export const YELLOW_LIMIT = 5;

export interface Player {
  id: PlayerId;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  /** 1–99, intern Gleitkomma; angezeigt wird Math.round. */
  strength: number;
  potential: number;
  /** −3 … +3 */
  form: number;
  /** 0–100 */
  fitness: number;
  injury: { matchesLeft: number } | null;
  suspension: { matchesLeft: number } | null;
  yellowCards: number;
  clubId: ClubId | null;
  /** Statistik der laufenden Saison */
  stats: { apps: number; goals: number };
}

export type CrestPattern = "plain" | "stripes" | "sash" | "split" | "hoops";

export interface Club {
  id: ClubId;
  name: string;
  shortName: string;
  colors: [string, string];
  crest: CrestPattern;
  /** 1–100 */
  reputation: number;
  managerId: ManagerId | null;
  squad: PlayerId[];
  lineup: Lineup;
  tactics: Tactics;
}

export interface Manager {
  id: ManagerId;
  name: string;
  clubId: ClubId | null;
}

export interface Score {
  home: number;
  away: number;
}

export type MatchEvent =
  | { minute: number; type: "goal"; club: ClubId; player: PlayerId }
  | { minute: number; type: "yellow"; club: ClubId; player: PlayerId }
  | { minute: number; type: "red"; club: ClubId; player: PlayerId; secondYellow: boolean }
  | { minute: number; type: "injury"; club: ClubId; player: PlayerId }
  | { minute: number; type: "sub"; club: ClubId; out: PlayerId; in: PlayerId };

export interface Match {
  id: MatchId;
  competitionId: CompetitionId;
  /** Runde innerhalb des Wettbewerbs (Liga: Spieltag 1–34; Relegation: 1 = Hin-, 2 = Rückspiel). */
  round: number;
  home: ClubId;
  away: ClubId;
  result: Score | null;
  events: MatchEvent[];
  /** Nur gesetzt, wenn nach diesem Spiel ein Elfmeterschießen nötig war. */
  penalties: Score | null;
}

export interface Competition {
  id: CompetitionId;
  name: string;
  format: "league" | "knockout";
  clubs: ClubId[];
  rounds: number;
  matches: Match[];
}

export interface CalendarEntry {
  fixtures: { competitionId: CompetitionId; round: number }[];
}

export interface SeasonRecord {
  season: number;
  champions: Record<CompetitionId, ClubId>;
  promoted: ClubId[];
  relegated: ClubId[];
  topScorers: Record<CompetitionId, { player: PlayerId; goals: number } | null>;
}

export interface GameState {
  version: 1;
  rngState: RngState;
  season: number;
  calendar: CalendarEntry[];
  /** Index des nächsten zu spielenden Kalendereintrags. */
  calendarIndex: number;
  managers: Manager[];
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
  competitions: Record<CompetitionId, Competition>;
  history: SeasonRecord[];
  nextId: number;
}

export const LEAGUE_SIZE = 18;
export const COMP = { first: "L1", second: "L2", relegation: "REL" } as const;

export function newId(state: GameState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

export function isAvailable(p: Player): boolean {
  return p.injury === null && p.suspension === null;
}

export function displayStrength(p: Player): number {
  return Math.round(p.strength);
}

export function clubOf(state: GameState, managerId: ManagerId): Club | null {
  const m = state.managers.find((x) => x.id === managerId);
  return m && m.clubId ? state.clubs[m.clubId] : null;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/model.test.ts`
Expected: 5 Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/model.ts tests/engine/model.test.ts tests/engine/fixtures.ts
git commit -m "feat(engine): Datenmodell und Test-Hilfen"
```

---

### Task 3: Aufstellung (Positionsfaktor, Prüfung, Reparatur, Automatik)

**Files:**
- Create: `src/engine/lineup.ts`
- Test: `tests/engine/lineup.test.ts`

**Interfaces:**
- Consumes: Typen aus `model.ts` (Task 2)
- Produces:
  - `positionFactor(natural: Position, slot: Position): number`
  - `playerValue(p: Player): number` – Stärke × Form × Kondition, ohne Positionsfaktor
  - `validateLineup(state, clubId, lineup: Lineup): string | null` – liefert eine Fehlermeldung oder `null`
  - `repairLineup(state, clubId, lineup: Lineup, formation: Formation): Lineup` – ersetzt nur ungültige Plätze
  - `autoLineup(state, clubId, formation): Lineup`
  - `lineupsEqual(a: Lineup, b: Lineup): boolean`
  - `fillSlots(slots: (PlayerId | null)[], slotPos: Position[], candidates: Player[]): void` – füllt leere Plätze, erst nach passender Position, dann nach bestem Wert (wird in Task 8 für Formationswechsel genutzt)

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/lineup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { autoLineup, lineupsEqual, positionFactor, repairLineup, validateLineup } from "../../src/engine/lineup";
import { slotPositions } from "../../src/engine/model";
import { makePlayer, makeState } from "./fixtures";

describe("positionFactor", () => {
  it("entspricht der Tabelle aus der Spec", () => {
    expect(positionFactor("DF", "DF")).toBe(1);
    expect(positionFactor("DF", "MF")).toBe(0.85);
    expect(positionFactor("FW", "MF")).toBe(0.85);
    expect(positionFactor("DF", "FW")).toBe(0.65);
    expect(positionFactor("GK", "DF")).toBe(0.3);
    expect(positionFactor("MF", "GK")).toBe(0.3);
  });
});

describe("autoLineup", () => {
  it("stellt 11 verschiedene Spieler auf natürlichen Positionen auf", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const l = autoLineup(s, "c1", "4-3-3");
    expect(l.starters).toHaveLength(11);
    expect(new Set(l.starters).size).toBe(11);
    const slots = slotPositions("4-3-3");
    l.starters.forEach((id, i) => expect(s.players[id].position).toBe(slots[i]));
    expect(l.bench.length).toBeLessThanOrEqual(9);
    expect(l.bench.some((id) => s.players[id].position === "GK")).toBe(true);
    expect(validateLineup(s, "c1", l)).toBeNull();
  });

  it("nimmt die stärksten Spieler und lässt verletzte weg", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.players["c1-FW1"].strength = 90;
    s.players["c1-FW2"].strength = 85;
    s.players["c1-FW2"].injury = { matchesLeft: 3 };
    const l = autoLineup(s, "c1", "4-4-2");
    expect(l.starters).toContain("c1-FW1");
    expect(l.starters).not.toContain("c1-FW2");
    expect(l.bench).not.toContain("c1-FW2");
  });

  it("setzt einen Feldspieler ins Tor, wenn kein Torwart verfügbar ist", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    for (const id of ["c1-GK1", "c1-GK2", "c1-GK3"]) s.players[id].injury = { matchesLeft: 2 };
    const l = autoLineup(s, "c1", "4-4-2");
    expect(l.starters).toHaveLength(11);
    expect(s.players[l.starters[0]].position).not.toBe("GK");
  });
});

describe("validateLineup", () => {
  it("meldet zu wenige Spieler, Doppelte, Fremde, Verletzte und Gesperrte", () => {
    const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
    const ok = autoLineup(s, "c1", "4-4-2");
    expect(validateLineup(s, "c1", { ...ok, starters: ok.starters.slice(0, 10) })).toMatch(/genau 11/);
    expect(validateLineup(s, "c1", { ...ok, bench: [ok.starters[0]] })).toMatch(/doppelt/);
    expect(validateLineup(s, "c1", { ...ok, bench: ["c2-MF1"] })).toMatch(/nicht zum Kader/);
    s.players[ok.starters[5]].injury = { matchesLeft: 1 };
    expect(validateLineup(s, "c1", ok)).toMatch(/verletzt/);
    s.players[ok.starters[5]].injury = null;
    s.players[ok.starters[6]].suspension = { matchesLeft: 1 };
    expect(validateLineup(s, "c1", ok)).toMatch(/gesperrt/);
  });

  it("meldet zu viele Ersatzspieler", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const ok = autoLineup(s, "c1", "4-4-2");
    const rest = s.clubs.c1.squad.filter((id) => !ok.starters.includes(id));
    expect(validateLineup(s, "c1", { starters: ok.starters, bench: rest.slice(0, 10) })).toMatch(/Höchstens 9/);
  });
});

describe("repairLineup", () => {
  it("ersetzt nur den verletzten Spieler und lässt den Rest an seinem Platz", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const l = autoLineup(s, "c1", "4-4-2");
    const injured = l.starters[3];
    s.players[injured].injury = { matchesLeft: 2 };
    const r = repairLineup(s, "c1", l, "4-4-2");
    expect(r.starters).toHaveLength(11);
    expect(r.starters).not.toContain(injured);
    r.starters.forEach((id, i) => {
      if (i !== 3) expect(id).toBe(l.starters[i]);
    });
    expect(validateLineup(s, "c1", r)).toBeNull();
  });

  it("lässt eine gültige Aufstellung unverändert", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const l = autoLineup(s, "c1", "4-4-2");
    expect(lineupsEqual(repairLineup(s, "c1", l, "4-4-2"), l)).toBe(true);
  });

  it("entfernt Spieler, die nicht mehr im Kader sind", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const l = autoLineup(s, "c1", "4-4-2");
    const gone = l.starters[8];
    s.clubs.c1.squad = s.clubs.c1.squad.filter((id) => id !== gone);
    s.players.x = makePlayer("x", "FW", 99, { clubId: "c1" });
    const r = repairLineup(s, "c1", l, "4-4-2");
    expect(r.starters).not.toContain(gone);
    expect(r.starters).not.toContain("x");
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/lineup.test.ts`
Expected: FAIL mit „Failed to resolve import ../../src/engine/lineup“

- [ ] **Step 3: Implementieren**

`src/engine/lineup.ts`:

```ts
import {
  BENCH_SIZE,
  STARTERS,
  isAvailable,
  slotPositions,
  type ClubId,
  type Formation,
  type GameState,
  type Lineup,
  type Player,
  type PlayerId,
  type Position,
} from "./model";

const LINE_ORDER = { DF: 0, MF: 1, FW: 2 } as const;

export function positionFactor(natural: Position, slot: Position): number {
  if (natural === slot) return 1;
  if (natural === "GK" || slot === "GK") return 0.3;
  return Math.abs(LINE_ORDER[natural] - LINE_ORDER[slot]) === 1 ? 0.85 : 0.65;
}

export function playerValue(p: Player): number {
  return p.strength * (1 + 0.03 * p.form) * (0.7 + 0.3 * (p.fitness / 100));
}

export function validateLineup(state: GameState, clubId: ClubId, lineup: Lineup): string | null {
  const club = state.clubs[clubId];
  if (lineup.starters.length !== STARTERS) return "Die Startelf braucht genau 11 Spieler.";
  if (lineup.bench.length > BENCH_SIZE) return `Höchstens ${BENCH_SIZE} Ersatzspieler.`;
  const all = [...lineup.starters, ...lineup.bench];
  if (new Set(all).size !== all.length) return "Ein Spieler ist doppelt aufgestellt.";
  for (const id of all) {
    const p = state.players[id];
    if (!p || !club.squad.includes(id)) return "Ein Spieler gehört nicht zum Kader.";
    if (p.injury) return `${p.lastName} ist verletzt.`;
    if (p.suspension) return `${p.lastName} ist gesperrt.`;
  }
  return null;
}

/** Füllt leere Plätze: erst mit Spielern der passenden Position, dann mit dem besten Rest. Verändert `slots`. */
export function fillSlots(slots: (PlayerId | null)[], slotPos: Position[], candidates: Player[]): void {
  const used = new Set(slots.filter((s): s is PlayerId => s !== null));
  const pool = candidates.filter((p) => !used.has(p.id)).sort((a, b) => playerValue(b) - playerValue(a));
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] !== null) continue;
    const idx = pool.findIndex((p) => p.position === slotPos[i]);
    if (idx >= 0) {
      slots[i] = pool[idx].id;
      pool.splice(idx, 1);
    }
  }
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] !== null || pool.length === 0) continue;
    const score = (p: Player) => playerValue(p) * positionFactor(p.position, slotPos[i]);
    let best = 0;
    for (let j = 1; j < pool.length; j++) if (score(pool[j]) > score(pool[best])) best = j;
    slots[i] = pool[best].id;
    pool.splice(best, 1);
  }
}

export function repairLineup(state: GameState, clubId: ClubId, lineup: Lineup, formation: Formation): Lineup {
  const club = state.clubs[clubId];
  const ok = (id: PlayerId) => club.squad.includes(id) && state.players[id] !== undefined && isAvailable(state.players[id]);
  const slotPos = slotPositions(formation);
  const seen = new Set<PlayerId>();
  const slots: (PlayerId | null)[] = slotPos.map((_, i) => {
    const id = lineup.starters[i];
    if (id === undefined || !ok(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  const available = club.squad.map((id) => state.players[id]).filter(isAvailable);
  fillSlots(slots, slotPos, available);
  const starters = slots.filter((s): s is PlayerId => s !== null);

  const bench: PlayerId[] = [];
  for (const id of lineup.bench) {
    if (ok(id) && !starters.includes(id) && !bench.includes(id)) bench.push(id);
  }
  const rest = available
    .filter((p) => !starters.includes(p.id) && !bench.includes(p.id))
    .sort((a, b) => playerValue(b) - playerValue(a));
  if (!bench.some((id) => state.players[id].position === "GK")) {
    const gk = rest.findIndex((p) => p.position === "GK");
    if (gk >= 0) bench.unshift(rest.splice(gk, 1)[0].id);
  }
  while (bench.length < BENCH_SIZE && rest.length > 0) bench.push(rest.shift()!.id);
  return { starters, bench: bench.slice(0, BENCH_SIZE) };
}

export function autoLineup(state: GameState, clubId: ClubId, formation: Formation): Lineup {
  return repairLineup(state, clubId, { starters: [], bench: [] }, formation);
}

export function lineupsEqual(a: Lineup, b: Lineup): boolean {
  return (
    a.starters.length === b.starters.length &&
    a.bench.length === b.bench.length &&
    a.starters.every((id, i) => b.starters[i] === id) &&
    a.bench.every((id, i) => b.bench[i] === id)
  );
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/lineup.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/lineup.ts tests/engine/lineup.test.ts
git commit -m "feat(engine): Aufstellung prüfen, reparieren und automatisch erzeugen"
```

---

### Task 4: Spielplan (Kreisverfahren)

**Files:**
- Create: `src/engine/competition/schedule.ts`
- Test: `tests/engine/schedule.test.ts`

**Interfaces:**
- Consumes: `Rng` (Task 1), `newId`, `Competition`, `Match` (Task 2)
- Produces:
  - `roundRobin(clubs: ClubId[]): [ClubId, ClubId][][]` – 2·(n−1) Runden mit Paaren `[heim, gast]`
  - `createLeague(state, id, name, clubs, rng): Competition`
  - `matchesOfRound(c: Competition, round: number): Match[]`

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLeague, matchesOfRound, roundRobin } from "../../src/engine/competition/schedule";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

const clubs = Array.from({ length: 18 }, (_, i) => `c${i + 1}`);

describe("roundRobin", () => {
  const rounds = roundRobin(clubs);

  it("hat 34 Runden mit je 9 Spielen", () => {
    expect(rounds).toHaveLength(34);
    for (const r of rounds) expect(r).toHaveLength(9);
  });

  it("jeder Verein spielt genau einmal pro Runde", () => {
    for (const r of rounds) {
      const ids = r.flat();
      expect(new Set(ids).size).toBe(18);
    }
  });

  it("jede Paarung kommt genau einmal zu Hause und einmal auswärts vor", () => {
    const seen = new Map<string, number>();
    for (const r of rounds) for (const [h, a] of r) seen.set(`${h}|${a}`, (seen.get(`${h}|${a}`) ?? 0) + 1);
    for (const h of clubs)
      for (const a of clubs) {
        if (h === a) continue;
        expect(seen.get(`${h}|${a}`)).toBe(1);
      }
  });

  it("jeder Verein hat 17 Heimspiele", () => {
    for (const c of clubs) {
      const home = rounds.map((r) => r.some(([h]) => h === c));
      expect(home.filter(Boolean)).toHaveLength(17);
    }
  });

  it("lehnt eine ungerade Anzahl ab", () => {
    expect(() => roundRobin(["a", "b", "c"])).toThrow();
  });
});

describe("createLeague", () => {
  it("legt 306 Spiele mit eindeutigen IDs an", () => {
    const s = makeState([]);
    const league = createLeague(s, "L1", "1. Liga", clubs, Rng.fromSeed(1));
    expect(league.matches).toHaveLength(306);
    expect(new Set(league.matches.map((m) => m.id)).size).toBe(306);
    expect(league.rounds).toBe(34);
    expect(matchesOfRound(league, 1)).toHaveLength(9);
    expect(league.matches.every((m) => m.result === null && m.competitionId === "L1")).toBe(true);
  });
});
```

Hinweis: Die Abfolge von Heim- und Auswärtsspielen wird bewusst nicht geprüft, die Spec verlangt sie nicht.

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/schedule.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Implementieren**

`src/engine/competition/schedule.ts`:

```ts
import type { Rng } from "../rng";
import { newId, type ClubId, type Competition, type CompetitionId, type GameState, type Match } from "../model";

/** Doppeltes Kreisverfahren: Hinrunde nach Berger, Rückrunde mit getauschtem Heimrecht. */
export function roundRobin(clubs: ClubId[]): [ClubId, ClubId][][] {
  const n = clubs.length;
  if (n % 2 !== 0) throw new Error("Für den Spielplan ist eine gerade Anzahl Vereine nötig.");
  const arr = [...clubs];
  const first: [ClubId, ClubId][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [ClubId, ClubId][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      const swap = i === 0 ? r % 2 === 1 : i % 2 === 1;
      round.push(swap ? [b, a] : [a, b]);
    }
    first.push(round);
    arr.splice(1, 0, arr.pop()!);
  }
  const second = first.map((round) => round.map(([h, a]) => [a, h] as [ClubId, ClubId]));
  return [...first, ...second];
}

export function createLeague(state: GameState, id: CompetitionId, name: string, clubs: ClubId[], rng: Rng): Competition {
  const rounds = roundRobin(rng.shuffle(clubs));
  const matches: Match[] = [];
  rounds.forEach((pairs, r) => {
    for (const [home, away] of pairs) {
      matches.push({ id: newId(state, "m"), competitionId: id, round: r + 1, home, away, result: null, events: [], penalties: null });
    }
  });
  return { id, name, format: "league", clubs: [...clubs], rounds: rounds.length, matches };
}

export function matchesOfRound(c: Competition, round: number): Match[] {
  return c.matches.filter((m) => m.round === round);
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/schedule.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/competition/schedule.ts tests/engine/schedule.test.ts
git commit -m "feat(engine): Spielplan nach dem Kreisverfahren"
```

---

### Task 5: Tabelle

**Files:**
- Create: `src/engine/competition/standings.ts`
- Test: `tests/engine/standings.test.ts`

**Interfaces:**
- Consumes: `Competition`, `Match` (Task 2)
- Produces: `interface StandingRow { club; played; won; drawn; lost; goalsFor; goalsAgainst; goalDiff; points }`; `computeStandings(c: Competition): StandingRow[]`. Sortiert wird nach Punkten, dann Tordifferenz, dann erzielten Toren, dann direktem Vergleich (Punkte, dann Tordifferenz), zuletzt nach Vereins-ID.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/standings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import type { Competition, Match } from "../../src/engine/model";

function m(home: string, away: string, h: number | null, a: number | null): Match {
  return { id: `${home}${away}`, competitionId: "L", round: 1, home, away, result: h === null ? null : { home: h, away: a! }, events: [], penalties: null };
}
function league(matches: Match[]): Competition {
  return { id: "L", name: "Test", format: "league", clubs: ["a", "b", "c", "d"], rounds: 6, matches };
}

describe("computeStandings", () => {
  it("zählt Punkte, Tore und Spiele; ungespielte Spiele zählen nicht", () => {
    const t = computeStandings(league([m("a", "b", 2, 0), m("c", "d", 1, 1), m("a", "c", null, null)]));
    const a = t.find((r) => r.club === "a")!;
    expect(a).toMatchObject({ played: 1, won: 1, points: 3, goalsFor: 2, goalsAgainst: 0, goalDiff: 2 });
    const c = t.find((r) => r.club === "c")!;
    expect(c).toMatchObject({ played: 1, drawn: 1, points: 1 });
    expect(t[0].club).toBe("a");
    expect(t[3].club).toBe("b");
  });

  it("sortiert bei Punktgleichheit nach Tordifferenz, dann erzielten Toren", () => {
    const t = computeStandings(league([m("a", "d", 3, 2), m("b", "c", 1, 0), m("c", "a", 0, 0), m("d", "b", 0, 0)]));
    // a: 4 Pkt, +1, 3 Tore; b: 4 Pkt, +1, 1 Tor
    expect(t[0].club).toBe("a");
    expect(t[1].club).toBe("b");
  });

  it("nutzt den direkten Vergleich bei Gleichheit von Punkten, Differenz und Toren", () => {
    // a und b: je 3 Punkte, +0, 2 Tore; a hat b direkt geschlagen
    const t = computeStandings(league([m("a", "b", 2, 1), m("b", "c", 1, 0), m("c", "a", 1, 0)]));
    const ia = t.findIndex((r) => r.club === "a");
    const ib = t.findIndex((r) => r.club === "b");
    expect(ia).toBeLessThan(ib);
  });

  it("ohne Spiele: alle mit 0 Punkten, nach ID sortiert", () => {
    expect(computeStandings(league([])).map((r) => r.club)).toEqual(["a", "b", "c", "d"]);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/standings.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Implementieren**

`src/engine/competition/standings.ts`:

```ts
import type { ClubId, Competition } from "../model";

export interface StandingRow {
  club: ClubId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

function emptyRow(club: ClubId): StandingRow {
  return { club, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
}

function addResult(row: StandingRow, scored: number, conceded: number): void {
  row.played++;
  row.goalsFor += scored;
  row.goalsAgainst += conceded;
  row.goalDiff = row.goalsFor - row.goalsAgainst;
  if (scored > conceded) {
    row.won++;
    row.points += 3;
  } else if (scored === conceded) {
    row.drawn++;
    row.points += 1;
  } else row.lost++;
}

/** Negativ, wenn a im direkten Vergleich besser ist. */
function headToHead(c: Competition, a: ClubId, b: ClubId): number {
  const ra = emptyRow(a);
  const rb = emptyRow(b);
  for (const m of c.matches) {
    if (!m.result) continue;
    if (m.home === a && m.away === b) {
      addResult(ra, m.result.home, m.result.away);
      addResult(rb, m.result.away, m.result.home);
    } else if (m.home === b && m.away === a) {
      addResult(rb, m.result.home, m.result.away);
      addResult(ra, m.result.away, m.result.home);
    }
  }
  return rb.points - ra.points || rb.goalDiff - ra.goalDiff;
}

export function computeStandings(c: Competition): StandingRow[] {
  const rows = new Map(c.clubs.map((id) => [id, emptyRow(id)]));
  for (const m of c.matches) {
    if (!m.result) continue;
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    if (!h || !a) continue;
    addResult(h, m.result.home, m.result.away);
    addResult(a, m.result.away, m.result.home);
  }
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.goalDiff - x.goalDiff ||
      y.goalsFor - x.goalsFor ||
      headToHead(c, x.club, y.club) ||
      x.club.localeCompare(y.club),
  );
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/standings.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/competition/standings.ts tests/engine/standings.test.ts
git commit -m "feat(engine): Tabelle mit Tiebreakern"
```

---

### Task 6: Welt-Generator (Vereine und Spieler)

**Files:**
- Create: `src/engine/names.ts`
- Create: `src/engine/generator.ts`
- Test: `tests/engine/generator.test.ts`

**Interfaces:**
- Consumes: `Rng` (Task 1), Modell (Task 2), `autoLineup` (Task 3)
- Produces:
  - `generatePlayer(state, rng, clubId: ClubId | null, position, baseStrength, age?): Player` – legt den Spieler auch in `state.players` an
  - `generateWorld(seed: number): GameState` – 36 Vereine mit Kader, Aufstellung und Taktik. Die Vereine sind nach Reputation absteigend erzeugt; `competitions` und `calendar` bleiben leer, sie füllt `season.ts` (Task 9).
  - `baseStrengthFor(reputation: number): number`
  - `CLUB_COUNT = 36`

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/generator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CLUB_COUNT, generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";

describe("generateWorld", () => {
  const w = generateWorld(1234);
  const clubs = Object.values(w.clubs);

  it("ist deterministisch", () => {
    expect(JSON.stringify(generateWorld(1234))).toBe(JSON.stringify(w));
    expect(JSON.stringify(generateWorld(999))).not.toBe(JSON.stringify(w));
  });

  it("erzeugt 36 Vereine mit eindeutigen Namen", () => {
    expect(clubs).toHaveLength(CLUB_COUNT);
    expect(new Set(clubs.map((c) => c.name)).size).toBe(CLUB_COUNT);
  });

  it("jeder Verein hat 25 Spieler: 3 TW, 8 ABW, 8 MF, 6 ST", () => {
    for (const c of clubs) {
      const ps = c.squad.map((id) => w.players[id]);
      expect(ps).toHaveLength(25);
      expect(ps.filter((p) => p.position === "GK")).toHaveLength(3);
      expect(ps.filter((p) => p.position === "DF")).toHaveLength(8);
      expect(ps.filter((p) => p.position === "MF")).toHaveLength(8);
      expect(ps.filter((p) => p.position === "FW")).toHaveLength(6);
      expect(ps.every((p) => p.clubId === c.id)).toBe(true);
    }
  });

  it("Werte liegen in gültigen Bereichen", () => {
    for (const p of Object.values(w.players)) {
      expect(p.strength).toBeGreaterThanOrEqual(1);
      expect(p.strength).toBeLessThanOrEqual(99);
      expect(p.potential).toBeGreaterThanOrEqual(p.strength);
      expect(p.potential).toBeLessThanOrEqual(99);
      expect(p.age).toBeGreaterThanOrEqual(17);
      expect(p.age).toBeLessThanOrEqual(34);
      expect(p.fitness).toBe(100);
    }
    for (const c of clubs) {
      expect(c.reputation).toBeGreaterThanOrEqual(1);
      expect(c.reputation).toBeLessThanOrEqual(100);
      expect(c.colors[0]).not.toBe(c.colors[1]);
    }
  });

  it("stärkere Reputation bedeutet im Schnitt stärkere Spieler", () => {
    const sorted = [...clubs].sort((a, b) => b.reputation - a.reputation);
    const avg = (c: (typeof clubs)[number]) => c.squad.reduce((s, id) => s + w.players[id].strength, 0) / c.squad.length;
    const top = sorted.slice(0, 6).reduce((s, c) => s + avg(c), 0) / 6;
    const bottom = sorted.slice(-6).reduce((s, c) => s + avg(c), 0) / 6;
    expect(top - bottom).toBeGreaterThan(8);
  });

  it("jeder Verein hat eine gültige Aufstellung", () => {
    for (const c of clubs) expect(validateLineup(w, c.id, c.lineup)).toBeNull();
  });

  it("ist reines JSON", () => {
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/generator.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Namenslisten anlegen**

`src/engine/names.ts`:

```ts
/** Fiktive Ortsnamen – mindestens 36 nötig. */
export const TOWNS = [
  "Rheinau", "Hafenstadt", "Talheim", "Bergwald", "Lindenau", "Kohlberg", "Mühlbach", "Altfeld",
  "Ostheim", "Seeburg", "Eichtal", "Brückendorf", "Sandau", "Hohenried", "Kaltenbach", "Grünstadt",
  "Wiesental", "Kieselgrund", "Falkenau", "Rosenheide", "Birkenhain", "Wolfsgrund", "Hirschtal", "Kranichsee",
  "Silberbach", "Eisenhütte", "Weidenau", "Sonnenfeld", "Burgstetten", "Moorfelden", "Tannenhain", "Lerchenau",
  "Ahornstadt", "Nordhafen", "Schwarzwasser", "Goldau", "Ulmenried", "Westerkamp", "Felsenstein", "Krähenwinkel",
];

export const CLUB_PREFIXES = [
  "FC", "SV", "TSV", "VfB", "VfL", "SpVgg", "Borussia", "Eintracht", "Union", "Fortuna",
  "Germania", "Viktoria", "Alemannia", "Rot-Weiß", "Blau-Weiß", "Arminia", "TuS", "SC", "1. FC", "Sportfreunde",
];

export const FIRST_NAMES = [
  "Andreas", "Bernd", "Christian", "Daniel", "Dirk", "Frank", "Jens", "Jürgen", "Kai", "Lars",
  "Marco", "Markus", "Martin", "Michael", "Oliver", "Peter", "Ralf", "Sascha", "Stefan", "Thomas",
  "Thorsten", "Uwe", "Holger", "Sven", "Jörg", "Matthias", "Tobias", "Florian", "Jan", "Timo",
  "Mehmet", "Emre", "Luca", "Marko", "Ivan", "Pavel", "Kwame", "Samuel", "Diego", "João",
  "Erik", "Lukas", "Nils", "Moritz", "Felix", "Jonas", "Niklas", "Dennis", "Benjamin", "Patrick",
];

export const LAST_NAMES = [
  "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
  "Koch", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger",
  "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Krause", "Meier", "Lehmann", "Schmid", "Schulze",
  "Maier", "Köhler", "Herrmann", "König", "Walter", "Mayer", "Huber", "Kaiser", "Fuchs", "Peters",
  "Lang", "Scholz", "Möller", "Weiß", "Jung", "Hahn", "Vogel", "Friedrich", "Keller", "Günther",
  "Frank", "Berger", "Winkler", "Roth", "Beck", "Lorenz", "Baumann", "Franke", "Albrecht", "Ludwig",
  "Krämer", "Okafor", "Yılmaz", "Kowalski", "Novak", "Petrović", "Silva", "Mensah", "Andersen", "Lindqvist",
  "Bauer", "Brandt", "Engel", "Busch", "Pohl", "Sommer", "Haas", "Graf", "Seidel", "Heinrich",
];

/** Retro-Vereinsfarben (VGA-nah) */
export const CLUB_COLORS = [
  "#c0392b", "#1f4e9c", "#f2f2f2", "#111111", "#f1c40f",
  "#27ae60", "#8e44ad", "#e67e22", "#7fb3d5", "#7b241c",
];
```

- [ ] **Step 4: Generator implementieren**

`src/engine/generator.ts`:

```ts
import { autoLineup } from "./lineup";
import {
  newId,
  type Club,
  type ClubId,
  type CrestPattern,
  type GameState,
  type Player,
  type Position,
} from "./model";
import { CLUB_COLORS, CLUB_PREFIXES, FIRST_NAMES, LAST_NAMES, TOWNS } from "./names";
import { Rng } from "./rng";

export const CLUB_COUNT = 36;
const SQUAD_PLAN: [Position, number][] = [["GK", 3], ["DF", 8], ["MF", 8], ["FW", 6]];
const CRESTS: CrestPattern[] = ["plain", "stripes", "sash", "split", "hoops"];

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Reputation 92 → ca. 79, Reputation 30 → ca. 51. */
export function baseStrengthFor(reputation: number): number {
  return 38 + reputation * 0.45;
}

export function generatePlayer(
  state: GameState,
  rng: Rng,
  clubId: ClubId | null,
  position: Position,
  baseStrength: number,
  age = rng.int(17, 34),
): Player {
  let strength = rng.normal(baseStrength, 5);
  if (age <= 20) strength -= 6;
  else if (age >= 32) strength -= 3;
  strength = clamp(strength, 20, 95);
  let potential = strength;
  if (age <= 23) potential = strength + rng.int(2, 18);
  else if (age <= 28) potential = strength + rng.int(0, 5);
  const p: Player = {
    id: newId(state, "p"),
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    age,
    position,
    strength,
    potential: clamp(potential, strength, 99),
    form: 0,
    fitness: 100,
    injury: null,
    suspension: null,
    yellowCards: 0,
    clubId,
    stats: { apps: 0, goals: 0 },
  };
  state.players[p.id] = p;
  return p;
}

function clubName(rng: Rng, town: string): string {
  const prefix = rng.pick(CLUB_PREFIXES);
  const suffix = rng.chance(0.3) ? ` ${String(rng.int(0, 99)).padStart(2, "0")}` : "";
  return `${prefix} ${town}${suffix}`;
}

export function generateWorld(seed: number): GameState {
  const rng = Rng.fromSeed(seed);
  const state: GameState = {
    version: 1,
    rngState: rng.state(),
    season: 1,
    calendar: [],
    calendarIndex: 0,
    managers: [],
    clubs: {},
    players: {},
    competitions: {},
    history: [],
    nextId: 1,
  };
  const towns = rng.shuffle(TOWNS).slice(0, CLUB_COUNT);
  for (let i = 0; i < CLUB_COUNT; i++) {
    const reputation = clamp(Math.round(92 - i * 1.8 + rng.int(-3, 3)), 1, 100);
    const [c1, c2] = rng.shuffle(CLUB_COLORS);
    const club: Club = {
      id: newId(state, "c"),
      name: clubName(rng, towns[i]),
      shortName: towns[i],
      colors: [c1, c2],
      crest: rng.pick(CRESTS),
      reputation,
      managerId: null,
      squad: [],
      lineup: { starters: [], bench: [] },
      tactics: { formation: "4-4-2", style: "normal", hardness: "normal" },
    };
    state.clubs[club.id] = club;
    const base = baseStrengthFor(reputation);
    for (const [pos, n] of SQUAD_PLAN) {
      for (let k = 0; k < n; k++) club.squad.push(generatePlayer(state, rng, club.id, pos, base).id);
    }
    club.lineup = autoLineup(state, club.id, club.tactics.formation);
  }
  state.rngState = rng.state();
  return state;
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run tests/engine/generator.test.ts`
Expected: alle Tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/names.ts src/engine/generator.ts tests/engine/generator.test.ts
git commit -m "feat(engine): Welt-Generator mit fiktiven Vereinen und Spielern"
```

---

### Task 7: Effektive Spieler- und Teamstärke

**Files:**
- Create: `src/engine/match/strength.ts`
- Test: `tests/engine/strength.test.ts`

**Interfaces:**
- Consumes: `positionFactor` (Task 3), Modell (Task 2)
- Produces:
  - `HOME_FACTOR = 1.07`
  - `interface PitchPlayer { id: PlayerId; slot: Position }`
  - `interface TeamStrength { defense: number; midfield: number; attack: number; keeper: number }`
  - `effectiveStrength(p: Player, slot: Position, fitness: number): number`
  - `teamStrength(players: Record<PlayerId, Player>, pitch: PitchPlayer[], fitness: Record<PlayerId, number>, tactics: Tactics, home: boolean, bonus?: number): TeamStrength`

**Formeln** (Startwerte, in Task 8 kalibriert):
- Jeder Mannschaftsteil ist der Mittelwert seiner effektiven Stärken × `(1 + 0,1 × (Anzahl − Referenz))`. Die Referenz ist DF 4, MF 4, FW 2. Ein leerer Mannschaftsteil zählt mit 10.
- `defense = 0,85 × Abwehr + 0,15 × Torwart`
- Spielweise und Härte wie unter Global Constraints.
- Pro fehlendem Spieler (unter 11) alles ×0,95.
- Heim ×1,07, `bonus` (Plan 3: Taktiktraining) multipliziert alles.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/strength.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { autoLineup } from "../../src/engine/lineup";
import { HOME_FACTOR, effectiveStrength, teamStrength, type PitchPlayer } from "../../src/engine/match/strength";
import { slotPositions, type Tactics } from "../../src/engine/model";
import { makePlayer, makeState } from "./fixtures";

const normal: Tactics = { formation: "4-4-2", style: "normal", hardness: "normal" };

function pitchOf(formation: Tactics["formation"]) {
  const s = makeState([{ id: "c1", strength: 70 }]);
  const l = autoLineup(s, "c1", formation);
  const slots = slotPositions(formation);
  const pitch: PitchPlayer[] = l.starters.map((id, i) => ({ id, slot: slots[i] }));
  return { s, pitch };
}

describe("effectiveStrength", () => {
  it("verrechnet Positionsfaktor, Form und Kondition", () => {
    const p = makePlayer("a", "DF", 80);
    expect(effectiveStrength(p, "DF", 100)).toBeCloseTo(80);
    expect(effectiveStrength(p, "MF", 100)).toBeCloseTo(68);
    expect(effectiveStrength({ ...p, form: 3 }, "DF", 100)).toBeCloseTo(80 * 1.09);
    expect(effectiveStrength(p, "DF", 0)).toBeCloseTo(56);
  });
});

describe("teamStrength", () => {
  it("4-4-2 mit gleich starken Spielern: alle Teile gleich der Spielerstärke", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const t = teamStrength(s.players, pitch, {}, normal, false);
    expect(t.attack).toBeCloseTo(70);
    expect(t.midfield).toBeCloseTo(70);
    expect(t.defense).toBeCloseTo(70);
    expect(t.keeper).toBeCloseTo(70);
  });

  it("Heimvorteil multipliziert alle Teile", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const t = teamStrength(s.players, pitch, {}, normal, true);
    expect(t.attack).toBeCloseTo(70 * HOME_FACTOR);
    expect(t.defense).toBeCloseTo(70 * HOME_FACTOR);
  });

  it("offensiv stärkt den Angriff und schwächt die Abwehr, hart stärkt das Mittelfeld", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const off = teamStrength(s.players, pitch, {}, { ...normal, style: "offensive", hardness: "hard" }, false);
    expect(off.attack).toBeCloseTo(77);
    expect(off.defense).toBeCloseTo(63);
    expect(off.midfield).toBeCloseTo(73.5);
    const def = teamStrength(s.players, pitch, {}, { ...normal, style: "defensive" }, false);
    expect(def.attack).toBeCloseTo(63);
    expect(def.defense).toBeCloseTo(77);
  });

  it("die Formation verschiebt die Gewichte", () => {
    const { s, pitch } = pitchOf("5-3-2");
    const t = teamStrength(s.players, pitch, {}, { ...normal, formation: "5-3-2" }, false);
    expect(t.defense).toBeGreaterThan(70);
    expect(t.midfield).toBeLessThan(70);
  });

  it("ein fehlender Spieler schwächt das Team", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const full = teamStrength(s.players, pitch, {}, normal, false);
    const ten = teamStrength(s.players, pitch.slice(0, 10), {}, normal, false);
    expect(ten.midfield).toBeLessThan(full.midfield);
    expect(ten.attack).toBeLessThan(full.attack);
  });

  it("nutzt die Live-Kondition aus fitness, sonst die Spielerkondition", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const tired = Object.fromEntries(pitch.map((pp) => [pp.id, 0]));
    expect(teamStrength(s.players, pitch, tired, normal, false).attack).toBeCloseTo(49);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/strength.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Implementieren**

`src/engine/match/strength.ts`:

```ts
import { positionFactor } from "../lineup";
import type { Player, PlayerId, Position, Tactics } from "../model";

export const HOME_FACTOR = 1.07;
const REFERENCE = { DF: 4, MF: 4, FW: 2 } as const;
const EMPTY_UNIT = 10;
const SHORT_HANDED = 0.95;

export interface PitchPlayer {
  id: PlayerId;
  slot: Position;
}

export interface TeamStrength {
  defense: number;
  midfield: number;
  attack: number;
  keeper: number;
}

export function effectiveStrength(p: Player, slot: Position, fitness: number): number {
  return p.strength * positionFactor(p.position, slot) * (1 + 0.03 * p.form) * (0.7 + 0.3 * (fitness / 100));
}

export function teamStrength(
  players: Record<PlayerId, Player>,
  pitch: PitchPlayer[],
  fitness: Record<PlayerId, number>,
  tactics: Tactics,
  home: boolean,
  bonus = 1,
): TeamStrength {
  const by: Record<Position, number[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const pp of pitch) {
    const p = players[pp.id];
    by[pp.slot].push(effectiveStrength(p, pp.slot, fitness[pp.id] ?? p.fitness));
  }
  const unit = (pos: "DF" | "MF" | "FW") => {
    const a = by[pos];
    if (a.length === 0) return EMPTY_UNIT;
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    return mean * (1 + 0.1 * (a.length - REFERENCE[pos]));
  };
  const keeper = by.GK.length > 0 ? by.GK[0] : EMPTY_UNIT;
  let defense = 0.85 * unit("DF") + 0.15 * keeper;
  let midfield = unit("MF");
  let attack = unit("FW");
  if (tactics.style === "offensive") {
    attack *= 1.1;
    defense *= 0.9;
  } else if (tactics.style === "defensive") {
    attack *= 0.9;
    defense *= 1.1;
  }
  if (tactics.hardness === "hard") midfield *= 1.05;
  const f = (home ? HOME_FACTOR : 1) * bonus * Math.pow(SHORT_HANDED, Math.max(0, 11 - pitch.length));
  return { defense: defense * f, midfield: midfield * f, attack: attack * f, keeper: keeper * f };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/strength.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/match/strength.ts tests/engine/strength.test.ts
git commit -m "feat(engine): effektive Spieler- und Teamstärke"
```

---

### Task 8: Spielsimulation (Halbzeiten, Karten, Verletzungen, Wechsel, Elfmeterschießen)

**Files:**
- Create: `src/engine/match/simulate.ts`
- Test: `tests/engine/simulate.test.ts`
- Test: `tests/engine/calibration.test.ts`

**Interfaces:**
- Consumes: `Rng` (Task 1), Modell (Task 2), `fillSlots`, `playerValue`, `positionFactor` (Task 3), `teamStrength`, `effectiveStrength`, `HOME_FACTOR`, `PitchPlayer` (Task 7)
- Produces:
  - `SIM` – Konstanten
  - `type Side = "home" | "away"`
  - `interface LiveSide { club; tactics; pitch: PitchPlayer[]; bench: PlayerId[]; subsUsed; fitness: Record<PlayerId, number>; booked: PlayerId[]; sentOff: PlayerId[]; injured: PlayerId[]; played: PlayerId[]; goals: number; bonus: number }`
  - `interface LiveMatch { matchId; competitionId; home: LiveSide; away: LiveSide; events: MatchEvent[]; minute: number }`
  - `startMatch(state, match: Match): LiveMatch` – aus der aktuellen Vereinsaufstellung (die vorher repariert sein muss)
  - `simulateHalf(state, live, half: 1 | 2, rng): void` – verändert `live`
  - `substitute(state, live, side, outId, inId): string | null` – verändert `live` nur, wenn kein Fehler auftritt
  - `changeTactics(state, live, side, tactics: Partial<Tactics>): void` – bei neuer Formation werden die Spieler neu auf die Plätze verteilt
  - `sendOff(state, live, side, playerId, minute, secondYellow): void`
  - `finalScore(live): Score`
  - `penaltyShootout(rng): Score` – nie unentschieden
  - `bestBenchFor(state, s: LiveSide, slot: Position): PlayerId | null`
  - `sideOf(live, side): LiveSide`

**Kalibrierte Konstanten** (mit einem Prototyp ermittelt; ohne Karten und Verletzungen ergaben sie: gleich starke Teams 2,85 Tore, H/U/A ≈ 46/24/30 %, ein 10 Punkte schwächeres Team gewinnt ≈ 20 %):

| Konstante | Wert | Bedeutung |
|---|---|---|
| `baseChance` | 0,105 | Chance pro Minute bei Ballbesitz, wenn Angriff = Abwehr |
| `chanceExp` | 1,0 | Exponent auf Angriff/Abwehr |
| `baseGoal` | 0,30 | Torquote einer Chance, wenn Schütze = Torwart |
| `goalExp` | 0,5 | Exponent auf Schütze/Torwart |
| `yellowPerMin` | 0,0194 | pro Team und Minute (×0,7 fair, ×1,5 hart) |
| `redPerMin` | 0,0009 | glatt Rot, pro Team und Minute (gleiche Härtefaktoren) |
| `injuryPerMin` | 0,00167 | pro Team und Minute (× Härtefaktor des **Gegners**) |
| `fitnessDrain` | 0,28 | Konditionsverlust pro Minute (×1,2 hart, ×1,1 offensiv) |

Ein Schütze wird gewichtet nach Platz (ST 5, MF 2, ABW 0,5, TW 0) × Stärke ausgewählt.

- [ ] **Step 1: Failing Funktionstests schreiben**

`tests/engine/simulate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { autoLineup } from "../../src/engine/lineup";
import {
  changeTactics,
  finalScore,
  penaltyShootout,
  sendOff,
  simulateHalf,
  startMatch,
  substitute,
  type LiveMatch,
} from "../../src/engine/match/simulate";
import type { GameState, Match } from "../../src/engine/model";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

function setup(hs = 70, as = 70): { s: GameState; match: Match } {
  const s = makeState([{ id: "h", strength: hs }, { id: "a", strength: as }]);
  for (const id of ["h", "a"]) s.clubs[id].lineup = autoLineup(s, id, "4-4-2");
  const match: Match = { id: "m1", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
  return { s, match };
}

function playFull(s: GameState, match: Match, seed: number): LiveMatch {
  const rng = Rng.fromSeed(seed);
  const live = startMatch(s, match);
  simulateHalf(s, live, 1, rng);
  simulateHalf(s, live, 2, rng);
  return live;
}

describe("startMatch", () => {
  it("übernimmt Startelf, Bank, Taktik und Kondition", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    expect(live.home.pitch).toHaveLength(11);
    expect(live.home.pitch[0].slot).toBe("GK");
    expect(live.home.bench).toEqual(s.clubs.h.lineup.bench);
    expect(live.home.fitness[live.home.pitch[3].id]).toBe(100);
    expect(live.home.played).toHaveLength(11);
  });
});

describe("simulateHalf", () => {
  it("ist deterministisch", () => {
    const { s, match } = setup();
    expect(JSON.stringify(playFull(s, match, 5))).toBe(JSON.stringify(playFull(s, match, 5)));
  });

  it("die 1. Halbzeit endet in Minute 45, die 2. in Minute 90", () => {
    const { s, match } = setup();
    const rng = Rng.fromSeed(1);
    const live = startMatch(s, match);
    simulateHalf(s, live, 1, rng);
    expect(live.minute).toBe(45);
    expect(live.events.every((e) => e.minute <= 45)).toBe(true);
    simulateHalf(s, live, 2, rng);
    expect(live.minute).toBe(90);
  });

  it("Torereignisse passen zum Ergebnis, Torschützen standen auf dem Platz", () => {
    const { s, match } = setup();
    for (let seed = 1; seed <= 30; seed++) {
      const live = playFull(s, match, seed);
      const score = finalScore(live);
      const goals = live.events.filter((e) => e.type === "goal");
      expect(goals.filter((g) => g.club === "h")).toHaveLength(score.home);
      expect(goals.filter((g) => g.club === "a")).toHaveLength(score.away);
      for (const g of goals) {
        if (g.type !== "goal") continue;
        const side = g.club === "h" ? live.home : live.away;
        expect(side.played).toContain(g.player);
      }
    }
  });

  it("verändert den Spielstand nicht", () => {
    const { s, match } = setup();
    const before = JSON.stringify(s);
    playFull(s, match, 3);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("die Kondition sinkt im Lauf des Spiels", () => {
    const { s, match } = setup();
    const live = playFull(s, match, 2);
    const someone = live.home.pitch.find((pp) => s.clubs.h.lineup.starters.includes(pp.id))!;
    expect(live.home.fitness[someone.id]).toBeLessThan(80);
    expect(live.home.fitness[someone.id]).toBeGreaterThan(60);
  });

  it("nie mehr als 11 Spieler auf dem Platz, nie mehr als 5 Wechsel", () => {
    const { s, match } = setup();
    for (let seed = 1; seed <= 200; seed++) {
      const live = playFull(s, match, seed);
      for (const side of [live.home, live.away]) {
        expect(side.pitch.length).toBeLessThanOrEqual(11);
        expect(side.subsUsed).toBeLessThanOrEqual(5);
        expect(side.pitch.filter((pp) => pp.slot === "GK").length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("substitute", () => {
  it("tauscht einen Spieler auf demselben Platz aus", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    const out = live.home.pitch[5];
    const inId = live.home.bench[1];
    expect(substitute(s, live, "home", out.id, inId)).toBeNull();
    expect(live.home.pitch[5]).toEqual({ id: inId, slot: out.slot });
    expect(live.home.bench).not.toContain(inId);
    expect(live.home.subsUsed).toBe(1);
    expect(live.home.played).toContain(inId);
    expect(live.events.at(-1)).toMatchObject({ type: "sub", out: out.id, in: inId });
  });

  it("lehnt ungültige Wechsel ab und ändert dann nichts", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    const before = JSON.stringify(live);
    expect(substitute(s, live, "home", "gibts-nicht", live.home.bench[0])).toMatch(/nicht auf dem Platz/);
    expect(substitute(s, live, "home", live.home.pitch[1].id, "a-MF1")).toMatch(/nicht auf der Bank/);
    expect(JSON.stringify(live)).toBe(before);
  });

  it("ein ausgewechselter Spieler kann nicht zurückkommen, der 6. Wechsel wird abgelehnt", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    const firstOut = live.home.pitch[10].id;
    for (let i = 0; i < 5; i++) {
      expect(substitute(s, live, "home", live.home.pitch[10 - i].id, live.home.bench[0])).toBeNull();
    }
    expect(live.home.bench).not.toContain(firstOut);
    expect(substitute(s, live, "home", live.home.pitch[1].id, live.home.bench[0])).toMatch(/5 Wechsel/);
  });
});

describe("sendOff", () => {
  it("Torwart vom Platz mit freiem Wechsel: Ersatztorwart kommt für einen Feldspieler", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    sendOff(s, live, "home", live.home.pitch[0].id, 30, false);
    expect(live.home.pitch).toHaveLength(10);
    const gk = live.home.pitch.find((pp) => pp.slot === "GK")!;
    expect(s.players[gk.id].position).toBe("GK");
    expect(live.home.subsUsed).toBe(1);
  });

  it("Torwart vom Platz ohne Wechsel: ein Feldspieler geht ins Tor", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    live.home.subsUsed = 5;
    sendOff(s, live, "home", live.home.pitch[0].id, 80, false);
    expect(live.home.pitch).toHaveLength(10);
    const gk = live.home.pitch.find((pp) => pp.slot === "GK")!;
    expect(s.players[gk.id].position).not.toBe("GK");
  });
});

describe("changeTactics", () => {
  it("verteilt die Spieler bei neuer Formation passend um", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    changeTactics(s, live, "home", { formation: "4-3-3", style: "offensive" });
    expect(live.home.tactics.formation).toBe("4-3-3");
    expect(live.home.tactics.style).toBe("offensive");
    expect(live.home.pitch.filter((pp) => pp.slot === "FW")).toHaveLength(3);
    expect(live.home.pitch.filter((pp) => pp.slot === "GK")).toHaveLength(1);
    expect(new Set(live.home.pitch.map((pp) => pp.id)).size).toBe(11);
  });

  it("mit 10 Spielern fällt ein Sturmplatz weg", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    live.home.pitch.splice(5, 1);
    changeTactics(s, live, "home", { formation: "4-3-3" });
    expect(live.home.pitch).toHaveLength(10);
    expect(live.home.pitch.filter((pp) => pp.slot === "FW")).toHaveLength(2);
  });
});

describe("penaltyShootout", () => {
  it("endet nie unentschieden", () => {
    const rng = Rng.fromSeed(1);
    for (let i = 0; i < 500; i++) {
      const p = penaltyShootout(rng);
      expect(p.home).not.toBe(p.away);
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/simulate.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Simulation implementieren**

`src/engine/match/simulate.ts`:

```ts
import { fillSlots, playerValue, positionFactor } from "../lineup";
import {
  MAX_SUBS,
  slotPositions,
  type ClubId,
  type CompetitionId,
  type GameState,
  type Hardness,
  type Match,
  type MatchEvent,
  type MatchId,
  type PlayerId,
  type Position,
  type Score,
  type Tactics,
} from "../model";
import type { Rng } from "../rng";
import { HOME_FACTOR, effectiveStrength, teamStrength, type PitchPlayer, type TeamStrength } from "./strength";

export const SIM = {
  baseChance: 0.105,
  chanceExp: 1,
  baseGoal: 0.3,
  goalExp: 0.5,
  minGoal: 0.05,
  maxGoal: 0.8,
  yellowPerMin: 0.0194,
  redPerMin: 0.0009,
  injuryPerMin: 0.00167,
  fitnessDrain: 0.28,
};
const HARDNESS_FACTOR: Record<Hardness, number> = { fair: 0.7, normal: 1, hard: 1.5 };
const SHOOT_WEIGHT: Record<Position, number> = { GK: 0, DF: 0.5, MF: 2, FW: 5 };

export type Side = "home" | "away";

export interface LiveSide {
  club: ClubId;
  tactics: Tactics;
  pitch: PitchPlayer[];
  bench: PlayerId[];
  subsUsed: number;
  fitness: Record<PlayerId, number>;
  booked: PlayerId[];
  sentOff: PlayerId[];
  injured: PlayerId[];
  /** alle, die eingesetzt wurden (Startelf + Eingewechselte) */
  played: PlayerId[];
  goals: number;
  /** Multiplikator auf alle Mannschaftsteile (Plan 3: Taktiktraining) */
  bonus: number;
}

export interface LiveMatch {
  matchId: MatchId;
  competitionId: CompetitionId;
  home: LiveSide;
  away: LiveSide;
  events: MatchEvent[];
  minute: number;
}

function liveSide(state: GameState, clubId: ClubId): LiveSide {
  const club = state.clubs[clubId];
  const slots = slotPositions(club.tactics.formation);
  const pitch = club.lineup.starters.map((id, i) => ({ id, slot: slots[i] }));
  const fitness: Record<PlayerId, number> = {};
  for (const id of [...club.lineup.starters, ...club.lineup.bench]) fitness[id] = state.players[id].fitness;
  return {
    club: clubId,
    tactics: { ...club.tactics },
    pitch,
    bench: [...club.lineup.bench],
    subsUsed: 0,
    fitness,
    booked: [],
    sentOff: [],
    injured: [],
    played: [...club.lineup.starters],
    goals: 0,
    bonus: 1,
  };
}

export function startMatch(state: GameState, match: Match): LiveMatch {
  return {
    matchId: match.id,
    competitionId: match.competitionId,
    home: liveSide(state, match.home),
    away: liveSide(state, match.away),
    events: [],
    minute: 0,
  };
}

export function sideOf(live: LiveMatch, side: Side): LiveSide {
  return side === "home" ? live.home : live.away;
}

function strengthOf(state: GameState, s: LiveSide, home: boolean): TeamStrength {
  return teamStrength(state.players, s.pitch, s.fitness, s.tactics, home, s.bonus);
}

export function bestBenchFor(state: GameState, s: LiveSide, slot: Position): PlayerId | null {
  let best: PlayerId | null = null;
  let bestScore = -Infinity;
  for (const id of s.bench) {
    const p = state.players[id];
    const score = playerValue(p) * positionFactor(p.position, slot);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function bringOn(live: LiveMatch, s: LiveSide, slot: Position, inId: PlayerId, outId: PlayerId, minute: number): void {
  s.bench = s.bench.filter((id) => id !== inId);
  s.pitch.push({ id: inId, slot });
  s.subsUsed++;
  s.played.push(inId);
  live.events.push({ minute, type: "sub", club: s.club, out: outId, in: inId });
}

/** Sorgt dafür, dass jemand im Tor steht. */
function ensureKeeper(state: GameState, live: LiveMatch, s: LiveSide, minute: number): void {
  if (s.pitch.length === 0 || s.pitch.some((pp) => pp.slot === "GK")) return;
  const benchGk = s.bench.find((id) => state.players[id].position === "GK");
  const weakestOutfield = () => {
    let idx = 0;
    for (let i = 1; i < s.pitch.length; i++) {
      const a = s.pitch[i];
      const b = s.pitch[idx];
      if (effectiveStrength(state.players[a.id], a.slot, s.fitness[a.id]) < effectiveStrength(state.players[b.id], b.slot, s.fitness[b.id])) idx = i;
    }
    return idx;
  };
  if (s.subsUsed < MAX_SUBS && benchGk && s.pitch.length > 1) {
    const out = s.pitch.splice(weakestOutfield(), 1)[0];
    bringOn(live, s, "GK", benchGk, out.id, minute);
    return;
  }
  s.pitch[weakestOutfield()].slot = "GK";
}

export function sendOff(state: GameState, live: LiveMatch, side: Side, playerId: PlayerId, minute: number, secondYellow: boolean): void {
  const s = sideOf(live, side);
  s.pitch = s.pitch.filter((pp) => pp.id !== playerId);
  s.sentOff.push(playerId);
  live.events.push({ minute, type: "red", club: s.club, player: playerId, secondYellow });
  ensureKeeper(state, live, s, minute);
}

function injure(state: GameState, live: LiveMatch, s: LiveSide, playerId: PlayerId, minute: number): void {
  const idx = s.pitch.findIndex((pp) => pp.id === playerId);
  const slot = s.pitch[idx].slot;
  s.pitch.splice(idx, 1);
  s.injured.push(playerId);
  live.events.push({ minute, type: "injury", club: s.club, player: playerId });
  if (s.subsUsed < MAX_SUBS) {
    const inId = bestBenchFor(state, s, slot);
    if (inId) {
      bringOn(live, s, slot, inId, playerId, minute);
      return;
    }
  }
  ensureKeeper(state, live, s, minute);
}

function drainFitness(s: LiveSide): void {
  const f = (s.tactics.hardness === "hard" ? 1.2 : 1) * (s.tactics.style === "offensive" ? 1.1 : 1);
  for (const pp of s.pitch) s.fitness[pp.id] = Math.max(0, s.fitness[pp.id] - SIM.fitnessDrain * f);
}

function attack(state: GameState, live: LiveMatch, att: LiveSide, attS: TeamStrength, defS: TeamStrength, home: boolean, minute: number, rng: Rng): void {
  if (!rng.chance(SIM.baseChance * Math.pow(attS.attack / defS.defense, SIM.chanceExp))) return;
  const shooters = att.pitch.filter((pp) => SHOOT_WEIGHT[pp.slot] > 0);
  if (shooters.length === 0) return;
  const shooter = rng.weighted(shooters, (pp) => SHOOT_WEIGHT[pp.slot] * state.players[pp.id].strength);
  const shot = effectiveStrength(state.players[shooter.id], shooter.slot, att.fitness[shooter.id]) * (home ? HOME_FACTOR : 1) * att.bonus;
  const pGoal = Math.min(SIM.maxGoal, Math.max(SIM.minGoal, SIM.baseGoal * Math.pow(shot / Math.max(defS.keeper, 10), SIM.goalExp)));
  if (rng.chance(pGoal)) {
    att.goals++;
    live.events.push({ minute, type: "goal", club: att.club, player: shooter.id });
  }
}

function discipline(state: GameState, live: LiveMatch, side: Side, minute: number, rng: Rng): void {
  const s = sideOf(live, side);
  const other = sideOf(live, side === "home" ? "away" : "home");
  const hf = HARDNESS_FACTOR[s.tactics.hardness];
  if (s.pitch.length > 0 && rng.chance(SIM.yellowPerMin * hf)) {
    const p = rng.pick(s.pitch).id;
    if (s.booked.includes(p)) sendOff(state, live, side, p, minute, true);
    else {
      s.booked.push(p);
      live.events.push({ minute, type: "yellow", club: s.club, player: p });
    }
  }
  if (s.pitch.length > 0 && rng.chance(SIM.redPerMin * hf)) sendOff(state, live, side, rng.pick(s.pitch).id, minute, false);
  if (s.pitch.length > 0 && rng.chance(SIM.injuryPerMin * HARDNESS_FACTOR[other.tactics.hardness])) {
    injure(state, live, s, rng.pick(s.pitch).id, minute);
  }
}

function minuteStep(state: GameState, live: LiveMatch, minute: number, rng: Rng): void {
  drainFitness(live.home);
  drainFitness(live.away);
  const hs = strengthOf(state, live.home, true);
  const as = strengthOf(state, live.away, false);
  if (rng.chance(hs.midfield / (hs.midfield + as.midfield))) attack(state, live, live.home, hs, as, true, minute, rng);
  else attack(state, live, live.away, as, hs, false, minute, rng);
  discipline(state, live, "home", minute, rng);
  discipline(state, live, "away", minute, rng);
}

export function simulateHalf(state: GameState, live: LiveMatch, half: 1 | 2, rng: Rng): void {
  const from = half === 1 ? 1 : 46;
  const to = half === 1 ? 45 : 90;
  for (let m = from; m <= to; m++) {
    live.minute = m;
    minuteStep(state, live, m, rng);
  }
}

export function substitute(state: GameState, live: LiveMatch, side: Side, outId: PlayerId, inId: PlayerId): string | null {
  const s = sideOf(live, side);
  if (s.subsUsed >= MAX_SUBS) return `Alle ${MAX_SUBS} Wechsel sind aufgebraucht.`;
  const idx = s.pitch.findIndex((pp) => pp.id === outId);
  if (idx < 0) return "Der Spieler steht nicht auf dem Platz.";
  if (!s.bench.includes(inId)) return "Der Spieler sitzt nicht auf der Bank.";
  const slot = s.pitch[idx].slot;
  s.bench = s.bench.filter((id) => id !== inId);
  s.pitch[idx] = { id: inId, slot };
  s.subsUsed++;
  s.played.push(inId);
  live.events.push({ minute: live.minute, type: "sub", club: s.club, out: outId, in: inId });
  return null;
}

const DROP_ORDER: Position[] = ["FW", "MF", "DF"];

export function changeTactics(state: GameState, live: LiveMatch, side: Side, tactics: Partial<Tactics>): void {
  const s = sideOf(live, side);
  const formationChanged = tactics.formation !== undefined && tactics.formation !== s.tactics.formation;
  s.tactics = { ...s.tactics, ...tactics };
  if (!formationChanged) return;
  const slotPos = slotPositions(s.tactics.formation);
  while (slotPos.length > s.pitch.length) {
    const drop = DROP_ORDER.find((pos) => slotPos.lastIndexOf(pos) > 0)!;
    slotPos.splice(slotPos.lastIndexOf(drop), 1);
  }
  const keeper = s.pitch.find((pp) => pp.slot === "GK");
  const slots: (PlayerId | null)[] = slotPos.map((pos) => (pos === "GK" && keeper ? keeper.id : null));
  fillSlots(slots, slotPos, s.pitch.map((pp) => state.players[pp.id]));
  s.pitch = slots.map((id, i) => ({ id: id!, slot: slotPos[i] }));
}

export function finalScore(live: LiveMatch): Score {
  return { home: live.home.goals, away: live.away.goals };
}

export function penaltyShootout(rng: Rng): Score {
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.chance(0.75)) home++;
    if (rng.chance(0.75)) away++;
  }
  while (home === away) {
    if (rng.chance(0.75)) home++;
    if (rng.chance(0.75)) away++;
  }
  return { home, away };
}
```

Anmerkung zu `changeTactics`: `fillSlots` setzt beim Torwart-Platz bevorzugt den bisherigen Torwart, weil dieser vorbelegt ist. Die übrigen Plätze werden nach passender Position und Wert vergeben.

- [ ] **Step 4: Funktionstests laufen lassen**

Run: `npx vitest run tests/engine/simulate.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Failing Kalibrierungstest schreiben**

`tests/engine/calibration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { autoLineup } from "../../src/engine/lineup";
import { finalScore, simulateHalf, startMatch } from "../../src/engine/match/simulate";
import type { Match } from "../../src/engine/model";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

function series(homeStrength: number, awayStrength: number, n: number, seed: number) {
  const s = makeState([{ id: "h", strength: homeStrength }, { id: "a", strength: awayStrength }]);
  for (const id of ["h", "a"]) s.clubs[id].lineup = autoLineup(s, id, "4-4-2");
  const match: Match = { id: "m", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
  const rng = Rng.fromSeed(seed);
  let goals = 0, home = 0, draw = 0, away = 0;
  for (let i = 0; i < n; i++) {
    const live = startMatch(s, match);
    simulateHalf(s, live, 1, rng);
    simulateHalf(s, live, 2, rng);
    const r = finalScore(live);
    goals += r.home + r.away;
    if (r.home > r.away) home++;
    else if (r.home === r.away) draw++;
    else away++;
  }
  return { goals: goals / n, home: home / n, draw: draw / n, away: away / n };
}

describe("Kalibrierung (Spec 7.3)", () => {
  it("gleich starke Teams: 2,6–3,0 Tore, H/U/A ≈ 45/27/28 ±5", () => {
    const r = series(70, 70, 5000, 1);
    expect(r.goals).toBeGreaterThanOrEqual(2.6);
    expect(r.goals).toBeLessThanOrEqual(3.0);
    expect(r.home).toBeGreaterThanOrEqual(0.4);
    expect(r.home).toBeLessThanOrEqual(0.5);
    expect(r.draw).toBeGreaterThanOrEqual(0.22);
    expect(r.draw).toBeLessThanOrEqual(0.32);
    expect(r.away).toBeGreaterThanOrEqual(0.23);
    expect(r.away).toBeLessThanOrEqual(0.33);
  });

  it("ein 10 Punkte schwächeres Team gewinnt 15–25 % (Mittel aus Heim und Auswärts)", () => {
    const weakHome = series(60, 70, 2500, 2);
    const weakAway = series(70, 60, 2500, 3);
    const winRate = (weakHome.home + weakAway.away) / 2;
    expect(winRate).toBeGreaterThanOrEqual(0.15);
    expect(winRate).toBeLessThanOrEqual(0.25);
  });
});
```

- [ ] **Step 6: Kalibrierungstest laufen lassen**

Run: `npx vitest run tests/engine/calibration.test.ts`
Expected: PASS. Falls ein Wert knapp außerhalb liegt (Karten und Verletzungen fehlen im Prototyp), nur in `SIM` nachjustieren, und zwar in dieser Reihenfolge:
1. **Tore zu niedrig oder zu hoch:** `baseChance` in Schritten von 0,005 ändern.
2. **Heimsiege zu niedrig oder zu hoch:** `HOME_FACTOR` in `strength.ts` in Schritten von 0,01 ändern.
3. **Außenseiter-Quote zu niedrig:** `goalExp` senken; zu hoch: `chanceExp` erhöhen, jeweils in Schritten von 0,1.

Danach beide Testdateien erneut laufen lassen, bis alles PASS ist. In `strength.test.ts` wird `HOME_FACTOR` importiert, die Tests bleiben deshalb gültig.

- [ ] **Step 7: Commit**

```bash
git add src/engine/match/simulate.ts tests/engine/simulate.test.ts tests/engine/calibration.test.ts src/engine/match/strength.ts
git commit -m "feat(engine): Spielsimulation mit Halbzeiten, Karten, Verletzungen, Wechseln und Kalibrierung"
```

---

### Task 9: Mindestkader, neues Spiel und Saisonstart

**Files:**
- Create: `src/engine/squad.ts`
- Create: `src/engine/season.ts`
- Test: `tests/engine/squad.test.ts`
- Test: `tests/engine/newgame.test.ts`

**Interfaces:**
- Consumes: `generatePlayer`, `generateWorld`, `baseStrengthFor` (Task 6), `createLeague` (Task 4), `Rng`, Modell
- Produces:
  - `squad.ts`: `MIN_AVAILABLE = 13`; `ensureMinimumSquad(state, clubId, rng): Player[]` – ergänzt Amateurspieler, bis mindestens 13 Spieler einsatzfähig sind, darunter ein Torwart. Rückgabe sind die neuen Spieler; `state` wird verändert (Entwurf).
  - `season.ts`:
    - `type Result = { ok: true; state: GameState } | { ok: false; error: string }`
    - `withRng<T>(state, fn: (rng: Rng) => T): T` – verwendet `state.rngState` und schreibt ihn danach zurück
    - `startNewGame(world: GameState, managers: { name: string; clubId: ClubId }[]): Result`
    - `startSeason(state, firstClubs: ClubId[], secondClubs: ClubId[]): void` – verändert den Entwurf
    - `currentFixtures(state): Match[]`
    - `leagueOf(state, clubId): CompetitionId | null`

- [ ] **Step 1: Failing Tests schreiben**

`tests/engine/squad.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAvailable } from "../../src/engine/model";
import { MIN_AVAILABLE, ensureMinimumSquad } from "../../src/engine/squad";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

describe("ensureMinimumSquad", () => {
  it("ändert nichts bei genug einsatzfähigen Spielern", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    expect(ensureMinimumSquad(s, "c1", Rng.fromSeed(1))).toHaveLength(0);
    expect(s.clubs.c1.squad).toHaveLength(25);
  });

  it("ergänzt Amateure, wenn zu viele ausfallen, inklusive Torwart", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const squad = s.clubs.c1.squad;
    for (const id of squad.slice(0, 15)) s.players[id].injury = { matchesLeft: 3 };
    const added = ensureMinimumSquad(s, "c1", Rng.fromSeed(1));
    const available = s.clubs.c1.squad.map((id) => s.players[id]).filter(isAvailable);
    expect(available.length).toBeGreaterThanOrEqual(MIN_AVAILABLE);
    expect(available.some((p) => p.position === "GK")).toBe(true);
    expect(added.length).toBeGreaterThan(0);
    for (const p of added) {
      expect(p.clubId).toBe("c1");
      expect(s.players[p.id]).toBe(p);
      expect(p.strength).toBeLessThan(60);
    }
  });
});
```

`tests/engine/newgame.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { COMP, LEAGUE_SIZE } from "../../src/engine/model";
import { currentFixtures, leagueOf, startNewGame } from "../../src/engine/season";

describe("startNewGame", () => {
  const world = generateWorld(77);
  const ids = Object.keys(world.clubs);

  it("verteilt die 18 Vereine mit der höchsten Reputation auf die 1. Liga", () => {
    const r = startNewGame(world, [{ name: "Markus", clubId: ids[0] }]);
    if (!r.ok) throw new Error(r.error);
    const s = r.state;
    const l1 = s.competitions[COMP.first];
    const l2 = s.competitions[COMP.second];
    expect(l1.clubs).toHaveLength(LEAGUE_SIZE);
    expect(l2.clubs).toHaveLength(LEAGUE_SIZE);
    const minL1 = Math.min(...l1.clubs.map((c) => s.clubs[c].reputation));
    const maxL2 = Math.max(...l2.clubs.map((c) => s.clubs[c].reputation));
    expect(minL1).toBeGreaterThanOrEqual(maxL2);
    expect(s.calendar).toHaveLength(34);
    expect(s.calendarIndex).toBe(0);
    expect(currentFixtures(s)).toHaveLength(18);
    expect(leagueOf(s, l2.clubs[0])).toBe(COMP.second);
  });

  it("legt die Manager an und verknüpft sie mit ihren Vereinen", () => {
    const r = startNewGame(world, [{ name: "Anna", clubId: ids[3] }, { name: "Ben", clubId: ids[30] }]);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.managers.map((m) => m.name)).toEqual(["Anna", "Ben"]);
    const anna = r.state.managers[0];
    expect(r.state.clubs[ids[3]].managerId).toBe(anna.id);
    expect(anna.clubId).toBe(ids[3]);
  });

  it("verändert die übergebene Welt nicht", () => {
    const before = JSON.stringify(world);
    startNewGame(world, [{ name: "X", clubId: ids[0] }]);
    expect(JSON.stringify(world)).toBe(before);
  });

  it("lehnt ungültige Eingaben ab", () => {
    expect(startNewGame(world, [])).toMatchObject({ ok: false, error: expect.stringMatching(/1 bis 4/) });
    const five = Array.from({ length: 5 }, (_, i) => ({ name: `M${i}`, clubId: ids[i] }));
    expect(startNewGame(world, five)).toMatchObject({ ok: false });
    expect(startNewGame(world, [{ name: "  ", clubId: ids[0] }])).toMatchObject({ ok: false, error: expect.stringMatching(/Namen/) });
    expect(startNewGame(world, [{ name: "A", clubId: ids[0] }, { name: "B", clubId: ids[0] }])).toMatchObject({ ok: false, error: expect.stringMatching(/denselben Verein/) });
    expect(startNewGame(world, [{ name: "A", clubId: "gibts-nicht" }])).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/engine/squad.test.ts tests/engine/newgame.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Mindestkader implementieren**

`src/engine/squad.ts`:

```ts
import { generatePlayer } from "./generator";
import { isAvailable, type ClubId, type GameState, type Player, type Position } from "./model";
import type { Rng } from "./rng";

/** 11 Startspieler + 2 Ersatz – darunter muss ein Torwart sein. */
export const MIN_AVAILABLE = 13;

export function ensureMinimumSquad(state: GameState, clubId: ClubId, rng: Rng): Player[] {
  const club = state.clubs[clubId];
  const squad = () => club.squad.map((id) => state.players[id]);
  const avg = squad().reduce((s, p) => s + p.strength, 0) / Math.max(1, club.squad.length);
  const base = Math.max(25, avg - 15);
  const added: Player[] = [];
  const add = (pos: Position) => {
    const p = generatePlayer(state, rng, clubId, pos, base, rng.int(19, 30));
    club.squad.push(p.id);
    added.push(p);
  };
  if (!squad().some((p) => p.position === "GK" && isAvailable(p))) add("GK");
  const order: Position[] = ["DF", "MF", "FW"];
  let i = 0;
  while (squad().filter(isAvailable).length < MIN_AVAILABLE) add(order[i++ % order.length]);
  return added;
}
```

- [ ] **Step 4: Saisonstart implementieren**

`src/engine/season.ts`:

```ts
import { createLeague, matchesOfRound } from "./competition/schedule";
import { COMP, LEAGUE_SIZE, newId, type ClubId, type CompetitionId, type GameState, type Match } from "./model";
import { Rng } from "./rng";

export type Result = { ok: true; state: GameState } | { ok: false; error: string };

export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = Rng.fromState(state.rngState);
  const out = fn(rng);
  state.rngState = rng.state();
  return out;
}

export function startSeason(state: GameState, firstClubs: ClubId[], secondClubs: ClubId[]): void {
  withRng(state, (rng) => {
    const l1 = createLeague(state, COMP.first, "1. Liga", firstClubs, rng);
    const l2 = createLeague(state, COMP.second, "2. Liga", secondClubs, rng);
    state.competitions = { [l1.id]: l1, [l2.id]: l2 };
    state.calendar = Array.from({ length: l1.rounds }, (_, i) => ({
      fixtures: [
        { competitionId: l1.id, round: i + 1 },
        { competitionId: l2.id, round: i + 1 },
      ],
    }));
    state.calendarIndex = 0;
  });
  for (const p of Object.values(state.players)) {
    p.stats = { apps: 0, goals: 0 };
    p.yellowCards = 0;
  }
}

export function startNewGame(world: GameState, managers: { name: string; clubId: ClubId }[]): Result {
  if (managers.length < 1 || managers.length > 4) return { ok: false, error: "Es können 1 bis 4 Manager mitspielen." };
  if (managers.some((m) => m.name.trim() === "")) return { ok: false, error: "Jeder Manager braucht einen Namen." };
  if (managers.some((m) => !world.clubs[m.clubId])) return { ok: false, error: "Diesen Verein gibt es nicht." };
  if (new Set(managers.map((m) => m.clubId)).size !== managers.length)
    return { ok: false, error: "Zwei Manager können nicht denselben Verein übernehmen." };

  const state = structuredClone(world);
  for (const m of managers) {
    const id = newId(state, "mgr");
    state.managers.push({ id, name: m.name.trim(), clubId: m.clubId });
    state.clubs[m.clubId].managerId = id;
  }
  const byReputation = Object.values(state.clubs)
    .sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id))
    .map((c) => c.id);
  startSeason(state, byReputation.slice(0, LEAGUE_SIZE), byReputation.slice(LEAGUE_SIZE, 2 * LEAGUE_SIZE));
  return { ok: true, state };
}

export function currentFixtures(state: GameState): Match[] {
  const entry = state.calendar[state.calendarIndex];
  if (!entry) return [];
  return entry.fixtures.flatMap((f) => matchesOfRound(state.competitions[f.competitionId], f.round));
}

export function leagueOf(state: GameState, clubId: ClubId): CompetitionId | null {
  for (const id of [COMP.first, COMP.second]) {
    if (state.competitions[id]?.clubs.includes(clubId)) return id;
  }
  return null;
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run tests/engine/squad.test.ts tests/engine/newgame.test.ts`
Expected: alle Tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/squad.ts src/engine/season.ts tests/engine/squad.test.ts tests/engine/newgame.test.ts
git commit -m "feat(engine): Mindestkader, neues Spiel und Saisonstart"
```

---

### Task 10: KI der Computer-Vereine

**Files:**
- Create: `src/engine/ai.ts`
- Test: `tests/engine/ai.test.ts`

**Interfaces:**
- Consumes: `autoLineup` (Task 3), `teamStrength`, `PitchPlayer` (Task 7), `LiveMatch`, `Side`, `sideOf`, `substitute`, `changeTactics`, `bestBenchFor` (Task 8), Modell
- Produces:
  - `teamRating(state, clubId, formation, home): number` – Summe aus Abwehr, Mittelfeld und Angriff der Auto-Aufstellung bei normaler Taktik
  - `aiChooseFormation(state, clubId): Formation` – die Formation mit der höchsten Bewertung
  - `aiPrepare(state, clubId, opponentId, home): void` – setzt Formation, Aufstellung und Spielweise im Entwurf
  - `aiHalftime(state, live, side): void` – im Rückstand offensiv, bei Führung mit 2 oder mehr Toren defensiv; bis zu 3 Spieler mit Kondition < 70 werden ausgewechselt

**Regeln für die Spielweise:**

| Verhältnis eigene Bewertung / Gegner | Spielweise |
|---|---|
| > 1,10 | offensiv |
| < 0,90 | defensiv |
| sonst | normal |

Die Härte ist immer „normal“.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/ai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aiChooseFormation, aiHalftime, aiPrepare } from "../../src/engine/ai";
import { autoLineup, validateLineup } from "../../src/engine/lineup";
import { startMatch } from "../../src/engine/match/simulate";
import type { Match } from "../../src/engine/model";
import { makeState } from "./fixtures";

describe("aiChooseFormation", () => {
  it("wählt bei vielen starken Stürmern eine Formation mit mehr Stürmern", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    for (let i = 1; i <= 6; i++) s.players[`c1-FW${i}`].strength = 85;
    expect(["4-3-3", "4-2-4"]).toContain(aiChooseFormation(s, "c1"));
  });

  it("wählt bei starken Abwehrspielern eine Formation mit mehr Verteidigern", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    for (let i = 1; i <= 8; i++) s.players[`c1-DF${i}`].strength = 85;
    expect(aiChooseFormation(s, "c1")).toBe("5-3-2");
  });
});

describe("aiPrepare", () => {
  it("setzt eine gültige Aufstellung und wählt die Spielweise nach Stärkeverhältnis", () => {
    const s = makeState([{ id: "strong", strength: 80 }, { id: "weak", strength: 55 }]);
    aiPrepare(s, "strong", "weak", true);
    aiPrepare(s, "weak", "strong", false);
    expect(validateLineup(s, "strong", s.clubs.strong.lineup)).toBeNull();
    expect(s.clubs.strong.tactics.style).toBe("offensive");
    expect(s.clubs.weak.tactics.style).toBe("defensive");
  });

  it("gleich starke Gegner: normal", () => {
    const s = makeState([{ id: "a", strength: 70 }, { id: "b", strength: 70 }]);
    aiPrepare(s, "a", "b", false);
    expect(s.clubs.a.tactics.style).toBe("normal");
  });
});

describe("aiHalftime", () => {
  function live() {
    const s = makeState([{ id: "h", strength: 70 }, { id: "a", strength: 70 }]);
    for (const id of ["h", "a"]) s.clubs[id].lineup = autoLineup(s, id, "4-4-2");
    const m: Match = { id: "m", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
    return { s, l: startMatch(s, m) };
  }

  it("im Rückstand wird offensiv gespielt", () => {
    const { s, l } = live();
    l.away.goals = 1;
    aiHalftime(s, l, "home");
    expect(l.home.tactics.style).toBe("offensive");
  });

  it("bei 2 Toren Führung wird defensiv gespielt", () => {
    const { s, l } = live();
    l.home.goals = 2;
    aiHalftime(s, l, "home");
    expect(l.home.tactics.style).toBe("defensive");
  });

  it("wechselt höchstens 3 müde Spieler aus", () => {
    const { s, l } = live();
    for (const pp of l.home.pitch) l.home.fitness[pp.id] = 50;
    aiHalftime(s, l, "home");
    expect(l.home.subsUsed).toBe(3);
    expect(l.home.pitch).toHaveLength(11);
  });

  it("wechselt niemanden aus, wenn alle fit sind", () => {
    const { s, l } = live();
    aiHalftime(s, l, "home");
    expect(l.home.subsUsed).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/ai.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Implementieren**

`src/engine/ai.ts`:

```ts
import { autoLineup } from "./lineup";
import { bestBenchFor, changeTactics, sideOf, substitute, type LiveMatch, type Side } from "./match/simulate";
import { teamStrength } from "./match/strength";
import { FORMATION_LIST, MAX_SUBS, slotPositions, type ClubId, type Formation, type GameState } from "./model";

const TIRED = 70;
const MAX_AI_HALFTIME_SUBS = 3;

export function teamRating(state: GameState, clubId: ClubId, formation: Formation, home: boolean): number {
  const lineup = autoLineup(state, clubId, formation);
  const slots = slotPositions(formation);
  const pitch = lineup.starters.map((id, i) => ({ id, slot: slots[i] }));
  const t = teamStrength(state.players, pitch, {}, { formation, style: "normal", hardness: "normal" }, home);
  return t.defense + t.midfield + t.attack;
}

export function aiChooseFormation(state: GameState, clubId: ClubId): Formation {
  let best: Formation = "4-4-2";
  let bestRating = -Infinity;
  for (const f of FORMATION_LIST) {
    const r = teamRating(state, clubId, f, false);
    if (r > bestRating + 1e-9) {
      bestRating = r;
      best = f;
    }
  }
  return best;
}

export function aiPrepare(state: GameState, clubId: ClubId, opponentId: ClubId, home: boolean): void {
  const club = state.clubs[clubId];
  const formation = aiChooseFormation(state, clubId);
  const own = teamRating(state, clubId, formation, home);
  const opp = teamRating(state, opponentId, state.clubs[opponentId].tactics.formation, !home);
  const ratio = own / opp;
  club.tactics = {
    formation,
    style: ratio > 1.1 ? "offensive" : ratio < 0.9 ? "defensive" : "normal",
    hardness: "normal",
  };
  club.lineup = autoLineup(state, clubId, formation);
}

export function aiHalftime(state: GameState, live: LiveMatch, side: Side): void {
  const own = sideOf(live, side);
  const other = sideOf(live, side === "home" ? "away" : "home");
  const diff = own.goals - other.goals;
  if (diff < 0) changeTactics(state, live, side, { style: "offensive" });
  else if (diff >= 2) changeTactics(state, live, side, { style: "defensive" });

  const tired = own.pitch
    .filter((pp) => pp.slot !== "GK" && own.fitness[pp.id] < TIRED)
    .sort((a, b) => own.fitness[a.id] - own.fitness[b.id]);
  let done = 0;
  for (const pp of tired) {
    if (done >= MAX_AI_HALFTIME_SUBS || own.subsUsed >= MAX_SUBS) break;
    const inId = bestBenchFor(state, own, pp.slot);
    if (!inId) break;
    if (substitute(state, live, side, pp.id, inId) === null) done++;
  }
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/ai.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/ai.ts tests/engine/ai.test.ts
git commit -m "feat(engine): KI für Formation, Aufstellung und Halbzeit"
```

---

### Task 11: Spieltag-Ablauf (Vorbereitung, Halbzeiten, Auswertung, Relegation ansetzen)

**Files:**
- Modify: `src/engine/season.ts` (Funktionen anhängen, Imports ergänzen)
- Test: `tests/engine/matchday.test.ts`

**Interfaces:**
- Consumes: alles aus den Tasks 3–10
- Produces (in `season.ts`):
  - `interface Notice { managerId: ManagerId; text: string }`
  - `prepareMatchday(state): { state: GameState; notices: Notice[] }` – Mindestkader, KI-Vorbereitung, Reparatur menschlicher Aufstellungen
  - `kickOff(state): LiveMatch[]`
  - `playHalf(state, lives, half: 1 | 2): { state: GameState; lives: LiveMatch[] }`
  - `aiHalftimeAll(state, lives): LiveMatch[]` – Halbzeit-Entscheidungen aller KI-Vereine
  - `finishMatchday(state, lives): GameState` – Ergebnisse, Statistik, Karten, Sperren, Verletzungen, Kondition, Form; Kalender weiter; nach Spieltag 34 wird die Relegation angesetzt
  - `playMatchdayAuto(state): GameState` – kompletter Spieltag ohne menschliche Eingriffe (für Tests und den Langzeittest)
  - `relegationWinner(state): ClubId | null`
  - `isSeasonOver(state): boolean`
  - `REGEN = 0.6` (Anteil der fehlenden Kondition, der bis zum nächsten Spieltag zurückkommt)

**Regeln:**
- **Herunterzählen:** Zuerst werden die bestehenden Sperren und Verletzungen aller Spieler der heute spielenden Vereine um 1 reduziert, danach die neuen Ereignisse angewendet.
- **Gelbe Karten:** Jede gelbe Karte, die nicht zu Gelb-Rot führte, zählt +1. Bei 5 gibt es 1 Spiel Sperre, und der Zähler sinkt um 5.
- **Rote Karten:** Gelb-Rot bringt 1 Spiel Sperre, glatt Rot 3 Spiele.
- **Verletzungsdauer:** zufällig aus [1, 1, 1, 2, 2, 3, 4, 6] Spielen.
- **Kondition:**
  - Wer eingesetzt wurde, bekommt `f + 0,6 × (100 − f)`, wobei `f` die Kondition am Spielende ist.
  - Wer nicht eingesetzt wurde, hat danach 100.
- **Form:**
  - Erst klingt sie um 0,25 Richtung 0 ab.
  - Danach bekommen Eingesetzte einen Zuschlag: Sieg +0,5, Niederlage −0,5, und jedes eigene Tor +0,5 (zusammen höchstens +1).
  - Am Ende wird auf −3 bis +3 begrenzt.
- **Relegation:**
  - Hinspiel beim Zweitligisten, Rückspiel beim Erstligisten.
  - Ist das Gesamtergebnis nach dem Rückspiel gleich, wird `penalties` am Rückspiel gesetzt.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/matchday.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { COMP, type GameState } from "../../src/engine/model";
import {
  aiHalftimeAll,
  currentFixtures,
  finishMatchday,
  isSeasonOver,
  kickOff,
  playHalf,
  playMatchdayAuto,
  prepareMatchday,
  relegationWinner,
  startNewGame,
} from "../../src/engine/season";

function newGame(): GameState {
  const world = generateWorld(2024);
  const clubId = Object.keys(world.clubs)[0];
  const r = startNewGame(world, [{ name: "Markus", clubId }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("prepareMatchday", () => {
  it("repariert eine Manager-Aufstellung mit verletztem Spieler und meldet es", () => {
    const s = newGame();
    const club = s.clubs[s.managers[0].clubId!];
    const victim = club.lineup.starters[4];
    s.players[victim].injury = { matchesLeft: 2 };
    const before = JSON.stringify(s);
    const { state, notices } = prepareMatchday(s);
    expect(JSON.stringify(s)).toBe(before);
    const lineup = state.clubs[club.id].lineup;
    expect(lineup.starters).not.toContain(victim);
    expect(validateLineup(state, club.id, lineup)).toBeNull();
    expect(notices).toHaveLength(1);
    expect(notices[0].managerId).toBe(s.managers[0].id);
    expect(notices[0].text).toContain(s.players[victim].lastName);
  });

  it("alle spielenden Vereine haben danach eine gültige Aufstellung", () => {
    const { state } = prepareMatchday(newGame());
    for (const m of currentFixtures(state)) {
      expect(validateLineup(state, m.home, state.clubs[m.home].lineup)).toBeNull();
      expect(validateLineup(state, m.away, state.clubs[m.away].lineup)).toBeNull();
    }
  });
});

describe("kompletter Spieltag", () => {
  it("setzt alle 18 Ergebnisse, zählt Einsätze und schaltet den Kalender weiter", () => {
    let s = prepareMatchday(newGame()).state;
    let lives = kickOff(s);
    expect(lives).toHaveLength(18);
    ({ state: s, lives } = playHalf(s, lives, 1));
    expect(lives.every((l) => l.minute === 45)).toBe(true);
    lives = aiHalftimeAll(s, lives);
    ({ state: s, lives } = playHalf(s, lives, 2));
    const before = JSON.stringify(s);
    const after = finishMatchday(s, lives);
    expect(JSON.stringify(s)).toBe(before);
    expect(after.calendarIndex).toBe(1);
    const l1 = after.competitions[COMP.first];
    expect(l1.matches.filter((m) => m.result !== null)).toHaveLength(9);
    expect(computeStandings(l1).every((r) => r.played === 1)).toBe(true);
    const apps = Object.values(after.players).filter((p) => p.stats.apps === 1).length;
    expect(apps).toBeGreaterThanOrEqual(36 * 11);
    const goals = Object.values(after.players).reduce((x, p) => x + p.stats.goals, 0);
    const scored = l1.matches.concat(after.competitions[COMP.second].matches).reduce((x, m) => x + (m.result ? m.result.home + m.result.away : 0), 0);
    expect(goals).toBe(scored);
  });

  it("ist bei gleichem Spielstand deterministisch", () => {
    const s = newGame();
    expect(JSON.stringify(playMatchdayAuto(s))).toBe(JSON.stringify(playMatchdayAuto(s)));
  });
});

describe("Karten, Sperren, Verletzungen, Kondition", () => {
  function preparedLives() {
    const s = prepareMatchday(newGame()).state;
    return { s, lives: kickOff(s) };
  }

  it("glatt Rot = 3 Spiele, Gelb-Rot = 1 Spiel, 5. Gelbe = 1 Spiel, Verletzung ≥ 1 Spiel", () => {
    const { s, lives } = preparedLives();
    const side = lives[0].home;
    const [red, yellowRed, fifth, hurt] = side.pitch.slice(1, 5).map((pp) => pp.id);
    side.sentOff.push(red, yellowRed);
    side.booked.push(yellowRed, fifth);
    lives[0].events.push(
      { minute: 10, type: "red", club: side.club, player: red, secondYellow: false },
      { minute: 20, type: "red", club: side.club, player: yellowRed, secondYellow: true },
    );
    s.players[fifth].yellowCards = 4;
    side.injured.push(hurt);
    const after = finishMatchday(s, lives);
    expect(after.players[red].suspension).toEqual({ matchesLeft: 3 });
    expect(after.players[yellowRed].suspension).toEqual({ matchesLeft: 1 });
    expect(after.players[yellowRed].yellowCards).toBe(0);
    expect(after.players[fifth].suspension).toEqual({ matchesLeft: 1 });
    expect(after.players[fifth].yellowCards).toBe(0);
    expect(after.players[hurt].injury!.matchesLeft).toBeGreaterThanOrEqual(1);
  });

  it("Sperren laufen nach den Spielen des eigenen Vereins ab", () => {
    const s = newGame();
    const clubId = s.managers[0].clubId!;
    const pid = s.clubs[clubId].squad[20];
    s.players[pid].suspension = { matchesLeft: 1 };
    const after = playMatchdayAuto(s);
    expect(after.players[pid].suspension).toBeNull();
  });

  it("Kondition: Eingesetzte erholen sich teilweise, Nichteingesetzte ganz", () => {
    const { s, lives } = preparedLives();
    const side = lives[0].home;
    const played = side.pitch[3].id;
    side.fitness[played] = 70;
    const rested = s.clubs[side.club].squad.find((id) => !side.played.includes(id))!;
    s.players[rested].fitness = 60;
    const after = finishMatchday(s, lives);
    expect(after.players[played].fitness).toBeCloseTo(88);
    expect(after.players[rested].fitness).toBe(100);
  });
});

describe("Relegation", () => {
  it("wird nach Spieltag 34 mit dem 16. und dem 3. angesetzt und danach ist die Saison vorbei", () => {
    let s = newGame();
    for (let i = 0; i < 34; i++) s = playMatchdayAuto(s);
    const rel = s.competitions[COMP.relegation];
    expect(rel).toBeDefined();
    const sixteenth = computeStandings(s.competitions[COMP.first])[15].club;
    const third = computeStandings(s.competitions[COMP.second])[2].club;
    expect(rel.matches[0]).toMatchObject({ round: 1, home: third, away: sixteenth });
    expect(rel.matches[1]).toMatchObject({ round: 2, home: sixteenth, away: third });
    expect(s.calendar).toHaveLength(36);
    expect(isSeasonOver(s)).toBe(false);
    expect(relegationWinner(s)).toBeNull();
    s = playMatchdayAuto(s);
    s = playMatchdayAuto(s);
    expect(isSeasonOver(s)).toBe(true);
    expect([sixteenth, third]).toContain(relegationWinner(s));
  });

  it("bei gleichem Gesamtergebnis entscheidet das Elfmeterschießen", () => {
    let s = newGame();
    for (let i = 0; i < 35; i++) s = playMatchdayAuto(s);
    const rel = s.competitions[COMP.relegation];
    rel.matches[0].result = { home: 1, away: 1 };
    // Rückspiel ohne Simulation direkt auf 2:2 setzen
    const prepared = prepareMatchday(s).state;
    const lives = kickOff(prepared).map((l) => ({ ...l, home: { ...l.home, goals: 2 }, away: { ...l.away, goals: 2 } }));
    const after = finishMatchday(prepared, lives);
    const second = after.competitions[COMP.relegation].matches[1];
    expect(second.result).toEqual({ home: 2, away: 2 });
    expect(second.penalties).not.toBeNull();
    expect(second.penalties!.home).not.toBe(second.penalties!.away);
    const winner = second.penalties!.home > second.penalties!.away ? second.home : second.away;
    expect(relegationWinner(after)).toBe(winner);
  });
});
```

Anmerkung zum letzten Test: Das Hinspiel endet 1:1 und das Rückspiel 2:2 (gesetzt über `goals`). Das Gesamtergebnis ist also 3:3, und es gilt keine Auswärtstorregel. Deshalb muss das Elfmeterschießen entscheiden.

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/matchday.test.ts`
Expected: FAIL mit „does not provide an export named 'prepareMatchday'“

- [ ] **Step 3: Implementieren**

In `src/engine/season.ts` die Imports oben ersetzen durch:

```ts
import { aiHalftime, aiPrepare } from "./ai";
import { createLeague, matchesOfRound } from "./competition/schedule";
import { computeStandings } from "./competition/standings";
import { repairLineup, validateLineup } from "./lineup";
import { finalScore, penaltyShootout, simulateHalf, startMatch, type LiveMatch, type LiveSide } from "./match/simulate";
import {
  COMP,
  LEAGUE_SIZE,
  YELLOW_LIMIT,
  newId,
  type ClubId,
  type Competition,
  type CompetitionId,
  type GameState,
  type ManagerId,
  type Match,
  type Player,
} from "./model";
import { Rng } from "./rng";
import { ensureMinimumSquad } from "./squad";
```

Dann am Dateiende anhängen:

```ts
export interface Notice {
  managerId: ManagerId;
  text: string;
}

export const REGEN = 0.6;
const LEAGUE_ROUNDS = 2 * (LEAGUE_SIZE - 1);
const INJURY_LENGTHS = [1, 1, 1, 2, 2, 3, 4, 6];

export function prepareMatchday(state: GameState): { state: GameState; notices: Notice[] } {
  const draft = structuredClone(state);
  const notices: Notice[] = [];
  withRng(draft, (rng) => {
    for (const m of currentFixtures(draft)) {
      const sides: [ClubId, ClubId, boolean][] = [
        [m.home, m.away, true],
        [m.away, m.home, false],
      ];
      for (const [clubId, opponentId, home] of sides) {
        const club = draft.clubs[clubId];
        const added = ensureMinimumSquad(draft, clubId, rng);
        if (club.managerId === null) {
          aiPrepare(draft, clubId, opponentId, home);
          continue;
        }
        if (added.length > 0) {
          notices.push({ managerId: club.managerId, text: `Notkader: ${added.length} Amateurspieler wurden verpflichtet.` });
        }
        if (validateLineup(draft, clubId, club.lineup) !== null) {
          const before = club.lineup;
          club.lineup = repairLineup(draft, clubId, before, club.tactics.formation);
          const missing = before.starters
            .filter((id) => !club.lineup.starters.includes(id))
            .map((id) => draft.players[id]?.lastName ?? "?");
          notices.push({
            managerId: club.managerId,
            text: missing.length > 0 ? `Aufstellung ergänzt: ${missing.join(", ")} fällt aus.` : "Aufstellung wurde automatisch ergänzt.",
          });
        }
      }
    }
  });
  return { state: draft, notices };
}

export function kickOff(state: GameState): LiveMatch[] {
  return currentFixtures(state).map((m) => startMatch(state, m));
}

export function playHalf(state: GameState, lives: LiveMatch[], half: 1 | 2): { state: GameState; lives: LiveMatch[] } {
  const draft = structuredClone(state);
  const out = structuredClone(lives);
  withRng(draft, (rng) => {
    for (const live of out) simulateHalf(draft, live, half, rng);
  });
  return { state: draft, lives: out };
}

export function aiHalftimeAll(state: GameState, lives: LiveMatch[]): LiveMatch[] {
  const out = structuredClone(lives);
  for (const live of out) {
    if (state.clubs[live.home.club].managerId === null) aiHalftime(state, live, "home");
    if (state.clubs[live.away.club].managerId === null) aiHalftime(state, live, "away");
  }
  return out;
}

function tickDown(p: Player): void {
  if (p.suspension) p.suspension = p.suspension.matchesLeft > 1 ? { matchesLeft: p.suspension.matchesLeft - 1 } : null;
  if (p.injury) p.injury = p.injury.matchesLeft > 1 ? { matchesLeft: p.injury.matchesLeft - 1 } : null;
}

function decayForm(form: number): number {
  return form > 0 ? Math.max(0, form - 0.25) : Math.min(0, form + 0.25);
}

function findMatch(state: GameState, live: LiveMatch): Match {
  const m = state.competitions[live.competitionId].matches.find((x) => x.id === live.matchId);
  if (!m) throw new Error(`Spiel ${live.matchId} nicht gefunden`);
  return m;
}

function applySide(state: GameState, live: LiveMatch, side: LiveSide, ownGoals: number, otherGoals: number, rng: Rng): void {
  const resultBonus = ownGoals > otherGoals ? 0.5 : ownGoals < otherGoals ? -0.5 : 0;
  const goalsBy = new Map<string, number>();
  for (const e of live.events) if (e.type === "goal" && e.club === side.club) goalsBy.set(e.player, (goalsBy.get(e.player) ?? 0) + 1);

  for (const pid of state.clubs[side.club].squad) {
    const p = state.players[pid];
    p.form = decayForm(p.form);
    if (!side.played.includes(pid)) {
      p.fitness = 100;
      continue;
    }
    const goals = goalsBy.get(pid) ?? 0;
    p.stats.apps++;
    p.stats.goals += goals;
    const f = side.fitness[pid] ?? p.fitness;
    p.fitness = f + REGEN * (100 - f);
    p.form = Math.max(-3, Math.min(3, p.form + resultBonus + Math.min(1, goals * 0.5)));
  }
  for (const pid of side.booked) {
    if (side.sentOff.includes(pid)) continue;
    const p = state.players[pid];
    p.yellowCards++;
    if (p.yellowCards >= YELLOW_LIMIT) {
      p.yellowCards -= YELLOW_LIMIT;
      p.suspension = { matchesLeft: Math.max(1, p.suspension?.matchesLeft ?? 0) };
    }
  }
  for (const e of live.events) {
    if (e.type !== "red" || e.club !== side.club) continue;
    const len = e.secondYellow ? 1 : 3;
    const p = state.players[e.player];
    p.suspension = { matchesLeft: Math.max(len, p.suspension?.matchesLeft ?? 0) };
  }
  for (const pid of side.injured) state.players[pid].injury = { matchesLeft: rng.pick(INJURY_LENGTHS) };
}

function scheduleRelegation(state: GameState): void {
  const sixteenth = computeStandings(state.competitions[COMP.first])[15].club;
  const third = computeStandings(state.competitions[COMP.second])[2].club;
  const mk = (round: number, home: ClubId, away: ClubId): Match => ({
    id: newId(state, "m"),
    competitionId: COMP.relegation,
    round,
    home,
    away,
    result: null,
    events: [],
    penalties: null,
  });
  const rel: Competition = {
    id: COMP.relegation,
    name: "Relegation",
    format: "knockout",
    clubs: [sixteenth, third],
    rounds: 2,
    matches: [mk(1, third, sixteenth), mk(2, sixteenth, third)],
  };
  state.competitions[rel.id] = rel;
  state.calendar.push({ fixtures: [{ competitionId: rel.id, round: 1 }] }, { fixtures: [{ competitionId: rel.id, round: 2 }] });
}

/** Gesamtergebnis aus Sicht des Rückspiel-Gastgebers (Erstligist). */
function relegationAggregate(rel: Competition): { first: number; second: number } | null {
  const [m1, m2] = [...rel.matches].sort((a, b) => a.round - b.round);
  if (!m1.result || !m2.result) return null;
  return { first: m1.result.away + m2.result.home, second: m1.result.home + m2.result.away };
}

export function finishMatchday(state: GameState, lives: LiveMatch[]): GameState {
  const draft = structuredClone(state);
  withRng(draft, (rng) => {
    const playing = new Set(lives.flatMap((l) => [l.home.club, l.away.club]));
    for (const clubId of playing) for (const pid of draft.clubs[clubId].squad) tickDown(draft.players[pid]);
    for (const live of lives) {
      const match = findMatch(draft, live);
      const score = finalScore(live);
      match.result = score;
      match.events = live.events;
      applySide(draft, live, live.home, score.home, score.away, rng);
      applySide(draft, live, live.away, score.away, score.home, rng);
      if (match.competitionId === COMP.relegation && match.round === 2) {
        const agg = relegationAggregate(draft.competitions[COMP.relegation]);
        if (agg && agg.first === agg.second) match.penalties = penaltyShootout(rng);
      }
    }
    draft.calendarIndex++;
    if (draft.calendarIndex === LEAGUE_ROUNDS && !draft.competitions[COMP.relegation]) scheduleRelegation(draft);
  });
  return draft;
}

export function playMatchdayAuto(state: GameState): GameState {
  let s = prepareMatchday(state).state;
  let lives = kickOff(s);
  ({ state: s, lives } = playHalf(s, lives, 1));
  lives = aiHalftimeAll(s, lives);
  ({ state: s, lives } = playHalf(s, lives, 2));
  return finishMatchday(s, lives);
}

export function relegationWinner(state: GameState): ClubId | null {
  const rel = state.competitions[COMP.relegation];
  if (!rel) return null;
  const agg = relegationAggregate(rel);
  if (!agg) return null;
  const m2 = rel.matches.find((m) => m.round === 2)!;
  if (agg.first !== agg.second) return agg.first > agg.second ? m2.home : m2.away;
  if (!m2.penalties) return null;
  return m2.penalties.home > m2.penalties.away ? m2.home : m2.away;
}

export function isSeasonOver(state: GameState): boolean {
  return state.competitions[COMP.relegation] !== undefined && state.calendarIndex >= state.calendar.length;
}
```

Anmerkung: Die Imports `CompetitionId`, `matchesOfRound` und `createLeague` aus Task 9 bleiben in Gebrauch.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/matchday.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Alle bisherigen Tests laufen lassen**

Run: `npx vitest run`
Expected: alle Tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/season.ts tests/engine/matchday.test.ts
git commit -m "feat(engine): Spieltag-Ablauf mit Karten, Sperren, Verletzungen und Relegation"
```

---

### Task 12: Saisonende (Meister, Auf- und Abstieg, Chronik, neue Saison)

**Files:**
- Modify: `src/engine/season.ts` (Funktionen anhängen, Import `SeasonRecord` ergänzen)
- Test: `tests/engine/seasonend.test.ts`

**Interfaces:**
- Consumes: `computeStandings` (Task 5), `relegationWinner`, `isSeasonOver`, `startSeason` (Tasks 9 und 11)
- Produces:
  - `finishSeason(state): { state: GameState; record: SeasonRecord }` – wirft einen Fehler, wenn die Saison noch nicht vorbei ist
  - `topScorer(c: Competition): { player: PlayerId; goals: number } | null` – zählt die Tor-Ereignisse; bei Gleichstand gewinnt die kleinere Spieler-ID

**Regeln:**
- Die Plätze 17 und 18 der 1. Liga steigen ab, die Plätze 1 und 2 der 2. Liga steigen auf.
- Gewinnt der Zweitligist die Relegation, tauschen der 16. und der 3. zusätzlich die Liga.
- `season` wird um 1 erhöht, und `startSeason` wird mit den neuen Ligen aufgerufen. Dabei werden Saisonstatistik und gelbe Karten zurückgesetzt. Sperren und Verletzungen bleiben bestehen.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/seasonend.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import { generateWorld } from "../../src/engine/generator";
import { COMP, type Competition, type GameState } from "../../src/engine/model";
import { finishSeason, playMatchdayAuto, relegationWinner, startNewGame, topScorer } from "../../src/engine/season";

function playedSeason(seed: number): GameState {
  const world = generateWorld(seed);
  const r = startNewGame(world, [{ name: "M", clubId: Object.keys(world.clubs)[5] }]);
  if (!r.ok) throw new Error(r.error);
  let s = r.state;
  for (let i = 0; i < 36; i++) s = playMatchdayAuto(s);
  return s;
}

describe("finishSeason", () => {
  const s = playedSeason(31);
  const t1 = computeStandings(s.competitions[COMP.first]).map((r) => r.club);
  const t2 = computeStandings(s.competitions[COMP.second]).map((r) => r.club);
  const winner = relegationWinner(s)!;
  const { state: next, record } = finishSeason(s);

  it("trägt Meister, Auf- und Absteiger in die Chronik ein", () => {
    expect(record.season).toBe(1);
    expect(record.champions[COMP.first]).toBe(t1[0]);
    expect(record.champions[COMP.second]).toBe(t2[0]);
    expect(record.relegated).toEqual(expect.arrayContaining([t1[16], t1[17]]));
    expect(record.promoted).toEqual(expect.arrayContaining([t2[0], t2[1]]));
    if (winner === t2[2]) {
      expect(record.promoted).toContain(t2[2]);
      expect(record.relegated).toContain(t1[15]);
      expect(record.promoted).toHaveLength(3);
    } else {
      expect(record.promoted).toHaveLength(2);
      expect(record.relegated).toHaveLength(2);
    }
    expect(next.history).toEqual([record]);
  });

  it("stellt die neuen Ligen zusammen und beginnt Saison 2", () => {
    expect(next.season).toBe(2);
    const l1 = next.competitions[COMP.first].clubs;
    const l2 = next.competitions[COMP.second].clubs;
    expect(l1).toHaveLength(18);
    expect(l2).toHaveLength(18);
    expect(new Set([...l1, ...l2]).size).toBe(36);
    for (const c of record.promoted) expect(l1).toContain(c);
    for (const c of record.relegated) expect(l2).toContain(c);
    expect(next.competitions[COMP.relegation]).toBeUndefined();
    expect(next.calendar).toHaveLength(34);
    expect(next.calendarIndex).toBe(0);
    expect(Object.values(next.players).every((p) => p.stats.apps === 0 && p.yellowCards === 0)).toBe(true);
  });

  it("verändert den alten Spielstand nicht", () => {
    expect(s.season).toBe(1);
    expect(s.history).toHaveLength(0);
  });

  it("wirft, wenn die Saison noch läuft", () => {
    expect(() => finishSeason(next)).toThrow(/noch nicht vorbei/);
  });
});

describe("topScorer", () => {
  it("zählt Tore aus Ereignissen; bei Gleichstand gewinnt die kleinere ID", () => {
    const c: Competition = {
      id: "L",
      name: "L",
      format: "league",
      clubs: [],
      rounds: 1,
      matches: [
        {
          id: "m",
          competitionId: "L",
          round: 1,
          home: "a",
          away: "b",
          result: { home: 2, away: 2 },
          penalties: null,
          events: [
            { minute: 1, type: "goal", club: "a", player: "p9" },
            { minute: 2, type: "goal", club: "a", player: "p9" },
            { minute: 3, type: "goal", club: "b", player: "p2" },
            { minute: 4, type: "goal", club: "b", player: "p2" },
          ],
        },
      ],
    };
    expect(topScorer(c)).toEqual({ player: "p2", goals: 2 });
    expect(topScorer({ ...c, matches: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/seasonend.test.ts`
Expected: FAIL mit „does not provide an export named 'finishSeason'“

- [ ] **Step 3: Implementieren**

Im Import aus `./model` in `src/engine/season.ts` `type PlayerId` und `type SeasonRecord` ergänzen. Dann am Dateiende anhängen:

```ts
export function topScorer(c: Competition): { player: PlayerId; goals: number } | null {
  const goals = new Map<PlayerId, number>();
  for (const m of c.matches) for (const e of m.events) if (e.type === "goal") goals.set(e.player, (goals.get(e.player) ?? 0) + 1);
  let best: { player: PlayerId; goals: number } | null = null;
  for (const [player, n] of [...goals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!best || n > best.goals) best = { player, goals: n };
  }
  return best;
}

export function finishSeason(state: GameState): { state: GameState; record: SeasonRecord } {
  if (!isSeasonOver(state)) throw new Error("Die Saison ist noch nicht vorbei.");
  const draft = structuredClone(state);
  const l1 = draft.competitions[COMP.first];
  const l2 = draft.competitions[COMP.second];
  const t1 = computeStandings(l1).map((r) => r.club);
  const t2 = computeStandings(l2).map((r) => r.club);
  const relegated = [t1[16], t1[17]];
  const promoted = [t2[0], t2[1]];
  if (relegationWinner(draft) === t2[2]) {
    relegated.push(t1[15]);
    promoted.push(t2[2]);
  }
  const record: SeasonRecord = {
    season: draft.season,
    champions: { [COMP.first]: t1[0], [COMP.second]: t2[0] },
    promoted,
    relegated,
    topScorers: { [COMP.first]: topScorer(l1), [COMP.second]: topScorer(l2) },
  };
  draft.history.push(record);
  draft.season++;
  startSeason(
    draft,
    t1.filter((c) => !relegated.includes(c)).concat(promoted),
    t2.filter((c) => !promoted.includes(c)).concat(relegated),
  );
  return { state: draft, record };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/seasonend.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/season.ts tests/engine/seasonend.test.ts
git commit -m "feat(engine): Saisonende mit Auf- und Abstieg und Chronik"
```

---

### Task 13: Befehle (Aufstellung, Taktik, Halbzeitänderungen)

**Files:**
- Create: `src/engine/commands.ts`
- Test: `tests/engine/commands.test.ts`

**Interfaces:**
- Consumes: `validateLineup`, `repairLineup`, `autoLineup` (Task 3), `substitute`, `changeTactics`, `LiveMatch`, `Side` (Task 8), `Result` (Task 9), Modell
- Produces:
  - `type StateCommand` = `setLineup` | `setTactics` | `autoLineup`
  - `type HalftimeCommand` = `{ type: "halftimeChanges"; managerId; substitutions: { out: PlayerId; in: PlayerId }[]; tactics: Partial<Tactics> | null }`
  - `applyCommand(state, cmd: StateCommand): Result` – lässt `state` unverändert
  - `applyHalftime(state, lives: LiveMatch[], cmd: HalftimeCommand): { ok: true; lives: LiveMatch[] } | { ok: false; error: string }` – entweder alles oder nichts
  - `findLiveFor(state, lives, managerId): { index: number; side: Side } | null`

**Befehle:**
- `setLineup { managerId, lineup }` – wird mit `validateLineup` geprüft.
- `setTactics { managerId, tactics }` – Bei neuer Formation behalten die bisherigen Startspieler ihren Platz, wenn einer zu ihrer Position frei ist. Lücken füllt `repairLineup` mit den besten Spielern der passenden Position aus dem Kader.
- `autoLineup { managerId }` – beste Elf für die aktuelle Formation.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/commands.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyCommand, applyHalftime, findLiveFor } from "../../src/engine/commands";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { slotPositions, type GameState } from "../../src/engine/model";
import { kickOff, prepareMatchday, startNewGame } from "../../src/engine/season";

function game(): { s: GameState; mid: string; clubId: string } {
  const world = generateWorld(5);
  const clubId = Object.keys(world.clubs)[2];
  const r = startNewGame(world, [{ name: "M", clubId }]);
  if (!r.ok) throw new Error(r.error);
  return { s: r.state, mid: r.state.managers[0].id, clubId };
}

describe("applyCommand", () => {
  it("setLineup übernimmt eine gültige Aufstellung", () => {
    const { s, mid, clubId } = game();
    const club = s.clubs[clubId];
    const swapped = { starters: [...club.lineup.starters], bench: [...club.lineup.bench] };
    const benchMf = swapped.bench.find((id) => s.players[id].position !== "GK")!;
    const idx = swapped.starters.findIndex((id) => s.players[id].position === s.players[benchMf].position);
    const outId = swapped.starters[idx];
    swapped.starters[idx] = benchMf;
    swapped.bench = swapped.bench.map((id) => (id === benchMf ? outId : id));
    const r = applyCommand(s, { type: "setLineup", managerId: mid, lineup: swapped });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.clubs[clubId].lineup).toEqual(swapped);
    expect(s.clubs[clubId].lineup).not.toEqual(swapped);
  });

  it("setLineup lehnt ungültige Aufstellungen mit Meldung ab", () => {
    const { s, mid, clubId } = game();
    const bad = { starters: s.clubs[clubId].lineup.starters.slice(0, 9), bench: [] };
    expect(applyCommand(s, { type: "setLineup", managerId: mid, lineup: bad })).toEqual({ ok: false, error: "Die Startelf braucht genau 11 Spieler." });
  });

  it("unbekannter Manager wird abgelehnt", () => {
    const { s } = game();
    expect(applyCommand(s, { type: "autoLineup", managerId: "nix" })).toMatchObject({ ok: false, error: "Unbekannter Manager." });
  });

  it("setTactics mit neuer Formation verteilt die Spieler passend und bleibt gültig", () => {
    const { s, mid, clubId } = game();
    const r = applyCommand(s, { type: "setTactics", managerId: mid, tactics: { formation: "3-5-2", style: "offensive", hardness: "hard" } });
    if (!r.ok) throw new Error(r.error);
    const club = r.state.clubs[clubId];
    expect(club.tactics).toEqual({ formation: "3-5-2", style: "offensive", hardness: "hard" });
    expect(validateLineup(r.state, clubId, club.lineup)).toBeNull();
    const slots = slotPositions("3-5-2");
    const onNatural = club.lineup.starters.filter((id, i) => r.state.players[id].position === slots[i]).length;
    expect(onNatural).toBe(11);
  });

  it("autoLineup setzt die beste gültige Elf", () => {
    const { s, mid, clubId } = game();
    s.clubs[clubId].lineup = { starters: [], bench: [] };
    const r = applyCommand(s, { type: "autoLineup", managerId: mid });
    if (!r.ok) throw new Error(r.error);
    expect(validateLineup(r.state, clubId, r.state.clubs[clubId].lineup)).toBeNull();
  });
});

describe("applyHalftime", () => {
  function atHalftime() {
    const g = game();
    const s = prepareMatchday(g.s).state;
    return { ...g, s, lives: kickOff(s) };
  }

  it("führt Wechsel und Taktikänderung aus, ohne das Original zu verändern", () => {
    const { s, mid, lives } = atHalftime();
    const loc = findLiveFor(s, lives, mid)!;
    const side = lives[loc.index][loc.side];
    const out = side.pitch[6].id;
    const inId = side.bench[2];
    const r = applyHalftime(s, lives, { type: "halftimeChanges", managerId: mid, substitutions: [{ out, in: inId }], tactics: { style: "offensive" } });
    if (!r.ok) throw new Error(r.error);
    const after = r.lives[loc.index][loc.side];
    expect(after.pitch.map((pp) => pp.id)).toContain(inId);
    expect(after.tactics.style).toBe("offensive");
    expect(lives[loc.index][loc.side].pitch.map((pp) => pp.id)).toContain(out);
  });

  it("ist alles oder nichts: ein ungültiger Wechsel verwirft auch die gültigen", () => {
    const { s, mid, lives } = atHalftime();
    const loc = findLiveFor(s, lives, mid)!;
    const side = lives[loc.index][loc.side];
    const r = applyHalftime(s, lives, {
      type: "halftimeChanges",
      managerId: mid,
      substitutions: [
        { out: side.pitch[6].id, in: side.bench[2] },
        { out: "gibts-nicht", in: side.bench[3] },
      ],
      tactics: null,
    });
    expect(r).toEqual({ ok: false, error: "Der Spieler steht nicht auf dem Platz." });
  });

  it("lehnt Wechsel von Spielern des Gegners ab", () => {
    const { s, mid, lives } = atHalftime();
    const loc = findLiveFor(s, lives, mid)!;
    const other = lives[loc.index][loc.side === "home" ? "away" : "home"];
    const r = applyHalftime(s, lives, { type: "halftimeChanges", managerId: mid, substitutions: [{ out: other.pitch[3].id, in: other.bench[0] }], tactics: null });
    expect(r.ok).toBe(false);
  });

  it("findet kein Spiel für einen Manager ohne Verein", () => {
    const { s, lives } = atHalftime();
    expect(findLiveFor(s, lives, "nix")).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/commands.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Implementieren**

`src/engine/commands.ts`:

```ts
import { autoLineup, repairLineup, validateLineup } from "./lineup";
import { changeTactics, substitute, type LiveMatch, type Side } from "./match/simulate";
import {
  isAvailable,
  slotPositions,
  type Club,
  type GameState,
  type Lineup,
  type ManagerId,
  type PlayerId,
  type Tactics,
} from "./model";
import type { Result } from "./season";

export type StateCommand =
  | { type: "setLineup"; managerId: ManagerId; lineup: Lineup }
  | { type: "setTactics"; managerId: ManagerId; tactics: Tactics }
  | { type: "autoLineup"; managerId: ManagerId };

export interface HalftimeCommand {
  type: "halftimeChanges";
  managerId: ManagerId;
  substitutions: { out: PlayerId; in: PlayerId }[];
  tactics: Partial<Tactics> | null;
}

function managedClub(state: GameState, managerId: ManagerId): Club | string {
  const m = state.managers.find((x) => x.id === managerId);
  if (!m) return "Unbekannter Manager.";
  if (!m.clubId) return "Du hast zurzeit keinen Verein.";
  return state.clubs[m.clubId];
}

/** Bisherige Startspieler behalten ihren Platz, wenn er zu ihrer Position passt; den Rest füllt repairLineup. */
function reslot(state: GameState, club: Club, lineup: Lineup, tactics: Tactics): Lineup {
  const pool = lineup.starters.map((id) => state.players[id]).filter((p) => p && club.squad.includes(p.id) && isAvailable(p));
  const starters = slotPositions(tactics.formation).map((pos) => {
    const i = pool.findIndex((p) => p.position === pos);
    return i >= 0 ? pool.splice(i, 1)[0].id : "";
  });
  return repairLineup(state, club.id, { starters, bench: lineup.bench }, tactics.formation);
}

export function applyCommand(state: GameState, cmd: StateCommand): Result {
  const found = managedClub(state, cmd.managerId);
  if (typeof found === "string") return { ok: false, error: found };
  const draft = structuredClone(state);
  const club = draft.clubs[found.id];
  switch (cmd.type) {
    case "setLineup": {
      const error = validateLineup(draft, club.id, cmd.lineup);
      if (error) return { ok: false, error };
      club.lineup = { starters: [...cmd.lineup.starters], bench: [...cmd.lineup.bench] };
      return { ok: true, state: draft };
    }
    case "setTactics": {
      const formationChanged = cmd.tactics.formation !== club.tactics.formation;
      club.tactics = { ...cmd.tactics };
      if (formationChanged) club.lineup = reslot(draft, club, club.lineup, club.tactics);
      return { ok: true, state: draft };
    }
    case "autoLineup":
      club.lineup = autoLineup(draft, club.id, club.tactics.formation);
      return { ok: true, state: draft };
  }
}

export function findLiveFor(state: GameState, lives: LiveMatch[], managerId: ManagerId): { index: number; side: Side } | null {
  const clubId = state.managers.find((m) => m.id === managerId)?.clubId;
  if (!clubId) return null;
  const index = lives.findIndex((l) => l.home.club === clubId || l.away.club === clubId);
  if (index < 0) return null;
  return { index, side: lives[index].home.club === clubId ? "home" : "away" };
}

export function applyHalftime(
  state: GameState,
  lives: LiveMatch[],
  cmd: HalftimeCommand,
): { ok: true; lives: LiveMatch[] } | { ok: false; error: string } {
  const found = managedClub(state, cmd.managerId);
  if (typeof found === "string") return { ok: false, error: found };
  const loc = findLiveFor(state, lives, cmd.managerId);
  if (!loc) return { ok: false, error: "Dein Verein spielt heute nicht." };
  const out = structuredClone(lives);
  const live = out[loc.index];
  for (const s of cmd.substitutions) {
    const error = substitute(state, live, loc.side, s.out, s.in);
    if (error) return { ok: false, error };
  }
  if (cmd.tactics) changeTactics(state, live, loc.side, cmd.tactics);
  return { ok: true, lives: out };
}
```

Anmerkung zu `reslot`: Leere Plätze werden als `""` übergeben. `repairLineup` behandelt sie als ungültig, weil `""` nicht im Kader steht, und füllt sie auf. Zuerst kommen Kaderspieler der passenden Position zum Zug.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/commands.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/commands.ts tests/engine/commands.test.ts
git commit -m "feat(engine): Befehle für Aufstellung, Taktik und Halbzeit"
```

---

### Task 14: Session (Phasen, Hot-Seat) und Transport

**Files:**
- Create: `src/session/session.ts`
- Create: `src/transport/transport.ts`
- Test: `tests/session/session.test.ts`

**Interfaces:**
- Consumes: `applyCommand`, `applyHalftime`, `findLiveFor`, `StateCommand`, `HalftimeCommand` (Task 13); `prepareMatchday`, `kickOff`, `playHalf`, `aiHalftimeAll`, `finishMatchday`, `isSeasonOver`, `finishSeason`, `Notice` (Tasks 11 und 12)
- Produces:
  - `type Phase` =
    - `{ kind: "managerTurns"; pending: ManagerId[] }`
    - `{ kind: "firstHalf" }`
    - `{ kind: "halftime"; pending: ManagerId[] }`
    - `{ kind: "secondHalf" }`
    - `{ kind: "results" }`
    - `{ kind: "seasonEnd"; record: SeasonRecord }`
  - `type SessionCommand = StateCommand | HalftimeCommand | { type: "endTurn"; managerId: ManagerId }`
  - `interface Snapshot { state: GameState; phase: Phase; lives: LiveMatch[]; notices: Notice[] }`
  - `type Mode = "hotseat" | "parallel"`
  - `class Session`:
    - `constructor(state: GameState, mode?: Mode)`
    - `snapshot: Snapshot` (Getter)
    - `subscribe(fn): () => void` – ruft `fn` sofort einmal auf
    - `dispatch(cmd: SessionCommand): string | null`
    - `advance(): string | null` – vom Host aufgerufen, nachdem die UI die Konferenz bzw. die Auswertung gezeigt hat
  - `interface Transport { send(cmd): Promise<string | null>; subscribe(fn): () => void }`
  - `class LocalTransport implements Transport`

**Phasen:**

```
managerTurns ──(alle endTurn)──► firstHalf ──advance──► halftime ──(alle endTurn)──► secondHalf
                                    │                                                   │
                                    └─(kein Manager spielt)─────────────────────────────┘
secondHalf ──advance──► results ──advance──► managerTurns   (oder seasonEnd, wenn die Saison vorbei ist)
seasonEnd ──advance──► managerTurns (die neue Saison hat schon begonnen)
```

- **Hot-Seat:** Nur `pending[0]` darf handeln.
- **Parallel** (für Plan „Handy“): Jeder in `pending` darf handeln.
- **Halbzeit:** `pending` enthält die Manager, deren Verein an diesem Spieltag spielt.

- [ ] **Step 1: Failing Test schreiben**

`tests/session/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findLiveFor } from "../../src/engine/commands";
import { generateWorld } from "../../src/engine/generator";
import type { GameState } from "../../src/engine/model";
import { startNewGame } from "../../src/engine/season";
import { Session, type Snapshot } from "../../src/session/session";
import { LocalTransport } from "../../src/transport/transport";

function twoManagers(): GameState {
  const world = generateWorld(8);
  const ids = Object.keys(world.clubs);
  const r = startNewGame(world, [{ name: "Anna", clubId: ids[0] }, { name: "Ben", clubId: ids[20] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function endAll(session: Session): void {
  const p = session.snapshot.phase;
  if (p.kind !== "managerTurns" && p.kind !== "halftime") throw new Error(`falsche Phase ${p.kind}`);
  for (const id of [...p.pending]) expect(session.dispatch({ type: "endTurn", managerId: id })).toBeNull();
}

function playMatchday(session: Session): void {
  endAll(session);
  expect(session.snapshot.phase.kind).toBe("firstHalf");
  session.advance();
  if (session.snapshot.phase.kind === "halftime") endAll(session);
  expect(session.snapshot.phase.kind).toBe("secondHalf");
  session.advance();
  expect(session.snapshot.phase.kind).toBe("results");
  session.advance();
}

describe("Session", () => {
  it("beginnt mit den Manager-Runden in der Reihenfolge der Manager", () => {
    const s = twoManagers();
    const session = new Session(s);
    expect(session.snapshot.phase).toEqual({ kind: "managerTurns", pending: s.managers.map((m) => m.id) });
  });

  it("Hot-Seat: nur der Manager, der dran ist, darf handeln", () => {
    const s = twoManagers();
    const session = new Session(s);
    const [anna, ben] = s.managers;
    expect(session.dispatch({ type: "autoLineup", managerId: ben.id })).toBe("Du bist gerade nicht dran.");
    expect(session.dispatch({ type: "autoLineup", managerId: anna.id })).toBeNull();
    expect(session.dispatch({ type: "endTurn", managerId: anna.id })).toBeNull();
    expect(session.dispatch({ type: "autoLineup", managerId: ben.id })).toBeNull();
  });

  it("Parallel: jeder wartende Manager darf handeln", () => {
    const s = twoManagers();
    const session = new Session(s, "parallel");
    expect(session.dispatch({ type: "autoLineup", managerId: s.managers[1].id })).toBeNull();
  });

  it("lehnt Befehle in der falschen Phase ab", () => {
    const s = twoManagers();
    const session = new Session(s);
    expect(session.dispatch({ type: "halftimeChanges", managerId: s.managers[0].id, substitutions: [], tactics: null })).toBe("Das geht nur in der Halbzeit.");
    endAll(session);
    expect(session.dispatch({ type: "autoLineup", managerId: s.managers[0].id })).toBe("Das geht nur vor dem Spieltag.");
    expect(session.dispatch({ type: "endTurn", managerId: s.managers[0].id })).toBe("Das geht gerade nicht.");
  });

  it("advance() in den Manager-Runden wird abgelehnt", () => {
    const session = new Session(twoManagers());
    expect(session.advance()).toBe("Hier warten wir auf die Manager.");
  });

  it("spielt einen kompletten Spieltag inklusive Halbzeitwechsel", () => {
    const s = twoManagers();
    const session = new Session(s);
    const anna = s.managers[0];
    endAll(session);
    let snap = session.snapshot;
    expect(snap.lives).toHaveLength(18);
    expect(snap.lives.every((l) => l.minute === 45)).toBe(true);
    session.advance();
    snap = session.snapshot;
    expect(snap.phase).toEqual({ kind: "halftime", pending: s.managers.map((m) => m.id) });
    const loc = findLiveFor(snap.state, snap.lives, anna.id)!;
    const side = snap.lives[loc.index][loc.side];
    const inId = side.bench[1];
    expect(
      session.dispatch({ type: "halftimeChanges", managerId: anna.id, substitutions: [{ out: side.pitch[7].id, in: inId }], tactics: null }),
    ).toBeNull();
    expect(session.snapshot.lives[loc.index][loc.side].played).toContain(inId);
    endAll(session);
    snap = session.snapshot;
    expect(snap.phase.kind).toBe("secondHalf");
    expect(snap.lives.every((l) => l.minute === 90)).toBe(true);
    session.advance();
    expect(session.snapshot.phase.kind).toBe("results");
    expect(session.snapshot.state.calendarIndex).toBe(1);
    expect(session.snapshot.state.players[inId].stats.apps).toBe(1);
    session.advance();
    expect(session.snapshot.phase.kind).toBe("managerTurns");
    expect(session.snapshot.lives).toEqual([]);
  });

  it("benachrichtigt Abonnenten sofort und bei jeder Änderung", () => {
    const session = new Session(twoManagers());
    const seen: Snapshot[] = [];
    const off = session.subscribe((x) => seen.push(x));
    expect(seen).toHaveLength(1);
    session.dispatch({ type: "endTurn", managerId: session.snapshot.state.managers[0].id });
    expect(seen).toHaveLength(2);
    off();
    session.dispatch({ type: "endTurn", managerId: session.snapshot.state.managers[1].id });
    expect(seen).toHaveLength(2);
  });

  it("spielt eine ganze Saison bis zum Saisonende und startet Saison 2", () => {
    const session = new Session(twoManagers());
    for (let i = 0; i < 36; i++) playMatchday(session);
    const snap = session.snapshot;
    expect(snap.phase.kind).toBe("seasonEnd");
    if (snap.phase.kind === "seasonEnd") expect(snap.phase.record.season).toBe(1);
    expect(snap.state.season).toBe(2);
    session.advance();
    expect(session.snapshot.phase.kind).toBe("managerTurns");
  });
});

describe("LocalTransport", () => {
  it("leitet Befehle an die Session weiter und liefert Fehler zurück", async () => {
    const session = new Session(twoManagers());
    const t = new LocalTransport(session);
    const ben = session.snapshot.state.managers[1];
    await expect(t.send({ type: "autoLineup", managerId: ben.id })).resolves.toBe("Du bist gerade nicht dran.");
    let last: Snapshot | null = null;
    t.subscribe((x) => (last = x));
    expect(last).not.toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/session/session.test.ts`
Expected: FAIL mit „Failed to resolve import“

- [ ] **Step 3: Session implementieren**

`src/session/session.ts`:

```ts
import { applyCommand, applyHalftime, findLiveFor, type HalftimeCommand, type StateCommand } from "../engine/commands";
import type { LiveMatch } from "../engine/match/simulate";
import type { GameState, ManagerId, SeasonRecord } from "../engine/model";
import {
  aiHalftimeAll,
  finishMatchday,
  finishSeason,
  isSeasonOver,
  kickOff,
  playHalf,
  prepareMatchday,
  type Notice,
} from "../engine/season";

export type Phase =
  | { kind: "managerTurns"; pending: ManagerId[] }
  | { kind: "firstHalf" }
  | { kind: "halftime"; pending: ManagerId[] }
  | { kind: "secondHalf" }
  | { kind: "results" }
  | { kind: "seasonEnd"; record: SeasonRecord };

export type SessionCommand = StateCommand | HalftimeCommand | { type: "endTurn"; managerId: ManagerId };

export interface Snapshot {
  state: GameState;
  phase: Phase;
  lives: LiveMatch[];
  notices: Notice[];
}

export type Mode = "hotseat" | "parallel";

const NOT_YOUR_TURN = "Du bist gerade nicht dran.";

export class Session {
  private snap: Snapshot;
  private readonly listeners = new Set<(s: Snapshot) => void>();

  constructor(
    state: GameState,
    private readonly mode: Mode = "hotseat",
  ) {
    this.snap = { state, phase: { kind: "managerTurns", pending: [] }, lives: [], notices: [] };
    this.beginTurns();
  }

  get snapshot(): Snapshot {
    return this.snap;
  }

  subscribe(fn: (s: Snapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    return () => {
      this.listeners.delete(fn);
    };
  }

  dispatch(cmd: SessionCommand): string | null {
    const { phase } = this.snap;
    if (cmd.type === "halftimeChanges") {
      if (phase.kind !== "halftime") return "Das geht nur in der Halbzeit.";
      const denied = this.denied(cmd.managerId, phase.pending);
      if (denied) return denied;
      const r = applyHalftime(this.snap.state, this.snap.lives, cmd);
      if (!r.ok) return r.error;
      this.set({ lives: r.lives });
      return null;
    }
    if (cmd.type === "endTurn") {
      if (phase.kind !== "managerTurns" && phase.kind !== "halftime") return "Das geht gerade nicht.";
      const denied = this.denied(cmd.managerId, phase.pending);
      if (denied) return denied;
      const pending = phase.pending.filter((id) => id !== cmd.managerId);
      if (pending.length > 0) this.set({ phase: { ...phase, pending } });
      else if (phase.kind === "managerTurns") this.startMatchday();
      else this.startSecondHalf();
      return null;
    }
    if (phase.kind !== "managerTurns") return "Das geht nur vor dem Spieltag.";
    const denied = this.denied(cmd.managerId, phase.pending);
    if (denied) return denied;
    const r = applyCommand(this.snap.state, cmd);
    if (!r.ok) return r.error;
    this.set({ state: r.state });
    return null;
  }

  advance(): string | null {
    const { phase, state, lives } = this.snap;
    switch (phase.kind) {
      case "firstHalf": {
        const pending = state.managers.filter((m) => findLiveFor(state, lives, m.id) !== null).map((m) => m.id);
        if (pending.length > 0) this.set({ phase: { kind: "halftime", pending } });
        else this.startSecondHalf();
        return null;
      }
      case "secondHalf":
        this.set({ state: finishMatchday(state, lives), phase: { kind: "results" } });
        return null;
      case "results":
        if (isSeasonOver(state)) {
          const { state: next, record } = finishSeason(state);
          this.set({ state: next, lives: [], notices: [], phase: { kind: "seasonEnd", record } });
        } else this.beginTurns();
        return null;
      case "seasonEnd":
        this.beginTurns();
        return null;
      default:
        return "Hier warten wir auf die Manager.";
    }
  }

  private denied(managerId: ManagerId, pending: ManagerId[]): string | null {
    if (!pending.includes(managerId)) return NOT_YOUR_TURN;
    if (this.mode === "hotseat" && pending[0] !== managerId) return NOT_YOUR_TURN;
    return null;
  }

  private beginTurns(): void {
    const pending = this.snap.state.managers.filter((m) => m.clubId !== null).map((m) => m.id);
    this.set({ lives: [], notices: [], phase: { kind: "managerTurns", pending } });
    if (pending.length === 0) this.startMatchday();
  }

  private startMatchday(): void {
    const { state, notices } = prepareMatchday(this.snap.state);
    const first = playHalf(state, kickOff(state), 1);
    this.set({ state: first.state, lives: first.lives, notices, phase: { kind: "firstHalf" } });
  }

  private startSecondHalf(): void {
    const lives = aiHalftimeAll(this.snap.state, this.snap.lives);
    const second = playHalf(this.snap.state, lives, 2);
    this.set({ state: second.state, lives: second.lives, phase: { kind: "secondHalf" } });
  }

  private set(next: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...next };
    for (const fn of this.listeners) fn(this.snap);
  }
}
```

- [ ] **Step 4: Transport implementieren**

`src/transport/transport.ts`:

```ts
import type { Session, SessionCommand, Snapshot } from "../session/session";

/** Verbindung zwischen einer Oberfläche (Laptop oder später Handy) und der Session auf dem Host. */
export interface Transport {
  send(cmd: SessionCommand): Promise<string | null>;
  subscribe(fn: (s: Snapshot) => void): () => void;
}

/** Schritt 1: Die Oberfläche läuft im selben Browser wie die Session. */
export class LocalTransport implements Transport {
  constructor(private readonly session: Session) {}

  async send(cmd: SessionCommand): Promise<string | null> {
    return this.session.dispatch(cmd);
  }

  subscribe(fn: (s: Snapshot) => void): () => void {
    return this.session.subscribe(fn);
  }
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run tests/session/session.test.ts`
Expected: alle Tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/session/session.ts src/transport/transport.ts tests/session/session.test.ts
git commit -m "feat(session): Phasen eines Spieltags, Hot-Seat und LocalTransport"
```

---

### Task 15: Langzeittest über 10 Saisons und Abschlussprüfung

**Files:**
- Test: `tests/longrun/seasons.test.ts`

**Interfaces:**
- Consumes: `generateWorld`, `startNewGame`, `prepareMatchday`, `kickOff`, `playHalf`, `aiHalftimeAll`, `finishMatchday`, `isSeasonOver`, `finishSeason`, `currentFixtures`, `validateLineup`, `computeStandings`
- Produces: keine neuen Schnittstellen

- [ ] **Step 1: Langzeittest schreiben**

`tests/longrun/seasons.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { COMP, isAvailable, type GameState } from "../../src/engine/model";
import {
  aiHalftimeAll,
  currentFixtures,
  finishMatchday,
  finishSeason,
  isSeasonOver,
  kickOff,
  playHalf,
  prepareMatchday,
  startNewGame,
} from "../../src/engine/season";

describe("Langzeittest: 10 Saisons", () => {
  it("bleibt stabil", { timeout: 300_000 }, () => {
    const world = generateWorld(4711);
    const r = startNewGame(world, [{ name: "Test", clubId: Object.keys(world.clubs)[10] }]);
    if (!r.ok) throw new Error(r.error);
    let s: GameState = r.state;

    for (let season = 1; season <= 10; season++) {
      let goals = 0;
      let matches = 0;
      while (!isSeasonOver(s)) {
        s = prepareMatchday(s).state;
        for (const m of currentFixtures(s)) {
          for (const clubId of [m.home, m.away]) {
            expect(validateLineup(s, clubId, s.clubs[clubId].lineup)).toBeNull();
            const available = s.clubs[clubId].squad.map((id) => s.players[id]).filter(isAvailable);
            expect(available.length).toBeGreaterThanOrEqual(11);
          }
        }
        let lives = kickOff(s);
        ({ state: s, lives } = playHalf(s, lives, 1));
        lives = aiHalftimeAll(s, lives);
        ({ state: s, lives } = playHalf(s, lives, 2));
        s = finishMatchday(s, lives);
      }
      for (const id of [COMP.first, COMP.second]) {
        for (const m of s.competitions[id].matches) {
          expect(m.result).not.toBeNull();
          goals += m.result!.home + m.result!.away;
          matches++;
        }
        expect(computeStandings(s.competitions[id]).every((row) => row.played === 34)).toBe(true);
      }
      const avgGoals = goals / matches;
      expect(avgGoals).toBeGreaterThan(2.3);
      expect(avgGoals).toBeLessThan(3.3);

      const { state: next, record } = finishSeason(s);
      expect(record.season).toBe(season);
      expect(record.promoted.length).toBe(record.relegated.length);
      expect([2, 3]).toContain(record.promoted.length);
      const l1 = next.competitions[COMP.first].clubs;
      const l2 = next.competitions[COMP.second].clubs;
      expect(l1).toHaveLength(18);
      expect(l2).toHaveLength(18);
      expect(new Set([...l1, ...l2]).size).toBe(36);
      s = next;
    }

    expect(s.season).toBe(11);
    expect(s.history).toHaveLength(10);
    const squadSizes = Object.values(s.clubs).map((c) => c.squad.length);
    expect(Math.max(...squadSizes)).toBeLessThan(40);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
```

- [ ] **Step 2: Langzeittest laufen lassen**

Run: `npx vitest run tests/longrun/seasons.test.ts`
Expected: PASS. Laufzeit: Richtwert unter 2 Minuten.

Falls `avgGoals` außerhalb liegt, ist die Kalibrierung aus Task 8 im echten Ligabetrieb (unterschiedliche Stärken, KI-Spielweisen) verrutscht. Dann `SIM.baseChance` wie in Task 8 Step 6 anpassen und Task 8 und Task 15 erneut laufen lassen.

Falls die Kadergröße 40 erreicht, verpflichtet `ensureMinimumSquad` zu oft Amateure. Dann prüfen, ob `tickDown` in `finishMatchday` für alle Spieler der spielenden Vereine läuft.

- [ ] **Step 3: Gesamtprüfung**

Run: `npx vitest run && npm run check && npm run build`
Expected:
- alle Tests PASS
- `svelte-check` meldet 0 Fehler
- der Build ist erfolgreich

- [ ] **Step 4: Prüfen, dass die Engine frei von UI- und Browser-Abhängigkeiten ist**

Run: `grep -rnE "from \"(svelte|\.\./ui|\.\./session|\.\./\.\./session)|Math\.random|Date\.now|window\.|document\." src/engine || echo "sauber"`
Expected: `sauber`

- [ ] **Step 5: Commit**

```bash
git add tests/longrun/seasons.test.ts
git commit -m "test: Langzeittest über 10 Saisons"
```

---

## Nach diesem Plan

Mit Plan 1 ist die komplette Spiellogik für Ligen, Spiele und Saisons fertig und testbar, aber noch nicht im Browser spielbar. Danach folgen:

- **Plan 2: Oberfläche Hot-Seat.** Stil „Rasen & Holztafel“, 640×400 skaliert, Bildschirme für Neues Spiel, Manager-Wechsel, Hauptmenü, Mannschaft, Tabelle & Spielplan, Konferenz, Halbzeit, Auswertung und Saisonende. Training, Verträge, Transfers und Finanzen erscheinen dort zunächst als „folgt“-Kacheln.
- **Plan 3:** Wirtschaft samt Menüs.
- **Plan 4:** Speichern und Laden, Optionen, Playwright-Tests.

