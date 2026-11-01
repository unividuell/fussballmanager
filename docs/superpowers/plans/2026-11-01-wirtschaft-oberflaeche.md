# Wirtschaft in der Oberfläche (Plan 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Wirtschaft aus Plan 3a wird spielbar.
- **Hauptmenü:** Die gesperrten Kacheln Training, Verträge, Transfers, Finanzen und Nachrichten bekommen eigene Bildschirme.
- **Verhandlungen:** Verträge und Transfers werden in einem Verhandlungsdialog ausgehandelt.
- **Ohne Verein:** Entlassene Manager kommen weiter an die Reihe und können Jobangebote annehmen.
- **Kopfzeile:** zeigt den Kontostand.
- **Transfermarkt:** Er lässt sich per Klick auf den Spaltenkopf sortieren.
- **Offen aus Plan 2:** Die Ereignisliste in der Auswertung bekommt eine Höhenbegrenzung.

**Architecture:** Wie in Plan 2 sprechen die Bildschirme nur über den `GameController` mit der Session.
- **Logik:** Was aus dem Spielstand aufbereitet werden muss (Kassenbuch, Vertragsliste, Transfermarkt, Angebote, Sortierung), liegt in reinen Modulen unter `src/ui/logic/`.
- **Dialoge:** `Dialog.svelte` ist eine Holztafel, die über dem Bildschirm liegt. Die Esc-Taste behandelt immer der Bildschirm: Ist ein Dialog offen, schließt Esc ihn, sonst geht es zurück.
- **Session:** Die einzige Änderung außerhalb der UI ist, dass `beginTurns` alle Manager in die Manager-Runden aufnimmt, auch die ohne Verein.

**Tech Stack:** Svelte 5.57.3 (Runes), Vitest 5.0.5, Testing Library (wie in Plan 2), keine neuen Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-10-31-fussballmanager-design.md`, Abschnitte 3.2.1, 4, 7.4, 8, 9.

**Plan-Reihe:** 1 Engine-Kern ✓ · 2 Oberfläche Hot-Seat ✓ · 3a Wirtschaft in der Engine ✓ · **3b Wirtschaft in der Oberfläche (dieser Plan)** · 4 Speichern, Optionen, Playwright

## Global Constraints

- **Engine und Transport bleiben unverändert:** `src/engine/` und `src/transport/` werden nicht verändert.
- **Session:** In `src/session/session.ts` ändert sich nur `beginTurns`.
- **Spielstand nur über Befehle:** Die UI verändert den `GameState` nie direkt. Jede Änderung läuft über `controller.send(cmd)`, `controller.endTurn` oder `controller.advance`.
- **Befehle aus Plan 3a:**
  - Training und Finanzen: `setTraining { training }`, `setTicketPrice { price }`, `buildStadium`, `chooseSponsor { offerId }`
  - Verträge und Verhandlungen: `startContractTalk { playerId; salary; years }`, `respondNegotiation { negotiationId; response }`, `releasePlayer { playerId }`
  - Transfers: `startTransferTalk { playerId; fee }`, `setTransferListing { playerId; listed; askingPrice }`, `respondTransferOffer { offerId; response }`
  - Job: `acceptJobOffer { clubId }`

  Jeder Befehl trägt zusätzlich `managerId`. Die Antworten haben diese Form:
  - `response` (Verhandlung) = `{ amount; years? } | "accept" | "abort"`
  - `response` (Angebot) = `"accept" | "reject" | { counter }`
- **Texte und Geld:** Alle sichtbaren Texte sind deutsch. Geld wird immer mit `formatEuro` aus `src/engine/economy/util.ts` angezeigt.
- **Bildschirm, Farben, Schriften:** Die logische Fläche ist 640×400. Farben kommen nur aus Tokens in `theme.css`, Schriften wie in Plan 2.
- **Tasten:**
  - Jeder `<svelte:window onkeydown>`-Handler beginnt mit `if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;`.
  - Esc: Ist ein Dialog offen, schließt Esc nur den Dialog, sonst geht es zurück ins Hauptmenü.
  - Hauptmenü: 1–8 wählen eine Kachel, Enter entspricht „Weiter“.
- **Tests:**
  - Logik-Tests laufen in Node, Komponententests mit `// @vitest-environment jsdom`.
  - In Tests gilt: Muss ein **gesperrter** Button nichts tun, wird `userEvent` statt `fireEvent` verwendet.
  - In Dateien, die `$state` nutzen, heißt keine lokale Variable `state` (Konflikt mit der Rune). Stattdessen `gs` verwenden.
  - `svelte-check` muss 0 Fehler und 0 Warnungen melden.

## Review Focus

1. **Manager ohne Verein:**
   - Er kommt in den Manager-Runden an die Reihe, sieht seine Jobangebote und kann eines annehmen oder mit „Weiter“ aussetzen.
   - Er landet nie in einem Bildschirm, der einen Verein voraussetzt, dort würde die Oberfläche abstürzen.
   - Abgesichert in Task 1 und Task 9.
2. **Verhandlung über mehrere Runden im Dialog:**
   - Nach jeder Antwort zeigt der Dialog die aktuelle Forderung und die Rückmeldung der Gegenseite.
   - Abschluss und Abbruch sind sichtbar.
   - Ein Fehler der Engine (z. B. „Das Transferfenster ist geschlossen.“) erscheint im Dialog.
   - Abgesichert in Task 5.
3. **Esc bei offenem Dialog:** Es schließt nur den Dialog, der Bildschirm bleibt. Abgesichert in Task 6 und Task 7.
4. **Transfermarkt mit vielen Spielern** (über 1.000 aktive): Die Liste ist auf 150 Einträge begrenzt, bleibt bedienbar und sortierbar. Spieler anderer Manager und eigene Spieler tauchen nie auf. Abgesichert in Task 2 und Task 7.
5. **Entlassen eines Spielers:** Es gibt eine zweite Bestätigung mit der Abfindung, Geld und Kader ändern sich sichtbar, und die Aufstellung bleibt gültig. Abgesichert in Task 6.

## Dateistruktur

```
src/session/session.ts                 # beginTurns: alle Manager
src/ui/
├─ controller.svelte.ts                # neue TurnScreens, transferTab, Ohne-Verein-Weiche
├─ logic/
│  ├─ sort.ts                          # Sortierzustand, sortRows
│  └─ economy.ts                       # Kassenbuch, Verträge, Markt, Angebote, Verhandlung, Nachrichten
├─ theme/
│  ├─ theme.css                        # + Token --shade
│  └─ Dialog.svelte                    # Holztafel als Überlagerung
└─ screens/
   ├─ ClubHeader.svelte                # + Kontostand
   ├─ TurnStart.svelte                 # + Ohne-Verein-Variante
   ├─ MainMenu.svelte                  # alle Kacheln aktiv, Hinweis-Zähler
   ├─ Results.svelte                   # Höhenbegrenzung Ereignisse
   ├─ Training.svelte
   ├─ Finance.svelte
   ├─ NegotiationDialog.svelte
   ├─ Contracts.svelte
   ├─ Transfers.svelte
   ├─ Messages.svelte
   └─ Jobs.svelte
src/App.svelte                          # neue Zweige
tests/ui/*.test.ts, tests/session/session.test.ts
```

---

### Task 1: Manager ohne Verein in Session und Controller

**Files:**
- Modify: `src/session/session.ts` (`beginTurns`), `src/ui/controller.svelte.ts`, `src/ui/screens/TurnStart.svelte`, `src/App.svelte`
- Test: `tests/session/session.test.ts` (ergänzen), `tests/ui/controller.test.ts` (ergänzen), `tests/ui/menu.test.ts` (ergänzen)

**Interfaces:**
- Consumes: `fireManager` (engine/economy/board, nur im Test), `Rng`
- Produces:
  - **Session:** `beginTurns` nimmt **alle** Manager in `pending` auf. Die Halbzeit bleibt bei den spielenden Managern.
  - **Controller:**
    - `type TurnScreen = "turnStart" | "menu" | "squad" | "tables" | "training" | "contracts" | "transfers" | "finance" | "messages" | "jobs"`
    - `type TransferTab = "market" | "mine" | "offers"`
    - `transferTab: TransferTab` (`$state`, wird beim Phasenwechsel auf `"market"` zurückgesetzt)
    - `openTransfers(tab: TransferTab): void`
  - **Ohne-Verein-Weiche:** Hat der Manager, der gerade dran ist, keinen Verein, zeigt die Ansicht `"jobs"`. Ausgenommen sind die Bildschirme `"turnStart"`, `"messages"`, `"tables"` und `"jobs"`.
  - **TurnStart:** Ohne Verein zeigt er „Ohne Verein“ und die Taste „Jobangebote (Enter)“. Sie und Enter führen zu `open("jobs")`.
  - **App:** Ganz am Ende gibt es einen Platzhalter-Zweig `{:else}`, der „Bildschirm „…“ folgt.“ zeigt. Spätere Tasks fügen ihre Zweige **vor** `{:else}` ein, Task 9 entfernt den Platzhalter.

- [ ] **Step 1: Failing Tests schreiben**

An `tests/session/session.test.ts` anhängen:

```ts
import { fireManager } from "../../src/engine/economy/board";
import { Rng } from "../../src/engine/rng";

describe("Session mit Manager ohne Verein", () => {
  it("nimmt ihn in die Manager-Runden auf; er kann ein Jobangebot annehmen und weiterklicken", () => {
    const s = twoManagers();
    const anna = s.managers[0];
    fireManager(s, anna.id, Rng.fromSeed(1));
    const session = new Session(s);
    expect(session.snapshot.phase).toEqual({ kind: "managerTurns", pending: [anna.id, s.managers[1].id] });
    const offer = session.snapshot.state.managers[0].jobOffers[0];
    expect(session.dispatch({ type: "acceptJobOffer", managerId: anna.id, clubId: offer })).toBeNull();
    expect(session.snapshot.state.managers[0].clubId).toBe(offer);
    expect(session.dispatch({ type: "endTurn", managerId: anna.id })).toBeNull();
  });

  it("ohne Verein spielt er nicht mit und ist in der Halbzeit nicht dran", () => {
    const s = twoManagers();
    const [anna, ben] = s.managers;
    fireManager(s, anna.id, Rng.fromSeed(2));
    const session = new Session(s);
    session.dispatch({ type: "endTurn", managerId: anna.id });
    session.dispatch({ type: "endTurn", managerId: ben.id });
    session.advance();
    expect(session.snapshot.phase).toEqual({ kind: "halftime", pending: [ben.id] });
  });
});
```

(Die Imports gehören an den Dateianfang zu den übrigen Imports.)

An `tests/ui/controller.test.ts` anhängen:

```ts
import { fireManager } from "../../src/engine/economy/board";
import { Rng } from "../../src/engine/rng";

describe("GameController ohne Verein", () => {
  it("leitet auf die Jobangebote um, sobald der Manager keinen Verein hat", async () => {
    const c = started();
    const anna = c.snapshot!.state.managers[0];
    fireManager(c.snapshot!.state, anna.id, Rng.fromSeed(3)); // Testaufbau: Entlassung direkt im Spielstand
    c.open("menu");
    expect(c.view).toEqual({ kind: "jobs", managerId: anna.id });
    c.open("tables");
    expect(c.view).toEqual({ kind: "tables", managerId: anna.id });
    const offer = c.snapshot!.state.managers[0].jobOffers[0];
    expect(await c.send({ type: "acceptJobOffer", managerId: anna.id, clubId: offer })).toBe(true);
    c.open("menu");
    expect(c.view).toEqual({ kind: "menu", managerId: anna.id });
  });

  it("openTransfers merkt sich den Reiter", () => {
    const c = started();
    c.openTransfers("offers");
    expect(c.view.kind).toBe("transfers");
    expect(c.transferTab).toBe("offers");
  });
});
```

An `tests/ui/menu.test.ts` anhängen:

```ts
import { fireManager } from "../../src/engine/economy/board";
import { Rng } from "../../src/engine/rng";

describe("„ist dran“ ohne Verein", () => {
  it("zeigt „Ohne Verein“; Enter öffnet die Jobangebote", async () => {
    const c = new GameController();
    const world = generateWorld(11);
    c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
    fireManager(c.snapshot!.state, c.snapshot!.state.managers[0].id, Rng.fromSeed(1));
    render(App, { controller: c });
    await tick();
    expect(screen.getByText("Ohne Verein")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Enter" });
    expect(c.view.kind).toBe("jobs");
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/session/session.test.ts tests/ui/controller.test.ts tests/ui/menu.test.ts`
Expected: FAIL, weil der Manager ohne Verein fehlt, es keine Ansicht `"jobs"` gibt, `openTransfers` nicht existiert und der Text „Ohne Verein“ nicht gefunden wird.

- [ ] **Step 3: Implementieren**

In `src/session/session.ts` in `beginTurns` die Zeile

```ts
    const pending = this.snap.state.managers.filter((m) => m.clubId !== null).map((m) => m.id);
```

ersetzen durch:

```ts
    const pending = this.snap.state.managers.map((m) => m.id);
```

In `src/ui/controller.svelte.ts`:

1. Die Typen ersetzen bzw. ergänzen:

```ts
export type TurnScreen =
  | "turnStart"
  | "menu"
  | "squad"
  | "tables"
  | "training"
  | "contracts"
  | "transfers"
  | "finance"
  | "messages"
  | "jobs";

export type TransferTab = "market" | "mine" | "offers";

/** Bildschirme, die auch ohne Verein funktionieren. */
const WITHOUT_CLUB: TurnScreen[] = ["turnStart", "jobs", "messages", "tables"];
```

2. In der Klasse nach `message = $state<string | null>(null);` einfügen:

```ts
  transferTab = $state<TransferTab>("market");
```

3. Nach der Methode `open` einfügen:

```ts
  openTransfers(tab: TransferTab): void {
    this.transferTab = tab;
    this.open("transfers");
  }
```

4. In `receive` im `if (key !== this.lastKey)`-Block ergänzen: `this.transferTab = "market";`

5. In `computeView` den Fall `"managerTurns"` ersetzen durch:

```ts
      case "managerTurns": {
        const managerId = p.pending[0];
        const hasClub = s.state.managers.find((m) => m.id === managerId)?.clubId != null;
        const screen = !hasClub && !WITHOUT_CLUB.includes(this.screen) ? "jobs" : this.screen;
        return { kind: screen, managerId };
      }
```

In `src/ui/screens/TurnStart.svelte`:
- In `onKey` die Zeile `controller.open("menu");` ersetzen durch: `controller.open(club ? "menu" : "jobs");`
- Im Markup die Zeilen

```svelte
        {#if club}<p>{club.name}</p>{/if}
        <button class="btn primary" onclick={() => controller.open("menu")}>Los geht's (Enter)</button>
```

ersetzen durch:

```svelte
        {#if club}
          <p>{club.name}</p>
          <button class="btn primary" onclick={() => controller.open("menu")}>Los geht's (Enter)</button>
        {:else}
          <p>Ohne Verein</p>
          <button class="btn primary" onclick={() => controller.open("jobs")}>Jobangebote (Enter)</button>
        {/if}
```

In `src/App.svelte` vor `{/if}` am Ende einfügen:

```svelte
  {:else}
    <p class="placeholder">Bildschirm „{view.kind}“ folgt.</p>
```

und am Dateiende ergänzen:

```svelte
<style>
  .placeholder { padding: 16px; }
</style>
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/session/session.ts src/ui/controller.svelte.ts src/ui/screens/TurnStart.svelte src/App.svelte tests/session/session.test.ts tests/ui/controller.test.ts tests/ui/menu.test.ts
git commit -m "feat(ui): Manager ohne Verein kommen an die Reihe"
```

---

### Task 2: Gemeinsame Bausteine (Sortierung, Wirtschafts-Logik, Dialog, Kontostand)

**Files:**
- Create: `src/ui/logic/sort.ts`, `src/ui/logic/economy.ts`, `src/ui/theme/Dialog.svelte`
- Modify: `src/ui/theme/theme.css` (Token `--shade`), `src/ui/screens/ClubHeader.svelte` (Kontostand)
- Test: `tests/ui/sort.test.ts`, `tests/ui/economy.test.ts`, `tests/ui/dialog.test.ts`

**Interfaces:**
- Consumes:
  - Engine: `formatEuro` (economy/util), `salaryDemand` (economy/contracts), `marketValue` (economy/money), `askingFee` (economy/transfers), `messagesFor` (economy/messages), Modell-Typen
  - UI: `Panel` (Plan 2)
- Produces:
  - `sort.ts`:
    - `interface SortState<K extends string> { key: K; dir: 1 | -1 }`
    - `toggleSort(s, key): SortState<K>` – derselbe Schlüssel dreht die Richtung um, ein neuer Schlüssel beginnt absteigend
    - `sortRows(rows, s, value: (row, key) => number | string): T[]` – liefert eine neue Liste
  - `economy.ts`:
    - Kassenbuch: `LEDGER_LABEL`, `interface LedgerLine { category; label; lastMatchday; season }`, `ledgerSummary(club): { lines; lastTotal; seasonTotal; lastIndex }`
    - Verträge: `interface ContractRow { player; salary; endsSeason; expiring; demand; value }`, `contractRows(state, clubId)`
    - Transfermarkt: `interface MarketFilter { position: Position | "all"; freeOnly; listedOnly; maxFee: number | null }`, `DEFAULT_FILTER`, `interface MarketRow { player; clubName; fee; wage; value; free; listed }`, `marketRows(state, buyerClubId, filter, limit = 150)`
    - Angebote und Verhandlungen: `interface OfferRow { offer; playerName; buyerName }`, `openOffers(state, managerId)`, `latestNegotiation(state, managerId, playerId): Negotiation | null`
    - Anzeige: `messageLabel(season, calendarIndex)`, `potentialStars(p)`
  - `Dialog.svelte` mit den Props `{ title: string; children: Snippet; onClose: () => void }`:
    - **Aussehen:** eine Überlagerung mit `role="dialog"` und `aria-label={title}`, darin eine Holztafel und die Taste „Schließen“.
    - **Tasten:** Der Dialog selbst hört **nicht** auf Esc, das erledigt der Bildschirm (siehe Global Constraints).
  - `ClubHeader`: zeigt den Kontostand. Ist er negativ, bekommt er die Klasse `negative`.

**Regeln:**
- **`ledgerSummary`:** Pro Kategorie gibt es die Summe der laufenden Saison und die des letzten gebuchten Kalenderindex (`lastIndex`). Kategorien mit beiden Werten 0 entfallen.
- **`contractRows`:** sortiert nach Vertragsende aufsteigend, dann nach Stärke absteigend. `expiring` ist wahr, wenn der Vertrag in dieser Saison ausläuft.
- **`marketRows`:**
  - Aufgeführt werden aktive Spieler, die vereinslos sind oder bei einem KI-Verein spielen. Spieler des eigenen Vereins und anderer Manager sind ausgeschlossen.
  - Die Filter sind Position, „nur Vereinslose“, „nur Transferliste“ und „Ablöse ≤ maxFee“.
  - Sortiert wird nach Stärke absteigend, höchstens `limit` Einträge.
  - Der Vereinsname ist der Kurzname, bei Vereinslosen „vereinslos“.
- **`messageLabel`:** „S1 · 5. Sp.“ für Kalenderindex 4. Ab Index 34 heißt es „Relegation“.
- **`potentialStars`:** Potenzial bis 55 ergibt „★“, bis 65 „★★“, bis 75 „★★★“, bis 85 „★★★★“, darüber „★★★★★“.

- [ ] **Step 1: Failing Tests schreiben**

`tests/ui/sort.test.ts`:

```ts
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
```

`tests/ui/economy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import type { GameState } from "../../src/engine/model";
import { playMatchdayAuto, startNewGame } from "../../src/engine/season";
import {
  DEFAULT_FILTER,
  contractRows,
  latestNegotiation,
  ledgerSummary,
  marketRows,
  messageLabel,
  openOffers,
  potentialStars,
} from "../../src/ui/logic/economy";
import { makePlayer } from "../engine/fixtures";

function game(names = ["Anna", "Ben"]): GameState {
  const world = generateWorld(81);
  const ids = Object.keys(world.clubs);
  const r = startNewGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const own = (s: GameState) => s.clubs[s.managers[0].clubId!];

describe("ledgerSummary", () => {
  it("summiert die Saison und den letzten Spieltag je Kategorie", () => {
    const s = playMatchdayAuto(playMatchdayAuto(game()));
    const club = own(s);
    const sum = ledgerSummary(club);
    expect(sum.lastIndex).toBe(1);
    const tv = sum.lines.find((l) => l.category === "tv")!;
    expect(tv.label).toBe("TV-Geld");
    expect(tv.season).toBe(2 * tv.lastMatchday);
    expect(sum.seasonTotal).toBe(club.finance.ledger.reduce((x, e) => x + e.amount, 0));
    expect(sum.lines.every((l) => l.season !== 0 || l.lastMatchday !== 0)).toBe(true);
  });

  it("ohne Buchungen: leer", () => {
    expect(ledgerSummary(own(game())).lines).toEqual([]);
  });
});

describe("contractRows", () => {
  it("listet den Kader nach Vertragsende, markiert auslaufende Verträge", () => {
    const s = game();
    const rows = contractRows(s, own(s).id);
    expect(rows).toHaveLength(own(s).squad.length);
    for (let i = 1; i < rows.length; i++) expect((rows[i - 1].endsSeason ?? 0) <= (rows[i].endsSeason ?? 0)).toBe(true);
    expect(rows.filter((r) => r.expiring).every((r) => r.endsSeason === s.season)).toBe(true);
    expect(rows.every((r) => r.demand > 0 && r.value > 0)).toBe(true);
  });
});

describe("marketRows", () => {
  it("zeigt nur Vereinslose und KI-Spieler, nie eigene oder die anderer Manager", () => {
    const s = game();
    const rows = marketRows(s, own(s).id, DEFAULT_FILTER);
    const humanClubs = new Set(s.managers.map((m) => m.clubId));
    expect(rows.length).toBeLessThanOrEqual(150);
    expect(rows.every((r) => !humanClubs.has(r.player.clubId))).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].player.strength).toBeGreaterThanOrEqual(rows[i].player.strength);
  });

  it("filtert nach Position, Vereinslosen, Transferliste und Höchstablöse", () => {
    const s = game();
    const id = own(s).id;
    expect(marketRows(s, id, { ...DEFAULT_FILTER, position: "GK" }).every((r) => r.player.position === "GK")).toBe(true);
    const free = marketRows(s, id, { ...DEFAULT_FILTER, freeOnly: true });
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((r) => r.free && r.fee === 0 && r.clubName === "vereinslos")).toBe(true);
    expect(marketRows(s, id, { ...DEFAULT_FILTER, listedOnly: true })).toEqual([]);
    expect(marketRows(s, id, { ...DEFAULT_FILTER, maxFee: 100_000 }).every((r) => r.fee <= 100_000)).toBe(true);
  });
});

describe("Angebote, Verhandlungen, Beschriftungen", () => {
  it("openOffers und latestNegotiation finden die passenden Einträge", () => {
    const s = game();
    const p = s.players[own(s).squad[3]];
    const buyer = Object.values(s.clubs).find((c) => c.managerId === null)!;
    s.transferOffers.push({ id: "o1", managerId: s.managers[0].id, fromClub: buyer.id, playerId: p.id, fee: 1, maxFee: 2, round: 1, status: "open", season: 1, expiresAfter: 0 });
    s.transferOffers.push({ id: "o2", managerId: s.managers[1].id, fromClub: buyer.id, playerId: p.id, fee: 1, maxFee: 2, round: 1, status: "open", season: 1, expiresAfter: 0 });
    const rows = openOffers(s, s.managers[0].id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ playerName: `${p.firstName} ${p.lastName}`, buyerName: buyer.name });
    const base = { managerId: s.managers[0].id, playerId: p.id, stage: "salary" as const, fee: null, ask: 1, round: 1, desiredYears: 2, note: "", season: 1, createdAt: 0 };
    s.negotiations.push({ ...base, id: "n1", status: "aborted" }, { ...base, id: "n2", status: "open" });
    expect(latestNegotiation(s, s.managers[0].id, p.id)?.id).toBe("n2");
    expect(latestNegotiation(s, s.managers[1].id, p.id)).toBeNull();
  });

  it("messageLabel und potentialStars", () => {
    expect(messageLabel(1, 4)).toBe("S1 · 5. Sp.");
    expect(messageLabel(2, 34)).toBe("S2 · Relegation");
    expect(potentialStars(makePlayer("a", "MF", 50, { potential: 50 }))).toBe("★");
    expect(potentialStars(makePlayer("a", "MF", 50, { potential: 70 }))).toBe("★★★");
    expect(potentialStars(makePlayer("a", "MF", 50, { potential: 90 }))).toBe("★★★★★");
  });
});
```

`tests/ui/dialog.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet, tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { formatEuro } from "../../src/engine/economy/util";
import { GameController } from "../../src/ui/controller.svelte";
import Dialog from "../../src/ui/theme/Dialog.svelte";

describe("Dialog", () => {
  it("zeigt Titel und Inhalt; „Schließen“ ruft onClose", async () => {
    const onClose = vi.fn();
    render(Dialog, { title: "Verhandlung", onClose, children: createRawSnippet(() => ({ render: () => "<p>Inhalt</p>" })) });
    expect(screen.getByRole("dialog", { name: "Verhandlung" })).toBeTruthy();
    expect(screen.getByText("Inhalt")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Schließen/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Kopfzeile", () => {
  it("zeigt den Kontostand", async () => {
    const c = new GameController();
    const world = generateWorld(11);
    const clubId = Object.keys(world.clubs)[0];
    c.startGame(world, [{ name: "Anna", clubId }]);
    render(App, { controller: c });
    await tick();
    expect(screen.getByText(formatEuro(c.snapshot!.state.clubs[clubId].finance.balance))).toBeTruthy();
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/ui/sort.test.ts tests/ui/economy.test.ts tests/ui/dialog.test.ts`
Expected: FAIL, weil die Module `sort`, `economy` und `Dialog.svelte` fehlen und der Kontostand nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/ui/logic/sort.ts`:

```ts
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
```

`src/ui/logic/economy.ts`:

```ts
import { salaryDemand } from "../../engine/economy/contracts";
import { marketValue } from "../../engine/economy/money";
import { askingFee } from "../../engine/economy/transfers";
import type {
  Club,
  ClubId,
  GameState,
  LedgerCategory,
  ManagerId,
  Negotiation,
  Player,
  PlayerId,
  Position,
  TransferOffer,
} from "../../engine/model";

export const LEDGER_LABEL: Record<LedgerCategory, string> = {
  tickets: "Zuschauer",
  tv: "TV-Geld",
  sponsor: "Sponsor",
  salaries: "Gehälter",
  upkeep: "Stadionunterhalt",
  interest: "Zinsen",
  transfers: "Transfers",
  prizes: "Prämien",
  stadium: "Stadionausbau",
  severance: "Abfindungen",
  bonus: "Sponsorprämie",
};

export interface LedgerLine {
  category: LedgerCategory;
  label: string;
  lastMatchday: number;
  season: number;
}

const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function ledgerSummary(club: Club): { lines: LedgerLine[]; lastTotal: number; seasonTotal: number; lastIndex: number | null } {
  const ledger = club.finance.ledger;
  const lastIndex = ledger.length > 0 ? Math.max(...ledger.map((e) => e.calendarIndex)) : null;
  const lines = (Object.keys(LEDGER_LABEL) as LedgerCategory[])
    .map((category) => ({
      category,
      label: LEDGER_LABEL[category],
      season: total(ledger.filter((e) => e.category === category).map((e) => e.amount)),
      lastMatchday: total(ledger.filter((e) => e.category === category && e.calendarIndex === lastIndex).map((e) => e.amount)),
    }))
    .filter((l) => l.season !== 0 || l.lastMatchday !== 0);
  return { lines, lastTotal: total(lines.map((l) => l.lastMatchday)), seasonTotal: total(lines.map((l) => l.season)), lastIndex };
}

export interface ContractRow {
  player: Player;
  salary: number;
  endsSeason: number | null;
  expiring: boolean;
  demand: number;
  value: number;
}

export function contractRows(state: GameState, clubId: ClubId): ContractRow[] {
  return state.clubs[clubId].squad
    .map((id) => state.players[id])
    .map((p) => ({
      player: p,
      salary: p.contract?.salary ?? 0,
      endsSeason: p.contract?.endsSeason ?? null,
      expiring: (p.contract?.endsSeason ?? state.season) <= state.season,
      demand: salaryDemand(state, p, clubId),
      value: marketValue(p, state.season),
    }))
    .sort((a, b) => (a.endsSeason ?? 0) - (b.endsSeason ?? 0) || b.player.strength - a.player.strength);
}

export interface MarketFilter {
  position: Position | "all";
  freeOnly: boolean;
  listedOnly: boolean;
  maxFee: number | null;
}

export const DEFAULT_FILTER: MarketFilter = { position: "all", freeOnly: false, listedOnly: false, maxFee: null };

export interface MarketRow {
  player: Player;
  clubName: string;
  fee: number;
  wage: number;
  value: number;
  free: boolean;
  listed: boolean;
}

export function marketRows(state: GameState, buyerClubId: ClubId, f: MarketFilter, limit = 150): MarketRow[] {
  return Object.values(state.players)
    .filter((p) => !p.retired && p.clubId !== buyerClubId && (p.clubId === null || state.clubs[p.clubId].managerId === null))
    .filter((p) => f.position === "all" || p.position === f.position)
    .filter((p) => !f.freeOnly || p.clubId === null)
    .filter((p) => !f.listedOnly || p.transferListed !== null)
    .map((p) => ({
      player: p,
      clubName: p.clubId ? state.clubs[p.clubId].shortName : "vereinslos",
      fee: askingFee(state, p),
      wage: salaryDemand(state, p, buyerClubId),
      value: marketValue(p, state.season),
      free: p.clubId === null,
      listed: p.transferListed !== null,
    }))
    .filter((r) => f.maxFee === null || r.fee <= f.maxFee)
    .sort((a, b) => b.player.strength - a.player.strength)
    .slice(0, limit);
}

export interface OfferRow {
  offer: TransferOffer;
  playerName: string;
  buyerName: string;
}

export function openOffers(state: GameState, managerId: ManagerId): OfferRow[] {
  return state.transferOffers
    .filter((o) => o.managerId === managerId && o.status === "open")
    .map((o) => {
      const p = state.players[o.playerId];
      return { offer: o, playerName: `${p.firstName} ${p.lastName}`, buyerName: state.clubs[o.fromClub].name };
    });
}

export function latestNegotiation(state: GameState, managerId: ManagerId, playerId: PlayerId): Negotiation | null {
  for (let i = state.negotiations.length - 1; i >= 0; i--) {
    const n = state.negotiations[i];
    if (n.managerId === managerId && n.playerId === playerId) return n;
  }
  return null;
}

export function messageLabel(season: number, calendarIndex: number): string {
  return calendarIndex >= 34 ? `S${season} · Relegation` : `S${season} · ${calendarIndex + 1}. Sp.`;
}

export function potentialStars(p: Player): string {
  const n = p.potential <= 55 ? 1 : p.potential <= 65 ? 2 : p.potential <= 75 ? 3 : p.potential <= 85 ? 4 : 5;
  return "★".repeat(n);
}
```

`src/ui/theme/theme.css`: Im `:root`-Block nach `--ink: #0b0d0a;` ergänzen:

```css
  --shade: rgb(0 0 0 / 0.55);
```

`src/ui/theme/Dialog.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import Panel from "./Panel.svelte";

  let { title, children, onClose }: { title: string; children: Snippet; onClose: () => void } = $props();
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={title}>
  <Panel {title} class="dialog">
    {@render children()}
    <button class="btn close" onclick={onClose}>Schließen (Esc)</button>
  </Panel>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    background: var(--shade);
  }
  .overlay :global(.dialog) {
    width: 440px;
    max-height: 370px;
    overflow-y: auto;
  }
  .close { align-self: flex-end; }
</style>
```

`src/ui/screens/ClubHeader.svelte`:
- Import ergänzen: `import { formatEuro } from "../../engine/economy/util";`
- Vor `<span class="mgr">` einfügen:

```svelte
    <span class="money" class:negative={club.finance.balance < 0}>{formatEuro(club.finance.balance)}</span>
```

- Im `<style>`-Block ergänzen:

```css
  .money { color: var(--leaf); font-variant-numeric: tabular-nums; }
  .money.negative { color: var(--rust); }
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/ui/logic/sort.ts src/ui/logic/economy.ts src/ui/theme/Dialog.svelte src/ui/theme/theme.css src/ui/screens/ClubHeader.svelte tests/ui/sort.test.ts tests/ui/economy.test.ts tests/ui/dialog.test.ts
git commit -m "feat(ui): Sortierung, Wirtschafts-Logik, Dialog und Kontostand"
```

---

### Task 3: Training

**Files:**
- Create: `src/ui/screens/Training.svelte`
- Modify: `src/App.svelte` (Zweig vor `{:else}`)
- Test: `tests/ui/training.test.ts`

**Interfaces:**
- Consumes: `GameController` (Task 1), `potentialStars` (Task 2), `POSITION_LABEL`, `playerName` (format.ts), `ClubHeader`, `Panel`, `MAX_INDIVIDUAL` (engine/economy/training)
- Produces: `Training.svelte` mit den Props `{ controller; managerId }`
  - **Intensität:** 3 Tasten (locker, normal, hart) mit Kurzhinweis.
  - **Schwerpunkt:** 3 Tasten (Technik, Kondition, Taktik) mit Kurzhinweis.
  - **Extratraining:** eine Liste aller Kaderspieler, sortiert nach Abstand zum Potenzial. Ein Klick auf den Namen nimmt den Spieler auf oder heraus. Der Name trägt `aria-label="{Name} {ID}"`, die Überschrift lautet „EXTRATRAINING (n/3)“.
  - **Übernahme:** Jede Änderung schickt sofort `setTraining` mit dem vollständigen Plan. Fehler der Engine (z. B. „Höchstens 3 Spieler im Extratraining.“) erscheinen als `.msg`.
  - **Zurück:** Esc oder „Zurück (Esc)“ führt zu `controller.open("menu")`.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/training.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function trainingScreen() {
  const c = new GameController();
  const world = generateWorld(23);
  const clubId = Object.keys(world.clubs)[2];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.open("training");
  await tick();
  const club = () => c.snapshot!.state.clubs[clubId];
  const btn = (id: string) => screen.getByRole("button", { name: `${playerName(c.snapshot!.state.players[id])} ${id}` });
  return { c, club, btn };
}

describe("Training", () => {
  it("setzt Intensität und Schwerpunkt", async () => {
    const { club } = await trainingScreen();
    await fireEvent.click(screen.getByRole("button", { name: /^hart/ }));
    await fireEvent.click(screen.getByRole("button", { name: /^Taktik/ }));
    expect(club().training.intensity).toBe("hard");
    expect(club().training.focus).toBe("tactics");
  });

  it("Extratraining für bis zu 3 Spieler; der vierte wird mit Meldung abgelehnt; abwählen geht", async () => {
    const { club, btn } = await trainingScreen();
    const ids = club().squad.slice(0, 4);
    for (const id of ids.slice(0, 3)) await fireEvent.click(btn(id));
    expect(club().training.individual).toEqual(ids.slice(0, 3));
    expect(screen.getByText("EXTRATRAINING (3/3)")).toBeTruthy();
    await fireEvent.click(btn(ids[3]));
    expect(await screen.findByText("Höchstens 3 Spieler im Extratraining.")).toBeTruthy();
    await fireEvent.click(btn(ids[0]));
    expect(club().training.individual).toEqual(ids.slice(1, 3));
  });

  it("Esc führt zurück ins Menü", async () => {
    const { c } = await trainingScreen();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/training.test.ts`
Expected: FAIL, weil die Taste „hart“ nicht gefunden wird (Platzhalter).

- [ ] **Step 3: Implementieren**

`src/ui/screens/Training.svelte`:

```svelte
<script lang="ts">
  import { MAX_INDIVIDUAL } from "../../engine/economy/training";
  import { clubOf, type Intensity, type ManagerId, type PlayerId, type TrainingFocus, type TrainingPlan } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { potentialStars } from "../logic/economy";
  import { POSITION_LABEL, playerName } from "../logic/format";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const INTENSITIES: { id: Intensity; label: string; hint: string }[] = [
    { id: "light", label: "locker", hint: "wenig Fortschritt, schont die Kondition" },
    { id: "normal", label: "normal", hint: "ausgewogen" },
    { id: "hard", label: "hart", hint: "mehr Fortschritt, kostet Kondition, Verletzungsrisiko" },
  ];
  const FOCI: { id: TrainingFocus; label: string; hint: string }[] = [
    { id: "technique", label: "Technik", hint: "voller Fortschritt" },
    { id: "fitness", label: "Kondition", hint: "schnellere Erholung" },
    { id: "tactics", label: "Taktik", hint: "+3 % im nächsten Spiel" },
  ];

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const plan = $derived(club.training);
  const players = $derived(
    club.squad
      .map((id) => gs.players[id])
      .sort((a, b) => b.potential - b.strength - (a.potential - a.strength) || a.age - b.age),
  );

  function send(patch: Partial<TrainingPlan>): void {
    void controller.send({ type: "setTraining", managerId, training: { ...plan, individual: [...plan.individual], ...patch } });
  }

  function toggle(id: PlayerId): void {
    const individual = plan.individual.includes(id) ? plan.individual.filter((x) => x !== id) : [...plan.individual, id];
    send({ individual });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="training">
  <ClubHeader {controller} {managerId} />
  <div class="body">
    <div class="side">
      <Panel title="INTENSITÄT">
        {#each INTENSITIES as i (i.id)}
          <button class="btn opt" class:selected={plan.intensity === i.id} onclick={() => send({ intensity: i.id })}>
            {i.label}<small>{i.hint}</small>
          </button>
        {/each}
      </Panel>
      <Panel title="SCHWERPUNKT">
        {#each FOCI as f (f.id)}
          <button class="btn opt" class:selected={plan.focus === f.id} onclick={() => send({ focus: f.id })}>
            {f.label}<small>{f.hint}</small>
          </button>
        {/each}
      </Panel>
      <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
    </div>
    <Panel title="EXTRATRAINING ({plan.individual.length}/{MAX_INDIVIDUAL})">
      <div class="scroll">
        <table class="board-table">
          <thead><tr><th></th><th>Name</th><th>Pos</th><th class="num">Alter</th><th class="num">St</th><th>Pot</th></tr></thead>
          <tbody>
            {#each players as p (p.id)}
              <tr class:mine={plan.individual.includes(p.id)}>
                <td>{plan.individual.includes(p.id) ? "✓" : ""}</td>
                <td><button class="name" aria-label="{playerName(p)} {p.id}" onclick={() => toggle(p.id)}>{playerName(p)}</button></td>
                <td>{POSITION_LABEL[p.position]}</td>
                <td class="num">{p.age}</td>
                <td class="num">{Math.round(p.strength)}</td>
                <td class="stars">{potentialStars(p)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Panel>
  </div>
  {#if controller.message}<p class="msg">{controller.message}</p>{/if}
</div>

<style>
  .training { display: flex; flex-direction: column; height: 100%; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 220px 1fr; gap: 8px; padding: 8px; }
  .side { display: flex; flex-direction: column; gap: 6px; }
  .opt { display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
  .opt small { font-size: 13px; color: var(--leaf); }
  .scroll { overflow-y: auto; min-height: 0; flex: 1; }
  .name { all: unset; cursor: pointer; }
  .name:focus-visible { outline: 1px solid var(--gold); }
  .stars { color: var(--gold); }
  .msg { margin: 0 8px 6px; }
</style>
```

In `src/App.svelte`:
- Import ergänzen: `import Training from "./ui/screens/Training.svelte";`
- Vor `{:else}` einfügen:

```svelte
  {:else if view.kind === "training"}
    <Training {controller} managerId={view.managerId} />
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/training.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/Training.svelte src/App.svelte tests/ui/training.test.ts
git commit -m "feat(ui): Training"
```

---

### Task 4: Finanzen

**Files:**
- Create: `src/ui/screens/Finance.svelte`
- Modify: `src/App.svelte` (Zweig vor `{:else}`)
- Test: `tests/ui/finance.test.ts`

**Interfaces:**
- Consumes: `ledgerSummary` (Task 2), `formatEuro`, `STADIUM`, `optimalPrice` (engine/economy/stadium), `overdraftLimit` (engine/economy/money), `ClubHeader`, `Panel`
- Produces: `Finance.svelte` mit den Props `{ controller; managerId }`, 4 Bereiche:
  - **„BILANZ“:** Tabelle mit Kategorie, letztem Spieltag und Saison, darunter eine Summenzeile. Dazu Kontostand und Dispo-Limit.
  - **„EINTRITT“:**
    - Anzeige: aktueller Preis, Zuschauer beim letzten Heimspiel, Kapazität, Richtwert (`optimalPrice`).
    - Eingabe: Zahlenfeld mit `aria-label="Eintrittspreis"`, dazu die Taste „Preis setzen“.
  - **„STADION“:**
    - Anzeige: Stufe (1–5) und Plätze. Läuft ein Ausbau, steht dort „Ausbau läuft: noch N Spieltage“.
    - Taste „Ausbauen: X Plätze für Y (Z Spieltage)“. Sie ist gesperrt bei der höchsten Stufe oder laufendem Ausbau.
  - **„SPONSOR“:**
    - Ist ein Sponsor gewählt: Name, Betrag pro Spieltag, Prämie.
    - Sonst: die Angebote mit je einer Taste „Wählen“ (aria-label „{Name} wählen“).
  - **Fehler** erscheinen als `.msg`. **Zurück:** Esc oder „Zurück (Esc)“.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/finance.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { STADIUM } from "../../src/engine/economy/stadium";
import { formatEuro } from "../../src/engine/economy/util";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

async function financeScreen(index = 20) {
  const c = new GameController();
  const world = generateWorld(29);
  const clubId = Object.keys(world.clubs)[index];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.open("finance");
  await tick();
  return { c, club: () => c.snapshot!.state.clubs[clubId] };
}

describe("Finanzen", () => {
  it("zeigt Kontostand und gebuchte Kategorien", async () => {
    const { c, club } = await financeScreen();
    club().finance.ledger.push({ calendarIndex: 0, category: "tv", amount: 30_000 }); // Testaufbau
    c.open("menu");
    c.open("finance");
    await tick();
    expect(screen.getByText("TV-Geld")).toBeTruthy();
    expect(screen.getAllByText(formatEuro(club().finance.balance)).length).toBeGreaterThan(0);
  });

  it("setzt den Eintrittspreis und meldet ungültige Preise", async () => {
    const { club } = await financeScreen();
    const input = screen.getByLabelText("Eintrittspreis") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "31" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preis setzen" }));
    expect(club().finance.ticketPrice).toBe(31);
    await fireEvent.input(input, { target: { value: "2" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preis setzen" }));
    expect(await screen.findByText("Der Eintrittspreis muss zwischen 5 und 100 € liegen.")).toBeTruthy();
  });

  it("baut das Stadion aus, wenn das Geld reicht", async () => {
    const { c, club } = await financeScreen();
    club().finance.balance = 100_000_000; // Testaufbau
    c.open("menu");
    c.open("finance");
    await tick();
    const stage = club().finance.stadiumStage;
    await fireEvent.click(screen.getByRole("button", { name: /^Ausbauen/ }));
    expect(club().finance.building).toEqual({ stage: stage + 1, matchdaysLeft: STADIUM[stage + 1].buildMatchdays });
    expect(screen.getByText(/Ausbau läuft: noch/)).toBeTruthy();
  });

  it("wählt einen Sponsor", async () => {
    const { club } = await financeScreen();
    const offer = club().finance.sponsorOffers[1];
    await fireEvent.click(screen.getByRole("button", { name: `${offer.name} wählen` }));
    expect(club().finance.sponsor).toEqual(offer);
    expect(screen.queryByRole("button", { name: /wählen$/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/finance.test.ts`
Expected: FAIL, weil „TV-Geld“ bzw. das Feld „Eintrittspreis“ nicht gefunden werden.

- [ ] **Step 3: Implementieren**

`src/ui/screens/Finance.svelte`:

```svelte
<script lang="ts">
  import { overdraftLimit } from "../../engine/economy/money";
  import { STADIUM, optimalPrice } from "../../engine/economy/stadium";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { ledgerSummary } from "../logic/economy";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const f = $derived(club.finance);
  const summary = $derived(ledgerSummary(club));
  const next = $derived(STADIUM[f.stadiumStage + 1] ?? null);

  function initialPrice(): string {
    return String(clubOf(controller.snapshot!.state, managerId)?.finance.ticketPrice ?? 20);
  }
  let priceText = $state(initialPrice());

  function setPrice(): void {
    void controller.send({ type: "setTicketPrice", managerId, price: Number(priceText) });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="finance">
  <ClubHeader {controller} {managerId} />
  <div class="body">
    <Panel title="BILANZ">
      <table class="board-table">
        <thead><tr><th>Kategorie</th><th class="num">Letzter Spieltag</th><th class="num">Saison</th></tr></thead>
        <tbody>
          {#each summary.lines as l (l.category)}
            <tr><td>{l.label}</td><td class="num">{formatEuro(l.lastMatchday)}</td><td class="num">{formatEuro(l.season)}</td></tr>
          {/each}
          <tr class="sum"><td>Summe</td><td class="num">{formatEuro(summary.lastTotal)}</td><td class="num">{formatEuro(summary.seasonTotal)}</td></tr>
        </tbody>
      </table>
      <p>Kontostand: <b class:negative={f.balance < 0}>{formatEuro(f.balance)}</b> · Dispo-Limit: {formatEuro(overdraftLimit(club.reputation))}</p>
    </Panel>
    <div class="side">
      <Panel title="EINTRITT">
        <p>Preis: {formatEuro(f.ticketPrice)} · Richtwert: {formatEuro(optimalPrice(club.reputation))}</p>
        <p>Zuletzt {f.lastAttendance} von {STADIUM[f.stadiumStage].capacity} Plätzen</p>
        <div class="row">
          <input aria-label="Eintrittspreis" inputmode="numeric" size="4" bind:value={priceText} />
          <button class="btn" onclick={setPrice}>Preis setzen</button>
        </div>
      </Panel>
      <Panel title="STADION">
        <p>Stufe {f.stadiumStage + 1} von {STADIUM.length}: {STADIUM[f.stadiumStage].capacity} Plätze</p>
        {#if f.building}<p>Ausbau läuft: noch {f.building.matchdaysLeft} Spieltage</p>{/if}
        {#if next}
          <button class="btn" disabled={f.building !== null} onclick={() => void controller.send({ type: "buildStadium", managerId })}>
            Ausbauen: {next.capacity} Plätze für {formatEuro(next.cost)} ({next.buildMatchdays} Spieltage)
          </button>
        {:else}
          <p>Höchste Ausbaustufe erreicht.</p>
        {/if}
      </Panel>
      <Panel title="SPONSOR">
        {#if f.sponsor}
          <p>{f.sponsor.name}: {formatEuro(f.sponsor.perMatchday)} pro Spieltag, Prämie {formatEuro(f.sponsor.bonus)}</p>
        {:else}
          {#each f.sponsorOffers as o (o.id)}
            <div class="row">
              <span>{o.name}: {formatEuro(o.perMatchday)} / Sp., Prämie {formatEuro(o.bonus)}</span>
              <button class="btn" aria-label="{o.name} wählen" onclick={() => void controller.send({ type: "chooseSponsor", managerId, offerId: o.id })}>Wählen</button>
            </div>
          {/each}
        {/if}
      </Panel>
    </div>
  </div>
  <div class="foot">
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
  </div>
</div>

<style>
  .finance { display: flex; flex-direction: column; height: 100%; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px; overflow-y: auto; }
  .side { display: flex; flex-direction: column; gap: 6px; }
  p { margin: 0; font-size: 15px; }
  .row { display: flex; align-items: center; gap: 6px; justify-content: space-between; font-size: 15px; }
  input { width: 64px; font-family: var(--font-body); font-size: 16px; color: var(--cream); background: var(--wood-dark); border: 2px solid var(--wood-edge); }
  .sum td { color: var(--gold); border-top: 1px solid var(--wood-edge); }
  b { font-weight: normal; color: var(--leaf); }
  b.negative { color: var(--rust); }
  .foot { display: flex; gap: 6px; padding: 0 8px 6px; }
  .spacer { flex: 1; }
</style>
```

In `src/App.svelte`:
- Import ergänzen: `import Finance from "./ui/screens/Finance.svelte";`
- Vor `{:else}` einfügen:

```svelte
  {:else if view.kind === "finance"}
    <Finance {controller} managerId={view.managerId} />
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/finance.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/Finance.svelte src/App.svelte tests/ui/finance.test.ts
git commit -m "feat(ui): Finanzen mit Bilanz, Eintritt, Stadion und Sponsor"
```

---

### Task 5: Verhandlungsdialog

**Files:**
- Create: `src/ui/screens/NegotiationDialog.svelte`
- Test: `tests/ui/negotiation.test.ts`

**Interfaces:**
- Consumes:
  - Engine: `salaryDemand`, `desiredYears` (economy/contracts), `askingFee`, `isTransferWindow` (economy/transfers), `formatEuro`
  - UI: `latestNegotiation` (Task 2), `Dialog` (Task 2), `POSITION_LABEL`, `playerName`
- Produces: `NegotiationDialog.svelte` mit den Props `{ controller; managerId; playerId; mode: "contract" | "transfer"; onClose: () => void }`
  - **Kopf:** Position, Alter, Stärke, laufender Vertrag. Bei `mode === "transfer"` und geschlossenem Fenster zusätzlich „Das Transferfenster ist geschlossen.“
  - **Vor dem Start:**
    - Eingabefeld „Ablöse“ (Transfer) bzw. „Gehalt“ und „Laufzeit“ (Vertrag). Vorbelegt mit `askingFee` bzw. `salaryDemand` und `desiredYears`.
    - Taste „Verhandlung beginnen“. Sie schickt `startTransferTalk` bzw. `startContractTalk`.
  - **Offene Verhandlung:**
    - Anzeige: `note` der Gegenseite, „Runde r von 3 · Forderung: …“, die Eingabefelder der aktuellen Stufe (`fee` → „Ablöse“, `salary` → „Gehalt“ und „Laufzeit“).
    - Tasten: „Bieten“, „Forderung annehmen“ (`"accept"`) und „Abbrechen“ (`"abort"`).
    - Nach jeder Antwort wird das Betragsfeld auf die neue Forderung gesetzt.
  - **Beendet:** Es bleibt `note` stehen, dazu „Abgeschlossen.“ oder „Beendet.“.
  - **Fortsetzen:** Gibt es für den Spieler schon eine offene Verhandlung dieses Managers, setzt der Dialog sie fort.
  - **Fehler** der Engine (`controller.message`) erscheinen im Dialog.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/negotiation.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { salaryDemand } from "../../src/engine/economy/contracts";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import NegotiationDialog from "../../src/ui/screens/NegotiationDialog.svelte";

function setup() {
  const c = new GameController();
  const world = generateWorld(37);
  const clubId = Object.keys(world.clubs)[1];
  c.startGame(world, [{ name: "Anna", clubId }]);
  const s = c.snapshot!.state;
  return { c, s, managerId: s.managers[0].id, clubId };
}

describe("Verhandlungsdialog", () => {
  it("Vertrag: Gegenforderung anzeigen, dann annehmen", async () => {
    const { c, s, managerId, clubId } = setup();
    const pid = s.clubs[clubId].squad[5];
    render(NegotiationDialog, { controller: c, managerId, playerId: pid, mode: "contract", onClose: vi.fn() });
    const salary = screen.getByLabelText("Gehalt") as HTMLInputElement;
    await fireEvent.input(salary, { target: { value: String(Math.round(salaryDemand(s, s.players[pid], clubId) * 0.85)) } });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(screen.getByText(/fordert/)).toBeTruthy();
    expect(screen.getByText(/Runde 2 von 3/)).toBeTruthy();
    expect(Number(salary.value)).toBeGreaterThan(0);
    await fireEvent.click(screen.getByRole("button", { name: "Forderung annehmen" }));
    expect(screen.getByText("Abgeschlossen.")).toBeTruthy();
    expect(screen.getByText(/unterschreibt/)).toBeTruthy();
  });

  it("Transfer: Ablöse wird akzeptiert, danach Gehalt, dann Wechsel", async () => {
    const { c, s, managerId, clubId } = setup();
    s.clubs[clubId].finance.balance = 100_000_000; // Testaufbau
    const seller = Object.values(s.clubs).find((x) => x.managerId === null)!;
    const pid = seller.squad[14];
    render(NegotiationDialog, { controller: c, managerId, playerId: pid, mode: "transfer", onClose: vi.fn() });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(screen.getByText(/akzeptiert/)).toBeTruthy();
    expect(screen.getByLabelText("Gehalt")).toBeTruthy();
    expect(screen.getByLabelText("Laufzeit")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Forderung annehmen" }));
    expect(screen.getByText("Abgeschlossen.")).toBeTruthy();
    expect(c.snapshot!.state.clubs[clubId].squad).toContain(pid);
  });

  it("geschlossenes Fenster: Hinweis und Fehlermeldung im Dialog", async () => {
    const { c, s, managerId, clubId } = setup();
    s.calendarIndex = 5; // Testaufbau
    s.clubs[clubId].finance.balance = 100_000_000; // damit nicht schon das Geld scheitert
    const seller = Object.values(s.clubs).find((x) => x.managerId === null)!;
    render(NegotiationDialog, { controller: c, managerId, playerId: seller.squad[14], mode: "transfer", onClose: vi.fn() });
    expect(screen.getAllByText("Das Transferfenster ist geschlossen.").length).toBeGreaterThan(0);
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(screen.getAllByText("Das Transferfenster ist geschlossen.").length).toBeGreaterThan(1);
  });

  it("Abbrechen beendet die Verhandlung; „Schließen“ ruft onClose", async () => {
    const { c, s, managerId, clubId } = setup();
    const pid = s.clubs[clubId].squad[6];
    const onClose = vi.fn();
    render(NegotiationDialog, { controller: c, managerId, playerId: pid, mode: "contract", onClose });
    await fireEvent.input(screen.getByLabelText("Gehalt"), { target: { value: String(Math.round(salaryDemand(s, s.players[pid], clubId) * 0.85)) } });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    await fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.getByText("Beendet.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Schließen/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/negotiation.test.ts`
Expected: FAIL, weil das Modul `NegotiationDialog.svelte` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/ui/screens/NegotiationDialog.svelte`:

```svelte
<script lang="ts">
  import { desiredYears, salaryDemand } from "../../engine/economy/contracts";
  import type { NegotiationResponse } from "../../engine/economy/negotiations";
  import { askingFee, isTransferWindow } from "../../engine/economy/transfers";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId, type PlayerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { latestNegotiation } from "../logic/economy";
  import { POSITION_LABEL, playerName } from "../logic/format";
  import Dialog from "../theme/Dialog.svelte";

  let {
    controller,
    managerId,
    playerId,
    mode,
    onClose,
  }: { controller: GameController; managerId: ManagerId; playerId: PlayerId; mode: "contract" | "transfer"; onClose: () => void } = $props();

  function initial(): { negotiationId: string | null; amount: string; years: string } {
    const s = controller.snapshot!.state;
    const p = s.players[playerId];
    const open = latestNegotiation(s, managerId, playerId);
    if (open && open.status === "open") return { negotiationId: open.id, amount: String(open.ask), years: String(open.desiredYears) };
    const clubId = clubOf(s, managerId)!.id;
    const amount = mode === "transfer" ? askingFee(s, p) : salaryDemand(s, p, clubId);
    return { negotiationId: null, amount: String(amount), years: String(desiredYears(p)) };
  }

  const start0 = initial();
  let negotiationId = $state<string | null>(start0.negotiationId);
  let amountText = $state(start0.amount);
  let yearsText = $state(start0.years);

  const gs = $derived(controller.snapshot!.state);
  const p = $derived(gs.players[playerId]);
  const n = $derived(negotiationId ? (gs.negotiations.find((x) => x.id === negotiationId) ?? null) : null);
  const stage = $derived(n ? n.stage : mode === "transfer" ? "fee" : "salary");

  function syncFromNegotiation(): void {
    const cur = negotiationId ? controller.snapshot!.state.negotiations.find((x) => x.id === negotiationId) : null;
    if (cur && cur.status === "open") amountText = String(cur.ask);
  }

  async function begin(): Promise<void> {
    const amount = Number(amountText);
    const ok =
      mode === "transfer"
        ? await controller.send({ type: "startTransferTalk", managerId, playerId, fee: amount })
        : await controller.send({ type: "startContractTalk", managerId, playerId, salary: amount, years: Number(yearsText) });
    if (!ok) return;
    negotiationId = latestNegotiation(controller.snapshot!.state, managerId, playerId)?.id ?? null;
    syncFromNegotiation();
  }

  async function respond(response: NegotiationResponse): Promise<void> {
    if (!n) return;
    await controller.send({ type: "respondNegotiation", managerId, negotiationId: n.id, response });
    syncFromNegotiation();
  }

  function offer(): void {
    const amount = Number(amountText);
    void respond(stage === "salary" ? { amount, years: Number(yearsText) } : { amount });
  }
</script>

<Dialog title="VERHANDLUNG: {playerName(p)}" {onClose}>
  <p>
    {POSITION_LABEL[p.position]} · {p.age} Jahre · Stärke {Math.round(p.strength)}
    {#if p.contract} · Vertrag bis Saison {p.contract.endsSeason}, {formatEuro(p.contract.salary)} pro Spieltag{/if}
  </p>
  {#if mode === "transfer" && p.clubId !== null && !isTransferWindow(gs)}<p class="warn">Das Transferfenster ist geschlossen.</p>{/if}
  {#if n}
    <p class="note">{n.note}</p>
    <p>Runde {n.round} von 3 · Forderung: {formatEuro(n.ask)}{n.stage === "salary" ? " pro Spieltag" : ""}</p>
  {/if}
  {#if !n || n.status === "open"}
    <div class="row">
      <label>
        {stage === "fee" ? "Ablöse" : "Gehalt pro Spieltag"}
        <input aria-label={stage === "fee" ? "Ablöse" : "Gehalt"} bind:value={amountText} inputmode="numeric" size="9" />
      </label>
      {#if stage === "salary"}
        <label>Jahre <input aria-label="Laufzeit" bind:value={yearsText} inputmode="numeric" size="2" /></label>
      {/if}
    </div>
    <div class="row">
      {#if n}
        <button class="btn primary" onclick={offer}>Bieten</button>
        <button class="btn" onclick={() => void respond("accept")}>Forderung annehmen</button>
        <button class="btn" onclick={() => void respond("abort")}>Abbrechen</button>
      {:else}
        <button class="btn primary" onclick={() => void begin()}>Verhandlung beginnen</button>
      {/if}
    </div>
  {:else}
    <p class="done">{n.status === "accepted" ? "Abgeschlossen." : "Beendet."}</p>
  {/if}
  {#if controller.message}<p class="msg">{controller.message}</p>{/if}
</Dialog>

<style>
  p { margin: 0; font-size: 15px; }
  .note { color: var(--gold); }
  .warn { color: var(--rust); }
  .done { color: var(--leaf); }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  input { font-family: var(--font-body); font-size: 16px; color: var(--cream); background: var(--wood-dark); border: 2px solid var(--wood-edge); }
</style>
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/negotiation.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/NegotiationDialog.svelte tests/ui/negotiation.test.ts
git commit -m "feat(ui): Verhandlungsdialog für Verträge und Transfers"
```

---

### Task 6: Verträge

**Files:**
- Create: `src/ui/screens/Contracts.svelte`
- Modify: `src/App.svelte` (Zweig vor `{:else}`)
- Test: `tests/ui/contracts.test.ts`

**Interfaces:**
- Consumes: `contractRows` (Task 2), `NegotiationDialog` (Task 5), `severance` (engine/economy/contracts), `formatEuro`, `POSITION_LABEL`, `playerName`, `ClubHeader`, `Panel`
- Produces: `Contracts.svelte` mit den Props `{ controller; managerId }`
  - **Tabelle:** Die Spalten sind Name, Pos, Alter, St, Gehalt, bis (Saison, bei auslaufenden Verträgen „läuft aus“) und Forderung.
  - **Pro Zeile** zwei Tasten:
    - „Verlängern“ (aria-label „{Name} verlängern“) öffnet den Verhandlungsdialog im Modus `contract`.
    - „Entlassen“ (aria-label „{Name} entlassen“) zeigt eine Bestätigungszeile „{Name} entlassen? Abfindung: X“ mit „Ja, entlassen“ und „Nein“.
  - **Esc:**
    - Bei offenem Dialog schließt Esc den Dialog.
    - Bei offener Bestätigung bricht Esc sie ab.
    - Sonst führt Esc zurück ins Menü.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/contracts.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { severance } from "../../src/engine/economy/contracts";
import { formatEuro } from "../../src/engine/economy/util";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function contractsScreen() {
  const c = new GameController();
  const world = generateWorld(43);
  const clubId = Object.keys(world.clubs)[4];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.open("contracts");
  await tick();
  const gs = () => c.snapshot!.state;
  const name = (id: string) => playerName(gs().players[id]);
  return { c, gs, clubId, name };
}

describe("Verträge", () => {
  it("listet den Kader mit Gehalt und Vertragsende", async () => {
    const { gs, clubId } = await contractsScreen();
    expect(screen.getAllByRole("button", { name: /verlängern$/ })).toHaveLength(gs().clubs[clubId].squad.length);
  });

  it("„Verlängern“ öffnet den Dialog; Esc schließt nur den Dialog", async () => {
    const { c, gs, clubId, name } = await contractsScreen();
    const pid = gs().clubs[clubId].squad[3];
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} verlängern` }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    await tick();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(c.view.kind).toBe("contracts");
  });

  it("Entlassen nur nach Bestätigung, mit Abfindung; die Aufstellung bleibt gültig", async () => {
    const { gs, clubId, name } = await contractsScreen();
    const pid = gs().clubs[clubId].lineup.starters[4];
    const cost = severance(gs(), gs().players[pid]);
    const before = gs().clubs[clubId].finance.balance;
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} entlassen` }));
    expect(screen.getByText(new RegExp(`Abfindung: ${formatEuro(cost).replace(/\./g, "\\.")}`))).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Nein" }));
    expect(gs().clubs[clubId].squad).toContain(pid);
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} entlassen` }));
    await fireEvent.click(screen.getByRole("button", { name: "Ja, entlassen" }));
    expect(gs().clubs[clubId].squad).not.toContain(pid);
    expect(gs().clubs[clubId].finance.balance).toBe(before - cost);
    expect(validateLineup(gs(), clubId, gs().clubs[clubId].lineup)).toBeNull();
  });

  it("Esc ohne Dialog führt ins Menü", async () => {
    const { c } = await contractsScreen();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/contracts.test.ts`
Expected: FAIL, weil keine „verlängern“-Tasten gefunden werden (Platzhalter).

- [ ] **Step 3: Implementieren**

`src/ui/screens/Contracts.svelte`:

```svelte
<script lang="ts">
  import { severance } from "../../engine/economy/contracts";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId, type PlayerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { contractRows } from "../logic/economy";
  import { POSITION_LABEL, playerName } from "../logic/format";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";
  import NegotiationDialog from "./NegotiationDialog.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const rows = $derived(contractRows(gs, club.id));
  let talkFor = $state<PlayerId | null>(null);
  let confirmFor = $state<PlayerId | null>(null);

  async function release(id: PlayerId): Promise<void> {
    confirmFor = null;
    await controller.send({ type: "releasePlayer", managerId, playerId: id });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (talkFor) talkFor = null;
    else if (confirmFor) confirmFor = null;
    else controller.open("menu");
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="contracts">
  <ClubHeader {controller} {managerId} />
  <Panel title="VERTRÄGE" class="list">
    <div class="scroll">
      <table class="board-table">
        <thead>
          <tr><th>Name</th><th>Pos</th><th class="num">Alter</th><th class="num">St</th><th class="num">Gehalt</th><th>bis</th><th class="num">Forderung</th><th></th></tr>
        </thead>
        <tbody>
          {#each rows as r (r.player.id)}
            <tr class:expiring={r.expiring}>
              <td>{playerName(r.player)}</td>
              <td>{POSITION_LABEL[r.player.position]}</td>
              <td class="num">{r.player.age}</td>
              <td class="num">{Math.round(r.player.strength)}</td>
              <td class="num">{formatEuro(r.salary)}</td>
              <td>{r.expiring ? "läuft aus" : `S${r.endsSeason}`}</td>
              <td class="num">{formatEuro(r.demand)}</td>
              <td class="actions">
                <button class="btn" aria-label="{playerName(r.player)} verlängern" onclick={() => (talkFor = r.player.id)}>Verlängern</button>
                <button class="btn" aria-label="{playerName(r.player)} entlassen" onclick={() => (confirmFor = r.player.id)}>Entlassen</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Panel>
  <div class="foot">
    {#if confirmFor && gs.players[confirmFor]}
      {@const p = gs.players[confirmFor]}
      <span class="msg">{playerName(p)} entlassen? Abfindung: {formatEuro(severance(gs, p))}</span>
      <button class="btn primary" onclick={() => void release(p.id)}>Ja, entlassen</button>
      <button class="btn" onclick={() => (confirmFor = null)}>Nein</button>
    {:else if controller.message}
      <span class="msg">{controller.message}</span>
    {/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
  </div>
  {#if talkFor}
    <NegotiationDialog {controller} {managerId} playerId={talkFor} mode="contract" onClose={() => (talkFor = null)} />
  {/if}
</div>

<style>
  .contracts { display: flex; flex-direction: column; height: 100%; position: relative; }
  .contracts :global(.list) { flex: 1; min-height: 0; margin: 8px; }
  .scroll { overflow-y: auto; min-height: 0; flex: 1; }
  .board-table { font-size: 15px; }
  tr.expiring td { color: var(--gold); }
  .actions { display: flex; gap: 4px; }
  .actions .btn { padding: 0 4px; font-size: 14px; }
  .foot { display: flex; align-items: center; gap: 6px; padding: 0 8px 6px; }
  .spacer { flex: 1; }
</style>
```

In `src/App.svelte`:
- Import ergänzen: `import Contracts from "./ui/screens/Contracts.svelte";`
- Vor `{:else}` einfügen:

```svelte
  {:else if view.kind === "contracts"}
    <Contracts {controller} managerId={view.managerId} />
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/contracts.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/Contracts.svelte src/App.svelte tests/ui/contracts.test.ts
git commit -m "feat(ui): Verträge mit Verlängerung und Entlassung"
```

---

### Task 7: Transfers (Markt, eigene Spieler, Angebote)

**Files:**
- Create: `src/ui/screens/Transfers.svelte`
- Modify: `src/App.svelte` (Zweig vor `{:else}`)
- Test: `tests/ui/transfers.test.ts`

**Interfaces:**
- Consumes:
  - UI: `marketRows`, `DEFAULT_FILTER`, `openOffers` (Task 2), `sortRows`, `toggleSort` (Task 2), `NegotiationDialog` (Task 5), `controller.transferTab` (Task 1)
  - Engine: `isTransferWindow`, `marketValue`, `formatEuro`
- Produces: `Transfers.svelte` mit den Props `{ controller; managerId }`
  - **Reiter:** „Markt“, „Meine Spieler“ und „Angebote (n)“. Sie setzen `controller.transferTab`.
  - **Statuszeile:** „Transferfenster offen“ oder „Transferfenster geschlossen – nur Vereinslose verpflichtbar“.
  - **Markt:**
    - Filter: Positionstasten „Alle“, „TW“, „ABW“, „MF“, „ST“; Kontrollkästchen „nur Vereinslose“ und „nur Transferliste“; Feld „Höchstablöse“.
    - Tabelle: Die Spalten Name, Pos, Alter, St, Verein, Ablöse und Gehalt lassen sich sortieren. Jeder Spaltenkopf ist ein Button mit `aria-label="Sortieren nach {Spalte}"`. Start ist Stärke absteigend.
    - Pro Zeile: „Verhandeln“ (aria-label „{Name} verhandeln“). Das öffnet den Dialog, bei Vereinslosen im Modus `contract`, sonst `transfer`.
  - **Meine Spieler:**
    - Pro Spieler: Stärke, Marktwert und Status („gelistet: Preis“ bzw. „gelistet“ oder „—“).
    - Feld „Wunschpreis {Name}“ und die Taste „{Name} auf die Liste“ bzw. „{Name} von der Liste“. Das schickt `setTransferListing`, ein leerer Preis wird als `null` geschickt.
  - **Angebote:**
    - Pro offenem Angebot: „{Käufer} bietet {Ablöse} für {Spieler}“.
    - Tasten: „Angebot für {Spieler} annehmen“ und „Angebot für {Spieler} ablehnen“.
    - Gegenangebot: Feld „Gegenangebot {Spieler}“ und die Taste „Gegenangebot für {Spieler} senden“.
    - Ohne Angebote steht dort „Keine offenen Angebote.“
  - **Esc:** Bei offenem Dialog schließt Esc den Dialog, sonst geht es ins Menü.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/transfers.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function transfersScreen() {
  const c = new GameController();
  const world = generateWorld(47);
  const clubId = Object.keys(world.clubs)[6];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.openTransfers("market");
  await tick();
  const gs = () => c.snapshot!.state;
  return { c, gs, clubId, name: (id: string) => playerName(gs().players[id]) };
}

const ages = () => Array.from(document.querySelectorAll("td.age")).map((td) => Number(td.textContent));

describe("Transfermarkt", () => {
  it("zeigt keine eigenen Spieler und meldet das offene Fenster", async () => {
    const { gs, clubId, name } = await transfersScreen();
    expect(screen.getByText("Transferfenster offen")).toBeTruthy();
    for (const id of gs().clubs[clubId].squad) expect(screen.queryByRole("button", { name: `${name(id)} verhandeln` })).toBeNull();
  });

  it("sortiert per Klick auf den Spaltenkopf", async () => {
    await transfersScreen();
    await fireEvent.click(screen.getByRole("button", { name: "Sortieren nach Alter" }));
    const desc = ages();
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    await fireEvent.click(screen.getByRole("button", { name: "Sortieren nach Alter" }));
    const asc = ages();
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });

  it("filtert nach Torhütern und nach Vereinslosen", async () => {
    await transfersScreen();
    await fireEvent.click(screen.getByRole("button", { name: "TW" }));
    expect(Array.from(document.querySelectorAll("td.pos")).every((td) => td.textContent === "TW")).toBe(true);
    await fireEvent.click(screen.getByRole("button", { name: "Alle" }));
    await fireEvent.click(screen.getByLabelText("nur Vereinslose"));
    expect(Array.from(document.querySelectorAll("td.club")).every((td) => td.textContent === "vereinslos")).toBe(true);
  });

  it("Vereinslose öffnen einen Vertragsdialog, KI-Spieler einen Transferdialog; Esc schließt nur den Dialog", async () => {
    const { c, gs } = await transfersScreen();
    const free = Object.values(gs().players).filter((p) => p.clubId === null && !p.retired).sort((a, b) => b.strength - a.strength)[0];
    await fireEvent.click(screen.getByLabelText("nur Vereinslose")); // sonst kann er außerhalb der 150 stärksten liegen
    await fireEvent.click(screen.getByRole("button", { name: `${playerName(free)} verhandeln` }));
    expect(screen.getByLabelText("Gehalt")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    await tick();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(c.view.kind).toBe("transfers");
    await fireEvent.click(screen.getByLabelText("nur Vereinslose"));
    const firstAi = Array.from(document.querySelectorAll("td.club")).findIndex((td) => td.textContent !== "vereinslos");
    (screen.getAllByRole("button", { name: /verhandeln$/ })[firstAi] as HTMLButtonElement).click();
    await tick();
    expect(screen.getByLabelText("Ablöse")).toBeTruthy();
  });
});

describe("Meine Spieler und Angebote", () => {
  it("setzt einen Spieler mit Wunschpreis auf die Transferliste und wieder herunter", async () => {
    const { c, gs, clubId, name } = await transfersScreen();
    c.openTransfers("mine");
    await tick();
    const pid = gs().clubs[clubId].squad[8];
    await fireEvent.input(screen.getByLabelText(`Wunschpreis ${name(pid)}`), { target: { value: "300000" } });
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} auf die Liste` }));
    expect(gs().players[pid].transferListed).toEqual({ askingPrice: 300_000 });
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} von der Liste` }));
    expect(gs().players[pid].transferListed).toBeNull();
  });

  it("nimmt ein KI-Angebot an", async () => {
    const { c, gs, clubId, name } = await transfersScreen();
    const pid = gs().clubs[clubId].squad[9];
    const buyer = Object.values(gs().clubs).find((x) => x.managerId === null)!;
    gs().transferOffers.push({ id: "o1", managerId: gs().managers[0].id, fromClub: buyer.id, playerId: pid, fee: 400_000, maxFee: 500_000, round: 1, status: "open", season: 1, expiresAfter: 0 }); // Testaufbau
    c.openTransfers("offers");
    await tick();
    expect(screen.getByText(new RegExp(`${buyer.name} bietet`))).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: `Angebot für ${gs().players[pid].firstName} ${gs().players[pid].lastName} annehmen` }));
    expect(gs().clubs[clubId].squad).not.toContain(pid);
    expect(screen.getByText("Keine offenen Angebote.")).toBeTruthy();
    expect(name(pid)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/transfers.test.ts`
Expected: FAIL, weil „Transferfenster offen“ nicht gefunden wird (Platzhalter).

- [ ] **Step 3: Implementieren**

`src/ui/screens/Transfers.svelte`:

```svelte
<script lang="ts">
  import { marketValue } from "../../engine/economy/money";
  import { isTransferWindow } from "../../engine/economy/transfers";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId, type Player, type PlayerId, type Position } from "../../engine/model";
  import type { GameController, TransferTab } from "../controller.svelte";
  import { DEFAULT_FILTER, marketRows, openOffers, type MarketFilter, type MarketRow, type OfferRow } from "../logic/economy";
  import { POSITION_LABEL, playerName } from "../logic/format";
  import { sortRows, toggleSort, type SortState } from "../logic/sort";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";
  import NegotiationDialog from "./NegotiationDialog.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  type Key = "name" | "pos" | "age" | "strength" | "club" | "fee" | "wage";
  const COLUMNS: { key: Key; label: string; num: boolean }[] = [
    { key: "name", label: "Name", num: false },
    { key: "pos", label: "Pos", num: false },
    { key: "age", label: "Alter", num: true },
    { key: "strength", label: "St", num: true },
    { key: "club", label: "Verein", num: false },
    { key: "fee", label: "Ablöse", num: true },
    { key: "wage", label: "Gehalt", num: true },
  ];
  const POS_ORDER: Position[] = ["GK", "DF", "MF", "FW"];
  const POSITION_FILTERS: { id: Position | "all"; label: string }[] = [
    { id: "all", label: "Alle" },
    ...POS_ORDER.map((id) => ({ id, label: POSITION_LABEL[id] })),
  ];
  const TABS: { id: TransferTab; label: string }[] = [
    { id: "market", label: "Markt" },
    { id: "mine", label: "Meine Spieler" },
    { id: "offers", label: "Angebote" },
  ];

  let filter = $state<MarketFilter>({ ...DEFAULT_FILTER });
  let maxFeeText = $state("");
  let sort = $state<SortState<Key>>({ key: "strength", dir: -1 });
  let talk = $state<{ playerId: PlayerId; mode: "contract" | "transfer" } | null>(null);
  let prices = $state<Record<string, string>>({});
  let counters = $state<Record<string, string>>({});

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const windowOpen = $derived(isTransferWindow(gs));
  const maxFee = $derived(maxFeeText.trim() === "" ? null : Number(maxFeeText));
  const rows = $derived(sortRows(marketRows(gs, club.id, { ...filter, maxFee }), sort, value));
  const mine = $derived(club.squad.map((id) => gs.players[id]).sort((a, b) => b.strength - a.strength));
  const offers = $derived(openOffers(gs, managerId));

  function value(r: MarketRow, k: Key): number | string {
    switch (k) {
      case "name":
        return r.player.lastName;
      case "pos":
        return POS_ORDER.indexOf(r.player.position);
      case "age":
        return r.player.age;
      case "strength":
        return r.player.strength;
      case "club":
        return r.clubName;
      case "fee":
        return r.fee;
      case "wage":
        return r.wage;
    }
  }

  function arrow(k: Key): string {
    return sort.key === k ? (sort.dir === -1 ? " ▼" : " ▲") : "";
  }

  function list(p: Player, listed: boolean): void {
    const text = (prices[p.id] ?? "").trim();
    void controller.send({ type: "setTransferListing", managerId, playerId: p.id, listed, askingPrice: listed && text !== "" ? Number(text) : null });
  }

  function counter(o: OfferRow): void {
    void controller.send({ type: "respondTransferOffer", managerId, offerId: o.offer.id, response: { counter: Number(counters[o.offer.id] ?? "0") } });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (talk) talk = null;
    else controller.open("menu");
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="transfers">
  <ClubHeader {controller} {managerId} />
  <div class="tabs">
    {#each TABS as t (t.id)}
      <button class="btn" class:selected={controller.transferTab === t.id} onclick={() => (controller.transferTab = t.id)}>
        {t.label}{t.id === "offers" ? ` (${offers.length})` : ""}
      </button>
    {/each}
    <span class="status" class:closed={!windowOpen}>{windowOpen ? "Transferfenster offen" : "Transferfenster geschlossen – nur Vereinslose verpflichtbar"}</span>
  </div>

  {#if controller.transferTab === "market"}
    <div class="filters">
      {#each POSITION_FILTERS as pf (pf.id)}
        <button class="btn" class:selected={filter.position === pf.id} onclick={() => (filter = { ...filter, position: pf.id })}>{pf.label}</button>
      {/each}
      <label><input type="checkbox" bind:checked={filter.freeOnly} /> nur Vereinslose</label>
      <label><input type="checkbox" bind:checked={filter.listedOnly} /> nur Transferliste</label>
      <label>max. <input class="money" aria-label="Höchstablöse" bind:value={maxFeeText} inputmode="numeric" size="9" /></label>
    </div>
    <Panel class="list">
      <div class="scroll">
        <table class="board-table">
          <thead>
            <tr>
              {#each COLUMNS as col (col.key)}
                <th class:num={col.num}>
                  <button class="sort" aria-label="Sortieren nach {col.label}" onclick={() => (sort = toggleSort(sort, col.key))}>{col.label}{arrow(col.key)}</button>
                </th>
              {/each}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as r (r.player.id)}
              <tr>
                <td>{playerName(r.player)}</td>
                <td class="pos">{POSITION_LABEL[r.player.position]}</td>
                <td class="num age">{r.player.age}</td>
                <td class="num">{Math.round(r.player.strength)}</td>
                <td class="club">{r.clubName}</td>
                <td class="num">{r.free ? "–" : formatEuro(r.fee)}</td>
                <td class="num">{formatEuro(r.wage)}</td>
                <td>
                  <button class="btn small" aria-label="{playerName(r.player)} verhandeln" onclick={() => (talk = { playerId: r.player.id, mode: r.free ? "contract" : "transfer" })}>Verhandeln</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Panel>
  {:else if controller.transferTab === "mine"}
    <Panel class="list">
      <div class="scroll">
        <table class="board-table">
          <thead><tr><th>Name</th><th class="num">St</th><th class="num">Marktwert</th><th>Status</th><th>Wunschpreis</th><th></th></tr></thead>
          <tbody>
            {#each mine as p (p.id)}
              <tr>
                <td>{playerName(p)}</td>
                <td class="num">{Math.round(p.strength)}</td>
                <td class="num">{formatEuro(marketValue(p, gs.season))}</td>
                <td>{p.transferListed ? (p.transferListed.askingPrice ? `gelistet: ${formatEuro(p.transferListed.askingPrice)}` : "gelistet") : "—"}</td>
                <td><input class="money" aria-label="Wunschpreis {playerName(p)}" bind:value={prices[p.id]} inputmode="numeric" size="9" /></td>
                <td>
                  {#if p.transferListed}
                    <button class="btn small" aria-label="{playerName(p)} von der Liste" onclick={() => list(p, false)}>Von der Liste</button>
                  {:else}
                    <button class="btn small" aria-label="{playerName(p)} auf die Liste" onclick={() => list(p, true)}>Auf die Liste</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Panel>
  {:else}
    <Panel class="list">
      {#if offers.length === 0}
        <p>Keine offenen Angebote.</p>
      {:else}
        {#each offers as o (o.offer.id)}
          <div class="offer">
            <span>{o.buyerName} bietet {formatEuro(o.offer.fee)} für {o.playerName} (Runde {o.offer.round}/3)</span>
            <button class="btn small" aria-label="Angebot für {o.playerName} annehmen" onclick={() => void controller.send({ type: "respondTransferOffer", managerId, offerId: o.offer.id, response: "accept" })}>Annehmen</button>
            <button class="btn small" aria-label="Angebot für {o.playerName} ablehnen" onclick={() => void controller.send({ type: "respondTransferOffer", managerId, offerId: o.offer.id, response: "reject" })}>Ablehnen</button>
            <input class="money" aria-label="Gegenangebot {o.playerName}" bind:value={counters[o.offer.id]} inputmode="numeric" size="9" />
            <button class="btn small" aria-label="Gegenangebot für {o.playerName} senden" onclick={() => counter(o)}>Gegenangebot</button>
          </div>
        {/each}
      {/if}
    </Panel>
  {/if}

  <div class="foot">
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
  </div>
  {#if talk}
    <NegotiationDialog {controller} {managerId} playerId={talk.playerId} mode={talk.mode} onClose={() => (talk = null)} />
  {/if}
</div>

<style>
  .transfers { display: flex; flex-direction: column; height: 100%; position: relative; }
  .tabs, .filters { display: flex; align-items: center; gap: 6px; padding: 4px 8px 0; flex-wrap: wrap; font-size: 15px; }
  .status { margin-left: auto; color: var(--leaf); }
  .status.closed { color: var(--rust); }
  .transfers :global(.list) { flex: 1; min-height: 0; margin: 6px 8px; }
  .scroll { overflow-y: auto; min-height: 0; flex: 1; }
  .board-table { font-size: 15px; }
  .sort { all: unset; cursor: pointer; color: var(--leaf); }
  .sort:focus-visible { outline: 1px solid var(--gold); }
  .small { padding: 0 4px; font-size: 14px; }
  .money { font-family: var(--font-body); font-size: 15px; color: var(--cream); background: var(--wood-dark); border: 2px solid var(--wood-edge); }
  .offer { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 15px; }
  p { margin: 0; }
  .foot { display: flex; align-items: center; gap: 6px; padding: 0 8px 6px; }
  .spacer { flex: 1; }
</style>
```

In `src/App.svelte`:
- Import ergänzen: `import Transfers from "./ui/screens/Transfers.svelte";`
- Vor `{:else}` einfügen:

```svelte
  {:else if view.kind === "transfers"}
    <Transfers {controller} managerId={view.managerId} />
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/transfers.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/Transfers.svelte src/App.svelte tests/ui/transfers.test.ts
git commit -m "feat(ui): Transfers mit sortierbarem Markt, Transferliste und Angeboten"
```

---

### Task 8: Nachrichten und Jobangebote

**Files:**
- Create: `src/ui/screens/Messages.svelte`, `src/ui/screens/Jobs.svelte`
- Modify: `src/App.svelte` (Zweige vor `{:else}`)
- Test: `tests/ui/messages.test.ts`

**Interfaces:**
- Consumes:
  - Engine: `messagesFor` (economy/messages), `expectationLabel` (economy/board), `COMP`
  - UI: `messageLabel` (Task 2), `controller.openTransfers` (Task 1), `Crest`, `Panel`, `ClubHeader`
- Produces:
  - `Messages.svelte` mit den Props `{ controller; managerId }`:
    - **Liste:** neueste Nachricht zuerst, mit „S1 · 5. Sp.“ und Text. Ohne Nachrichten steht dort „Keine Nachrichten.“
    - **Sprung-Tasten** je nach Bezug:
      - `transferOffer` → „Zum Angebot“ (`openTransfers("offers")`)
      - `jobOffer` → „Zu den Jobangeboten“ (`open("jobs")`)
      - `sponsor` → „Zu den Finanzen“
      - `negotiation` → „Zu den Verträgen“

      Ohne Verein gibt es nur „Zu den Jobangeboten“.
    - **Zurück:** Esc oder „Zurück (Esc)“ führt mit Verein ins Menü, ohne Verein zu den Jobs.
  - `Jobs.svelte` mit den Props `{ controller; managerId }`:
    - **Überschrift:** „OHNE VEREIN“ (mit „Seit N Spieltagen ohne Verein.“) bzw. „JOBANGEBOTE“.
    - **Pro Angebot** (nur Vereine ohne Manager): Wappen, Name, Liga, Saisonziel und die Taste „Annehmen“ (aria-label „{Verein} annehmen“). Nach erfolgreicher Annahme folgt `open("menu")`.
    - **Ohne Angebote:** „Zurzeit keine Angebote. Spätestens nach 3 Spieltagen meldet sich ein Verein.“
    - **Weitere Tasten:**
      - „Nachrichten“ und „Tabelle“
      - ohne Verein: „Weiter (Enter)“ (`endTurn`)
      - mit Verein: „Zurück (Esc)“ (Menü)

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/messages.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { fireManager } from "../../src/engine/economy/board";
import { postMessage } from "../../src/engine/economy/messages";
import { generateWorld } from "../../src/engine/generator";
import { Rng } from "../../src/engine/rng";
import { GameController } from "../../src/ui/controller.svelte";

async function game() {
  const c = new GameController();
  const world = generateWorld(53);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[3] }]);
  render(App, { controller: c });
  await tick();
  return { c, gs: () => c.snapshot!.state, anna: () => c.snapshot!.state.managers[0] };
}

describe("Nachrichten", () => {
  it("neueste zuerst; Verweise springen zum Angebot und zu den Finanzen", async () => {
    const { c, gs, anna } = await game();
    postMessage(gs(), anna().id, "Erste Testnachricht");
    postMessage(gs(), anna().id, "Zweite Testnachricht", { type: "transferOffer", id: "x" }); // Testaufbau
    c.open("messages");
    await tick();
    const items = Array.from(document.querySelectorAll("li.message")).map((li) => li.textContent ?? "");
    expect(items[0]).toContain("Zweite Testnachricht");
    expect(items[1]).toContain("Erste Testnachricht");
    await fireEvent.click(screen.getAllByRole("button", { name: "Zum Angebot" })[0]);
    expect(c.view.kind).toBe("transfers");
    expect(c.transferTab).toBe("offers");
    c.open("messages");
    await tick();
    await fireEvent.click(screen.getAllByRole("button", { name: "Zu den Finanzen" })[0]);
    expect(c.view.kind).toBe("finance");
  });
});

describe("Jobangebote", () => {
  it("ohne Verein: Angebote annehmen führt ins Hauptmenü des neuen Vereins", async () => {
    const { c, gs, anna } = await game();
    fireManager(gs(), anna().id, Rng.fromSeed(2)); // Testaufbau
    c.open("menu");
    await tick();
    expect(screen.getByText("OHNE VEREIN")).toBeTruthy();
    const target = gs().clubs[anna().jobOffers[0]];
    await fireEvent.click(screen.getByRole("button", { name: `${target.name} annehmen` }));
    expect(anna().clubId).toBe(target.id);
    expect(c.view.kind).toBe("menu");
  });

  it("ohne Verein: „Weiter“ beendet die Runde", async () => {
    const { c, gs, anna } = await game();
    fireManager(gs(), anna().id, Rng.fromSeed(3));
    c.open("jobs");
    await tick();
    await fireEvent.keyDown(window, { key: "Enter" });
    await tick();
    expect(c.view.kind).toBe("conference");
  });

  it("mit Verein und Angebot: Überschrift „JOBANGEBOTE“ und „Zurück“", async () => {
    const { c, gs, anna } = await game();
    const other = Object.values(gs().clubs).find((x) => x.managerId === null)!;
    anna().jobOffers = [other.id]; // Testaufbau
    c.open("jobs");
    await tick();
    expect(screen.getByText("JOBANGEBOTE")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(c.view.kind).toBe("menu");
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/messages.test.ts`
Expected: FAIL, weil keine Nachrichtenliste und kein „OHNE VEREIN“ gefunden werden.

- [ ] **Step 3: Implementieren**

`src/ui/screens/Messages.svelte`:

```svelte
<script lang="ts">
  import { messagesFor } from "../../engine/economy/messages";
  import type { ManagerId, Message } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { messageLabel } from "../logic/economy";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const hasClub = $derived(gs.managers.find((m) => m.id === managerId)?.clubId != null);
  const list = $derived(messagesFor(gs, managerId));

  function link(m: Message): { label: string; go: () => void } | null {
    if (!m.ref) return null;
    switch (m.ref.type) {
      case "jobOffer":
        return { label: "Zu den Jobangeboten", go: () => controller.open("jobs") };
      case "transferOffer":
        return hasClub ? { label: "Zum Angebot", go: () => controller.openTransfers("offers") } : null;
      case "sponsor":
        return hasClub ? { label: "Zu den Finanzen", go: () => controller.open("finance") } : null;
      case "negotiation":
        return hasClub ? { label: "Zu den Verträgen", go: () => controller.open("contracts") } : null;
    }
  }

  function back(): void {
    controller.open(hasClub ? "menu" : "jobs");
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      back();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="messages">
  <ClubHeader {controller} {managerId} />
  <Panel title="NACHRICHTEN" class="list">
    {#if list.length === 0}
      <p>Keine Nachrichten.</p>
    {:else}
      <ul>
        {#each list as m (m.id)}
          {@const l = link(m)}
          <li class="message">
            <span class="when">{messageLabel(m.season, m.calendarIndex)}</span>
            <span class="text">{m.text}</span>
            {#if l}<button class="btn small" onclick={l.go}>{l.label}</button>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Panel>
  <div class="foot">
    <span class="spacer"></span>
    <button class="btn" onclick={back}>Zurück (Esc)</button>
  </div>
</div>

<style>
  .messages { display: flex; flex-direction: column; height: 100%; }
  .messages :global(.list) { flex: 1; min-height: 0; margin: 8px; overflow-y: auto; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
  li { display: grid; grid-template-columns: 96px 1fr auto; gap: 6px; align-items: center; font-size: 15px; }
  .when { color: var(--leaf); }
  .small { padding: 0 4px; font-size: 14px; }
  p { margin: 0; }
  .foot { display: flex; padding: 0 8px 6px; }
  .spacer { flex: 1; }
</style>
```

`src/ui/screens/Jobs.svelte`:

```svelte
<script lang="ts">
  import { expectationLabel } from "../../engine/economy/board";
  import { COMP, type ClubId, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import Crest from "../theme/Crest.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const m = $derived(gs.managers.find((x) => x.id === managerId)!);
  const hasClub = $derived(m.clubId !== null);
  const offers = $derived(m.jobOffers.map((id) => gs.clubs[id]).filter((c) => c && c.managerId === null));

  function leagueOf(id: ClubId): string {
    return gs.competitions[COMP.first]?.clubs.includes(id) ? COMP.first : COMP.second;
  }

  async function accept(clubId: ClubId): Promise<void> {
    if (await controller.send({ type: "acceptJobOffer", managerId, clubId })) controller.open("menu");
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter" && !hasClub) {
      e.preventDefault();
      void controller.endTurn(managerId);
    } else if (e.key === "Escape" && hasClub) {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="jobs">
  <Panel>
    <h1>{hasClub ? "JOBANGEBOTE" : "OHNE VEREIN"}</h1>
    <p>{controller.managerName(managerId)}{hasClub ? "" : ` · Seit ${m.unemployedFor} Spieltagen ohne Verein.`}</p>
  </Panel>
  <Panel title="ANGEBOTE" class="list">
    {#if offers.length === 0}
      <p>Zurzeit keine Angebote. Spätestens nach 3 Spieltagen meldet sich ein Verein.</p>
    {:else}
      {#each offers as c (c.id)}
        {@const league = leagueOf(c.id)}
        <div class="offer">
          <Crest colors={c.colors} pattern={c.crest} size={20} />
          <strong>{c.name}</strong>
          <span>{gs.competitions[league]?.name ?? ""} · Ziel: {expectationLabel(c.board.expectation, league)}</span>
          <button class="btn primary" aria-label="{c.name} annehmen" onclick={() => void accept(c.id)}>Annehmen</button>
        </div>
      {/each}
    {/if}
  </Panel>
  <div class="foot">
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("messages")}>Nachrichten</button>
    <button class="btn" onclick={() => controller.open("tables")}>Tabelle</button>
    {#if hasClub}
      <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
    {:else}
      <button class="btn primary" onclick={() => void controller.endTurn(managerId)}>Weiter (Enter)</button>
    {/if}
  </div>
</div>

<style>
  .jobs { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
  .jobs :global(.list) { flex: 1; min-height: 0; overflow-y: auto; }
  p { margin: 0; }
  .offer { display: flex; align-items: center; gap: 8px; font-size: 16px; }
  .offer strong { font-weight: normal; color: var(--gold); }
  .offer .btn { margin-left: auto; }
  .foot { display: flex; align-items: center; gap: 6px; }
  .spacer { flex: 1; }
</style>
```

In `src/App.svelte`:
- Imports ergänzen: `import Jobs from "./ui/screens/Jobs.svelte";` und `import Messages from "./ui/screens/Messages.svelte";`
- Vor `{:else}` einfügen:

```svelte
  {:else if view.kind === "messages"}
    <Messages {controller} managerId={view.managerId} />
  {:else if view.kind === "jobs"}
    {#key view.managerId}<Jobs {controller} managerId={view.managerId} />{/key}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/messages.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/Messages.svelte src/ui/screens/Jobs.svelte src/App.svelte tests/ui/messages.test.ts
git commit -m "feat(ui): Nachrichten und Jobangebote"
```

---

### Task 9: Hauptmenü freischalten, Ereignisliste begrenzen, Ablauftest

**Files:**
- Modify: `src/ui/screens/MainMenu.svelte`, `src/ui/screens/Results.svelte`, `src/App.svelte` (Platzhalter entfernen), `tests/ui/menu.test.ts` (Tests zu gesperrten Kacheln anpassen), `tests/ui/results.test.ts` (ergänzen)
- Test: `tests/ui/economyFlow.test.ts`

**Interfaces:**
- Consumes: alle Bildschirme aus den Tasks 3–8, `messagesFor`, `openOffers`
- Produces:
  - **Hauptmenü:**
    - Alle 8 Kacheln sind aktiv: 1 Mannschaft, 2 Training, 3 Verträge, 4 Transfers, 5 Finanzen, 6 Tabelle, 7 Nachrichten, 8 Weiter.
    - „Transfers“ zeigt „Transfers (n)“ bei n offenen Angeboten an den Manager.
    - „Nachrichten“ zeigt „Nachrichten (n)“ bei n Nachrichten dieser Saison mit Kalenderindex ≥ aktueller Index − 1. Das sind die Nachrichten seit dem letzten Spieltag.
  - **Auswertung:** Die Tafeln „EREIGNISSE“ und „HINWEISE“ bekommen die Klasse `capped`, sind höchstens 84 px hoch und scrollen. Die Tasten „Tabelle“ und „Weiter“ bleiben so immer sichtbar (offener Punkt aus Plan 2).
  - **App:** Der Platzhalter-Zweig `{:else}` und sein `<style>` entfallen, alle Ansichten haben einen Zweig.

- [ ] **Step 1: Bestehende Menütests anpassen und neue Tests schreiben**

In `tests/ui/menu.test.ts`:
- Den Test „hat 8 Kacheln, fünf davon gesperrt“ ersetzen durch:

```ts
  it("hat 8 Kacheln, keine gesperrt", async () => {
    const c = game();
    c.open("menu");
    await tick();
    const tiles = screen.getAllByRole("button").filter((b) => b.classList.contains("tile"));
    expect(tiles).toHaveLength(8);
    expect(tiles.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(0);
  });
```

- Den Test „gesperrte Kacheln reagieren nicht auf ihre Taste“ ersetzen durch:

```ts
  it("Tasten 2, 3, 4, 5 und 7 öffnen die Wirtschafts-Bildschirme", async () => {
    const c = game();
    const expected: [string, string][] = [["2", "training"], ["3", "contracts"], ["4", "transfers"], ["5", "finance"], ["7", "messages"]];
    for (const [key, kind] of expected) {
      c.open("menu");
      await tick();
      await fireEvent.keyDown(window, { key });
      expect(c.view.kind).toBe(kind);
    }
  });
```

An `tests/ui/results.test.ts` innerhalb des bestehenden `describe` anhängen (die Imports `screen` aus `@testing-library/svelte` ergänzen):

```ts
  it("viele Ereignisse: die Tafel ist höhenbegrenzt, „Tabelle“ und „Weiter“ bleiben da", async () => {
    const controller = new GameController();
    const world = generateWorld(3);
    const mgrClub = Object.keys(world.clubs)[0];
    controller.startGame(world, [{ name: "Anna", clubId: mgrClub }]);
    const id = controller.snapshot!.state.managers[0].id;
    await controller.endTurn(id);
    controller.advance();
    await controller.endTurn(id);
    controller.advance();
    const snap = controller.snapshot!;
    const live = snap.lives.find((l) => l.home.club === mgrClub || l.away.club === mgrClub)!;
    const scorer = (live.home.club === mgrClub ? live.home : live.away).played[5];
    for (let m = 1; m <= 25; m++) live.events.push({ minute: m, type: "goal", club: mgrClub, player: scorer }); // Testaufbau: viele Ereignisse
    render(App, { controller });
    await tick();
    expect(document.querySelector("section.panel.capped")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Weiter/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tabelle" })).toBeTruthy();
  });
```

`tests/ui/economyFlow.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

const key = async (k: string) => {
  await fireEvent.keyDown(window, { key: k });
  await new Promise((r) => setTimeout(r, 0));
  await tick();
};

describe("Wirtschaft über die Oberfläche", () => {
  it("Vereinslosen verpflichten, Eintritt setzen, hart trainieren, Spieltag starten", async () => {
    const c = new GameController();
    const world = generateWorld(59);
    const clubId = Object.keys(world.clubs)[5];
    c.startGame(world, [{ name: "Anna", clubId }]);
    render(App, { controller: c });
    await tick();
    const club = () => c.snapshot!.state.clubs[clubId];
    const squadBefore = club().squad.length;

    await key("Enter"); // → Hauptmenü
    await key("4"); // → Transfers
    await fireEvent.click(screen.getByLabelText("nur Vereinslose"));
    await fireEvent.click(screen.getAllByRole("button", { name: /verhandeln$/ })[0]);
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(screen.getByText("Abgeschlossen.")).toBeTruthy();
    await key("Escape"); // Dialog zu
    expect(c.view.kind).toBe("transfers");
    await key("Escape"); // → Menü
    expect(club().squad.length).toBe(squadBefore + 1);

    await key("5"); // → Finanzen
    await fireEvent.input(screen.getByLabelText("Eintrittspreis"), { target: { value: "25" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preis setzen" }));
    expect(club().finance.ticketPrice).toBe(25);
    await key("Escape");

    await key("2"); // → Training
    await fireEvent.click(screen.getByRole("button", { name: /^hart/ }));
    expect(club().training.intensity).toBe("hard");
    await key("Escape");

    await key("Enter"); // Weiter
    expect(c.view).toEqual({ kind: "conference", half: 1 });
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/ui/menu.test.ts tests/ui/results.test.ts tests/ui/economyFlow.test.ts`
Expected: FAIL, weil die Kacheln noch gesperrt sind, `capped` fehlt und die Taste 4 nichts öffnet.

- [ ] **Step 3: Implementieren**

In `src/ui/screens/MainMenu.svelte`:
- Imports ergänzen:

```ts
  import { messagesFor } from "../../engine/economy/messages";
  import { openOffers } from "../logic/economy";
```

- Die Konstante `tiles` ersetzen durch:

```ts
  const gs = $derived(controller.snapshot!.state);
  const offerCount = $derived(openOffers(gs, managerId).length);
  const newMessages = $derived(
    messagesFor(gs, managerId).filter((m) => m.season === gs.season && m.calendarIndex >= gs.calendarIndex - 1).length,
  );
  const count = (label: string, n: number) => (n > 0 ? `${label} (${n})` : label);

  const tiles = $derived<{ key: string; icon: string; label: string; action: (() => void) | null }[]>([
    { key: "1", icon: "11", label: "Mannschaft", action: () => controller.open("squad") },
    { key: "2", icon: "++", label: "Training", action: () => controller.open("training") },
    { key: "3", icon: "§", label: "Verträge", action: () => controller.open("contracts") },
    { key: "4", icon: "<>", label: count("Transfers", offerCount), action: () => controller.openTransfers("market") },
    { key: "5", icon: "$", label: "Finanzen", action: () => controller.open("finance") },
    { key: "6", icon: "#", label: "Tabelle", action: () => controller.open("tables") },
    { key: "7", icon: "@", label: count("Nachrichten", newMessages), action: () => controller.open("messages") },
    { key: "8", icon: ">>", label: "Weiter", action: () => void controller.endTurn(managerId) },
  ]);
```

In `src/ui/screens/Results.svelte`:
- Bei `<Panel title="EREIGNISSE">` und `<Panel title="HINWEISE">` jeweils `class="capped"` ergänzen.
- Im `<style>`-Block ergänzen:

```css
  .results :global(.capped) { flex: none; max-height: 84px; overflow-y: auto; }
```

In `src/App.svelte` den Zweig

```svelte
  {:else}
    <p class="placeholder">Bildschirm „{view.kind}“ folgt.</p>
```

und den `<style>`-Block mit `.placeholder` entfernen.

- [ ] **Step 4: Gesamtprüfung**

Run: `npx vitest run && npm run check && npm run build`
Expected:
- alle Tests PASS (Engine, Session, UI)
- `svelte-check` meldet 0 Fehler und 0 Warnungen
- der Build ist erfolgreich

Run: `git diff --stat main -- src/engine src/transport`
Expected: keine Ausgabe

Run: `git diff main -- src/session/session.ts`
Expected: nur die Zeile in `beginTurns` ist geändert

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/MainMenu.svelte src/ui/screens/Results.svelte src/App.svelte tests/ui/menu.test.ts tests/ui/results.test.ts tests/ui/economyFlow.test.ts
git commit -m "feat(ui): Hauptmenü mit allen Bereichen, begrenzte Ereignisliste und Ablauftest"
```

---

## Manuell ausprobieren

```bash
npm run dev
```

1. Neues Spiel mit 1–2 Managern anlegen.
2. **Transfers** (Taste 4):
   - „nur Vereinslose“ wählen, einen Spieler verhandeln und verpflichten.
   - Nach Alter sortieren.
   - Einen eigenen Spieler auf die Transferliste setzen.
3. **Finanzen** (Taste 5): Eintrittspreis ändern und einen Sponsor wählen.
4. **Training** (Taste 2): Intensität und Schwerpunkt einstellen, bis zu 3 Spieler fördern.
5. **Verträge** (Taste 3):
   - Einen Spieler verlängern und dabei eine Gegenforderung erleben.
   - Einen Spieler mit Bestätigung entlassen.
6. **Mehrere Spieltage spielen:**
   - Nachrichten (Taste 7) ansehen.
   - Im Winterfenster vor dem 18. Spieltag auf KI-Angebote reagieren.
7. **Wird ein Manager entlassen:** Er sieht „OHNE VEREIN“ und kann ein Jobangebot annehmen.

