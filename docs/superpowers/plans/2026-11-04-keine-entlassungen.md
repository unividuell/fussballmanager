# Keine Entlassungen – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manager werden nie entlassen und bekommen keine Jobangebote. Jeder Manager bleibt für das ganze Spiel bei seinem Startverein. Alte Spielstände (v1) werden automatisch auf v2 migriert.

**Architecture:**
- **Task 1 (Oberfläche):** entfernt alles, was Manager ohne Verein oder Jobangebote anzeigt. Das geht, solange die Engine die Felder noch kennt.
- **Task 2 (Engine und Speicher):**
  - Das Datenmodell ändert sich: `Manager.clubId` ist nie mehr `null`, `jobOffers` und `unemployedFor` entfallen, das Schema wird v2.
  - Die Vorstandslogik wird auf reine Rückmeldung reduziert.
  - Der Befehl `acceptJobOffer` entfällt.
  - Dazu kommt die erste echte Migration v1 → v2.
- **Task 3:** räumt die letzten Stellen auf und passt den Langzeittest und den Playwright-Test an.

**Tech Stack:** TypeScript 5.6.3, Svelte 5.57.3 (Runes), Vitest 5.0.5, @testing-library/svelte 5.4.2, user-event 14.6.8, Playwright 1.64.1. Neue Abhängigkeiten gibt es keine.

**Spec:** `docs/superpowers/specs/2026-10-31-fussballmanager-design.md`, geändert am 2026-11-04. Maßgeblich sind:
- Abschnitt 8.5 „Keine Entlassungen“;
- 3.1 Punkt 3, 3.2 Punkt 1 und 3.3 Punkt 4;
- 9 (Entscheidungsnachrichten ohne Jobangebot);
- 10 (Migration).

## Global Constraints

- **Kein Verein ohne Manager-Wechsel:**
  - Manager werden nie entlassen und bekommen keine Jobangebote.
  - `Manager.clubId` ist immer ein existierender Verein, und `clubs[m.clubId].managerId === m.id` gilt dauerhaft.
- **Vorstand:**
  - Fällt das Vertrauen unter 30 (`WARN_BELOW`), kommt **einmal** die Nachricht „Der Vorstand ist unzufrieden.“.
  - Erneut kommt sie erst, nachdem das Vertrauen wieder über 40 gestiegen ist.
- **Saisonbilanz:**

  | Ergebnis | Nachricht | Vertrauen |
  |---|---|---|
  | erreicht (Platz ≤ Ziel) | „Der Vorstand ist zufrieden: Saisonziel erreicht.“ | +15 (max. 100) |
  | verfehlt | „Der Vorstand ist enttäuscht: Saisonziel verfehlt.“ | −10 (min. 0) |
  | deutlich verfehlt (Platz > Ziel + 5) | „Der Vorstand ist sehr enttäuscht: Saisonziel deutlich verfehlt.“ | −15 (min. 0) |

- **Sponsorbonus:** Er hängt weiterhin am Saisonziel (`expectationMet`). Dieser Code bleibt unverändert.
- **Schema v2:**
  - Neue Spielstände haben `version: 2`.
  - Ein v1-Spielstand wird beim Laden migriert. Die eingefrorene Datei `tests/storage/fixtures/save-v1.json` wird **nicht** verändert.
- **Migrationen** arbeiten auf rohen JSON-Objekten und importieren keine Engine-Logik. Erlaubt sind nur Typen und `isObject`.
- **Engine:** Sie bleibt deterministisch, also ohne `Math.random` und `Date.now`. Spielstände bleiben JSON-serialisierbar, mit `null` statt `undefined`.
- **Oberfläche:**
  - Alle Texte sind deutsch.
  - Jeder `keydown`-Handler am Fenster beginnt mit `if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;`.
  - Esc-Regel: Ist ein Dialog offen, schließt Esc nur den Dialog.
- In Dateien mit `$state` heißt keine lokale Variable `state` (stattdessen `gs`).
- Die Projekt-Typprüfung hat keine Node-Typen, deshalb gibt es keine `node:*`-Importe in Dateien unter `src/` und `tests/`.
- Commit-Nachrichten sind deutsch im Stil `feat(engine): …` und enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Alter v1-Spielstand mit einem entlassenen Manager** (`clubId: null`, offene Jobangebote, Nachricht mit Verweis auf ein Jobangebot): Er lädt, der Manager hat danach einen Verein, und das Spiel läuft weiter. *Test in Task 2.*
2. **Vertrauen fällt auf 0 und bleibt dort über viele Spieltage:** Der Manager bleibt beim Verein, und die Warnung kommt nur einmal. *Test in Task 2.*
3. **Ein v1-Spielstand ohne Besonderheiten** (die eingefrorene Testdatei): Er lädt als v2 und ist spielbar. *Test in Task 2.*
4. **Hot-Seat-Runde, Halbzeit und Nachrichten-Bildschirm nach dem Entfernen der Weiche „ohne Verein“:** Jeder Bildschirm ist für jeden Manager erreichbar, Esc führt ins Hauptmenü. *Tests in Task 1.*
5. **Zehn Saisons mit Managern:** Sie bleiben bei ihrem Verein, auch bei Abstieg oder Pleite. *Test in Task 3.*

---

### Task 1: Oberfläche ohne „Ohne Verein“ und ohne Jobangebote

**Files:**
- Delete: `src/ui/screens/Jobs.svelte`
- Modify: `src/App.svelte`, `src/ui/controller.svelte.ts`, `src/ui/screens/TurnStart.svelte`, `src/ui/screens/Messages.svelte`
- Test: `tests/ui/messages.test.ts`, `tests/ui/menu.test.ts`, `tests/ui/controller.test.ts` (die Tests zu „ohne Verein“ und Jobangebote entfernen), `tests/ui/turnStart.test.ts` (neu)

**Interfaces:**
- Consumes: den bestehenden `GameController` mit `open`, `view` und `screen`.
- Produces:
  - `TurnScreen` ohne `"jobs"`.
  - `computeView` gibt für `managerTurns` immer `{ kind: this.screen, managerId: pending[0] }` zurück.
  - `WITHOUT_CLUB` gibt es nicht mehr.

- [ ] **Step 1: Neuen Test schreiben**

`tests/ui/turnStart.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

function started(): GameController {
  const c = new GameController();
  const world = generateWorld(4);
  const ids = Object.keys(world.clubs);
  c.startGame(world, [{ name: "Anna", clubId: ids[0] }, { name: "Ben", clubId: ids[20] }]);
  return c;
}

describe("„ist dran“ und Nachrichten ohne Sonderfall", () => {
  it("„ist dran“ zeigt den Verein, Enter öffnet das Hauptmenü", async () => {
    const c = started();
    render(App, { controller: c });
    await tick();
    const club = c.snapshot!.state.clubs[c.snapshot!.state.managers[0].clubId!];
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
    expect(screen.getAllByText(club.name).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Ohne Verein")).toBeNull();
    await fireEvent.keyDown(window, { key: "Enter" });
    expect(c.view.kind).toBe("menu");
  });

  it("jeder Bildschirm ist erreichbar; Nachrichten: Esc führt ins Hauptmenü", async () => {
    const c = started();
    const anna = c.snapshot!.state.managers[0].id;
    for (const s of ["squad", "training", "contracts", "transfers", "finance", "tables", "messages", "save", "options"] as const) {
      c.open(s);
      expect(c.view).toEqual({ kind: s, managerId: anna });
    }
    c.open("messages");
    render(App, { controller: c });
    await tick();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });
});
```

- [ ] **Step 2: Den Test laufen lassen**

Run: `npx vitest run tests/ui/turnStart.test.ts`
Expected: PASS oder FAIL, beides ist hier in Ordnung. Der Test sichert das Verhalten ab, das nach dem Umbau gelten muss, und kann schon vorher grün sein. Notiere das Ergebnis im Report.

- [ ] **Step 3: Oberfläche umbauen**

**Löschen:** `src/ui/screens/Jobs.svelte`.

**`src/App.svelte`:** Den Import von `Jobs` und den Zweig `{:else if view.kind === "jobs"} … {/key}` entfernen.

**`src/ui/controller.svelte.ts`:**
- `"jobs"` aus `TurnScreen` entfernen.
- Die Konstante `WITHOUT_CLUB` samt Kommentar entfernen.
- In `computeView` wird der Fall `managerTurns` zu:

```ts
      case "managerTurns":
        return { kind: this.screen, managerId: p.pending[0] };
```

**`src/ui/screens/TurnStart.svelte`:**
- `club` bleibt `$derived(clubOf(controller.snapshot!.state, managerId))`.
- Enter ruft immer `controller.open("menu")` auf.
- Im Markup entfällt der `{:else}`-Zweig mit „Ohne Verein“ und „Jobangebote (Enter)“. Übrig bleiben Wappen, Überschrift, Vereinsname, „Los geht's (Enter)“ und die Autosave-Warnung:

```svelte
        {#if club}<Crest colors={club.colors} pattern={club.crest} size={48} />{/if}
        <h1>{controller.managerName(managerId).toUpperCase()} IST DRAN</h1>
        {#if club}<p>{club.name}</p>{/if}
        <button class="btn primary" onclick={() => controller.open("menu")}>Los geht's (Enter)</button>
        {#if controller.autosaveFailed}
          <p class="warn">Autosave fehlgeschlagen – der Spielstand wird nicht automatisch gespeichert.</p>
        {/if}
```

**`src/ui/screens/Messages.svelte`:**
- `hasClub` entfernen.
- `link()` wird zu:

```ts
  function link(m: Message): { label: string; go: () => void } | null {
    switch (m.ref?.type) {
      case "transferOffer":
        return { label: "Zum Angebot", go: () => controller.openTransfers("offers") };
      case "sponsor":
        return { label: "Zu den Finanzen", go: () => controller.open("finance") };
      case "negotiation":
        return { label: "Zu den Verträgen", go: () => controller.open("contracts") };
      default:
        return null;
    }
  }
```

- `back()` ruft `controller.open("menu")` auf.
- Alle weiteren Verwendungen von `hasClub` in dieser Datei entfernen, auch im Markup.

**Tests:** Entferne alle Tests unter `tests/ui/`, die `fireManager`, `jobOffers`, `acceptJobOffer`, `"jobs"`, „Ohne Verein“ oder „Jobangebote“ benutzen. Nach dem Stand vom 2026-11-04 sind das:
- in `tests/ui/messages.test.ts` die Tests ab „ohne Verein: Angebote annehmen …“ bis einschließlich dem Test mit `anna().jobOffers = [other.id]`;
- in `tests/ui/menu.test.ts` der Block `describe("„ist dran“ ohne Verein", …)`;
- in `tests/ui/controller.test.ts` der Block `describe("GameController ohne Verein", …)`.

Entferne danach unbenutzte Importe (`fireManager`, `Rng`). Die übrigen Tests in diesen Dateien bleiben unverändert.

Run: `grep -rn "jobs\|Jobangebot\|Ohne Verein\|fireManager" src/ui src/App.svelte tests/ui`
Expected: keine Treffer, außer in Wörtern, die nichts damit zu tun haben.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui && npm run check`
Expected: PASS, 0 Fehler, 0 Warnungen.

- [ ] **Step 5: Commit**

```bash
git add -A src/ui src/App.svelte tests/ui
git commit -m "refactor(ui): keine Ansichten mehr für Manager ohne Verein und Jobangebote"
```

---

### Task 2: Engine und Speicher – keine Entlassungen, Schema v2 mit Migration

**Files:**
- Modify: `src/engine/model.ts`, `src/engine/economy/board.ts`, `src/engine/economy/processing.ts`, `src/engine/commands.ts`, `src/engine/season.ts`, `src/engine/generator.ts`
- Create: `src/storage/migrations.ts`
- Modify: `src/storage/migrate.ts`, `src/storage/validate.ts`
- Test:
  - `tests/engine/economy/board.test.ts` (neu schreiben);
  - `tests/storage/migrations.test.ts` (neu);
  - `tests/storage/savefile.test.ts` (an v2 anpassen);
  - alle Tests, die Manager mit `jobOffers` oder `unemployedFor` anlegen oder `fireManager`, `acceptJobOffer`, `unemployedTick`, `jobOffersFor` oder `clearStaleJobOffers` benutzen (die Liste steht in Step 6).

**Interfaces:**
- Consumes: aus Task 1 die Oberfläche ohne den Bildschirm „jobs“.
- Produces:
  - `interface Manager { id: ManagerId; name: string; clubId: ClubId }`
  - `Message.ref.type: "transferOffer" | "sponsor" | "negotiation"`
  - `GameState.version: 2`
  - `boardChecks(state: GameState): void` (ohne `rng`)
  - `seasonReview(state: GameState, tables: Record<CompetitionId, ClubId[]>): void` (ohne `rng`)
  - Konstanten `WARN_BELOW = 30`, `WARN_RESET = 40`, `CLEARLY_MISSED_BY = 5`
  - `CURRENT_VERSION = 2`, `MIGRATIONS = { 1: v1ToV2 }`
  - `v1ToV2(raw): raw` aus `src/storage/migrations.ts`

- [ ] **Step 1: Board-Tests neu schreiben**

Ersetze den Inhalt von `tests/engine/economy/board.test.ts`. Behalte dabei **unverändert** die bestehenden Tests für `assignExpectations`, `expectationLabel`, `expectationMet` und `updateConfidence`, mit Setup und Hilfsfunktionen wie `anna(s)` und `tables(s, rank)`, sofern es sie gibt. Lies die Datei zuerst.

Entferne alle Tests zu `fireManager`, `acceptJobOffer`, `unemployedTick`, `jobOffersFor` und `clearStaleJobOffers`. Ersetze die Tests zu `boardChecks` und `seasonReview` durch diese hier. Passe die Imports und den Testaufbau an die vorhandenen Helfer der Datei an, etwa `newGame()`, `anna(s)` oder `tables(s, rank)`.

```ts
describe("boardChecks – keine Entlassung", () => {
  it("warnt einmal unter 30, erst nach Erholung über 40 erneut; der Manager bleibt", () => {
    const s = /* Spiel mit Manager Anna, wie in den bisherigen Tests der Datei */;
    const club = s.clubs[anna(s).clubId];
    const count = () => s.messages.filter((m) => m.managerId === anna(s).id && m.text === "Der Vorstand ist unzufrieden.").length;
    s.calendarIndex = 20;
    club.board.confidence = 0;
    for (let i = 0; i < 10; i++) boardChecks(s);
    expect(count()).toBe(1);
    expect(anna(s).clubId).toBe(club.id);
    expect(club.managerId).toBe(anna(s).id);
    club.board.confidence = 35;
    boardChecks(s);
    club.board.confidence = 10;
    boardChecks(s);
    expect(count()).toBe(1);
    club.board.confidence = 41;
    boardChecks(s);
    club.board.confidence = 10;
    boardChecks(s);
    expect(count()).toBe(2);
  });
});

describe("seasonReview – nur Rückmeldung", () => {
  it("Ziel erreicht: +15 und Lob", () => { /* Platz = Ziel */ });
  it("Ziel verfehlt: −10 und Enttäuschung", () => { /* Platz = Ziel + 3 */ });
  it("Ziel deutlich verfehlt: −15, Nachricht, Manager bleibt beim Verein", () => { /* Platz = Ziel + 6 */ });
});
```

Schreibe die drei `seasonReview`-Tests vollständig aus. Bestimme die Platzierung über die vorhandene Hilfe `tables(s, rank)` oder baue `tables` selbst: `Record<CompetitionId, ClubId[]>` mit Annas Verein auf Index `rank - 1`. Setze vorher `confidence = 50`.

Erwartet werden genau die Werte und Texte aus den Global Constraints:
- 65 / „Der Vorstand ist zufrieden: Saisonziel erreicht.“
- 40 / „Der Vorstand ist enttäuscht: Saisonziel verfehlt.“
- 35 / „Der Vorstand ist sehr enttäuscht: Saisonziel deutlich verfehlt.“

Prüfe jedes Mal zusätzlich `anna(s).clubId` unverändert und `s.managers[0]` ohne die Schlüssel `jobOffers` und `unemployedFor`. Prüfe außerdem: Nach `seasonReview` gibt es keine Nachricht, deren Text mit „Jobangebote“ beginnt.

- [ ] **Step 2: Migrationstests schreiben**

`tests/storage/migrations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { migrate } from "../../src/storage/migrate";
import { v1ToV2 } from "../../src/storage/migrations";
import { decodeSave } from "../../src/storage/savefile";
import { validateState } from "../../src/storage/validate";
import savedV1 from "./fixtures/save-v1.json?raw";

function v1State(): Record<string, any> {
  return JSON.parse(savedV1).state;
}

describe("Migration v1 → v2", () => {
  it("die eingefrorene v1-Datei lädt als v2 ohne Jobfelder", () => {
    const r = decodeSave(savedV1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.state.version).toBe(2);
    for (const m of r.file.state.managers) expect(Object.keys(m).sort()).toEqual(["clubId", "id", "name"]);
  });

  it("ein entlassener Manager bekommt den schwächsten freien Zweitligisten", () => {
    const s = v1State();
    const anna = s.managers[0];
    const old = anna.clubId;
    s.clubs[old].managerId = null;
    anna.clubId = null;
    anna.jobOffers = [s.competitions.L1.clubs[0]];
    anna.unemployedFor = 2;
    s.messages.push({ id: "msgX", managerId: anna.id, season: 1, calendarIndex: 1, text: "Jobangebote: …", ref: { type: "jobOffer", id: anna.jobOffers[0] } });

    const free = (s.competitions.L2.clubs as string[])
      .map((id) => s.clubs[id])
      .filter((c) => c.managerId === null)
      .sort((a, b) => a.reputation - b.reputation || (a.id < b.id ? -1 : 1))[0];

    const r = migrate(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.state.managers[0];
    expect(m.clubId).toBe(free.id);
    expect(r.state.clubs[free.id].managerId).toBe(m.id);
    expect(r.state.clubs[free.id].board.confidence).toBe(60);
    expect(r.state.messages.find((x) => x.id === "msgX")!.ref).toBeNull();
    expect(validateState(r.state)).toBeNull();
  });

  it("v1ToV2 setzt die Version auf 2 und verändert nichts anderes an Vereinen mit Manager", () => {
    const s = v1State();
    const before = JSON.parse(JSON.stringify(s.clubs));
    const out = v1ToV2(s);
    expect(out.version).toBe(2);
    expect(out.clubs).toEqual(before);
  });
});
```

`any` steht hier nur im Testaufbau, weil das rohe v1-JSON keinen Typ hat. Erlaubt `svelte-check` es nicht, nimm `Record<string, unknown>` mit Casts.

- [ ] **Step 3: Tests laufen lassen – sie schlagen fehl**

Run: `npx vitest run tests/engine/economy/board.test.ts tests/storage/migrations.test.ts`
Expected: FAIL. Es fehlen `migrations.ts`, die neue Signatur und die neuen Texte.

- [ ] **Step 4: Engine ändern**

**`src/engine/model.ts`:**

```ts
export interface Manager {
  id: ManagerId;
  name: string;
  /** Verein des Managers – fest für das ganze Spiel (keine Entlassungen) */
  clubId: ClubId;
}
```

- In `Message.ref` entfällt `"jobOffer"`: `{ type: "transferOffer" | "sponsor" | "negotiation"; id: string } | null`.
- `GameState.version: 2;`
- `clubOf`: `const m = state.managers.find((x) => x.id === managerId); return m ? state.clubs[m.clubId] : null;`

**`src/engine/generator.ts`:** `version: 2`.

**`src/engine/season.ts`** (in `startNewGame`): `state.managers.push({ id, name: m.name.trim(), clubId: m.clubId });`

**`src/engine/economy/board.ts`:** Unverändert bleiben `TARGET_RANK`, `START_CONFIDENCE`, `WARN_BELOW`, `RANK_FROM`, `BY_RANK`, `clamp`, `expectationLabel`, `assignExpectations`, `expectationMet` und `updateConfidence`.

Ersatzlos entfallen:
- `FIRE_BELOW`, `FIRE_FROM`, `NEW_COACH_CONFIDENCE`, `GUARANTEED_OFFER_AFTER`;
- `jobOffersFor`, `offerText`, `closeManagerBusiness`, `fireManager`;
- `unemployedTick`, `acceptJobOffer`, `clearStaleJobOffers`;
- der Import `Rng`.

Neu bzw. ersetzt:

```ts
export const WARN_RESET = 40;
export const CLEARLY_MISSED_BY = 5;

/** Vertrauen hat außer einer Nachricht keine Folgen – Manager werden nie entlassen. */
export function boardChecks(state: GameState): void {
  for (const club of Object.values(state.clubs)) {
    if (!club.managerId) continue;
    const b = club.board;
    if (b.confidence < WARN_BELOW && !b.warned) {
      b.warned = true;
      postToClub(state, club.id, "Der Vorstand ist unzufrieden.");
    }
    if (b.confidence > WARN_RESET) b.warned = false;
  }
}

/** Saisonbilanz für die Vereine der Manager: Vertrauen und eine Nachricht, sonst nichts. */
export function seasonReview(state: GameState, tables: Record<CompetitionId, ClubId[]>): void {
  for (const league of [COMP.first, COMP.second]) {
    (tables[league] ?? []).forEach((clubId, i) => {
      const club = state.clubs[clubId];
      if (!club.managerId) return;
      const rank = i + 1;
      const target = TARGET_RANK[club.board.expectation];
      const b = club.board;
      if (rank <= target) {
        b.confidence = Math.min(100, b.confidence + 15);
        postMessage(state, club.managerId, "Der Vorstand ist zufrieden: Saisonziel erreicht.");
      } else if (rank > target + CLEARLY_MISSED_BY) {
        b.confidence = Math.max(0, b.confidence - 15);
        postMessage(state, club.managerId, "Der Vorstand ist sehr enttäuscht: Saisonziel deutlich verfehlt.");
      } else {
        b.confidence = Math.max(0, b.confidence - 10);
        postMessage(state, club.managerId, "Der Vorstand ist enttäuscht: Saisonziel verfehlt.");
      }
    });
  }
}
```

Entferne nicht mehr benutzte Imports, etwa `ManagerId`.

**`src/engine/economy/processing.ts`:**
- Imports von `clearStaleJobOffers` und `unemployedTick` entfernen.
- `boardChecks(state, rng);` wird zu `boardChecks(state);`.
- Die Zeilen `unemployedTick(state, rng);` und `if (state.calendarIndex === 0) clearStaleJobOffers(state);` entfallen.
- In `seasonEndEconomy` wird daraus `seasonReview(state, tables);`. Bleibt dort `rng` ungenutzt, lass den Parameter stehen, wenn andere Aufrufe in derselben Funktion ihn brauchen. Sonst entferne ihn samt Aufrufer.

**`src/engine/commands.ts`:**
- Den Import von `acceptJobOffer` und das Variant `{ type: "acceptJobOffer"; … }` aus `EconomyCommand` entfernen.
- Den `if (cmd.type === "acceptJobOffer")`-Block in `applyCommand` entfernen.
- `applyEconomy(draft, clubId, cmd: EconomyCommand)` bekommt den Parametertyp ohne `Exclude`.
- `managedClub`: Die Prüfung „Du hast zurzeit keinen Verein.“ entfällt, denn `m.clubId` ist immer gesetzt. Für einen unbekannten Manager bleibt die bisherige Meldung.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -50` (bzw. `npm run check`)
Expected: Die Fehler zeigen jetzt alle verbleibenden Stellen, die `null` als `clubId`, `jobOffers` oder `unemployedFor` erwarten. Behebe sie wie folgt:
- In `src/` entfernen Vergleiche wie `m.clubId === null` oder `!m.clubId` den toten Zweig. Liegt so eine Stelle in einer Svelte-Datei, die Task 3 nennt (`SeasonEnd.svelte`, `Conference.svelte`), darfst du sie schon hier vereinfachen.
- In `tests/` siehe Step 6.

- [ ] **Step 5: Speicher ändern**

`src/storage/migrations.ts`:

```ts
import { isObject } from "./guards";
import type { Migration } from "./migrate";

const START_CONFIDENCE_V2 = 60;

/**
 * v1 → v2 (2026-11-04): keine Entlassungen mehr.
 * Manager haben immer einen Verein; Jobangebote und die Zeit ohne Verein entfallen.
 * Ein Manager ohne Verein übernimmt den schwächsten freien Zweitligisten.
 */
export const v1ToV2: Migration = (raw) => {
  const clubs = (isObject(raw.clubs) ? raw.clubs : {}) as Record<string, Record<string, unknown>>;
  const comps = (isObject(raw.competitions) ? raw.competitions : {}) as Record<string, Record<string, unknown>>;
  const l2 = isObject(comps.L2) && Array.isArray(comps.L2.clubs) ? (comps.L2.clubs as string[]) : [];
  const managers = Array.isArray(raw.managers) ? raw.managers : [];
  for (const m of managers) {
    if (!isObject(m)) continue;
    delete m.jobOffers;
    delete m.unemployedFor;
    if (typeof m.clubId === "string") continue;
    const free = l2
      .map((id) => clubs[id])
      .filter((c) => isObject(c) && c.managerId === null)
      .sort((a, b) => Number(a.reputation) - Number(b.reputation) || (String(a.id) < String(b.id) ? -1 : 1))[0];
    m.clubId = free ? free.id : null;
    if (!free) continue;
    free.managerId = m.id;
    if (isObject(free.board)) {
      free.board.confidence = START_CONFIDENCE_V2;
      free.board.warned = false;
    }
  }
  if (Array.isArray(raw.messages)) {
    for (const msg of raw.messages) if (isObject(msg) && isObject(msg.ref) && msg.ref.type === "jobOffer") msg.ref = null;
  }
  return { ...raw, version: 2 };
};
```

Findet sich kein freier Zweitligist, was bei ≤ 4 Managern und 18 Zweitligisten nicht vorkommt, bleibt `clubId` `null`. Die Prüfung meldet den Spielstand dann als beschädigt.

**`src/storage/migrate.ts`:** `CURRENT_VERSION = 2` und `export const MIGRATIONS: Record<number, Migration> = { 1: v1ToV2 };` mit `import { v1ToV2 } from "./migrations";`. Der Kommentar über `MIGRATIONS` bleibt.

**`src/storage/validate.ts`** (Manager-Schleife):
- `if (m.clubId !== null) { … }` wird zu einer unbedingten Prüfung: `if (!hasClub(m.clubId)) return \`Verein ${String(m.clubId)} fehlt\`;` und danach die bisherige `managerId`-Prüfung.
- Die Zeile mit `m.jobOffers` entfällt.

**`tests/storage/savefile.test.ts`:**
- „lehnt Spielstände aus einer neueren Version ab“ nimmt `version: 3`.
- In den Migrationstests mit eingesetzten Schritten (`steps`, `{}`, `(s) => s`) wird der Ausgangsstand explizit auf `version: 1` gesetzt, z. B. `migrate({ ...raw(), version: 1 }, steps, 3)`. Die erwarteten Ergebnisse bleiben dieselben.
- Der Test „v1-Testdatei“ erwartet `version` 2.

- [ ] **Step 6: Übrige Tests anpassen**

Run: `grep -rln "jobOffers\|unemployedFor\|fireManager\|acceptJobOffer\|unemployedTick\|jobOffersFor\|clearStaleJobOffers" tests src`
Expected (vor der Anpassung):
- `tests/engine/economy/{transfers,contracts,messages,commands}.test.ts`
- `tests/engine/fixtures.ts`
- `tests/session/session.test.ts`
- evtl. `tests/engine/economy/processing.test.ts` und `tests/engine/generator.test.ts`

So passt du sie an:
- **Testaufbau mit Managern:** `{ …, jobOffers: [], unemployedFor: 0 }` wird zu `{ id, name, clubId }`.
- **`tests/session/session.test.ts`:** den Block `describe("Session mit Manager ohne Verein", …)` und die unbenutzten Imports (`fireManager`, `Rng`) entfernen.
- **`tests/engine/economy/commands.test.ts`:** den Test „Jobangebot annehmen geht auch ohne Verein; andere Befehle nicht“ entfernen.
- **Tests mit Werten, die vom Zufall abhängen:** Durch den Wegfall von `unemployedTick` und den Zufall in `seasonReview` verbraucht die Engine weniger Zufallszahlen. Schlägt deshalb ein Test mit exakten Werten fehl, prüfe:
  - Ist die Erwartung ein Kalibrierungsziel aus der Spec (Torquote, Bereichsgrenzen)? Dann muss der Test grün bleiben. Melde es, wenn das nicht ohne Code-Änderung geht.
  - Ist sie nur ein zufällig festgehaltener Einzelwert? Dann passe ihn an, und notiere jeden angepassten Wert im Report.

Run: `grep -rn "jobOffers\|unemployedFor\|fireManager\|acceptJobOffer\|jobOffer\"" src tests --include=*.ts --include=*.svelte`
Expected: Treffer nur noch in `src/storage/migrations.ts` und `tests/storage/migrations.test.ts`.

- [ ] **Step 7: Tests laufen lassen**

Run: `npm run check && npm test`
Expected: 0 Fehler, 0 Warnungen, alle Tests PASS. Der Langzeittest `tests/longrun/economy.test.ts` hat einen Test zu Entlassungen in Saison 1 („sacked“). Den passt Task 3 an. Schlägt er hier fehl, ersetze vorerst nur `if (s.managers[0].clubId === null) fired = true;` durch nichts und lass die Schleife stehen. Task 3 schreibt ihn neu. Notiere das im Report.

- [ ] **Step 8: Commit**

```bash
git add -A src tests
git commit -m "feat(engine): keine Entlassungen und keine Jobangebote; Spielstand-Schema v2 mit Migration"
```

---

### Task 3: Aufräumen, Langzeittest und Browser-Test

**Files:**
- Modify: `src/ui/screens/SeasonEnd.svelte`, `src/ui/screens/Conference.svelte` (falls Task 2 sie nicht schon vereinfacht hat)
- Modify: `tests/longrun/economy.test.ts`, `tests/longrun/seasons.test.ts`, `tests/e2e/season.spec.ts`, `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: `Manager.clubId: ClubId` aus Task 2.
- Produces: keine neuen.

- [ ] **Step 1: Letzte Stellen vereinfachen**

**`SeasonEnd.svelte`:** Die Manager-Zeile wird ohne den Fall „ohne Verein“ geschrieben:

```svelte
        {#each gs.managers as m (m.id)}
          {@const league = leagueOf(gs, m.clubId)}
          <p>{m.name}: {gs.clubs[m.clubId].name}{league ? ` – nächste Saison ${gs.competitions[league].name}` : ""}</p>
        {/each}
```

**`Conference.svelte`:** In `initialCompIndex` entfällt `if (!m.clubId) continue;`.

Run: `grep -rn "clubId === null\|!m.clubId\|clubId ? \|ohne Verein" src`
Expected: keine Treffer, die Manager betreffen. Spieler (`p.clubId === null` = vereinslos) bleiben unverändert.

- [ ] **Step 2: Langzeittests**

**`tests/longrun/economy.test.ts`:** Der Test mit `sacked` (8 Startvereine, Saison 1) wird zu:

```ts
  it("Manager bleiben bei ihrem Verein – in Saison 1 bei 8 verschiedenen Startvereinen", { timeout: 300_000 }, () => {
    for (let i = 0; i < 8; i++) {
      /* gleicher Aufbau wie bisher: world, startNewGame mit clubId = Object.keys(world.clubs)[i], eine Saison spielen */
      // nach jedem Spieltag und am Saisonende:
      expect(s.managers[0].clubId).toBe(start);
      expect(s.clubs[start].managerId).toBe(s.managers[0].id);
    }
  });
```

Behalte den bestehenden Aufbau und die Schleife über die Spieltage. Ersetze nur die Entlassungs-Erkennung, das `console.log` und `expect(sacked.length)` durch die beiden Erwartungen oben. `start` ist die beim Start gewählte `clubId`. Den Test-Titel übernimmst du wie oben.

**`tests/longrun/seasons.test.ts`:** Merke dir nach `startNewGame` `const start = s.managers[0].clubId;`. Prüfe in der Saisonschleife direkt vor `s = next;`: `expect(next.managers[0].clubId).toBe(start);`.

Run: `npx vitest run tests/longrun`
Expected: PASS.

- [ ] **Step 3: Browser-Test**

In **`tests/e2e/season.spec.ts`** werden die beiden letzten Zeilen (Kommentar und `evaluate` auf `snapshot.state.season`) zu:

```ts
  await expect(page.getByText(/Saison 2/)).toBeVisible();
```

In **`tests/e2e/helpers.ts`:** Wird `controller` im Typ von `window.__fm` jetzt nirgends mehr benutzt, entferne es aus dem Typ.

Run: `npm run check`
Expected: 0 Fehler.

Run (falls ein Browser verfügbar ist): `npm run test:e2e`
Expected: 4 Tests PASS.

Hat ein früherer Task in dieser Umgebung Chromium mit eigenem `LD_LIBRARY_PATH` zum Laufen gebracht, nutze das. Ohne Browser melde `DONE_WITH_CONCERNS` mit dem genauen Fehler.

- [ ] **Step 4: Gesamtprüfung**

Run: `npm test && npm run check && npm run build`
Expected: Alle Tests PASS, 0 Fehler, 0 Warnungen, Build OK.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "test: Manager bleiben dauerhaft bei ihrem Verein"
```
