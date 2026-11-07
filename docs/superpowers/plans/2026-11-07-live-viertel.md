# Live-Viertel und Torszenen – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Konferenz wird durch einen Live-Bildschirm ersetzt: Jedes Spiel eines Managers läuft in einem Viertel mit Druckkurve und Meldungen, und Tore und Großchancen erscheinen als animierte Pixelszene.

**Architecture:**
- **Engine:** Sie hält zusätzlich Chancen ohne Tor (`type: "chance"`) und die Angriffsseite pro Minute fest. Dabei zieht sie keinen einzigen Zufallswert mehr als bisher.
- **Reine Logik** unter `src/ui/live/`:
  - Druckkurve,
  - Szenenliste und Szenenausgang,
  - Wiedergabe (Uhr, Warteschlangen, Auflösung),
  - Aufteilung der Viertel,
  - Schussplan und Canvas-Zeichnen.

  Alles ist ohne Svelte testbar.
- **Svelte-Komponenten** zeigen das an. `LiveScreen.svelte` ersetzt `Conference.svelte`, die View heißt `live` statt `conference`.

**Tech Stack:** TypeScript 5.6.3, Svelte 5.57.3 (Runes), Vite 8.3.5, Vitest 5.0.5, @testing-library/svelte 5.4.2, jsdom 30.1.3, Playwright 1.64.1. Keine neuen npm-Abhängigkeiten. Bildaufbereitung per `uv` mit pillow, numpy und scipy, nur als Werkzeug und nicht im Build.

**Spec:** `docs/superpowers/specs/2026-11-06-live-viertel-design.md`. Sie ergänzt die Haupt-Spec `docs/superpowers/specs/2026-10-31-fussballmanager-design.md`.

**Referenz (Wegwerf):**
- `docs/superpowers/mockups/szene.js`: Choreografie, Zeiten und Zeichenroutinen der Szene. Task 6 portiert sie.
- `docs/superpowers/mockups/live-viertel.html`: Aussehen der Viertel.

## Global Constraints

- Für denselben Seed liefert die Engine **dieselben Ergebnisse** wie vor der Änderung. Kein zusätzlicher Aufruf des Engine-`Rng`, weder für `big`, noch für die Angriffsseite, noch für Szenenausgänge.
- Pseudozufall in der Oberfläche (Rauschen, Ausgang, Texte, Schussziel) kommt ausschließlich aus `hash01(...)` (Task 2), abgeleitet aus Spiel-ID und Minute.
- Spielstand, Meldung, Kurvenpunkt, Live-Tabelle und Torton einer Szene springen **erst bei der Auflösung um**, 1280 ms nach Szenenstart. Ohne Szene springen sie in der Ereignisminute.
- **Szenenzeiten:** Schuss 760 ms, Flug 520 ms, Torwartsprung ab 980 ms, Auflösung 1280 ms, Ende 3400 ms.
- **Ausgangsgewichte** für Großchancen ohne Tor: gehalten 0,55, vorbei oder drüber 0,30, Pfosten oder Latte 0,15.
- **Uhr:** `TEMPOS = [1000, 500, 200]` ms pro Minute. Solange irgendeine Szene läuft, gilt `TEMPOS[0]`.
- **Einblendungstexte:** `TOR!` (gelb), `GEHALTEN!`, `VORBEI!`, `DRÜBER!`, `PFOSTEN!`, `LATTE!` (creme).
- **Szenenzeile:** `GROSSCHANCE {minute}' {Nachname} · {Vereinsname}`.
- **Szenen-Canvas:** 320×200, `imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`. Im Viertel 2× skaliert (640×400), bei einem einzigen Spiel 4× (1280×800).
- **Szenenkoordinaten:** Tor innen x 92–228, Latte unten y 58, Torlinie y 95. Der Ball startet bei (76, 192).
- **Platzhalterfarben:** Torwart `#00FF00`, Schützentrikot und Stutzen `#FF00FF`, Schützenhose `#00FFFF`. Erkannt werden sie mit einer Toleranz von 90 in der Summe der absoluten RGB-Differenzen.
- **Maß-Wächter** (`tests/ui/sizes.test.ts` prüft jede neue `.svelte` unter `src/ui`):
  - Press-Start-2P-Schrift (`--font-display`, h1–h3) mindestens 16 px und gerade,
  - übrige Schrift mindestens 20 px,
  - alle anderen px-Werte gerade,
  - `<Crest size>` mindestens 32 und gerade.
- Alle Assets werden lokal mitgeliefert, kein CDN.
- Optionen heißen in der Oberfläche „Spieltempo“ (vorher „Konferenz-Tempo“) und „Torszenen“ (an/aus, Standard an).

## Review Focus

1. **Spieltag ohne Spiel eines Managers**, etwa eine Relegation ohne Manager-Verein: Der Bildschirm darf nicht leer bleiben oder abstürzen. Er zeigt die Tabelle der Liga des ersten Managers bildschirmfüllend, und Uhr und „Weiter“ funktionieren. *(Test in Task 5 und Task 8.)*
2. **Leertaste mitten in einer Szene**, auch kurz vor Minute 45: Alles bis zum Halbzeitende ist sofort aufgelöst. Spielstand, Tabelle und Kurve stimmen mit der Engine überein, keine Szene hängt, und „Weiter“ erscheint. *(Test in Task 4 und Task 8.)*
3. **Mehrere Szenen kurz hintereinander im selben Spiel**, etwa Tore in Minute 30 und 31: Die zweite wartet, bis die erste fertig ist. Der Spielstand zählt beide, in der richtigen Reihenfolge. *(Test in Task 4.)*
4. **Zweite Halbzeit:** Die Tore der ersten Halbzeit sind von Anfang an aufgelöst, sie erscheinen weder erneut als Szene noch gezählt. Die Kurve zeigt den Verlauf der ersten Halbzeit weiter. *(Test in Task 4 und Task 7.)*
5. **Ergebnisübersicht und Saisonstatistik nach dem Spieltag:** `chance`-Ereignisse tauchen weder in der Ereignisliste von `Results.svelte` noch in der Torschützenzählung auf. *(Test in Task 1.)*

---

### Task 1: Engine – Chancen und Angriffsseite festhalten

**Files:**
- Modify: `src/engine/model.ts:226-231` (MatchEvent)
- Modify: `src/engine/match/simulate.ts` (`SIM`, `LiveMatch`, `startMatch`, `attack`, `minuteStep`)
- Modify: `src/ui/logic/format.ts:26-40` (`eventText`, muss den neuen Typ abdecken)
- Test: `tests/engine/simulate.test.ts`, `tests/engine/rngFingerprint.test.ts` (neu), `tests/ui/results.test.ts`

**Interfaces:**
- Produces:
  - `MatchEvent` um `{ minute: number; type: "chance"; club: ClubId; player: PlayerId; big: boolean }` erweitert.
  - `LiveMatch.attacks: Side[]`, wobei `attacks[m - 1]` die Seite ist, die in Minute `m` angriff. Gesetzt für jede simulierte Minute.
  - `SIM.bigChance: number` ist die pGoal-Schwelle.
  - `eventText` für `chance`: `"{minute}' Chance: {Nachname}"`. Das ist nur ein Fallback, der Live-Bildschirm nutzt eigene Texte (Task 3).

- [ ] **Step 1: Fingerabdruck-Test auf dem unveränderten Code schreiben**

`tests/engine/rngFingerprint.test.ts`:
- Wie die `series`-Hilfe in `tests/engine/calibration.test.ts`: 300 Spiele mit den Stärken 70 gegen 65, Seed 11.
- Pro Spiel als String festhalten: `finalScore` und die Minuten und Schützen aller `goal`-, `yellow`-, `red`-, `injury`- und `sub`-Ereignisse. Der Typ `chance` wird ausdrücklich herausgefiltert.

```ts
it("gleiche Ergebnisse wie vor der Chancen-Erweiterung", () => {
  expect(fingerprint(300, 11)).toMatchSnapshot();
});
```

- [ ] **Step 2: Snapshot erzeugen und committen, BEVOR die Engine geändert wird**

Run: `npx vitest run tests/engine/rngFingerprint.test.ts`
Expected: PASS, neue Datei `tests/engine/__snapshots__/rngFingerprint.test.ts.snap`.

```bash
git add tests/engine/rngFingerprint.test.ts tests/engine/__snapshots__/
git commit -m "test(engine): Fingerabdruck der Spielergebnisse vor der Chancen-Erweiterung"
```

- [ ] **Step 3: Failing tests für Chancen und Angriffsseite**

In `tests/engine/simulate.test.ts` (Hilfen `setup` und `playFull` gibt es schon):

```ts
it("hält für jede Minute die angreifende Seite fest", () => {
  const { s, match } = setup();
  const live = playFull(s, match, 5);
  expect(live.attacks).toHaveLength(90);
  expect(live.attacks.every((x) => x === "home" || x === "away")).toBe(true);
});

it("Chancen ohne Tor sind Ereignisse mit Verein und Schützen auf dem Platz", () => {
  const { s, match } = setup();
  const live = playFull(s, match, 5);
  const chances = live.events.filter((e) => e.type === "chance");
  expect(chances.length).toBeGreaterThan(0);
  for (const c of chances) {
    expect(["h", "a"]).toContain(c.club);
    expect(s.clubs[c.club].squad).toContain(c.player);
  }
});

it("im Schnitt 2–3 Großchancen ohne Tor pro Spiel", () => {
  // 2000 Spiele 70 gegen 70, ein Rng mit Seed 3 über alle Spiele wie in calibration.test.ts
  expect(avgBigMisses).toBeGreaterThanOrEqual(2);
  expect(avgBigMisses).toBeLessThanOrEqual(3);
});
```

- [ ] **Step 4: Tests ausführen, sie schlagen fehl**

Run: `npx vitest run tests/engine/simulate.test.ts`
Expected: FAIL (`attacks` undefined, keine `chance`-Ereignisse).

- [ ] **Step 5: Engine erweitern**

- `startMatch` setzt `attacks: []`.
- `minuteStep`:
  - Das Ergebnis des bestehenden `rng.chance(hs.midfield / …)` wird in eine Variable übernommen.
  - `live.attacks[minute - 1] = home ? "home" : "away"` wird gesetzt.
  - Danach wird `attack` wie bisher aufgerufen. Die Reihenfolge der Rng-Aufrufe bleibt unverändert.
- `attack`: Im `else`-Zweig von `rng.chance(pGoal)` wird `{ minute, type: "chance", club: att.club, player: shooter.id, big: pGoal >= SIM.bigChance }` gepusht.
- `SIM.bigChance`: Startwert `0.3`. So einstellen, dass der Test aus Step 3 grün wird.

- [ ] **Step 6: Tests ausführen**

Run: `npx vitest run tests/engine tests/longrun`
Expected: alles PASS, auch der Fingerabdruck aus Step 2 und die Kalibrierung.

- [ ] **Step 7: Review-Focus 5 – Chancen nicht in der Ergebnisliste**

In `tests/ui/results.test.ts` ein Test:
- Ein `chance`-Ereignis eines Manager-Vereins in `snapshot.lives[0].events` einfügen.
- Den Ergebnisbildschirm rendern.
- Prüfen: `queryByText(/Chance:/)` ist `null`.

`Results.svelte` filtert bereits auf `goal`, `red` und `injury`. Der Test sichert das ab.

Run: `npx vitest run tests/ui/results.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine src/ui/logic/format.ts tests/engine tests/ui/results.test.ts
git commit -m "feat(engine): Chancen ohne Tor und Angriffsseite pro Minute festhalten"
```

Hinweis: `src/storage/validate.ts` und `guards.ts` prüfen keine Ereignistypen. Eine Schemaversion oder Migration ist nicht nötig (Spec 6.4).

---

### Task 2: Hash und Druckkurve

**Files:**
- Create: `src/ui/live/hash.ts`
- Create: `src/ui/live/pressure.ts`
- Test: `tests/ui/live/pressure.test.ts`

**Interfaces:**
- Consumes: `LiveMatch.attacks`, `MatchEvent` `chance`/`goal` (Task 1)
- Produces:
  - `hash01(...parts: (string | number)[]): number`: deterministisch, in [0, 1).
  - `pressureCurve(live: LiveMatch): number[]`: Länge = Anzahl simulierter Minuten (`live.attacks.length`). Index `m - 1` ist der Wert für Minute `m`, in [−1, 1], wobei +1 die Heimseite bedeutet.

- [ ] **Step 1: Failing tests**

```ts
it("hash01 ist deterministisch und liegt in [0,1)", () => {
  expect(hash01("m1", 12)).toBe(hash01("m1", 12));
  expect(hash01("m1", 12)).not.toBe(hash01("m1", 13));
  for (let i = 0; i < 1000; i++) { const v = hash01("x", i); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});

it("Kurve hat eine Länge pro simulierter Minute und bleibt in [-1,1]", () => {
  const live = played(45);               // Hilfe: echtes Spiel, nur 1. Halbzeit simuliert
  const c = pressureCurve(live);
  expect(c).toHaveLength(45);
  expect(c.every((v) => v >= -1 && v <= 1)).toBe(true);
});

it("vor einer Chance steigt der Druck zur angreifenden Seite", () => {
  const live = synthetic({ attacks: Array(45).fill("away"), events: [] });
  const withChance = synthetic({ attacks: Array(45).fill("away"), events: [{ minute: 30, type: "chance", club: HOME, player: "p", big: true }] });
  expect(pressureCurve(withChance)[28]).toBeGreaterThan(pressureCurve(live)[28]);
});

it("gleiche Eingabe, gleiche Kurve", () => {
  const live = played(90);
  expect(pressureCurve(live)).toEqual(pressureCurve(structuredClone(live)));
});
```

- [ ] **Step 2: Tests ausführen, sie schlagen fehl**

Run: `npx vitest run tests/ui/live/pressure.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren**

`hash01`: FNV-1a 32 bit über `parts.join("|")`, geteilt durch 2³².

`pressureCurve`: Diese Startwerte darf der Umsetzer nachjustieren (Spec 5.2). Ziel ist eine Kurve wie im Entwurf.

```
side(m) = attacks[m-1] === "home" ? +1 : -1
base(m) = 0.75 * base(m-1) + 0.25 * side(m)          (base(0) = 0)
build(m) = Σ über goal/chance-Ereignisse e mit e.minute ∈ [m, m+3]:
           s_e * w_e * (1 - (e.minute - m) / 4)
           s_e = +1 wenn e.club === live.home.club, sonst -1
           w_e = 0.6 für goal oder big, 0.35 sonst
noise(m) = (hash01(live.matchId, m, "druck") - 0.5) * 0.2
wert(m)  = clamp(base(m) + build(m) + noise(m), -1, 1)
```

- [ ] **Step 4: Tests ausführen**

Run: `npx vitest run tests/ui/live/pressure.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/live/hash.ts src/ui/live/pressure.ts tests/ui/live/pressure.test.ts
git commit -m "feat(live): Druckkurve aus Angriffsseiten und Chancen"
```

---

### Task 3: Szenenliste, Ausgang und Meldungstexte

**Files:**
- Create: `src/ui/live/scenes.ts`
- Test: `tests/ui/live/scenes.test.ts`

**Interfaces:**
- Consumes: `hash01` (Task 2), `MatchEvent` (Task 1)
- Produces:
  ```ts
  export type SceneOutcome = "goal" | "save" | "wide" | "post";
  export type SceneVariant = "catch" | "parry" | "side" | "over" | "post" | "bar" | null;
  export interface SceneEvent {
    matchId: MatchId; minute: number; club: ClubId; player: PlayerId;
    home: boolean; outcome: SceneOutcome; variant: SceneVariant;
    event: MatchEvent;            // das auslösende goal- bzw. chance-Ereignis (Objektidentität aus live.events)
  }
  export const SCENE_MS: { kick: 760; fly: 520; dive: 980; reveal: 1280; end: 3400 };
  export function isSceneEvent(e: MatchEvent): boolean;          // goal oder chance mit big
  export function sceneOf(live: LiveMatch, e: MatchEvent): SceneEvent;
  export function sceneLabel(s: SceneEvent): "TOR!" | "GEHALTEN!" | "VORBEI!" | "DRÜBER!" | "PFOSTEN!" | "LATTE!";
  export function liveEventText(state: GameState, matchId: MatchId, e: MatchEvent): string;
  ```

- [ ] **Step 1: Failing tests**

```ts
it("Tore und Großchancen sind Szenen, kleine Chancen und Karten nicht", () => {
  expect(isSceneEvent(goal)).toBe(true);
  expect(isSceneEvent({ ...chance, big: true })).toBe(true);
  expect(isSceneEvent({ ...chance, big: false })).toBe(false);
  expect(isSceneEvent(yellow)).toBe(false);
});

it("ein Tor hat immer den Ausgang goal", () => {
  expect(sceneOf(live, goal).outcome).toBe("goal");
});

it("Ausgänge der Großchancen folgen den Gewichten 55/30/15", () => {
  // 10 000 künstliche Großchancen mit verschiedenen Minuten und matchIds
  expect(share("save")).toBeCloseTo(0.55, 1);
  expect(share("wide")).toBeCloseTo(0.30, 1);
  expect(share("post")).toBeCloseTo(0.15, 1);
});

it("Ausgang ist für dieselbe Chance immer gleich", () => {
  expect(sceneOf(live, bigChance)).toEqual(sceneOf(structuredClone(live), bigChance));
});

it("Einblendung passt zu Ausgang und Variante", () => {
  expect(sceneLabel({ ...s, outcome: "wide", variant: "over" })).toBe("DRÜBER!");
  expect(sceneLabel({ ...s, outcome: "post", variant: "bar" })).toBe("LATTE!");
});

it("Meldungstexte", () => {
  expect(liveEventText(state, "m1", goalByMueller)).toBe("34' TOR! Müller");
  expect(liveEventText(state, "m1", bigSaveByMueller)).toBe("34' Müller: gehalten");
  expect(liveEventText(state, "m1", smallChanceByMueller)).toMatch(/Müller/);
});
```

- [ ] **Step 2: Tests ausführen, sie schlagen fehl**

Run: `npx vitest run tests/ui/live/scenes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementieren**

- **Ausgang:** `u = hash01(matchId, minute, player, "ausgang")`. Bei `u < 0.55` gehalten, bei `u < 0.85` vorbei/drüber, sonst Pfosten/Latte.
- **Variante:** `v = hash01(matchId, minute, player, "variante")`.
  - Gehalten: `v < 0.25` ergibt `catch`, sonst `parry`.
  - Vorbei/drüber: `v < 0.4` ergibt `over`, sonst `side`.
  - Pfosten/Latte: `v < 0.4` ergibt `bar`, sonst `post`.
  - Tor: `null`.
- **`liveEventText`:**
  - Tor: wie `eventText`.
  - Großchance: `"{min}' {Nachname}: {Label ohne ! und klein}"`, also gehalten, vorbei, drüber, pfosten, latte.
  - Kleine Chance: Vorlage per `hash01(matchId, minute, "text")` aus
    `["Schuss von %s, drüber", "%s köpft, knapp vorbei", "Schuss von %s, geblockt", "%s zieht ab, Ecke", "Flanke, %s verpasst"]`, mit `"{min}' "` davor.
  - Alle übrigen Typen: `eventText`.

- [ ] **Step 4: Tests ausführen**

Run: `npx vitest run tests/ui/live/scenes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/live/scenes.ts tests/ui/live/scenes.test.ts
git commit -m "feat(live): Szenenliste, Ausgänge und Meldungstexte"
```

---

### Task 4: Wiedergabe – Uhr, Warteschlangen, Auflösung

**Files:**
- Create: `src/ui/live/playback.ts`
- Test: `tests/ui/live/playback.test.ts`

**Interfaces:**
- Consumes: `SceneEvent`, `isSceneEvent`, `sceneOf`, `SCENE_MS` (Task 3), `TEMPOS` aus `src/ui/logic/ticker.ts`
- Produces:
  ```ts
  export interface PlaybackOptions {
    lives: LiveMatch[];
    managed: MatchId[];          // Spiele, die Szenen bekommen
    from: number; to: number;    // halfBounds(half)
    scenes: boolean;             // Option „Torszenen“
  }
  export interface ActiveScene { scene: SceneEvent; elapsed: number; revealed: boolean }
  export class Playback {
    constructor(o: PlaybackOptions);
    readonly minute: number;
    step(now: number): MatchEvent[];        // Uhr +1 Minute (höchstens bis `to`); liefert sofort aufgelöste Ereignisse
    update(now: number): MatchEvent[];      // Szenen fortschreiben; liefert die jetzt aufgelösten Szenen-Ereignisse
    skipToEnd(): MatchEvent[];              // Minute = to, alles bis `to` aufgelöst, Szenen weg
    msPerMinute(tempo: number): number;     // TEMPOS[0], solange eine Szene läuft, sonst TEMPOS[tempo]
    active(matchId: MatchId, now: number): ActiveScene | null;
    revealed(matchId: MatchId): MatchEvent[];   // in Reihenfolge der Auflösung
    score(matchId: MatchId): Score;             // aus aufgelösten goal-Ereignissen
    readonly sceneRunning: boolean;
    readonly finished: boolean;             // minute >= to && keine Szene aktiv oder wartend
  }
  ```

- [ ] **Step 1: Failing tests**

Die Hilfe `liveWith(events, { managed })` baut ein `LiveMatch` mit vorgegebenen Ereignissen und 45 Angriffsseiten.

```ts
it("Ereignisse ohne Szene sind in ihrer Minute aufgelöst", () => {
  const p = new Playback({ lives: [liveWith([goalAt(3)])], managed: [], from: 0, to: 45, scenes: true });
  p.step(0); p.step(0);
  expect(p.score("m1")).toEqual({ home: 0, away: 0 });
  expect(p.step(0)).toHaveLength(1);
  expect(p.score("m1")).toEqual({ home: 1, away: 0 });
});

it("ein Tor in einem Manager-Spiel zählt erst bei der Auflösung", () => {
  const p = managedPlayback([goalAt(1)]);
  p.step(0);
  expect(p.score("m1").home).toBe(0);
  p.update(0);                                   // Szene startet bei 0
  p.update(SCENE_MS.reveal - 1);
  expect(p.score("m1").home).toBe(0);
  expect(p.update(SCENE_MS.reveal)).toHaveLength(1);
  expect(p.score("m1").home).toBe(1);
});

it("während einer Szene läuft die Uhr langsam", () => {
  const p = managedPlayback([goalAt(1)]);
  p.step(0); p.update(0);
  expect(p.msPerMinute(2)).toBe(1000);
  p.update(SCENE_MS.end);
  expect(p.msPerMinute(2)).toBe(200);
});

it("zwei Szenen im selben Spiel laufen nacheinander", () => {   // Review Focus 3
  const p = managedPlayback([goalAt(1), goalAt(2)]);
  p.step(0); p.update(0); p.step(500);
  p.update(SCENE_MS.end);                        // erste fertig, zweite startet jetzt
  expect(p.score("m1").home).toBe(1);
  p.update(SCENE_MS.end + SCENE_MS.reveal);
  expect(p.score("m1").home).toBe(2);
});

it("Leertaste löst alles bis zum Halbzeitende auf und beendet Szenen", () => {   // Review Focus 2
  const p = managedPlayback([goalAt(44), chanceAt(45, true)]);
  for (let i = 0; i < 44; i++) p.step(0);
  p.update(0);
  p.skipToEnd();
  expect(p.minute).toBe(45);
  expect(p.score("m1").home).toBe(1);
  expect(p.sceneRunning).toBe(false);
  expect(p.finished).toBe(true);
});

it("am Halbzeitende ist erst fertig, wenn keine Szene mehr offen ist", () => {
  const p = managedPlayback([goalAt(45)]);
  for (let i = 0; i < 45; i++) p.step(0);
  p.update(0);
  expect(p.finished).toBe(false);
  p.update(SCENE_MS.end); p.update(SCENE_MS.end);
  expect(p.finished).toBe(true);
});

it("2. Halbzeit: Ereignisse vor `from` gelten als aufgelöst", () => {   // Review Focus 4
  const p = new Playback({ lives: [liveWith([goalAt(20), goalAt(50)])], managed: ["m1"], from: 45, to: 90, scenes: true });
  expect(p.score("m1").home).toBe(1);
  p.step(0); p.update(0);
  expect(p.active("m1", 0)).toBeNull();           // Tor aus Minute 20 kommt nicht als Szene
});

it("ohne Torszenen-Option gibt es keine Szenen", () => {
  const p = new Playback({ lives: [liveWith([goalAt(1)])], managed: ["m1"], from: 0, to: 45, scenes: false });
  p.step(0);
  expect(p.score("m1").home).toBe(1);
  expect(p.sceneRunning).toBe(false);
});
```

- [ ] **Step 2: Tests ausführen, sie schlagen fehl**

Run: `npx vitest run tests/ui/live/playback.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementieren**

- **Pro Spiel:** eine Warteschlange von `SceneEvent`s und eine aktive Szene `{ scene, startedAt, revealed }`.
- **`step(now)`:**
  - Erhöht die Minute.
  - Für jedes Ereignis mit `e.minute === minute`: Ist das Spiel in `managed`, sind Szenen an und ist `isSceneEvent(e)`, wird es eingereiht. Sonst ist es sofort aufgelöst.
  - Am Ende wird `update(now)` aufgerufen, damit wartende Szenen sofort starten.
- **`update(now)`:**
  - Erreicht eine aktive Szene `elapsed >= SCENE_MS.reveal`, wird sie aufgelöst. Bei `elapsed >= SCENE_MS.end` wird sie entfernt.
  - Ist danach keine Szene aktiv und die Warteschlange nicht leer, startet die nächste mit `startedAt = now`.
- **`score`:** zählt aufgelöste `goal`-Ereignisse nach `e.club === live.home.club`.

- [ ] **Step 4: Tests ausführen**

Run: `npx vitest run tests/ui/live/playback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/live/playback.ts tests/ui/live/playback.test.ts
git commit -m "feat(live): Wiedergabe mit Szenen-Warteschlange und verzögerter Auflösung"
```

---

### Task 5: Aufteilung der Viertel und Live-Tabelle

**Files:**
- Create: `src/ui/live/layout.ts`
- Modify: `src/ui/logic/tables.ts` (`liveTableView` dazu)
- Modify: `docs/superpowers/specs/2026-11-06-live-viertel-design.md` (Abschnitt 4.1, siehe Step 3)
- Test: `tests/ui/live/layout.test.ts`, `tests/ui/tables.test.ts`

**Interfaces:**
- Consumes: `leagueOf` (`src/engine/season.ts`), `computeStandings`, `tableView`-Bausteine aus `tables.ts`
- Produces:
  ```ts
  export type LiveSlot = { kind: "match"; matchId: MatchId } | { kind: "table"; competitionId: CompetitionId };
  export interface LiveLayout { full: boolean; slots: LiveSlot[] }   // full: genau 1 Slot, bildschirmfüllend; sonst genau 4
  export function liveLayout(state: GameState, lives: LiveMatch[]): LiveLayout;
  export function managedMatchIds(state: GameState, lives: LiveMatch[]): MatchId[];
  // tables.ts
  export function liveTableView(state: GameState, competitionId: CompetitionId, scores: Record<MatchId, Score>): TableRowView[];
  ```

- [ ] **Step 1: Failing tests**

```ts
it("1 Spiel mit Manager: bildschirmfüllend", () => {
  expect(liveLayout(state1Manager, lives)).toEqual({ full: true, slots: [{ kind: "match", matchId: m1 }] });
});
it("zwei Manager im direkten Duell und sonst keiner: ein Spiel, bildschirmfüllend", () => { ... full: true ... });
it("3 Spiele: drei Viertel in Manager-Reihenfolge, das vierte zeigt die Liga des ersten Managers", () => {
  expect(layout.slots.map((s) => s.kind)).toEqual(["match", "match", "match", "table"]);
  expect(layout.slots[3]).toEqual({ kind: "table", competitionId: leagueOfFirstManager });
});
it("2 Spiele: zwei freie Viertel zeigen erst die Liga des ersten Managers, dann die andere Liga", () => {
  expect(layout.slots.slice(2)).toEqual([{ kind: "table", competitionId: "L1" }, { kind: "table", competitionId: "L2" }]);
});
it("kein Spiel mit Manager (Relegation ohne Manager-Verein): Tabelle bildschirmfüllend", () => {   // Review Focus 1
  expect(liveLayout(stateRelegationNoManager, relLives)).toEqual({ full: true, slots: [{ kind: "table", competitionId: leagueOfFirstManager }] });
});
// tables.test.ts
it("Live-Tabelle rechnet laufende Spielstände mit ein", () => {
  const rows = liveTableView(state, "L1", { [matchId]: { home: 1, away: 0 } });
  expect(rows.find((r) => r.club === homeClub)!.points).toBe(before + 3);
});
```

- [ ] **Step 2: Tests ausführen, sie schlagen fehl**

Run: `npx vitest run tests/ui/live/layout.test.ts tests/ui/tables.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementieren und Spec angleichen**

- **`managedMatchIds`:** Manager in `state.managers`-Reihenfolge. Für jeden das Live-Spiel seines Vereins, ohne doppelte Einträge.
- **`liveLayout`:**
  - Bei 0 oder 1 Spiel: `full`.
  - Sonst: Die Spiele kommen in die ersten Slots. Freie Slots bekommen abwechselnd die Liga des ersten Managers, `leagueOf(state, managers[0].clubId)`, und die jeweils andere Liga (`COMP.first`/`COMP.second`).
- **`liveTableView`:** Klon der Competition. Für Spiele der Competition, deren `id` in `scores` steht, wird `result` auf den Live-Stand gesetzt. Danach wie `tableView`.
- **Spec 4.1, Live-Tabelle:** Statt „Spielen die Manager in verschiedenen Ligen und sind zwei Viertel frei, zeigt das zweite freie Viertel die andere Liga.“ heißt es künftig: „Sind zwei Viertel frei, zeigt das zweite immer die andere Liga (zwei gleiche Tabellen wären sinnlos).“ Dazu der Satz: „Gibt es kein Spiel mit Manager, zeigt der Bildschirm die Tabelle der Liga des ersten Managers bildschirmfüllend.“

- [ ] **Step 4: Tests ausführen**

Run: `npx vitest run tests/ui/live/layout.test.ts tests/ui/tables.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/live/layout.ts src/ui/logic/tables.ts tests/ui/live/layout.test.ts tests/ui/tables.test.ts docs/superpowers/specs/2026-11-06-live-viertel-design.md
git commit -m "feat(live): Aufteilung der Viertel und Live-Tabelle"
```

---

### Task 6: Szenen-Renderer und Grafiken

**Files:**
- Modify: `assets-raw/szene/aufbereiten.py`: `OUT` wird `src/ui/live/assets`. Der Mockup-Zusammenbau liest die PNGs von dort.
- Create: `src/ui/live/assets/{stadion,torwart,schuetze,ball-effekte,netz}.png` und `sprites.json`, erzeugt durch das Skript.
- Delete: `docs/superpowers/mockups/szene/` (die PNGs liegen jetzt unter `src/ui/live/assets`).
- Create: `src/ui/live/sceneRender.ts`
- Test: `tests/ui/live/sceneRender.test.ts`

**Interfaces:**
- Consumes: `SceneEvent`, `SCENE_MS` (Task 3), `hash01` (Task 2)
- Produces:
  ```ts
  export interface ShotPlan {
    outcome: SceneOutcome; variant: SceneVariant;
    side: -1 | 1; height: "low" | "mid" | "high";
    target: { x: number; y: number }; diveSide: -1 | 1; diveReach: number;
  }
  export interface SceneSheets { shooter: CanvasImageSource; keeper: CanvasImageSource }
  export function planShot(s: SceneEvent): ShotPlan;
  export function keeperColor(clubColors: [string, string]): string;
  export function loadSceneImages(): Promise<void>;                     // lädt die PNGs einmal
  export function sceneSheets(shirt: string, shorts: string, keeper: string): SceneSheets;   // umgefärbt, zwischengespeichert
  export function renderScene(ctx: CanvasRenderingContext2D, plan: ShotPlan, t: number, sheets: SceneSheets): void;
  export const GOAL: { l: 92; r: 228; bar: 58; line: 95; cx: 160 };
  ```

- [ ] **Step 1: Grafiken ins Projekt legen**

`OUT` in `aufbereiten.py` auf `src/ui/live/assets` umstellen. Den Mockup-Teil so anpassen, dass er die PNGs und `sprites.json` dort liest. Danach `docs/superpowers/mockups/szene/` löschen.

Run: `uv run --no-project --with pillow --with numpy --with scipy python assets-raw/szene/aufbereiten.py`
Expected: `stadion.png (320, 200)`, `torwart.png (256, 168)`, `schuetze.png (288, 192)`, `ball-effekte.png (96, 64)`, `netz.png (136, 37)`, und `live-viertel.html` neu geschrieben.

- [ ] **Step 2: Failing tests**

```ts
it("Tor: Ziel liegt im Tor", () => {
  const p = planShot(scene("goal"));
  expect(p.target.x).toBeGreaterThan(GOAL.l); expect(p.target.x).toBeLessThan(GOAL.r);
  expect(p.target.y).toBeGreaterThan(GOAL.bar); expect(p.target.y).toBeLessThan(GOAL.line);
});
it("vorbei: Ziel liegt seitlich außerhalb, drüber: oberhalb der Latte", () => { ... });
it("Pfosten: Ziel auf dem Pfosten (x = cx ± 69), Latte: y = bar - 1", () => { ... });
it("gehalten: Torwart springt zur Schussseite", () => { expect(p.diveSide).toBe(p.side); });
it("gleiche Szene, gleicher Plan", () => { expect(planShot(s)).toEqual(planShot(structuredClone(s))); });
it("Torwartfarbe hebt sich von beiden Vereinsfarben ab", () => {
  expect(keeperColor(["#3cb043", "#ffffff"])).not.toBe("#3cb043");
});
it("renderScene zeichnet zu allen Zeitpunkten ohne Fehler", () => {
  // ctx-Attrappe: Proxy, jede Methode ist ein no-op, drawImage wird gezählt
  for (const t of [0, 300, 760, 1100, 1280, 1700, 2600, 3399]) renderScene(fakeCtx, planShot(scene("post")), t, fakeSheets);
  expect(drawImageCalls).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Tests ausführen, sie schlagen fehl**

Run: `npx vitest run tests/ui/live/sceneRender.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementieren, als Port von `docs/superpowers/mockups/szene.js`**

- **Übernehmen:**
  - Konstanten und Zeiten,
  - `drawFrame` mit Ausrichtung `feet`/`center` und Spiegeln,
  - `drawBall` (pixelweise),
  - `drawShadow`, `ballAt`,
  - die Posenfolgen von Torwart und Schütze,
  - das Netz bei einem Tor (blinkt in 150-ms-Takten bis 900 ms nach der Auflösung),
  - den Funken bei Pfosten/Latte,
  - das Grasbüschel beim Schuss,
  - `keeperColor` mit der Liste `["#3cb043", "#d4b000", "#2b2b2b", "#e05a00", "#9a9a9a"]` und Mindestabstand 160.
- **Ändern:**
  - `planScene(outcome)` wird zu `planShot(s)`. Statt `Math.random`/`rnd`/`pick` nimmt es `hash01(s.matchId, s.minute, s.player, "<zweck>")` und übernimmt Ausgang und Variante aus `SceneEvent` (`catch` statt `central`, `over`, `bar`).
- **Assets** per Vite-Import (`import stadionUrl from "./assets/stadion.png"`, `import sprites from "./assets/sprites.json"`).
- **`sceneSheets`** färbt über ein Offscreen-Canvas mit `getImageData` um, Toleranz siehe Global Constraints. Der Cache-Schlüssel sind die drei Farben.

- [ ] **Step 5: Tests ausführen**

Run: `npx vitest run tests/ui/live/sceneRender.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add assets-raw/szene/aufbereiten.py src/ui/live/assets src/ui/live/sceneRender.ts tests/ui/live/sceneRender.test.ts docs/superpowers/mockups
git commit -m "feat(live): Szenen-Renderer mit Pixelgrafiken"
```

---

### Task 7: Bausteine der Viertel – Druckkurve, Live-Tabelle, Spiel-Viertel

**Files:**
- Create: `src/ui/live/PressureGraph.svelte`
- Create: `src/ui/live/LiveTable.svelte`
- Create: `src/ui/live/SceneView.svelte`
- Create: `src/ui/live/MatchPanel.svelte`
- Test: `tests/ui/live/panels.test.ts`

**Interfaces:**
- Consumes: `pressureCurve` (Task 2), `liveEventText`, `sceneLabel`, `SceneEvent` (Task 3), `ActiveScene` (Task 4), `liveTableView` (Task 5), `planShot`, `renderScene`, `sceneSheets`, `keeperColor`, `loadSceneImages` (Task 6), `Crest` und `Panel` aus `src/ui/theme`
- Produces (Props):
  - `PressureGraph`: `{ curve: number[]; minute: number; marks: { minute: number; home: boolean; goal: boolean }[]; homeColor: string; awayColor: string; homeName: string; awayName: string; chances: [number, number] }`
  - `LiveTable`: `{ state: GameState; competitionId: CompetitionId; scores: Record<MatchId, Score> }`
  - `SceneView`: `{ state: GameState; scene: SceneEvent; elapsed: number; revealed: boolean }`. Zeichnet bei jeder Änderung von `elapsed` neu.
  - `MatchPanel`: `{ state: GameState; live: LiveMatch; minute: number; score: Score; revealed: MatchEvent[]; active: ActiveScene | null; flash: boolean }`

- [ ] **Step 1: Failing tests**

```ts
it("MatchPanel zeigt Spielstand, Minute und die letzten 3 Meldungen, neueste oben", () => {
  render(MatchPanel, { props: { ...base, minute: 34, score: { home: 1, away: 0 }, revealed: [e10, e20, e30, e33] } });
  expect(screen.getByText("1:0")).toBeTruthy();
  expect(screen.getByText("34'")).toBeTruthy();
  const lines = [...document.querySelectorAll(".tick div")].map((d) => d.textContent);
  expect(lines).toHaveLength(3);
  expect(lines[0]).toMatch(/^33'/);
});
it("Kurve zeigt nur Minuten bis zur aktuellen, Halbzeit-Verlauf bleibt", () => {   // Review Focus 4
  render(PressureGraph, { props: { ...graph, curve: Array(90).fill(0.5), minute: 50 } });
  expect(document.querySelectorAll(".col")).toHaveLength(50);
});
it("während einer Szene zeigt MatchPanel die Szene mit Szenenzeile statt Kurve", () => {
  render(MatchPanel, { props: { ...base, active: { scene, elapsed: 500, revealed: false } } });
  expect(screen.getByText(/GROSSCHANCE 34'/)).toBeTruthy();
  expect(document.querySelector(".graph")).toBeNull();
});
it("Einblendung erst nach der Auflösung", () => {
  render(SceneView, { props: { state, scene, elapsed: 1279, revealed: false } });
  expect(screen.queryByText("TOR!")).toBeNull();
  // rerender mit elapsed 1280, revealed true → TOR! sichtbar
});
it("LiveTable hebt Manager-Vereine hervor", () => { ... ".managed" ... });
```

jsdom hat kein Canvas. `HTMLCanvasElement.prototype.getContext` wird im Test mit derselben Proxy-Attrappe wie in Task 6 belegt.

- [ ] **Step 2: Tests ausführen, sie schlagen fehl**

Run: `npx vitest run tests/ui/live/panels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementieren**

Als Vorlage dient der Entwurf `live-viertel.html`. Seine Maße gelten für 320×200 und werden fürs Viertel verdoppelt.

- **`MatchPanel`:**
  - Kopfzeile aus Holz: `Crest size={32}` und Name je Verein, Spielstand mit Blinken bei `flash`, Minute.
  - Darunter `PressureGraph`, unten die Meldungsleiste mit 3 Zeilen VT323 mindestens 20 px, Tore in `--gold`.
- **`PressureGraph`:**
  - Säulen per `div` oder SVG: oben in der Heimfarbe, unten in der Gastfarbe.
  - Mittellinie, Halbzeitstrich bei 45, Cursor an der aktuellen Minute, Punkte für `marks`.
  - Statistikzeile: `▲ Heim · Chancen x : y · Gast ▼`.
- **`SceneView`:**
  - `<canvas width=320 height=200>` mit CSS-Breite 100 % und `image-rendering: pixelated`.
  - Szenenzeile oben, Einblendung `sceneLabel` ab `revealed`.
  - Schütze in den Farben des angreifenden Vereins (`colors[0]` als Trikot, `colors[1]` als Hose), Torwart in `keeperColor(...)` des verteidigenden Vereins.
- **`LiveTable`:** kompakte Tabelle (Platz, Verein, Spiele, Tore, Punkte). Manager-Vereine in `--gold`.

Alle CSS-Maße müssen dem Maß-Wächter genügen.

- [ ] **Step 4: Tests ausführen, inklusive Maß-Wächter**

Run: `npx vitest run tests/ui/live/panels.test.ts tests/ui/sizes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/live/*.svelte tests/ui/live/panels.test.ts
git commit -m "feat(live): Viertel mit Druckkurve, Szene und Live-Tabelle"
```

---

### Task 8: Live-Bildschirm einbauen, Konferenz entfernen

**Files:**
- Create: `src/ui/screens/LiveScreen.svelte`
- Delete: `src/ui/screens/Conference.svelte`, `tests/ui/conference.test.ts`
- Modify:
  - `src/ui/controller.svelte.ts:31,275,277`: View `{ kind: "live"; half: 1 | 2 }` statt `conference`.
  - `src/App.svelte:48`.
  - `src/ui/logic/ticker.ts`: `tickerRows`, `competitionsOf`, `competitionName` und `TickerRow` entfallen. `soundsFor` wird durch `whistleDue(from, to, end)` ersetzt.
  - `src/ui/logic/options.ts`: `scenes: boolean`, Standard `true`, `loadOptions` mit Fallback.
  - `src/ui/screens/Options.svelte`: „Spieltempo“ und „Torszenen“.
  - `docs/superpowers/specs/2026-10-31-fussballmanager-design.md`, Abschnitte 2, 3.2, 3.3 und 4: Konferenz durch Live-Bildschirm ersetzen und auf die Live-Spec verweisen. Abschnitt 2 zur Dauer gemäß Live-Spec Abschnitt 12.
- Test:
  - `tests/ui/live/liveScreen.test.ts` (neu),
  - `tests/ui/flow.test.ts`, `tests/ui/options.test.ts`, `tests/ui/sound.test.ts`, `tests/ui/ticker.test.ts`, `tests/ui/controller.test.ts`, `tests/ui/halftime.test.ts`, `tests/ui/failure.test.ts`, `tests/ui/persist.test.ts`, `tests/ui/economyFlow.test.ts`: `conference` wird überall zu `live`.
  - `tests/e2e/season.spec.ts`, `tests/e2e/layout.spec.ts`.

**Interfaces:**
- Consumes: alles aus Task 2–7, `controller.playSound`, `controller.options`, `controller.advance`.
- Produces: View-Art `"live"`. `Options.scenes`.

- [ ] **Step 1: Failing tests**

`tests/ui/live/liveScreen.test.ts`, mit fake timers wie im bisherigen `conference.test.ts` (`atConference` wird `atLive`):

```ts
it("läuft bis zur Halbzeit, wartet auf offene Szenen und bietet dann „Weiter“ an", ...);
it("Leertaste: Spielstände = Halbzeitstände der Engine, keine Szene offen", async () => {   // Review Focus 2
  const c = await atLive();
  await fireEvent.keyDown(window, { key: " " });
  for (const l of managedLives(c)) expect(screen.getByText(`${l.home.goals}:${l.away.goals}`)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Weiter (Enter)" })).toBeTruthy();
});
it("bei einem Manager füllt das Spiel den Bildschirm, bei drei gibt es vier Viertel mit einer Tabelle", ...);
it("Torton erst bei der Auflösung der Szene", ...);   // playSound-Spy, Zeit bis kurz vor und bis nach 1280 ms Szenenzeit vorspulen
it("Option „Torszenen“ aus: keine Szene, Torton in der Minute", ...);
it("kein Spiel mit Manager: Tabelle bildschirmfüllend, Uhr und „Weiter“ funktionieren", ...);   // Review Focus 1
// options.test.ts
it("lädt fehlendes `scenes` als true", () => expect(loadOptions(prefsWith({ tempo: 1 })).scenes).toBe(true));
```

- [ ] **Step 2: Tests ausführen, sie schlagen fehl**

Run: `npx vitest run tests/ui/live/liveScreen.test.ts tests/ui/options.test.ts`
Expected: FAIL.

- [ ] **Step 3: `LiveScreen.svelte` implementieren und einbauen**

- **Beim Start:**
  - `new Playback({ lives, managed: managedMatchIds(state, lives), ...halfBounds(half), scenes: options.scenes })`,
  - `liveLayout(state, lives)`,
  - `loadSceneImages()`.
- **Uhr:**
  - `setTimeout` mit `playback.msPerMinute(tempo)`, dann `step(performance.now())`.
  - Zusätzlich eine `requestAnimationFrame`-Schleife mit `update(performance.now())`, solange `sceneRunning`.
  - Nach jeder Mutation einen `$state`-Zähler erhöhen, damit Svelte neu rendert.
- **Töne:**
  - `goal` für jedes neu aufgelöste `goal` eines Manager-Spiels, nur einmal pro Aufruf, aus den Rückgaben von `step` und `update`.
  - `whistle` über `whistleDue`, wenn die Minute `to` erreicht.
  - Nach `skipToEnd` kein Torton, nur der Pfiff.
- **Layout:**
  - `full` ergibt einen Slot mit 1280×800.
  - Sonst ein Raster 2×2 à 640×400 mit `MatchPanel`/`LiveTable`.
  - Die Scores für `LiveTable`: Bei Manager-Spielen `playback.score(id)`, bei allen anderen der Stand aus Ereignissen mit Minute ≤ aktueller Minute.
- **Fußleiste:**
  - `−` `Tempo n/3` `+`, „Überspringen (Leertaste)“.
  - Bei `finished`: `HALBZEIT` bzw. `ABPFIFF` und „Weiter (Enter)“.
  - Tasten `+`, `-`, Leertaste und Enter wie bisher, TAB entfällt.
- **Controller und App:** `conference` wird zu `live`, `Conference.svelte` und die nicht mehr genutzten Teile von `ticker.ts` werden gelöscht.
- **Optionen:** `scenes` und die Beschriftungen.
- **Haupt-Spec** anpassen.

- [ ] **Step 4: Alle Unit-Tests anpassen und ausführen**

Run: `npx vitest run`
Expected: alles PASS. Insbesondere `tests/ui/sizes.test.ts`, der Fingerabdruck, die Kalibrierung und die Langzeittests.

- [ ] **Step 5: Typprüfung**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 6: Playwright anpassen und ausführen**

- In `tests/e2e/season.spec.ts` und `layout.spec.ts`: Statt `/KONFERENZ/` wird auf das Live-Viertel gewartet (z. B. `getByText("Tempo", { exact: false })` oder eine Kennung des Live-Bildschirms).
- Leertaste, `HALBZEIT`, „Weiter (Enter)“ und `expectNoOverflow(page, "Live")` bleiben.

Run: `npx playwright test`
Expected: alle PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src tests docs/superpowers/specs
git commit -m "feat(live): Live-Bildschirm ersetzt die Konferenz"
```
