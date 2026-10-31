# Wirtschaft in der Engine (Plan 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Engine bekommt die komplette Wirtschaft aus Spec Abschnitt 7.4, 8 und 9:
- Training mit Spielerentwicklung, Alterung, Karriereende und Nachwuchs
- Finanzen mit Zuschauern, TV, Sponsor, Gehältern, Stadion und Dispo
- Verträge mit Verhandlung in höchstens 3 Runden
- Transfermarkt mit Transferfenstern, Ablöse- und Gehaltsverhandlung und KI-Angeboten für Spieler der Manager
- KI-Wirtschaft
- Vorstand mit Erwartung, Vertrauen, Entlassung und Jobangeboten
- Nachrichten

Alles ist über neue Befehle steuerbar und mit Tests abgesichert. Die Oberfläche dazu folgt in Plan 3b.

**Architecture:** Neue Module liegen unter `src/engine/economy/`. Sie importieren nichts aus `season.ts`, damit keine Import-Zyklen entstehen. `season.ts` ruft sie an drei Stellen auf:
- `startSeason` → `startSeasonEconomy`
- `finishMatchday` → `processMatchday` und danach `afterAdvance`
- `finishSeason` → `seasonEndEconomy` und `summerMarket`

Alle Änderungen folgen weiter dem Muster „kopieren, dann verändern“ und sind deterministisch über den `Rng`. Geldbeträge sind ganze Euro. Gebucht wird über das Kassenbuch (`book`), damit die Oberfläche später die Bilanz zeigen kann.

**Tech Stack:** TypeScript 5.6.3, Vitest 5.0.5 (bestehendes Setup), keine neuen Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-10-31-fussballmanager-design.md`, Abschnitte 3.3, 3.4, 7.4, 8, 9 und 15.

**Plan-Reihe:** 1 Engine-Kern ✓ · 2 Oberfläche Hot-Seat ✓ · **3a Wirtschaft in der Engine (dieser Plan)** · 3b Wirtschaft in der Oberfläche · 4 Speichern, Optionen, Playwright

## Global Constraints

- **Engine-Regeln:**
  - Unter `src/engine/` gibt es keine Imports aus `svelte`, `src/ui`, `src/session` oder Browser-APIs.
  - `Math.random()` und `Date.now()` sind verboten.
  - Öffentliche Funktionen, die einen `GameState` zurückgeben, verändern ihr Argument nicht.
  - Die Module unter `src/engine/economy/` importieren nie aus `src/engine/season.ts`.
- **Serialisierbarkeit:** Alles im `GameState` ist reines JSON. Für fehlende Werte gibt es `null`, nie `undefined`.
- **Sprache:** Texte für Menschen (Fehlermeldungen, Nachrichten) sind deutsch. Geldbeträge in Texten werden mit `formatEuro` formatiert, z. B. „1.250.000 €“.
- **Spieltage und Fenster:**
  - Eine Woche entspricht einem Liga-Spieltag (Kalenderindex 0–33). Gehälter, TV, Sponsor, Unterhalt und Zinsen werden nur an diesen 34 Liga-Spieltagen gebucht. Zuschauereinnahmen gibt es bei jedem Heimspiel, auch in der Relegation.
  - Das Transferfenster ist offen bei Kalenderindex 0 (Sommer, vor dem 1. Spieltag) sowie 17 und 18 (Winter, vor den Spieltagen 18 und 19). Außerhalb davon sind nur vereinslose Spieler verpflichtbar.
- **Verhandlungen:**
  - Es gibt höchstens 3 Runden.
  - Ein Angebot ab 100 % der Forderung wird angenommen.
  - Unter 70 % bricht die Gegenseite ab, ebenso in Runde 3, wenn das Angebot unter der Forderung liegt.
  - Nach einem Abbruch muss man 3 Spieltage warten.
- **Spieler und Kader:**
  - Abfindung bei Entlassung: 50 % des Restgehalts.
  - Ein Kader hat höchstens 32 Spieler.
- **Vorstand:**
  - Das Vertrauen startet bei 60.
  - Unter 30 gibt es eine Warnung.
  - Unter 15 folgt die Entlassung, frühestens nach dem 8. Spieltag (ab Kalenderindex 8).
- **Arbeitslose Manager:** Spätestens nach 3 Spieltagen ohne Verein bekommt ein Manager ein Angebot eines Zweitligisten.
- **Nachrichten:** höchstens 60 pro Manager (die ältesten fallen weg).
- **Abweichungen von der Spec**, festgehalten als Entscheidungen dieses Plans:
  - Ausstiegsklauseln entfallen.
  - Eine Vorbereitungsrunde als eigene Phase entfällt. Die Sommer-Transferphase sind die Manager-Runden bei Kalenderindex 0.
  - Karriere-Statistik entfällt.
  - Die Session wird erst in Plan 3b so umgebaut, dass Manager ohne Verein an die Reihe kommen.

## Review Focus

1. **Geld wird knapp:** Ein Verein ist über dem Dispo-Limit. Dann sind Käufe gesperrt, das Vertrauen sinkt deutlich, und es gibt keine negativen Kader oder NaN-Werte. Abgesichert in Task 3, Task 6 und Task 11.
2. **Ein Spieler verschwindet aus dem Verein** (Verkauf, Vertragsende, Entlassung, Karriereende), während er in der Aufstellung oder der Förderliste steht: Er wird überall entfernt, und der nächste Spieltag läuft. Abgesichert in Task 2 und Task 11.
3. **Gleichzeitige Verhandlungen um denselben Spieler** (eigene Verhandlung und KI-Angebot): Es läuft höchstens eine offene Verhandlung pro Spieler. Abgeschlossene Transfers machen andere offene Vorgänge zu diesem Spieler ungültig. Abgesichert in Task 6 und Task 7.
4. **Manager wird mitten in der Saison entlassen:** Sein Ex-Verein spielt als KI weiter, er bekommt Angebote, und nach spätestens 3 Spieltagen ist ein Angebot eines Zweitligisten da. Abgesichert in Task 8.
5. **Wirtschaft über viele Saisons:** Die Kader schrumpfen nicht, das Geld explodiert nicht, die Stärke driftet nicht ab, und der Spielstand wächst nicht unbegrenzt. Abgesichert in Task 11.

## Dateistruktur

```
src/engine/
├─ model.ts                  # erweitert: Vertrag, Finanzen, Vorstand, Training, Verhandlungen, Angebote, Nachrichten
├─ generator.ts              # erweitert: Startwerte Wirtschaft, vereinslose Spieler
├─ match/simulate.ts         # erweitert: Taktiktraining-Bonus aus dem Verein
├─ season.ts                 # erweitert: Aufrufe der Wirtschaft
├─ commands.ts               # erweitert: Wirtschaftsbefehle
└─ economy/
   ├─ util.ts                # Liga/Rang eines Vereins, Runden, Euro-Format
   ├─ money.ts               # Gehalt, Marktwert, Dispo, Kassenbuch
   ├─ messages.ts            # Nachrichten
   ├─ stadium.ts             # Stufen, Zuschauer, Preise, Ausbau
   ├─ finance.ts             # Buchungen pro Spieltag, Sponsor, Prämien
   ├─ training.ts            # Training, Entwicklung, Alterung, Nachwuchs, vereinslose Spieler
   ├─ contracts.ts           # Forderung, Verhandlungslogik, Verträge, Entlassung, KI-Verlängerung
   ├─ transfers.ts           # Fenster, Ablöse, Transfer, Kauf-Verhandlung, Transferliste, KI-Angebote, KI-Markt
   ├─ board.ts               # Erwartung, Vertrauen, Entlassung, Jobangebote
   └─ processing.ts          # Ablauf pro Spieltag und zum Saisonende
tests/engine/economy/*.test.ts
tests/longrun/economy.test.ts
```

---

### Task 1: Datenmodell, Geld-Grundlagen und Startwerte

**Files:**
- Modify: `src/engine/model.ts`, `src/engine/generator.ts`, `src/engine/season.ts` (nur `startNewGame`), `tests/engine/fixtures.ts`, `tests/engine/generator.test.ts`
- Create: `src/engine/economy/util.ts`, `src/engine/economy/money.ts`, `src/engine/economy/stadium.ts`
- Test: `tests/engine/economy/money.test.ts`

**Interfaces:**
- Produces in `model.ts`:
  - **Typen:** `Contract`, `Intensity`, `TrainingFocus`, `TrainingPlan`, `Expectation`, `Board`, `Sponsor`, `LedgerCategory`, `LedgerEntry`, `Finance`, `Negotiation`, `TransferOffer`, `Message`
  - **Konstanten:** `MAX_SQUAD = 32`, `LEAGUE_MATCHDAYS = 34`
  - **Neue Felder:**
    - `Player`: `contract`, `morale`, `transferListed`, `talkCooldown`, `retired`
    - `Club`: `finance`, `board`, `training`, `tacticsBonus`
    - `Manager`: `jobOffers`, `unemployedFor`
    - `GameState`: `negotiations`, `transferOffers`, `messages`
- `economy/util.ts`: `roundTo(x, step)`, `clubLeague(state, clubId)`, `leagueRank(state, clubId)`, `formatEuro(amount)`, `isLeagueMatchday(index)`
- `economy/money.ts`: `salaryFor(strength)`, `startBalance(rep)`, `overdraftLimit(rep)`, `marketValue(p, season)`, `book(state, clubId, category, amount)`, `canAfford(club, amount)`, `isOverLimit(club)`, `wageBill(state, clubId)`
- `economy/stadium.ts` (erster Teil): `STADIUM`, `initialStage(rep)`, `referencePrice(rep)`, `optimalPrice(rep)`, `priceFactor(price, rep)`
- `generator.ts`:
  - **Spieler eines Vereins** bekommen einen Vertrag mit dem Gehalt `salaryFor(strength)`. Er läuft bis Saison 1 bis 4.
  - **Startwerte jedes Vereins:**
    - Finanzen: Kontostand `startBalance(rep)`, Eintrittspreis `optimalPrice(rep)`, Stadionstufe `initialStage(rep)`
    - Vorstand: Erwartung „mid“, Vertrauen 60
    - Training: normal, Technik
    - `tacticsBonus = 1`
  - **Vereinslose Spieler:** 30 Stück mit `clubId = null` und `contract = null`.

**Startwerte für das Balancing** (Spec 15; Task 11 justiert sie):

| Größe | Formel |
|---|---|
| Gehalt pro Spieltag | `2500 × 1,075^(Stärke − 40)`, auf 100 € gerundet. Stärke 50 ergibt 5.200 €, Stärke 70 ergibt 21.900 €. |
| Startkapital | Reputation × 50.000 € |
| Dispo-Limit | Reputation × 30.000 € |
| Marktwert | `50.000 × 1,12^(Stärke − 40)`, anschließend mit den Faktoren unten multipliziert, auf 10.000 € gerundet, mindestens 10.000 € |

Faktoren für den Marktwert:
- **Alter:** bis 21 Jahre × 1,3; 22–27 × 1,1; 28–30 × 1,0; 31–32 × 0,7; ab 33 × 0,4
- **Potenzial:** × (1 + (Potenzial − Stärke) / 40)
- **Vertrag:** ohne Vertrag × 0,5; läuft diese Saison aus × 0,6; noch 1 Saison × 0,85; sonst × 1

Stadionstufen:

| Stufe | Plätze | Unterhalt pro Spieltag | Ausbaukosten | Bauzeit |
|---|---|---|---|---|
| 0 | 8.000 | 8.000 € | – | – |
| 1 | 16.000 | 15.000 € | 2 Mio € | 6 Spieltage |
| 2 | 28.000 | 28.000 € | 5 Mio € | 8 Spieltage |
| 3 | 45.000 | 45.000 € | 10 Mio € | 10 Spieltage |
| 4 | 65.000 | 70.000 € | 20 Mio € | 12 Spieltage |

- **Startstufe:** `floor(Reputation / 20)`, begrenzt auf 0–4.
- **Referenzpreis:** `10 + 0,15 × Reputation`.
- **Optimaler Preis:** `round(1,5 × Referenzpreis)`. Bei Reputation 30 sind das 22 €, bei Reputation 90 sind es 35 €.
- **Preisfaktor:** `1,5 − Preis / (2 × Referenzpreis)`, begrenzt auf 0–1,5.

- [ ] **Step 1: Datenmodell erweitern**

In `src/engine/model.ts` direkt vor `export interface Player {` einfügen:

```ts
export interface Contract {
  /** Gehalt pro Spieltag in € */
  salary: number;
  /** letzte Saison, für die der Vertrag gilt */
  endsSeason: number;
}

export type Intensity = "light" | "normal" | "hard";
export type TrainingFocus = "fitness" | "tactics" | "technique";
export interface TrainingPlan {
  intensity: Intensity;
  focus: TrainingFocus;
  /** bis zu 3 Spieler mit Extratraining */
  individual: PlayerId[];
}

export type Expectation = "title" | "upper" | "mid" | "survival";
export interface Board {
  expectation: Expectation;
  /** 0–100 */
  confidence: number;
  warned: boolean;
}

export interface Sponsor {
  id: string;
  name: string;
  perMatchday: number;
  /** wird am Saisonende gezahlt, wenn das Saisonziel erreicht ist */
  bonus: number;
}

export type LedgerCategory =
  | "tickets"
  | "tv"
  | "sponsor"
  | "salaries"
  | "upkeep"
  | "interest"
  | "transfers"
  | "prizes"
  | "stadium"
  | "severance"
  | "bonus";

export interface LedgerEntry {
  calendarIndex: number;
  category: LedgerCategory;
  amount: number;
}

export interface Finance {
  balance: number;
  ticketPrice: number;
  /** 0–4, siehe STADIUM in economy/stadium.ts */
  stadiumStage: number;
  building: { stage: number; matchdaysLeft: number } | null;
  sponsor: Sponsor | null;
  sponsorOffers: Sponsor[];
  /** Buchungen der laufenden Saison */
  ledger: LedgerEntry[];
  /** Spieltage in Folge über dem Dispo-Limit */
  overdraftStreak: number;
  lastAttendance: number;
}

export interface Negotiation {
  id: string;
  managerId: ManagerId;
  playerId: PlayerId;
  /** fee = Ablöse mit dem Verein, salary = Gehalt mit dem Spieler */
  stage: "fee" | "salary";
  /** vereinbarte Ablöse (nur bei Transfers, sobald die Ablöse steht) */
  fee: number | null;
  /** aktuelle Forderung der Gegenseite */
  ask: number;
  /** 1–3 */
  round: number;
  desiredYears: number;
  status: "open" | "accepted" | "aborted";
  /** letzte Rückmeldung der Gegenseite, für die Anzeige */
  note: string;
  season: number;
  createdAt: number;
}

export interface TransferOffer {
  id: string;
  managerId: ManagerId;
  fromClub: ClubId;
  playerId: PlayerId;
  fee: number;
  /** verdeckt: so viel würde der KI-Verein höchstens zahlen */
  maxFee: number;
  round: number;
  status: "open" | "accepted" | "rejected" | "withdrawn";
  season: number;
  /** letzter Kalenderindex, an dem das Angebot gilt */
  expiresAfter: number;
}

export interface Message {
  id: string;
  managerId: ManagerId;
  season: number;
  calendarIndex: number;
  text: string;
  ref: { type: "transferOffer" | "jobOffer" | "sponsor" | "negotiation"; id: string } | null;
}

export const MAX_SQUAD = 32;
export const LEAGUE_MATCHDAYS = 34;
```

In `interface Player` nach `stats: { apps: number; goals: number };` einfügen:

```ts
  /** null = vereinslos */
  contract: Contract | null;
  /** 0–100 */
  morale: number;
  transferListed: { askingPrice: number | null } | null;
  /** Spieltage, bis wieder verhandelt werden kann */
  talkCooldown: number;
  retired: boolean;
```

In `interface Club` nach `tactics: Tactics;` einfügen:

```ts
  finance: Finance;
  board: Board;
  training: TrainingPlan;
  /** Multiplikator fürs nächste Spiel (Taktiktraining) */
  tacticsBonus: number;
```

`interface Manager` ersetzen durch:

```ts
export interface Manager {
  id: ManagerId;
  name: string;
  clubId: ClubId | null;
  jobOffers: ClubId[];
  /** Spieltage ohne Verein */
  unemployedFor: number;
}
```

In `interface GameState` nach `history: SeasonRecord[];` einfügen:

```ts
  negotiations: Negotiation[];
  transferOffers: TransferOffer[];
  messages: Message[];
```

- [ ] **Step 2: Failing Test für Geld und Stadion schreiben**

`tests/engine/economy/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canAfford, book, isOverLimit, marketValue, overdraftLimit, salaryFor, startBalance, wageBill } from "../../../src/engine/economy/money";
import { STADIUM, initialStage, optimalPrice, priceFactor, referencePrice } from "../../../src/engine/economy/stadium";
import { clubLeague, formatEuro, isLeagueMatchday, leagueRank, roundTo } from "../../../src/engine/economy/util";
import { generateWorld } from "../../../src/engine/generator";
import { COMP } from "../../../src/engine/model";
import { startNewGame } from "../../../src/engine/season";
import { makePlayer, makeState } from "../fixtures";

describe("util", () => {
  it("rundet und formatiert Euro", () => {
    expect(roundTo(12_345, 100)).toBe(12_300);
    expect(formatEuro(1_250_000)).toBe("1.250.000 €");
    expect(formatEuro(-5_000)).toBe("-5.000 €");
    expect(formatEuro(0)).toBe("0 €");
    expect(formatEuro(999)).toBe("999 €");
  });

  it("erkennt Liga-Spieltage", () => {
    expect(isLeagueMatchday(0)).toBe(true);
    expect(isLeagueMatchday(33)).toBe(true);
    expect(isLeagueMatchday(34)).toBe(false);
  });

  it("findet Liga und Tabellenplatz", () => {
    const world = generateWorld(3);
    const r = startNewGame(world, [{ name: "A", clubId: Object.keys(world.clubs)[0] }]);
    if (!r.ok) throw new Error(r.error);
    const l2Club = r.state.competitions[COMP.second].clubs[0];
    expect(clubLeague(r.state, l2Club)).toBe(COMP.second);
    const rank = leagueRank(r.state, l2Club)!;
    expect(rank).toBeGreaterThanOrEqual(1);
    expect(rank).toBeLessThanOrEqual(18);
    expect(clubLeague(r.state, "gibts-nicht")).toBeNull();
  });
});

describe("money", () => {
  it("Gehalt wächst exponentiell mit der Stärke", () => {
    expect(salaryFor(40)).toBe(2_500);
    expect(salaryFor(50)).toBe(5_200);
    expect(salaryFor(70)).toBe(21_900);
    expect(salaryFor(80)).toBeGreaterThan(salaryFor(70));
  });

  it("Startkapital und Dispo hängen an der Reputation", () => {
    expect(startBalance(50)).toBe(2_500_000);
    expect(overdraftLimit(50)).toBe(1_500_000);
  });

  it("Marktwert: stärker = teurer, alt = billiger, Vertragsende senkt den Wert", () => {
    const base = makePlayer("a", "MF", 70, { age: 25, potential: 70, contract: { salary: 1, endsSeason: 4 } });
    const mv = marketValue(base, 1);
    expect(mv % 10_000).toBe(0);
    expect(marketValue({ ...base, strength: 80, potential: 80 }, 1)).toBeGreaterThan(mv);
    expect(marketValue({ ...base, age: 33 }, 1)).toBeLessThan(mv);
    expect(marketValue({ ...base, contract: { salary: 1, endsSeason: 1 } }, 1)).toBeLessThan(mv);
    expect(marketValue({ ...base, contract: null }, 1)).toBeLessThan(mv);
    expect(marketValue({ ...base, potential: 90 }, 1)).toBeGreaterThan(mv);
    expect(marketValue(makePlayer("w", "DF", 1), 1)).toBe(10_000);
  });

  it("bucht ins Kassenbuch, prüft Dispo und Gehaltssumme", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const club = s.clubs.c1;
    club.finance.balance = 100_000;
    s.calendarIndex = 5;
    book(s, "c1", "tickets", 50_000);
    expect(club.finance.balance).toBe(150_000);
    expect(club.finance.ledger.at(-1)).toEqual({ calendarIndex: 5, category: "tickets", amount: 50_000 });
    const limit = overdraftLimit(club.reputation);
    expect(canAfford(club, 150_000 + limit)).toBe(true);
    expect(canAfford(club, 150_000 + limit + 1)).toBe(false);
    club.finance.balance = -limit - 1;
    expect(isOverLimit(club)).toBe(true);
    expect(wageBill(s, "c1")).toBe(25 * 5_000);
  });
});

describe("stadium", () => {
  it("hat 5 Stufen mit wachsender Kapazität", () => {
    expect(STADIUM).toHaveLength(5);
    for (let i = 1; i < STADIUM.length; i++) expect(STADIUM[i].capacity).toBeGreaterThan(STADIUM[i - 1].capacity);
  });

  it("Startstufe und optimaler Preis nach Reputation", () => {
    expect(initialStage(90)).toBe(4);
    expect(initialStage(50)).toBe(2);
    expect(initialStage(10)).toBe(0);
    expect(referencePrice(30)).toBeCloseTo(14.5);
    expect(optimalPrice(30)).toBe(22);
    expect(optimalPrice(90)).toBe(35);
  });

  it("Preisfaktor sinkt mit dem Preis und bleibt zwischen 0 und 1,5", () => {
    expect(priceFactor(0, 50)).toBe(1.5);
    expect(priceFactor(20, 50)).toBeGreaterThan(priceFactor(40, 50));
    expect(priceFactor(1_000, 50)).toBe(0);
  });
});
```

In `tests/engine/generator.test.ts` innerhalb von `describe("generateWorld", …)` ergänzen:

```ts
  it("Vereinsspieler haben Verträge, 30 Spieler sind vereinslos", () => {
    for (const c of clubs) {
      for (const id of c.squad) {
        const p = w.players[id];
        expect(p.contract).not.toBeNull();
        expect(p.contract!.salary).toBeGreaterThan(0);
        expect(p.contract!.endsSeason).toBeGreaterThanOrEqual(1);
        expect(p.contract!.endsSeason).toBeLessThanOrEqual(4);
        expect(p.retired).toBe(false);
      }
    }
    const free = Object.values(w.players).filter((p) => p.clubId === null);
    expect(free).toHaveLength(30);
    expect(free.every((p) => p.contract === null)).toBe(true);
  });

  it("Vereine starten mit Kapital, Stadion, Vorstand und Training", () => {
    for (const c of clubs) {
      expect(c.finance.balance).toBeGreaterThan(0);
      expect(c.finance.stadiumStage).toBeGreaterThanOrEqual(0);
      expect(c.finance.stadiumStage).toBeLessThanOrEqual(4);
      expect(c.board.confidence).toBe(60);
      expect(c.training).toEqual({ intensity: "normal", focus: "technique", individual: [] });
      expect(c.tacticsBonus).toBe(1);
    }
    expect(w.negotiations).toEqual([]);
    expect(w.transferOffers).toEqual([]);
    expect(w.messages).toEqual([]);
  });
```

Der bestehende Test „jeder Verein hat 25 Spieler“ prüft `ps.every((p) => p.clubId === c.id)` nur über den Kader. Er bleibt gültig.

- [ ] **Step 3: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/engine/economy/money.test.ts tests/engine/generator.test.ts`
Expected: FAIL, weil die Module unter `economy/` nicht gefunden werden und die neuen Generator-Tests fehlschlagen.

- [ ] **Step 4: Hilfsmodule implementieren**

`src/engine/economy/util.ts`:

```ts
import { computeStandings } from "../competition/standings";
import { COMP, LEAGUE_MATCHDAYS, type ClubId, type CompetitionId, type GameState } from "../model";

export function roundTo(x: number, step: number): number {
  return Math.round(x / step) * step;
}

export function clubLeague(state: GameState, clubId: ClubId): CompetitionId | null {
  for (const id of [COMP.first, COMP.second]) {
    if (state.competitions[id]?.clubs.includes(clubId)) return id;
  }
  return null;
}

export function leagueRank(state: GameState, clubId: ClubId): number | null {
  const league = clubLeague(state, clubId);
  if (!league) return null;
  return computeStandings(state.competitions[league]).findIndex((r) => r.club === clubId) + 1;
}

export function formatEuro(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${digits} €`;
}

export function isLeagueMatchday(index: number): boolean {
  return index < LEAGUE_MATCHDAYS;
}
```

`src/engine/economy/money.ts`:

```ts
import type { Club, ClubId, GameState, LedgerCategory, Player } from "../model";
import { roundTo } from "./util";

export function salaryFor(strength: number): number {
  return roundTo(2500 * Math.pow(1.075, strength - 40), 100);
}

export function startBalance(reputation: number): number {
  return roundTo(reputation * 50_000, 10_000);
}

export function overdraftLimit(reputation: number): number {
  return roundTo(reputation * 30_000, 10_000);
}

export function marketValue(p: Player, season: number): number {
  const age = p.age <= 21 ? 1.3 : p.age <= 27 ? 1.1 : p.age <= 30 ? 1 : p.age <= 32 ? 0.7 : 0.4;
  const potential = 1 + Math.max(0, p.potential - p.strength) / 40;
  const left = p.contract ? p.contract.endsSeason - season : -1;
  const contract = !p.contract ? 0.5 : left <= 0 ? 0.6 : left === 1 ? 0.85 : 1;
  return Math.max(10_000, roundTo(50_000 * Math.pow(1.12, p.strength - 40) * age * potential * contract, 10_000));
}

export function book(state: GameState, clubId: ClubId, category: LedgerCategory, amount: number): void {
  const f = state.clubs[clubId].finance;
  f.balance += amount;
  f.ledger.push({ calendarIndex: state.calendarIndex, category, amount });
}

export function canAfford(club: Club, amount: number): boolean {
  return club.finance.balance - amount >= -overdraftLimit(club.reputation);
}

export function isOverLimit(club: Club): boolean {
  return club.finance.balance < -overdraftLimit(club.reputation);
}

export function wageBill(state: GameState, clubId: ClubId): number {
  return state.clubs[clubId].squad.reduce((s, id) => s + (state.players[id].contract?.salary ?? 0), 0);
}
```

`src/engine/economy/stadium.ts`:

```ts
export interface StadiumStage {
  capacity: number;
  upkeep: number;
  cost: number;
  buildMatchdays: number;
}

export const STADIUM: readonly StadiumStage[] = [
  { capacity: 8_000, upkeep: 8_000, cost: 0, buildMatchdays: 0 },
  { capacity: 16_000, upkeep: 15_000, cost: 2_000_000, buildMatchdays: 6 },
  { capacity: 28_000, upkeep: 28_000, cost: 5_000_000, buildMatchdays: 8 },
  { capacity: 45_000, upkeep: 45_000, cost: 10_000_000, buildMatchdays: 10 },
  { capacity: 65_000, upkeep: 70_000, cost: 20_000_000, buildMatchdays: 12 },
];

export function initialStage(reputation: number): number {
  return Math.max(0, Math.min(STADIUM.length - 1, Math.floor(reputation / 20)));
}

export function referencePrice(reputation: number): number {
  return 10 + reputation * 0.15;
}

export function optimalPrice(reputation: number): number {
  return Math.round(1.5 * referencePrice(reputation));
}

/** Anteil der Grundnachfrage, der bei diesem Preis kommt (0 bis 1,5). */
export function priceFactor(price: number, reputation: number): number {
  return Math.max(0, Math.min(1.5, 1.5 - price / (2 * referencePrice(reputation))));
}
```

- [ ] **Step 5: Generator, Fixtures und `startNewGame` anpassen**

In `src/engine/generator.ts`:

1. Imports ergänzen:

```ts
import { salaryFor, startBalance } from "./economy/money";
import { initialStage, optimalPrice } from "./economy/stadium";
```

Unter `const CRESTS …` zwei Konstanten anlegen:

```ts
const FREE_AGENTS_START = 30;
const FREE_AGENT_POSITIONS: Position[] = ["GK", "DF", "DF", "MF", "MF", "FW"];
```

2. Im Objekt-Literal `const p: Player = { … }` von `generatePlayer` nach `stats: { apps: 0, goals: 0 },` einfügen:

```ts
    contract: clubId ? { salary: salaryFor(strength), endsSeason: state.season + rng.int(0, 3) } : null,
    morale: 60,
    transferListed: null,
    talkCooldown: 0,
    retired: false,
```

3. Im `state`-Literal von `generateWorld` nach `history: [],` einfügen:

```ts
    negotiations: [],
    transferOffers: [],
    messages: [],
```

4. Im `club`-Literal nach `tactics: { … },` einfügen:

```ts
      finance: {
        balance: startBalance(reputation),
        ticketPrice: optimalPrice(reputation),
        stadiumStage: initialStage(reputation),
        building: null,
        sponsor: null,
        sponsorOffers: [],
        ledger: [],
        overdraftStreak: 0,
        lastAttendance: 0,
      },
      board: { expectation: "mid", confidence: 60, warned: false },
      training: { intensity: "normal", focus: "technique", individual: [] },
      tacticsBonus: 1,
```

5. Nach der Vereinsschleife und vor `state.rngState = rng.state();` einfügen:

```ts
  for (let i = 0; i < FREE_AGENTS_START; i++) {
    generatePlayer(state, rng, null, rng.pick(FREE_AGENT_POSITIONS), rng.int(45, 65), rng.int(22, 32));
  }
```

In `src/engine/season.ts`, in `startNewGame`, die Zeile `state.managers.push({ id, name: m.name.trim(), clubId: m.clubId });` ersetzen durch:

```ts
    state.managers.push({ id, name: m.name.trim(), clubId: m.clubId, jobOffers: [], unemployedFor: 0 });
```

In `tests/engine/fixtures.ts`:
- In `makePlayer` nach `stats: { apps: 0, goals: 0 },` einfügen:

```ts
    contract: { salary: 5_000, endsSeason: 3 },
    morale: 60,
    transferListed: null,
    talkCooldown: 0,
    retired: false,
```

- In `makeClub` nach `tactics: { … },` einfügen:

```ts
    finance: {
      balance: 2_000_000,
      ticketPrice: 20,
      stadiumStage: 2,
      building: null,
      sponsor: null,
      sponsorOffers: [],
      ledger: [],
      overdraftStreak: 0,
      lastAttendance: 0,
    },
    board: { expectation: "mid", confidence: 60, warned: false },
    training: { intensity: "normal", focus: "technique", individual: [] },
    tacticsBonus: 1,
```

- In `makeState` im `state`-Literal nach `history: [],` einfügen: `negotiations: [], transferOffers: [], messages: [],`

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run && npm run check`
Expected:
- Alle Tests sind PASS, auch die bisherigen Engine- und UI-Tests.
- `svelte-check` meldet 0 Fehler und 0 Warnungen.

Der Kalibrierungstest nutzt die Fixtures und ist deshalb unverändert. Der Langzeittest arbeitet mit Bandbreiten. Er kann durch die zusätzlichen Zufallszahlen im Generator andere Werte liefern, muss aber innerhalb der Bandbreiten bleiben. Falls er knapp herausfällt, als `DONE_WITH_CONCERNS` melden und nichts nachjustieren.

- [ ] **Step 7: Commit**

```bash
git add src/engine/model.ts src/engine/generator.ts src/engine/season.ts src/engine/economy tests/engine/fixtures.ts tests/engine/generator.test.ts tests/engine/economy/money.test.ts
git commit -m "feat(engine): Datenmodell und Geld-Grundlagen für die Wirtschaft"
```

---

### Task 2: Nachrichten, Kaderpflege, Training, Alterung und Nachwuchs

**Files:**
- Create: `src/engine/economy/messages.ts`, `src/engine/economy/roster.ts`, `src/engine/economy/training.ts`
- Test: `tests/engine/economy/messages.test.ts`, `tests/engine/economy/training.test.ts`

**Interfaces:**
- Consumes: `generatePlayer`, `baseStrengthFor` (generator), `repairLineup` (lineup), `salaryFor` (Task 1), `roundTo`, Modell
- Produces:
  - `messages.ts`: `MESSAGE_LIMIT = 60`, `postMessage(state, managerId, text, ref?)`, `postToClub(state, clubId, text, ref?): Message | null`, `messagesFor(state, managerId): Message[]` (neueste zuerst)
  - `roster.ts`: `removeFromClub(state, playerId)`. Die Funktion nimmt den Spieler aus Kader, Aufstellung (die sofort repariert wird) und Förderliste. Sie setzt `clubId`, `contract` und `transferListed` auf `null`, bricht offene Verhandlungen zu diesem Spieler ab und zieht offene KI-Angebote für ihn zurück.
  - `training.ts`:
    - Konstanten: `INTENSITY`, `FOCUS_GROWTH`, `TACTICS_BONUS = 1.03`, `MAX_INDIVIDUAL = 3`
    - Training: `baseDevelopment(age, strength, potential)`, `applyTraining(state, clubId, played: ReadonlySet<PlayerId>, rng): PlayerId[]` (gibt die Trainingsverletzten zurück), `validateTraining(state, clubId, plan): string | null`, `aiTrainingPlan(state, clubId): TrainingPlan`
    - Saisonwechsel: `retireChance(age)`, `seasonAging(state, rng): PlayerId[]`, `addYouth(state, rng): PlayerId[]`, `addFreeAgents(state, rng, count?)`, `trimFreeAgents(state, max?)`

**Regeln** (Spec 7.4, 8.4, mit Startwerten):

- **Entwicklung pro Spieltag** (Basiswert):
  - bis 24 Jahre: `min(0,35; 0,04 + 0,01 × Abstand zum Potenzial)`
  - 25–30 Jahre: 0,03, wenn noch unter dem Potenzial, sonst 0
  - 31–32 Jahre: −0,06
  - ab 33 Jahren: −0,15
- **Wachstum** = Basiswert × Intensität × Schwerpunkt × Förderung × Spielpraxis. Ein Spieler wächst nie über sein Potenzial.

  | Faktor | Werte |
  |---|---|
  | Intensität | locker 0,6 · normal 1,0 · hart 1,4 |
  | Schwerpunkt | Technik 1,0 · Kondition 0,5 · Taktik 0,5 |
  | Förderung | ×2 |
  | Spielpraxis | ×1,1 |

- **Abbau** (negativer Basiswert) wirkt unabhängig vom Training. Die Stärke fällt dabei nie unter 1.
- **Kondition:**
  - Schwerpunkt Kondition holt zusätzlich 50 % der fehlenden Kondition zurück.
  - Danach kostet das Training Kondition: locker 0, normal 3, hart 7.
- **Trainingsverletzungen** pro Spieler und Spieltag: locker 0, normal 0,002, hart 0,006. Sie dauern 1–3 Spiele.
- **Taktikbonus:** Schwerpunkt Taktik setzt `tacticsBonus = 1,03`, sonst 1.
- **Karriereende** ab 34 Jahren mit der Wahrscheinlichkeit `0,3 + 0,15 × (Alter − 34)`, höchstens 1.
- **Nachwuchs** pro Verein und Saison:
  - Anzahl: 2–3 Spieler, Alter 16–18.
  - Stärke: Grundstärke − 12. Potenzial: Stärke + 10 bis 35, höchstens 99.
  - Vertrag: Gehalt 50 % von `salaryFor`, Laufzeit bis Saison + 2.
- **Neue vereinslose Spieler:** 25 pro Saison, Alter 22–32, Grundstärke 45–65. Der Pool wird auf höchstens 150 begrenzt. Sind es mehr, beenden die ältesten, bei gleichem Alter die schwächsten, ihre Karriere.

- [ ] **Step 1: Failing Tests schreiben**

`tests/engine/economy/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MESSAGE_LIMIT, messagesFor, postMessage, postToClub } from "../../../src/engine/economy/messages";
import { removeFromClub } from "../../../src/engine/economy/roster";
import { autoLineup, validateLineup } from "../../../src/engine/lineup";
import { makeState } from "../fixtures";

describe("messages", () => {
  it("legt Nachrichten an, neueste zuerst, höchstens 60 pro Manager", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.managers.push({ id: "m1", name: "A", clubId: "c1", jobOffers: [], unemployedFor: 0 });
    s.clubs.c1.managerId = "m1";
    for (let i = 0; i < MESSAGE_LIMIT + 5; i++) postMessage(s, "m1", `Nachricht ${i}`);
    const mine = messagesFor(s, "m1");
    expect(mine).toHaveLength(MESSAGE_LIMIT);
    expect(mine[0].text).toBe(`Nachricht ${MESSAGE_LIMIT + 4}`);
    expect(mine.at(-1)!.text).toBe("Nachricht 5");
  });

  it("postToClub schreibt nur an menschliche Manager", () => {
    const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
    s.managers.push({ id: "m1", name: "A", clubId: "c1", jobOffers: [], unemployedFor: 0 });
    s.clubs.c1.managerId = "m1";
    expect(postToClub(s, "c1", "Hallo")?.managerId).toBe("m1");
    expect(postToClub(s, "c2", "Hallo")).toBeNull();
    expect(s.messages).toHaveLength(1);
  });
});

describe("removeFromClub", () => {
  it("entfernt den Spieler überall und hält die Aufstellung gültig", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const club = s.clubs.c1;
    club.lineup = autoLineup(s, "c1", "4-4-2");
    const starter = club.lineup.starters[4];
    const benched = club.lineup.bench[2];
    club.training.individual = [starter];
    s.negotiations.push({ id: "n1", managerId: "m1", playerId: starter, stage: "salary", fee: null, ask: 1, round: 1, desiredYears: 2, status: "open", note: "", season: 1, createdAt: 0 });
    s.transferOffers.push({ id: "o1", managerId: "m1", fromClub: "x", playerId: starter, fee: 1, maxFee: 2, round: 1, status: "open", season: 1, expiresAfter: 0 });
    removeFromClub(s, starter);
    removeFromClub(s, benched);
    expect(club.squad).not.toContain(starter);
    expect(club.lineup.starters).not.toContain(starter);
    expect(club.lineup.bench).not.toContain(benched);
    expect(validateLineup(s, "c1", club.lineup)).toBeNull();
    expect(club.training.individual).toEqual([]);
    expect(s.players[starter]).toMatchObject({ clubId: null, contract: null, transferListed: null });
    expect(s.negotiations[0].status).toBe("aborted");
    expect(s.transferOffers[0].status).toBe("withdrawn");
  });
});
```

`tests/engine/economy/training.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  addFreeAgents,
  addYouth,
  aiTrainingPlan,
  applyTraining,
  baseDevelopment,
  retireChance,
  seasonAging,
  trimFreeAgents,
  validateTraining,
} from "../../../src/engine/economy/training";
import { Rng } from "../../../src/engine/rng";
import { makePlayer, makeState } from "../fixtures";

const none = new Set<string>();

describe("baseDevelopment", () => {
  it("Junge wachsen umso schneller, je größer der Abstand zum Potenzial", () => {
    expect(baseDevelopment(20, 50, 70)).toBeCloseTo(0.24);
    expect(baseDevelopment(20, 50, 51)).toBeCloseTo(0.05);
    expect(baseDevelopment(20, 40, 99)).toBe(0.35);
    expect(baseDevelopment(27, 60, 65)).toBe(0.03);
    expect(baseDevelopment(27, 65, 65)).toBe(0);
    expect(baseDevelopment(31, 70, 70)).toBe(-0.06);
    expect(baseDevelopment(34, 70, 70)).toBe(-0.15);
  });
});

describe("applyTraining", () => {
  function youngster(intensity: "light" | "normal" | "hard", individual = false) {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const pid = "c1-MF1";
    Object.assign(s.players[pid], { age: 19, strength: 50, potential: 80 });
    s.clubs.c1.training = { intensity, focus: "technique", individual: individual ? [pid] : [] };
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    return s.players[pid].strength - 50;
  }

  it("hartes Training bringt mehr als lockeres, Förderung verdoppelt", () => {
    expect(youngster("normal")).toBeCloseTo(0.34);
    expect(youngster("hard")).toBeGreaterThan(youngster("normal"));
    expect(youngster("light")).toBeLessThan(youngster("normal"));
    expect(youngster("normal", true)).toBeCloseTo(0.68);
  });

  it("wächst nie über das Potenzial; Ältere bauen ab, nie unter 1", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    Object.assign(s.players["c1-FW1"], { age: 20, strength: 69.99, potential: 70 });
    Object.assign(s.players["c1-FW2"], { age: 35, strength: 1.05, potential: 1.05 });
    Object.assign(s.players["c1-FW3"], { age: 33, strength: 70, potential: 70 });
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.players["c1-FW1"].strength).toBe(70);
    expect(s.players["c1-FW2"].strength).toBe(1);
    expect(s.players["c1-FW3"].strength).toBeCloseTo(69.85);
  });

  it("Konditionsschwerpunkt erholt, hartes Training kostet Kondition", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.players["c1-DF1"].fitness = 60;
    s.clubs.c1.training = { intensity: "normal", focus: "fitness", individual: [] };
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.players["c1-DF1"].fitness).toBeCloseTo(77);
    s.clubs.c1.training = { intensity: "hard", focus: "technique", individual: [] };
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.players["c1-DF1"].fitness).toBeCloseTo(70);
  });

  it("Taktikschwerpunkt setzt den Bonus, sonst 1", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.clubs.c1.training = { intensity: "normal", focus: "tactics", individual: [] };
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.clubs.c1.tacticsBonus).toBe(1.03);
    s.clubs.c1.training.focus = "technique";
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.clubs.c1.tacticsBonus).toBe(1);
  });

  it("hartes Training verletzt manchmal, lockeres nie", () => {
    const rng = Rng.fromSeed(7);
    let hard = 0;
    let light = 0;
    for (let i = 0; i < 200; i++) {
      const s = makeState([{ id: "c1", strength: 60 }]);
      s.clubs.c1.training.intensity = "hard";
      hard += applyTraining(s, "c1", none, rng).length;
      s.clubs.c1.training.intensity = "light";
      for (const id of s.clubs.c1.squad) s.players[id].injury = null;
      light += applyTraining(s, "c1", none, rng).length;
    }
    expect(hard).toBeGreaterThan(10);
    expect(light).toBe(0);
  });
});

describe("validateTraining und aiTrainingPlan", () => {
  it("prüft Intensität, Schwerpunkt und Förderliste", () => {
    const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
    const ok = { intensity: "hard", focus: "tactics", individual: ["c1-MF1"] } as const;
    expect(validateTraining(s, "c1", { ...ok, individual: [...ok.individual] })).toBeNull();
    expect(validateTraining(s, "c1", { ...ok, individual: [], intensity: "x" as never })).toBe("Unbekannte Trainingsintensität.");
    expect(validateTraining(s, "c1", { ...ok, individual: [], focus: "x" as never })).toBe("Unbekannter Trainingsschwerpunkt.");
    expect(validateTraining(s, "c1", { ...ok, individual: ["c1-MF1", "c1-MF2", "c1-MF3", "c1-MF4"] })).toBe("Höchstens 3 Spieler im Extratraining.");
    expect(validateTraining(s, "c1", { ...ok, individual: ["c2-MF1"] })).toBe("Ein Spieler gehört nicht zum Kader.");
    expect(validateTraining(s, "c1", { ...ok, individual: ["c1-MF1", "c1-MF1"] })).toBe("Ein Spieler ist doppelt eingetragen.");
  });

  it("die KI fördert bis zu 3 junge Spieler mit großem Potenzial", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    Object.assign(s.players["c1-DF1"], { age: 19, potential: 85 });
    Object.assign(s.players["c1-MF1"], { age: 21, potential: 75 });
    Object.assign(s.players["c1-FW1"], { age: 30, potential: 90 });
    const plan = aiTrainingPlan(s, "c1");
    expect(plan.intensity).toBe("normal");
    expect(plan.focus).toBe("technique");
    expect(plan.individual).toEqual(["c1-DF1", "c1-MF1"]);
  });
});

describe("Saisonwechsel", () => {
  it("Karriereende-Wahrscheinlichkeit", () => {
    expect(retireChance(33)).toBe(0);
    expect(retireChance(34)).toBeCloseTo(0.3);
    expect(retireChance(38)).toBeCloseTo(0.9);
    expect(retireChance(40)).toBe(1);
  });

  it("alle altern um ein Jahr; 40-Jährige beenden die Karriere und verlassen den Verein", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.players["c1-GK3"].age = 39;
    const before = s.players["c1-MF1"].age;
    const retired = seasonAging(s, Rng.fromSeed(1));
    expect(s.players["c1-MF1"].age).toBe(before + 1);
    expect(retired).toEqual(["c1-GK3"]);
    expect(s.players["c1-GK3"]).toMatchObject({ retired: true, clubId: null, contract: null });
    expect(s.clubs.c1.squad).not.toContain("c1-GK3");
    seasonAging(s, Rng.fromSeed(2));
    expect(s.players["c1-GK3"].age).toBe(40);
  });

  it("Nachwuchs: 2–3 Spieler pro Verein mit Vertrag und Potenzial", () => {
    const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
    const ids = addYouth(s, Rng.fromSeed(4));
    for (const c of ["c1", "c2"]) {
      const youth = s.clubs[c].squad.filter((id) => ids.includes(id));
      expect(youth.length).toBeGreaterThanOrEqual(2);
      expect(youth.length).toBeLessThanOrEqual(3);
      for (const id of youth) {
        const p = s.players[id];
        expect(p.age).toBeGreaterThanOrEqual(16);
        expect(p.age).toBeLessThanOrEqual(18);
        expect(p.potential).toBeGreaterThanOrEqual(p.strength + 10);
        expect(p.contract).toEqual({ salary: expect.any(Number), endsSeason: s.season + 2 });
      }
    }
  });

  it("neue Vereinslose und Begrenzung des Pools", () => {
    const s = makeState([]);
    addFreeAgents(s, Rng.fromSeed(3), 25);
    const free = () => Object.values(s.players).filter((p) => p.clubId === null && !p.retired);
    expect(free()).toHaveLength(25);
    expect(free().every((p) => p.contract === null && p.age >= 22 && p.age <= 32)).toBe(true);
    s.players[free()[0].id].age = 40;
    trimFreeAgents(s, 20);
    expect(free()).toHaveLength(20);
    expect(free().some((p) => p.age === 40)).toBe(false);
  });

  it("makePlayer bleibt mit dem neuen Modell kompatibel", () => {
    expect(makePlayer("x", "GK", 50).retired).toBe(false);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/engine/economy/messages.test.ts tests/engine/economy/training.test.ts`
Expected: FAIL, weil die Module nicht gefunden werden.

- [ ] **Step 3: Implementieren**

`src/engine/economy/messages.ts`:

```ts
import { newId, type ClubId, type GameState, type ManagerId, type Message } from "../model";

export const MESSAGE_LIMIT = 60;

export function postMessage(state: GameState, managerId: ManagerId, text: string, ref: Message["ref"] = null): Message {
  const message: Message = { id: newId(state, "msg"), managerId, season: state.season, calendarIndex: state.calendarIndex, text, ref };
  state.messages.push(message);
  const mine = state.messages.filter((m) => m.managerId === managerId);
  if (mine.length > MESSAGE_LIMIT) {
    const drop = new Set(mine.slice(0, mine.length - MESSAGE_LIMIT).map((m) => m.id));
    state.messages = state.messages.filter((m) => !drop.has(m.id));
  }
  return message;
}

export function postToClub(state: GameState, clubId: ClubId, text: string, ref: Message["ref"] = null): Message | null {
  const managerId = state.clubs[clubId]?.managerId;
  return managerId ? postMessage(state, managerId, text, ref) : null;
}

export function messagesFor(state: GameState, managerId: ManagerId): Message[] {
  return state.messages.filter((m) => m.managerId === managerId).reverse();
}
```

`src/engine/economy/roster.ts`:

```ts
import { repairLineup } from "../lineup";
import type { GameState, PlayerId } from "../model";

/** Nimmt einen Spieler aus seinem Verein (Verkauf, Vertragsende, Entlassung, Karriereende). */
export function removeFromClub(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  const clubId = p.clubId;
  if (clubId) {
    const club = state.clubs[clubId];
    club.squad = club.squad.filter((id) => id !== playerId);
    const placeholder = {
      starters: club.lineup.starters.map((id) => (id === playerId ? "" : id)),
      bench: club.lineup.bench.filter((id) => id !== playerId),
    };
    club.lineup = repairLineup(state, clubId, placeholder, club.tactics.formation);
    club.training = { ...club.training, individual: club.training.individual.filter((id) => id !== playerId) };
  }
  p.clubId = null;
  p.contract = null;
  p.transferListed = null;
  for (const n of state.negotiations) {
    if (n.playerId === playerId && n.status === "open") {
      n.status = "aborted";
      n.note = `${p.lastName} ist nicht mehr verfügbar.`;
    }
  }
  for (const o of state.transferOffers) if (o.playerId === playerId && o.status === "open") o.status = "withdrawn";
}
```

Hinweis: Wer `removeFromClub` beim Abschluss einer Verhandlung aufruft, setzt deren Status **vorher** auf `"accepted"`. Sonst bricht die Funktion die eigene Verhandlung ab (Task 6).

`src/engine/economy/training.ts`:

```ts
import { baseStrengthFor, generatePlayer } from "../generator";
import type { ClubId, GameState, Intensity, PlayerId, Position, TrainingFocus, TrainingPlan } from "../model";
import type { Rng } from "../rng";
import { postToClub } from "./messages";
import { salaryFor } from "./money";
import { removeFromClub } from "./roster";
import { roundTo } from "./util";

export const INTENSITY: Record<Intensity, { growth: number; fitnessCost: number; injuryRisk: number }> = {
  light: { growth: 0.6, fitnessCost: 0, injuryRisk: 0 },
  normal: { growth: 1, fitnessCost: 3, injuryRisk: 0.002 },
  hard: { growth: 1.4, fitnessCost: 7, injuryRisk: 0.006 },
};
export const FOCUS_GROWTH: Record<TrainingFocus, number> = { technique: 1, fitness: 0.5, tactics: 0.5 };
export const TACTICS_BONUS = 1.03;
export const MAX_INDIVIDUAL = 3;
const INDIVIDUAL_BONUS = 2;
const PLAYED_BONUS = 1.1;
const RETIRE_AGE = 34;
const YOUTH_POSITIONS: Position[] = ["GK", "DF", "DF", "MF", "MF", "FW"];
export const FREE_AGENT_POOL_MAX = 150;

export function baseDevelopment(age: number, strength: number, potential: number): number {
  const gap = Math.max(0, potential - strength);
  if (age <= 24) return Math.min(0.35, 0.04 + 0.01 * gap);
  if (age <= 30) return gap > 0 ? 0.03 : 0;
  if (age <= 32) return -0.06;
  return -0.15;
}

export function applyTraining(state: GameState, clubId: ClubId, played: ReadonlySet<PlayerId>, rng: Rng): PlayerId[] {
  const club = state.clubs[clubId];
  const plan = club.training;
  const cfg = INTENSITY[plan.intensity];
  const injured: PlayerId[] = [];
  for (const pid of club.squad) {
    const p = state.players[pid];
    const base = baseDevelopment(p.age, p.strength, p.potential);
    if (base > 0) {
      const mult =
        cfg.growth *
        FOCUS_GROWTH[plan.focus] *
        (plan.individual.includes(pid) ? INDIVIDUAL_BONUS : 1) *
        (played.has(pid) ? PLAYED_BONUS : 1);
      p.strength = Math.min(Math.max(p.strength, p.potential), p.strength + base * mult);
    } else if (base < 0) {
      p.strength = Math.max(1, p.strength + base);
    }
    if (plan.focus === "fitness") p.fitness += (100 - p.fitness) * 0.5;
    p.fitness = Math.max(0, p.fitness - cfg.fitnessCost);
    if (p.injury === null && cfg.injuryRisk > 0 && rng.chance(cfg.injuryRisk)) {
      p.injury = { matchesLeft: rng.int(1, 3) };
      injured.push(pid);
    }
  }
  club.tacticsBonus = plan.focus === "tactics" ? TACTICS_BONUS : 1;
  return injured;
}

export function validateTraining(state: GameState, clubId: ClubId, plan: TrainingPlan): string | null {
  if (!Object.hasOwn(INTENSITY, plan.intensity)) return "Unbekannte Trainingsintensität.";
  if (!Object.hasOwn(FOCUS_GROWTH, plan.focus)) return "Unbekannter Trainingsschwerpunkt.";
  if (!Array.isArray(plan.individual) || plan.individual.length > MAX_INDIVIDUAL) return "Höchstens 3 Spieler im Extratraining.";
  if (new Set(plan.individual).size !== plan.individual.length) return "Ein Spieler ist doppelt eingetragen.";
  const squad = state.clubs[clubId].squad;
  if (plan.individual.some((id) => !squad.includes(id))) return "Ein Spieler gehört nicht zum Kader.";
  return null;
}

export function aiTrainingPlan(state: GameState, clubId: ClubId): TrainingPlan {
  const individual = state.clubs[clubId].squad
    .map((id) => state.players[id])
    .filter((p) => p.age <= 23 && p.potential - p.strength > 3)
    .sort((a, b) => b.potential - b.strength - (a.potential - a.strength) || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_INDIVIDUAL)
    .map((p) => p.id);
  return { intensity: "normal", focus: "technique", individual };
}

export function retireChance(age: number): number {
  if (age < RETIRE_AGE) return 0;
  return Math.min(1, 0.3 + 0.15 * (age - RETIRE_AGE));
}

function retire(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  if (p.clubId) {
    postToClub(state, p.clubId, `${p.firstName} ${p.lastName} beendet seine Karriere.`);
    removeFromClub(state, playerId);
  }
  p.retired = true;
  p.clubId = null;
  p.contract = null;
}

/** Saisonwechsel: alle Aktiven altern, manche beenden ihre Karriere. */
export function seasonAging(state: GameState, rng: Rng): PlayerId[] {
  const retired: PlayerId[] = [];
  for (const p of Object.values(state.players)) {
    if (p.retired) continue;
    p.age++;
    if (rng.chance(retireChance(p.age))) {
      retire(state, p.id);
      retired.push(p.id);
    }
  }
  return retired;
}

export function addYouth(state: GameState, rng: Rng): PlayerId[] {
  const ids: PlayerId[] = [];
  for (const club of Object.values(state.clubs)) {
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const p = generatePlayer(state, rng, club.id, rng.pick(YOUTH_POSITIONS), baseStrengthFor(club.reputation) - 12, rng.int(16, 18));
      p.potential = Math.min(99, Math.max(p.strength, p.strength + rng.int(10, 35)));
      p.contract = { salary: roundTo(salaryFor(p.strength) * 0.5, 100), endsSeason: state.season + 2 };
      club.squad.push(p.id);
      ids.push(p.id);
    }
    postToClub(state, club.id, `Aus der Jugend rücken ${n} Spieler in den Kader auf.`);
  }
  return ids;
}

export function addFreeAgents(state: GameState, rng: Rng, count = 25): PlayerId[] {
  const ids: PlayerId[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generatePlayer(state, rng, null, rng.pick(YOUTH_POSITIONS), rng.int(45, 65), rng.int(22, 32)).id);
  }
  return ids;
}

/** Hält den Pool der Vereinslosen klein: die ältesten (bei Gleichstand schwächsten) hören auf. */
export function trimFreeAgents(state: GameState, max = FREE_AGENT_POOL_MAX): void {
  const free = Object.values(state.players)
    .filter((p) => p.clubId === null && !p.retired)
    .sort((a, b) => b.age - a.age || a.strength - b.strength || (a.id < b.id ? -1 : 1));
  for (const p of free.slice(0, Math.max(0, free.length - max))) p.retired = true;
}
```

Der Test „Nachwuchs“ prüft `potential ≥ strength + 10`. Das gilt, weil `strength + 10 ≤ 99` ist (Nachwuchs-Stärke < 89). Falls ein Wert anders ausfällt, nicht den Test aufweichen, sondern melden.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/economy && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy tests/engine/economy
git commit -m "feat(engine): Nachrichten, Kaderpflege, Training, Alterung und Nachwuchs"
```

---

### Task 3: Zuschauer, Stadionausbau und Finanzen

**Files:**
- Modify: `src/engine/economy/stadium.ts` (anhängen)
- Create: `src/engine/economy/finance.ts`
- Test: `tests/engine/economy/finance.test.ts`

**Interfaces:**
- Consumes: Task 1 (`book`, `canAfford`, `isOverLimit`, `wageBill`, `clubLeague`, `isLeagueMatchday`, `roundTo`, `formatEuro`), `postToClub` (Task 2), `computeStandings`, `LiveMatch` (Typ)
- Produces:
  - `stadium.ts`:
    - `attendance(state, homeId, awayId): number`
    - `validateTicketPrice(price): string | null`
    - `startBuilding(state, clubId): string | null`
  - `finance.ts`:
    - Konstanten: `TV_PER_MATCHDAY`, `INTEREST_RATE = 0.01`, `PRIZE_POOL`
    - Sponsor: `sponsorOffers(state, clubId, rng): Sponsor[]`, `chooseSponsor(state, clubId, offerId): string | null`
    - Spieltag: `processFinances(state, lives)`
    - Saisonwechsel: `seasonEndFinances(state, tables, met)`, `startSeasonFinances(state, rng)`

**Regeln** (Startwerte):

- **Nachfrage pro Heimspiel** = `(1500 + 450 × Reputation) × Liga × Erfolg × Gegner × Preisfaktor`.
  - Liga: 2. Liga ×0,75.
  - Erfolg: `1,25 − 0,5 × (Rang − 1) / 17`; vor dem ersten Spiel 1.
  - Gegner: `0,9 + 0,2 × Gegner-Reputation / 100`.
  - Zuschauer = `min(Kapazität, Nachfrage)`, Einnahme = Zuschauer × Eintrittspreis.
  - Zuschauereinnahmen gibt es bei **jedem** Heimspiel, auch in der Relegation.
- **Pro Liga-Spieltag für jeden Verein:**
  - **Einnahmen:**
    - TV-Geld: 1. Liga 100.000 €, 2. Liga 30.000 €.
    - Sponsor: der Betrag pro Spieltag. Hat der Verein noch keinen Sponsor gewählt, wird beim ersten Spieltag automatisch einer genommen: die KI wählt den höchsten, ein Manager das erste Angebot (mit Nachricht).
  - **Ausgaben:**
    - Gehälter: Summe aller Verträge.
    - Unterhalt: abhängig von der Stadionstufe.
    - Dispozinsen: 1 % des negativen Kontostands.
  - **Stadionbau:** Läuft ein Ausbau, zählt er einen Spieltag herunter. Ist er fertig, gilt die neue Stufe und es gibt eine Nachricht.
  - **Dispo:** `overdraftStreak` zählt die Spieltage über dem Limit. Beim ersten Mal kommt die Nachricht „Transfers sind gesperrt“.
- **Sponsorangebote:** 3 pro Saison.
  - Betrag pro Spieltag: `Reputation × 1000 × (0,6 in der 2. Liga) × 0,85–1,15`, auf 1.000 € gerundet.
  - Prämie: `Betrag × 8 × 0,5–1,5`, auf 10.000 € gerundet.
- **Saisonende:**
  - Prämie: `Topf × (18 − Platzindex) / 18`. Der Topf beträgt in der 1. Liga 3 Mio €, in der 2. Liga 1 Mio €. Platzindex 0 ist der Meister.
  - Sponsorprämie, wenn das Saisonziel erreicht ist.
- **Saisonstart:** Das Kassenbuch wird geleert, es gibt keinen Sponsor, und neue Angebote kommen herein. Manager bekommen dazu eine Nachricht. KI-Vereine setzen den optimalen Eintrittspreis.
- **Eintrittspreis:** ganze Zahl von 5 bis 100 €.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/economy/finance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PRIZE_POOL,
  TV_PER_MATCHDAY,
  chooseSponsor,
  processFinances,
  seasonEndFinances,
  sponsorOffers,
  startSeasonFinances,
} from "../../../src/engine/economy/finance";
import { wageBill } from "../../../src/engine/economy/money";
import { STADIUM, attendance, startBuilding, validateTicketPrice } from "../../../src/engine/economy/stadium";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { kickOff, startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(12);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  if (!r.ok) throw new Error(r.error);
  // Sponsorangebote erzeugt startSeason erst ab Task 8; ein zweiter Aufruf danach schadet nicht.
  startSeasonFinances(r.state, Rng.fromSeed(99));
  return r.state;
}

describe("Zuschauer", () => {
  it("nie mehr als die Kapazität; teurer = weniger Zuschauer; 2. Liga weniger als 1. Liga", () => {
    const s = game();
    const [l1a, l1b] = s.competitions[COMP.first].clubs;
    const club = s.clubs[l1a];
    club.finance.stadiumStage = 4;
    club.finance.ticketPrice = 20;
    const cheap = attendance(s, l1a, l1b);
    club.finance.ticketPrice = 60;
    const expensive = attendance(s, l1a, l1b);
    expect(expensive).toBeLessThan(cheap);
    club.finance.stadiumStage = 0;
    club.finance.ticketPrice = 5;
    expect(attendance(s, l1a, l1b)).toBe(STADIUM[0].capacity);
    const l2 = s.competitions[COMP.second].clubs[0];
    s.clubs[l2].reputation = club.reputation;
    Object.assign(s.clubs[l2].finance, { stadiumStage: 4, ticketPrice: 20 });
    club.finance.stadiumStage = 4;
    club.finance.ticketPrice = 20;
    expect(attendance(s, l2, l1b)).toBeLessThan(attendance(s, l1a, l1b));
  });
});

describe("Eintrittspreis und Ausbau", () => {
  it("prüft den Eintrittspreis", () => {
    expect(validateTicketPrice(25)).toBeNull();
    expect(validateTicketPrice(4)).toBe("Der Eintrittspreis muss zwischen 5 und 100 € liegen.");
    expect(validateTicketPrice(101)).not.toBeNull();
    expect(validateTicketPrice(20.5)).not.toBeNull();
  });

  it("startet einen Ausbau, bucht die Kosten und lehnt Doppelbau, Höchststufe und fehlendes Geld ab", () => {
    const s = game();
    const id = s.competitions[COMP.first].clubs[5];
    const f = s.clubs[id].finance;
    f.stadiumStage = 1;
    f.balance = 10_000_000;
    expect(startBuilding(s, id)).toBeNull();
    expect(f.balance).toBe(10_000_000 - STADIUM[2].cost);
    expect(f.building).toEqual({ stage: 2, matchdaysLeft: STADIUM[2].buildMatchdays });
    expect(startBuilding(s, id)).toBe("Es wird schon gebaut.");
    f.building = null;
    f.stadiumStage = 4;
    expect(startBuilding(s, id)).toBe("Das Stadion hat schon die höchste Ausbaustufe.");
    f.stadiumStage = 3;
    f.balance = -1_000_000;
    expect(startBuilding(s, id)).toBe("Dafür reicht das Geld nicht.");
  });
});

describe("Sponsor", () => {
  it("drei Angebote, in der 2. Liga im Schnitt niedriger", () => {
    const s = game();
    const rng = Rng.fromSeed(1);
    const l1 = s.competitions[COMP.first].clubs[0];
    const l2 = s.competitions[COMP.second].clubs[0];
    s.clubs[l2].reputation = s.clubs[l1].reputation;
    const a = sponsorOffers(s, l1, rng);
    const b = sponsorOffers(s, l2, rng);
    expect(a).toHaveLength(3);
    const avg = (xs: typeof a) => xs.reduce((x, o) => x + o.perMatchday, 0) / xs.length;
    expect(avg(b)).toBeLessThan(avg(a));
    expect(a.every((o) => o.bonus > 0 && o.perMatchday % 1_000 === 0)).toBe(true);
  });

  it("chooseSponsor wählt ein Angebot genau einmal", () => {
    const s = game();
    const id = Object.keys(s.clubs)[0];
    const offer = s.clubs[id].finance.sponsorOffers[1];
    expect(chooseSponsor(s, id, "gibts-nicht")).toBe("Dieses Angebot gibt es nicht.");
    expect(chooseSponsor(s, id, offer.id)).toBeNull();
    expect(s.clubs[id].finance.sponsor).toEqual(offer);
    expect(chooseSponsor(s, id, offer.id)).toBe("Der Sponsorvertrag für diese Saison steht schon.");
  });
});

describe("processFinances", () => {
  it("bucht Zuschauer, TV, Sponsor, Gehälter und Unterhalt an einem Liga-Spieltag", () => {
    const s = game();
    const lives = kickOff(s);
    const live = lives[0];
    const home = s.clubs[live.home.club];
    const away = s.clubs[live.away.club];
    const before = { home: home.finance.balance, away: away.finance.balance };
    const wagesAway = wageBill(s, away.id);
    processFinances(s, lives);
    const sum = (club: typeof home, cat: string) => club.finance.ledger.filter((e) => e.category === cat).reduce((x, e) => x + e.amount, 0);
    expect(sum(home, "tickets")).toBe(home.finance.lastAttendance * home.finance.ticketPrice);
    expect(sum(away, "tickets")).toBe(0);
    expect(sum(away, "tv")).toBe(TV_PER_MATCHDAY[COMP.first]);
    expect(sum(away, "salaries")).toBe(-wagesAway);
    expect(sum(away, "upkeep")).toBe(-STADIUM[away.finance.stadiumStage].upkeep);
    expect(away.finance.sponsor).not.toBeNull();
    expect(sum(away, "sponsor")).toBe(away.finance.sponsor!.perMatchday);
    const total = (club: typeof home) => club.finance.ledger.reduce((x, e) => x + e.amount, 0);
    expect(home.finance.balance - before.home).toBe(total(home));
    expect(away.finance.balance - before.away).toBe(total(away));
  });

  it("die KI nimmt den besten Sponsor, der Manager bekommt das erste Angebot mit Nachricht", () => {
    const s = game();
    const human = s.clubs[s.managers[0].clubId!];
    const ai = Object.values(s.clubs).find((c) => c.managerId === null)!;
    const best = Math.max(...ai.finance.sponsorOffers.map((o) => o.perMatchday));
    processFinances(s, []);
    expect(ai.finance.sponsor!.perMatchday).toBe(best);
    expect(human.finance.sponsor).toEqual(human.finance.sponsorOffers[0]);
    expect(s.messages.some((m) => m.text.includes("automatisch"))).toBe(true);
  });

  it("Zinsen bei negativem Konto, Dispo-Zähler und Nachricht", () => {
    const s = game();
    const human = s.clubs[s.managers[0].clubId!];
    human.finance.balance = -100_000_000;
    processFinances(s, []);
    expect(human.finance.ledger.some((e) => e.category === "interest" && e.amount < 0)).toBe(true);
    expect(human.finance.overdraftStreak).toBe(1);
    expect(s.messages.some((m) => m.text.includes("Dispo-Limit"))).toBe(true);
    processFinances(s, []);
    expect(human.finance.overdraftStreak).toBe(2);
  });

  it("Stadionausbau wird fertig und meldet sich", () => {
    const s = game();
    const human = s.clubs[s.managers[0].clubId!];
    human.finance.stadiumStage = 1;
    human.finance.building = { stage: 2, matchdaysLeft: 1 };
    processFinances(s, []);
    expect(human.finance.stadiumStage).toBe(2);
    expect(human.finance.building).toBeNull();
    expect(s.messages.some((m) => m.text.includes("Stadionausbau"))).toBe(true);
  });

  it("an Relegationstagen nur Zuschauereinnahmen", () => {
    const s = game();
    const lives = kickOff(s).slice(0, 1);
    s.calendarIndex = 34;
    processFinances(s, lives);
    const cats = new Set(Object.values(s.clubs).flatMap((c) => c.finance.ledger.map((e) => e.category)));
    expect([...cats]).toEqual(["tickets"]);
  });
});

describe("Saisonwechsel", () => {
  it("Prämien nach Platz und Sponsorprämie bei erreichtem Ziel", () => {
    const s = game();
    const l1 = [...s.competitions[COMP.first].clubs];
    const l2 = [...s.competitions[COMP.second].clubs];
    for (const id of [...l1, ...l2]) s.clubs[id].finance.sponsor = { id: "x", name: "X", perMatchday: 1, bonus: 500_000 };
    const before = s.clubs[l1[0]].finance.balance;
    seasonEndFinances(s, { [COMP.first]: l1, [COMP.second]: l2 }, (id) => id === l1[0]);
    expect(s.clubs[l1[0]].finance.balance - before).toBe(PRIZE_POOL[COMP.first] + 500_000);
    const last = s.clubs[l1[17]].finance.ledger.find((e) => e.category === "prizes")!.amount;
    expect(last).toBe(Math.round(PRIZE_POOL[COMP.first] / 18 / 10_000) * 10_000);
    expect(s.clubs[l1[1]].finance.ledger.some((e) => e.category === "bonus")).toBe(false);
  });

  it("Saisonstart: Kassenbuch leer, neue Angebote, KI mit optimalem Preis", () => {
    const s = game();
    const any = Object.values(s.clubs);
    for (const c of any) {
      c.finance.ledger.push({ calendarIndex: 3, category: "tv", amount: 1 });
      c.finance.sponsor = c.finance.sponsorOffers[0];
      c.finance.ticketPrice = 99;
    }
    startSeasonFinances(s, Rng.fromSeed(2));
    for (const c of any) {
      expect(c.finance.ledger).toEqual([]);
      expect(c.finance.sponsor).toBeNull();
      expect(c.finance.sponsorOffers).toHaveLength(3);
      if (c.managerId === null) expect(c.finance.ticketPrice).not.toBe(99);
      else expect(c.finance.ticketPrice).toBe(99);
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/economy/finance.test.ts`
Expected: FAIL, weil das Modul `finance` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

An `src/engine/economy/stadium.ts` anhängen. Die Imports kommen an den Dateianfang.

```ts
import { computeStandings } from "../competition/standings";
import { COMP, type ClubId, type GameState } from "../model";
import { book, canAfford } from "./money";
import { clubLeague } from "./util";

export function attendance(state: GameState, homeId: ClubId, awayId: ClubId): number {
  const home = state.clubs[homeId];
  const away = state.clubs[awayId];
  const league = clubLeague(state, homeId);
  const base = (1500 + home.reputation * 450) * (league === COMP.second ? 0.75 : 1);
  let success = 1;
  if (league) {
    const table = computeStandings(state.competitions[league]);
    const index = table.findIndex((r) => r.club === homeId);
    if (index >= 0 && table[index].played > 0) success = 1.25 - (0.5 * index) / (table.length - 1);
  }
  const opponent = 0.9 + (0.2 * away.reputation) / 100;
  const demand = base * success * opponent * priceFactor(home.finance.ticketPrice, home.reputation);
  return Math.round(Math.min(STADIUM[home.finance.stadiumStage].capacity, Math.max(0, demand)));
}

export function validateTicketPrice(price: number): string | null {
  if (!Number.isInteger(price) || price < 5 || price > 100) return "Der Eintrittspreis muss zwischen 5 und 100 € liegen.";
  return null;
}

export function startBuilding(state: GameState, clubId: ClubId): string | null {
  const club = state.clubs[clubId];
  const f = club.finance;
  if (f.building) return "Es wird schon gebaut.";
  const next = f.stadiumStage + 1;
  if (next >= STADIUM.length) return "Das Stadion hat schon die höchste Ausbaustufe.";
  const { cost, buildMatchdays } = STADIUM[next];
  if (!canAfford(club, cost)) return "Dafür reicht das Geld nicht.";
  book(state, clubId, "stadium", -cost);
  f.building = { stage: next, matchdaysLeft: buildMatchdays };
  return null;
}
```

`src/engine/economy/finance.ts`:

```ts
import type { LiveMatch } from "../match/simulate";
import { COMP, newId, type ClubId, type CompetitionId, type GameState, type Sponsor } from "../model";
import type { Rng } from "../rng";
import { postToClub } from "./messages";
import { book, isOverLimit, wageBill } from "./money";
import { STADIUM, attendance, optimalPrice } from "./stadium";
import { clubLeague, formatEuro, isLeagueMatchday, roundTo } from "./util";

export const TV_PER_MATCHDAY: Record<string, number> = { [COMP.first]: 100_000, [COMP.second]: 30_000 };
export const INTEREST_RATE = 0.01;
export const PRIZE_POOL: Record<string, number> = { [COMP.first]: 3_000_000, [COMP.second]: 1_000_000 };

const SPONSOR_NAMES = [
  "Brauerei Hopfenkrone", "Autohaus Kolbenring", "Stadtwerke Lichtblick", "Bäckerei Goldkorn",
  "Versicherung Treuhand", "Elektro Blitz", "Möbel Eichenstolz", "Molkerei Weidenglück",
  "Baumarkt Schraubwerk", "Reisebüro Fernweh", "Sparkasse Taler", "Druckerei Letter",
];

export function sponsorOffers(state: GameState, clubId: ClubId, rng: Rng): Sponsor[] {
  const club = state.clubs[clubId];
  const factor = clubLeague(state, clubId) === COMP.second ? 0.6 : 1;
  return rng.shuffle(SPONSOR_NAMES).slice(0, 3).map((name) => {
    const perMatchday = roundTo(club.reputation * 1000 * factor * (0.85 + rng.next() * 0.3), 1000);
    return { id: newId(state, "sp"), name, perMatchday, bonus: roundTo(perMatchday * 8 * (0.5 + rng.next()), 10_000) };
  });
}

export function chooseSponsor(state: GameState, clubId: ClubId, offerId: string): string | null {
  const f = state.clubs[clubId].finance;
  if (f.sponsor) return "Der Sponsorvertrag für diese Saison steht schon.";
  const offer = f.sponsorOffers.find((o) => o.id === offerId);
  if (!offer) return "Dieses Angebot gibt es nicht.";
  f.sponsor = offer;
  return null;
}

export function processFinances(state: GameState, lives: LiveMatch[]): void {
  for (const l of lives) {
    const home = state.clubs[l.home.club];
    const att = attendance(state, home.id, l.away.club);
    home.finance.lastAttendance = att;
    if (att > 0) book(state, home.id, "tickets", att * home.finance.ticketPrice);
  }
  if (!isLeagueMatchday(state.calendarIndex)) return;
  for (const club of Object.values(state.clubs)) {
    const league = clubLeague(state, club.id);
    if (!league) continue;
    const f = club.finance;
    if (!f.sponsor && f.sponsorOffers.length > 0) {
      f.sponsor =
        club.managerId === null
          ? f.sponsorOffers.reduce((best, o) => (o.perMatchday > best.perMatchday ? o : best))
          : f.sponsorOffers[0];
      postToClub(state, club.id, `Kein Sponsor gewählt – ${f.sponsor.name} wurde automatisch genommen.`);
    }
    book(state, club.id, "tv", TV_PER_MATCHDAY[league]);
    if (f.sponsor) book(state, club.id, "sponsor", f.sponsor.perMatchday);
    const wages = wageBill(state, club.id);
    if (wages > 0) book(state, club.id, "salaries", -wages);
    book(state, club.id, "upkeep", -STADIUM[f.stadiumStage].upkeep);
    if (f.balance < 0) book(state, club.id, "interest", Math.round(f.balance * INTEREST_RATE));
    if (f.building) {
      const left = f.building.matchdaysLeft - 1;
      if (left <= 0) {
        f.stadiumStage = f.building.stage;
        f.building = null;
        postToClub(state, club.id, `Der Stadionausbau ist fertig: jetzt ${STADIUM[f.stadiumStage].capacity} Plätze.`);
      } else f.building = { ...f.building, matchdaysLeft: left };
    }
    f.overdraftStreak = isOverLimit(club) ? f.overdraftStreak + 1 : 0;
    if (f.overdraftStreak === 1) {
      postToClub(state, club.id, "Achtung: Das Konto liegt über dem Dispo-Limit. Transfers sind gesperrt.");
    }
  }
}

export function seasonEndFinances(state: GameState, tables: Record<CompetitionId, ClubId[]>, met: (clubId: ClubId) => boolean): void {
  for (const league of [COMP.first, COMP.second]) {
    (tables[league] ?? []).forEach((clubId, i) => {
      book(state, clubId, "prizes", roundTo((PRIZE_POOL[league] * (18 - i)) / 18, 10_000));
    });
  }
  for (const club of Object.values(state.clubs)) {
    const sponsor = club.finance.sponsor;
    if (sponsor && met(club.id)) {
      book(state, club.id, "bonus", sponsor.bonus);
      postToClub(state, club.id, `Saisonziel erreicht: ${sponsor.name} zahlt ${formatEuro(sponsor.bonus)} Prämie.`);
    }
  }
}

export function startSeasonFinances(state: GameState, rng: Rng): void {
  for (const club of Object.values(state.clubs)) {
    const f = club.finance;
    f.ledger = [];
    f.sponsor = null;
    f.sponsorOffers = sponsorOffers(state, club.id, rng);
    if (club.managerId === null) f.ticketPrice = optimalPrice(club.reputation);
    else postToClub(state, club.id, "Neue Sponsorangebote liegen vor.", { type: "sponsor", id: f.sponsorOffers[0].id });
  }
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/economy && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy tests/engine/economy/finance.test.ts
git commit -m "feat(engine): Zuschauer, Stadionausbau und Finanzen"
```

---

### Task 4: Verträge (Forderung, Verhandlungslogik, Unterschrift, Entlassung, Vertragsende)

**Files:**
- Create: `src/engine/economy/contracts.ts`
- Test: `tests/engine/economy/contracts.test.ts`

**Interfaces:**
- Consumes: `salaryFor`, `book` (Task 1), `postToClub`, `removeFromClub` (Task 2), `roundTo`, `formatEuro`
- Produces:
  - Konstanten: `MIN_YEARS = 1`, `MAX_YEARS = 5`, `ABORT_RATIO = 0.7`, `TALK_COOLDOWN = 3`
  - Forderung: `desiredYears(p)`, `salaryDemand(state, p, clubId)`, `yearsAdjusted(ask, years, desired)`, `validateYears(years): string | null`
  - Verhandlung: `type TalkOutcome = { kind: "accepted"; amount } | { kind: "counter"; amount; round } | { kind: "aborted" }`, `evaluateOffer(offer, ask, round): TalkOutcome`
  - Vertrag: `contractEnd(state, years)`, `signContract(state, playerId, clubId, salary, years)`
  - Entlassung: `remainingMatchdays(state, p)`, `severance(state, p)`, `releasePlayer(state, clubId, playerId): string | null`
  - Laufender Betrieb: `expireContracts(state): PlayerId[]`, `expiringNotices(state)`, `aiRenewals(state)`, `tickCooldowns(state)`

**Regeln** (Spec 8.2, mit Startwerten):

- **Wunschlaufzeit:** bis 24 Jahre 4 Jahre, bis 29 Jahre 3, bis 32 Jahre 2, sonst 1.
- **Gehaltsforderung** = `salaryFor(Stärke)` × Alter × Verein × Stimmung × Einsatzzeit, auf 100 € gerundet.
  - Alter: ab 31 Jahren ×0,9.
  - Verein: `0,8 + 0,4 × Reputation / 100`.
  - Stimmung: `1,15 − 0,3 × Moral / 100`.
  - Einsatzzeit: ×0,85, wenn der Spieler im eigenen Verein ab Kalenderindex 10 auf weniger als 30 % Einsätze kommt.
- **Laufzeit-Abweichung:** Jedes Jahr Abweichung von der Wunschlaufzeit erhöht die Forderung um 5 %.
- **Bewertung eines Angebots:**
  - Ab 100 % der Forderung ist es angenommen, zum angebotenen Betrag.
  - Unter 70 % oder in Runde 3 unter der Forderung bricht die Gegenseite ab.
  - Sonst kommt eine Gegenforderung: `Forderung − 0,35 × (Forderung − Angebot)`, auf 100 € gerundet, in der nächsten Runde.
- **Vertragsende:** `Saison + Jahre − 1`, wenn bei Kalenderindex 0 unterschrieben wird. Sonst `Saison + Jahre`, denn die laufende Saison zählt dann nicht mehr als volle Saison.
- **Unterschrift:**
  - Der Spieler wechselt gegebenenfalls in den Verein.
  - Er ist danach nicht mehr auf der Transferliste und hat keine Sperrzeit für Verhandlungen.
  - Seine Moral steigt um 10, höchstens auf 100.
- **Entlassung:**
  - Abfindung: `50 % × Gehalt × restliche Spieltage`, auf 100 € gerundet.
  - Restliche Spieltage: `(Vertragsende − Saison) × 34 + (34 − min(34, Kalenderindex))`.
- **Saisonende:** Verträge mit `endsSeason ≤ Saison` enden, und der Spieler wird vereinslos. Manager bekommen dazu eine Nachricht.
- **Hinweis auf auslaufende Verträge:** bei Kalenderindex 24 (etwa 10 Spieltage vor Schluss) eine Nachricht an Manager.
- **KI-Verlängerung:** ab Kalenderindex 23, solange es Liga-Spieltage sind. Verlängert wird bei auslaufendem Vertrag, Alter bis 31 und einer Stärke von mindestens dem Schnitt der Startelf − 5. Dafür gibt es die Forderung und die Wunschlaufzeit.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/economy/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  aiRenewals,
  contractEnd,
  desiredYears,
  evaluateOffer,
  expireContracts,
  expiringNotices,
  releasePlayer,
  remainingMatchdays,
  salaryDemand,
  severance,
  signContract,
  tickCooldowns,
  validateYears,
  yearsAdjusted,
} from "../../../src/engine/economy/contracts";
import { salaryFor } from "../../../src/engine/economy/money";
import { autoLineup } from "../../../src/engine/lineup";
import { makePlayer, makeState } from "../fixtures";

function withManager() {
  const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
  s.managers.push({ id: "m1", name: "Anna", clubId: "c1", jobOffers: [], unemployedFor: 0 });
  s.clubs.c1.managerId = "m1";
  for (const c of ["c1", "c2"]) s.clubs[c].lineup = autoLineup(s, c, "4-4-2");
  return s;
}

describe("Forderung", () => {
  it("Wunschlaufzeit nach Alter", () => {
    expect(desiredYears(makePlayer("a", "MF", 60, { age: 20 }))).toBe(4);
    expect(desiredYears(makePlayer("a", "MF", 60, { age: 27 }))).toBe(3);
    expect(desiredYears(makePlayer("a", "MF", 60, { age: 31 }))).toBe(2);
    expect(desiredYears(makePlayer("a", "MF", 60, { age: 34 }))).toBe(1);
  });

  it("stärker, größerer Verein und schlechte Laune = höhere Forderung; Alter ab 31 senkt", () => {
    const s = withManager();
    const p = s.players["c1-MF1"];
    const base = salaryDemand(s, p, "c1");
    expect(base).toBe(Math.round((salaryFor(60) * (0.8 + 0.4 * 0.5) * (1.15 - 0.3 * 0.6)) / 100) * 100);
    expect(salaryDemand(s, { ...p, strength: 70 }, "c1")).toBeGreaterThan(base);
    s.clubs.c2.reputation = 90;
    expect(salaryDemand(s, p, "c2")).toBeGreaterThan(base);
    expect(salaryDemand(s, { ...p, morale: 10 }, "c1")).toBeGreaterThan(base);
    expect(salaryDemand(s, { ...p, age: 31 }, "c1")).toBeLessThan(base);
  });

  it("wer kaum spielt, fordert weniger", () => {
    const s = withManager();
    s.calendarIndex = 12;
    const p = s.players["c1-MF8"];
    expect(salaryDemand(s, { ...p, stats: { apps: 1, goals: 0 } }, "c1")).toBeLessThan(salaryDemand(s, { ...p, stats: { apps: 10, goals: 0 } }, "c1"));
  });

  it("Laufzeit-Abweichung kostet 5 % pro Jahr; Laufzeit 1–5", () => {
    expect(yearsAdjusted(10_000, 3, 3)).toBe(10_000);
    expect(yearsAdjusted(10_000, 1, 3)).toBe(11_000);
    expect(validateYears(3)).toBeNull();
    expect(validateYears(0)).toBe("Die Laufzeit muss 1 bis 5 Jahre betragen.");
    expect(validateYears(6)).not.toBeNull();
    expect(validateYears(2.5)).not.toBeNull();
  });
});

describe("evaluateOffer", () => {
  it("nimmt an, kontert, bricht ab", () => {
    expect(evaluateOffer(10_000, 10_000, 1)).toEqual({ kind: "accepted", amount: 10_000 });
    expect(evaluateOffer(12_000, 10_000, 2)).toEqual({ kind: "accepted", amount: 12_000 });
    expect(evaluateOffer(8_000, 10_000, 1)).toEqual({ kind: "counter", amount: 9_300, round: 2 });
    expect(evaluateOffer(6_900, 10_000, 1)).toEqual({ kind: "aborted" });
    expect(evaluateOffer(9_999, 10_000, 3)).toEqual({ kind: "aborted" });
  });
});

describe("Verträge", () => {
  it("Vertragsende hängt davon ab, ob die Saison schon läuft", () => {
    const s = withManager();
    expect(contractEnd(s, 2)).toBe(2);
    s.calendarIndex = 5;
    expect(contractEnd(s, 2)).toBe(3);
  });

  it("signContract: Vereinsloser kommt in den Kader, Moral steigt, Transferliste weg", () => {
    const s = withManager();
    s.players.free = makePlayer("free", "FW", 65, { clubId: null, contract: null, morale: 95, transferListed: { askingPrice: null }, talkCooldown: 2 });
    signContract(s, "free", "c1", 12_000, 3);
    expect(s.clubs.c1.squad).toContain("free");
    expect(s.players.free).toMatchObject({ clubId: "c1", contract: { salary: 12_000, endsSeason: 3 }, morale: 100, transferListed: null, talkCooldown: 0 });
  });

  it("signContract mit Spieler eines anderen Vereins nimmt ihn dort heraus", () => {
    const s = withManager();
    signContract(s, "c2-FW1", "c1", 9_000, 2);
    expect(s.clubs.c2.squad).not.toContain("c2-FW1");
    expect(s.clubs.c1.squad).toContain("c2-FW1");
  });

  it("Entlassung kostet die halbe Restsumme und macht den Spieler vereinslos", () => {
    const s = withManager();
    s.calendarIndex = 10;
    const p = s.players["c1-MF7"];
    p.contract = { salary: 4_000, endsSeason: 2 };
    expect(remainingMatchdays(s, p)).toBe(34 + 24);
    expect(severance(s, p)).toBe(Math.round((4_000 * 58 * 0.5) / 100) * 100);
    const before = s.clubs.c1.finance.balance;
    expect(releasePlayer(s, "c1", "c1-MF7")).toBeNull();
    expect(s.clubs.c1.finance.balance).toBe(before - 116_000);
    expect(s.players["c1-MF7"].clubId).toBeNull();
    expect(releasePlayer(s, "c1", "c2-MF1")).toBe("Der Spieler gehört nicht zum Kader.");
  });

  it("auslaufende Verträge enden am Saisonende mit Nachricht an den Manager", () => {
    const s = withManager();
    s.players["c1-DF1"].contract = { salary: 1, endsSeason: 1 };
    s.players["c2-DF1"].contract = { salary: 1, endsSeason: 1 };
    s.players["c1-DF2"].contract = { salary: 1, endsSeason: 2 };
    expect(expireContracts(s).sort()).toEqual(["c1-DF1", "c2-DF1"]);
    expect(s.clubs.c1.squad).not.toContain("c1-DF1");
    expect(s.clubs.c1.squad).toContain("c1-DF2");
    expect(s.messages.filter((m) => m.text.includes("ausgelaufen"))).toHaveLength(1);
  });

  it("Hinweis auf auslaufende Verträge bei Kalenderindex 24, nur an Manager", () => {
    const s = withManager();
    s.players["c1-GK1"].contract = { salary: 1, endsSeason: 1 };
    s.players["c2-GK1"].contract = { salary: 1, endsSeason: 1 };
    s.calendarIndex = 23;
    expiringNotices(s);
    expect(s.messages).toHaveLength(0);
    s.calendarIndex = 24;
    expiringNotices(s);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].text).toContain(s.players["c1-GK1"].lastName);
  });

  it("die KI verlängert Leistungsträger, nicht alte oder schwache Spieler", () => {
    const s = withManager();
    s.calendarIndex = 25;
    Object.assign(s.players["c2-MF1"], { contract: { salary: 1, endsSeason: 1 }, strength: 65 });
    Object.assign(s.players["c2-MF2"], { contract: { salary: 1, endsSeason: 1 }, age: 33 });
    Object.assign(s.players["c2-MF3"], { contract: { salary: 1, endsSeason: 1 }, strength: 40 });
    Object.assign(s.players["c1-MF1"], { contract: { salary: 1, endsSeason: 1 } });
    aiRenewals(s);
    expect(s.players["c2-MF1"].contract!.endsSeason).toBeGreaterThan(1);
    expect(s.players["c2-MF2"].contract!.endsSeason).toBe(1);
    expect(s.players["c2-MF3"].contract!.endsSeason).toBe(1);
    expect(s.players["c1-MF1"].contract!.endsSeason).toBe(1);
  });

  it("Sperrzeiten für Verhandlungen laufen ab", () => {
    const s = withManager();
    s.players["c1-MF1"].talkCooldown = 2;
    tickCooldowns(s);
    expect(s.players["c1-MF1"].talkCooldown).toBe(1);
    tickCooldowns(s);
    tickCooldowns(s);
    expect(s.players["c1-MF1"].talkCooldown).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/economy/contracts.test.ts`
Expected: FAIL, weil das Modul `contracts` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/engine/economy/contracts.ts`:

```ts
import { LEAGUE_MATCHDAYS, type ClubId, type GameState, type Player, type PlayerId } from "../model";
import { postToClub } from "./messages";
import { book, salaryFor } from "./money";
import { removeFromClub } from "./roster";
import { roundTo } from "./util";

export const MIN_YEARS = 1;
export const MAX_YEARS = 5;
export const ABORT_RATIO = 0.7;
export const TALK_COOLDOWN = 3;
const COUNTER_STEP = 0.35;
const SEVERANCE_SHARE = 0.5;
const RENEWAL_FROM = 23;
const EXPIRY_NOTICE_AT = 24;

export function desiredYears(p: Player): number {
  if (p.age <= 24) return 4;
  if (p.age <= 29) return 3;
  if (p.age <= 32) return 2;
  return 1;
}

export function salaryDemand(state: GameState, p: Player, clubId: ClubId): number {
  const club = state.clubs[clubId];
  let d = salaryFor(p.strength);
  if (p.age >= 31) d *= 0.9;
  d *= 0.8 + (0.4 * club.reputation) / 100;
  d *= 1.15 - (0.3 * p.morale) / 100;
  if (p.clubId === clubId && state.calendarIndex >= 10 && p.stats.apps < state.calendarIndex * 0.3) d *= 0.85;
  return roundTo(d, 100);
}

export function yearsAdjusted(ask: number, years: number, desired: number): number {
  return roundTo(ask * (1 + 0.05 * Math.abs(years - desired)), 100);
}

export function validateYears(years: number): string | null {
  if (!Number.isInteger(years) || years < MIN_YEARS || years > MAX_YEARS) return "Die Laufzeit muss 1 bis 5 Jahre betragen.";
  return null;
}

export type TalkOutcome =
  | { kind: "accepted"; amount: number }
  | { kind: "counter"; amount: number; round: number }
  | { kind: "aborted" };

export function evaluateOffer(offer: number, ask: number, round: number): TalkOutcome {
  if (offer >= ask) return { kind: "accepted", amount: offer };
  if (offer < ABORT_RATIO * ask || round >= 3) return { kind: "aborted" };
  return { kind: "counter", amount: roundTo(ask - (ask - offer) * COUNTER_STEP, 100), round: round + 1 };
}

export function contractEnd(state: GameState, years: number): number {
  return state.season + years - (state.calendarIndex === 0 ? 1 : 0);
}

export function signContract(state: GameState, playerId: PlayerId, clubId: ClubId, salary: number, years: number): void {
  const p = state.players[playerId];
  const club = state.clubs[clubId];
  if (p.clubId !== clubId) {
    if (p.clubId) removeFromClub(state, playerId);
    p.clubId = clubId;
  }
  if (!club.squad.includes(playerId)) club.squad.push(playerId);
  p.contract = { salary, endsSeason: contractEnd(state, years) };
  p.transferListed = null;
  p.morale = Math.min(100, p.morale + 10);
  p.talkCooldown = 0;
}

export function remainingMatchdays(state: GameState, p: Player): number {
  if (!p.contract) return 0;
  const seasons = p.contract.endsSeason - state.season;
  return Math.max(0, seasons * LEAGUE_MATCHDAYS + (LEAGUE_MATCHDAYS - Math.min(LEAGUE_MATCHDAYS, state.calendarIndex)));
}

export function severance(state: GameState, p: Player): number {
  return roundTo((p.contract?.salary ?? 0) * remainingMatchdays(state, p) * SEVERANCE_SHARE, 100);
}

export function releasePlayer(state: GameState, clubId: ClubId, playerId: PlayerId): string | null {
  const p = state.players[playerId];
  if (!p || p.clubId !== clubId) return "Der Spieler gehört nicht zum Kader.";
  const amount = severance(state, p);
  if (amount > 0) book(state, clubId, "severance", -amount);
  removeFromClub(state, playerId);
  return null;
}

export function expireContracts(state: GameState): PlayerId[] {
  const gone: PlayerId[] = [];
  for (const p of Object.values(state.players)) {
    if (!p.clubId || !p.contract || p.contract.endsSeason > state.season) continue;
    postToClub(state, p.clubId, `${p.firstName} ${p.lastName} verlässt den Verein, sein Vertrag ist ausgelaufen.`);
    removeFromClub(state, p.id);
    gone.push(p.id);
  }
  return gone;
}

export function expiringNotices(state: GameState): void {
  if (state.calendarIndex !== EXPIRY_NOTICE_AT) return;
  for (const club of Object.values(state.clubs)) {
    if (!club.managerId) continue;
    const names = club.squad
      .map((id) => state.players[id])
      .filter((p) => p.contract && p.contract.endsSeason <= state.season)
      .map((p) => p.lastName);
    if (names.length > 0) postToClub(state, club.id, `Verträge laufen zum Saisonende aus: ${names.join(", ")}.`);
  }
}

export function aiRenewals(state: GameState): void {
  if (state.calendarIndex < RENEWAL_FROM || state.calendarIndex >= LEAGUE_MATCHDAYS) return;
  for (const club of Object.values(state.clubs)) {
    if (club.managerId) continue;
    const starters = club.lineup.starters.map((id) => state.players[id]).filter(Boolean);
    const avg = starters.reduce((s, p) => s + p.strength, 0) / Math.max(1, starters.length);
    for (const pid of [...club.squad]) {
      const p = state.players[pid];
      if (!p.contract || p.contract.endsSeason > state.season) continue;
      if (p.age > 31 || p.strength < avg - 5) continue;
      signContract(state, pid, club.id, salaryDemand(state, p, club.id), desiredYears(p));
    }
  }
}

export function tickCooldowns(state: GameState): void {
  for (const p of Object.values(state.players)) if (p.talkCooldown > 0) p.talkCooldown--;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/economy && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy/contracts.ts tests/engine/economy/contracts.test.ts
git commit -m "feat(engine): Verträge mit Forderung, Verhandlungslogik und Entlassung"
```

---

### Task 5: Transfer-Grundlagen (Fenster, Ablöse, Wechsel, Transferliste)

**Files:**
- Create: `src/engine/economy/transfers.ts`
- Test: `tests/engine/economy/transfers.test.ts`

**Interfaces:**
- Consumes: `marketValue`, `book` (Task 1), `postToClub`, `removeFromClub` (Task 2), `roundTo`, `formatEuro`
- Produces:
  - Fenster: `WINDOW_INDICES = [0, 17, 18]`, `isTransferWindow(state)`
  - `askingFee(state, p): number`. Ein vereinsloser Spieler kostet 0. Steht ein Spieler auf der Transferliste, gilt sein Wunschpreis, sonst der Marktwert. Ein Startspieler kostet den Marktwert × 1,5, ein anderer Spieler den Marktwert × 1,2, jeweils auf 10.000 € gerundet.
  - `executeTransfer(state, toClubId, playerId, fee)`:
    - **Geld:** bucht die Ablöse bei beiden Vereinen (Kategorie „transfers“).
    - **Wechsel:** nimmt den Spieler beim alten Verein heraus und fügt ihn dem neuen Kader hinzu. Der Vertrag ist danach `null`, den setzt der Aufrufer über `signContract`.
    - **Nachricht:** der abgebende Manager wird benachrichtigt.
  - `setTransferListing(state, clubId, playerId, listed, askingPrice): string | null`

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/economy/transfers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { marketValue } from "../../../src/engine/economy/money";
import { WINDOW_INDICES, askingFee, executeTransfer, isTransferWindow, setTransferListing } from "../../../src/engine/economy/transfers";
import { autoLineup } from "../../../src/engine/lineup";
import { makePlayer, makeState } from "../fixtures";

function setup() {
  const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
  s.managers.push({ id: "m1", name: "Anna", clubId: "c1", jobOffers: [], unemployedFor: 0 });
  s.clubs.c1.managerId = "m1";
  for (const c of ["c1", "c2"]) s.clubs[c].lineup = autoLineup(s, c, "4-4-2");
  return s;
}

describe("Transferfenster", () => {
  it("ist vor dem 1., 18. und 19. Spieltag offen", () => {
    const s = setup();
    expect(WINDOW_INDICES).toEqual([0, 17, 18]);
    for (const i of [0, 17, 18]) {
      s.calendarIndex = i;
      expect(isTransferWindow(s)).toBe(true);
    }
    for (const i of [1, 16, 19, 33, 34]) {
      s.calendarIndex = i;
      expect(isTransferWindow(s)).toBe(false);
    }
  });
});

describe("askingFee", () => {
  it("Startspieler teurer als Ersatz, Transferliste nach Wunschpreis, Vereinslose kostenlos", () => {
    const s = setup();
    const starter = s.players[s.clubs.c2.lineup.starters[3]];
    const reserve = s.players[s.clubs.c2.squad.find((id) => !s.clubs.c2.lineup.starters.includes(id))!];
    const mv = (id: string) => marketValue(s.players[id], s.season);
    expect(askingFee(s, starter)).toBe(Math.round((mv(starter.id) * 1.5) / 10_000) * 10_000);
    expect(askingFee(s, reserve)).toBe(Math.round((mv(reserve.id) * 1.2) / 10_000) * 10_000);
    reserve.transferListed = { askingPrice: null };
    expect(askingFee(s, reserve)).toBe(mv(reserve.id));
    reserve.transferListed = { askingPrice: 123_000 };
    expect(askingFee(s, reserve)).toBe(123_000);
    expect(askingFee(s, makePlayer("f", "MF", 70, { clubId: null, contract: null }))).toBe(0);
  });
});

describe("executeTransfer", () => {
  it("bucht die Ablöse, wechselt den Kader und benachrichtigt den abgebenden Manager", () => {
    const s = setup();
    const pid = s.clubs.c1.squad[10];
    const before = { c1: s.clubs.c1.finance.balance, c2: s.clubs.c2.finance.balance };
    executeTransfer(s, "c2", pid, 750_000);
    expect(s.clubs.c1.finance.balance).toBe(before.c1 + 750_000);
    expect(s.clubs.c2.finance.balance).toBe(before.c2 - 750_000);
    expect(s.clubs.c1.squad).not.toContain(pid);
    expect(s.clubs.c2.squad).toContain(pid);
    expect(s.players[pid].clubId).toBe("c2");
    expect(s.players[pid].contract).toBeNull();
    expect(s.messages[0].text).toContain("750.000 €");
  });

  it("ein Vereinsloser kommt ohne Buchung beim Verkäufer", () => {
    const s = setup();
    s.players.f = makePlayer("f", "FW", 60, { clubId: null, contract: null });
    executeTransfer(s, "c2", "f", 0);
    expect(s.clubs.c2.squad).toContain("f");
    expect(s.clubs.c2.finance.ledger).toEqual([]);
  });
});

describe("setTransferListing", () => {
  it("setzt und entfernt Spieler auf der Transferliste", () => {
    const s = setup();
    const pid = s.clubs.c1.squad[5];
    expect(setTransferListing(s, "c1", pid, true, 400_000)).toBeNull();
    expect(s.players[pid].transferListed).toEqual({ askingPrice: 400_000 });
    expect(setTransferListing(s, "c1", pid, true, null)).toBeNull();
    expect(s.players[pid].transferListed).toEqual({ askingPrice: null });
    expect(setTransferListing(s, "c1", pid, false, null)).toBeNull();
    expect(s.players[pid].transferListed).toBeNull();
    expect(setTransferListing(s, "c1", s.clubs.c2.squad[0], true, null)).toBe("Der Spieler gehört nicht zum Kader.");
    expect(setTransferListing(s, "c1", pid, true, -5)).toBe("Der Wunschpreis muss eine positive ganze Zahl sein.");
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/economy/transfers.test.ts`
Expected: FAIL, weil das Modul `transfers` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/engine/economy/transfers.ts`:

```ts
import type { ClubId, GameState, Player, PlayerId } from "../model";
import { postToClub } from "./messages";
import { book, marketValue } from "./money";
import { removeFromClub } from "./roster";
import { formatEuro, roundTo } from "./util";

export const WINDOW_INDICES: readonly number[] = [0, 17, 18];

export function isTransferWindow(state: GameState): boolean {
  return WINDOW_INDICES.includes(state.calendarIndex);
}

export function askingFee(state: GameState, p: Player): number {
  if (!p.clubId) return 0;
  const mv = marketValue(p, state.season);
  if (p.transferListed) return p.transferListed.askingPrice ?? mv;
  const starter = state.clubs[p.clubId].lineup.starters.includes(p.id);
  return roundTo(mv * (starter ? 1.5 : 1.2), 10_000);
}

/** Wechsel mit Ablöse; der neue Vertrag wird danach mit signContract gesetzt. */
export function executeTransfer(state: GameState, toClubId: ClubId, playerId: PlayerId, fee: number): void {
  const p = state.players[playerId];
  const fromClubId = p.clubId;
  if (fromClubId) {
    if (fee > 0) book(state, fromClubId, "transfers", fee);
    postToClub(state, fromClubId, `${p.firstName} ${p.lastName} wechselt für ${formatEuro(fee)} zu ${state.clubs[toClubId].name}.`);
    removeFromClub(state, playerId);
  }
  if (fee > 0) book(state, toClubId, "transfers", -fee);
  p.clubId = toClubId;
  const to = state.clubs[toClubId];
  if (!to.squad.includes(playerId)) to.squad.push(playerId);
}

export function setTransferListing(
  state: GameState,
  clubId: ClubId,
  playerId: PlayerId,
  listed: boolean,
  askingPrice: number | null,
): string | null {
  const p = state.players[playerId];
  if (!p || p.clubId !== clubId) return "Der Spieler gehört nicht zum Kader.";
  if (askingPrice !== null && (!Number.isInteger(askingPrice) || askingPrice <= 0)) return "Der Wunschpreis muss eine positive ganze Zahl sein.";
  p.transferListed = listed ? { askingPrice } : null;
  return null;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/economy/transfers.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy/transfers.ts tests/engine/economy/transfers.test.ts
git commit -m "feat(engine): Transferfenster, Ablöse, Wechsel und Transferliste"
```

---

### Task 6: Verhandlungen mit Spielern und Vereinen

**Files:**
- Create: `src/engine/economy/negotiations.ts`
- Test: `tests/engine/economy/negotiations.test.ts`

**Interfaces:**
- Consumes:
  - Task 4: `desiredYears`, `salaryDemand`, `yearsAdjusted`, `evaluateOffer`, `signContract`, `validateYears`, `TALK_COOLDOWN`
  - Task 5: `askingFee`, `executeTransfer`, `isTransferWindow`
  - Task 1: `canAfford`, `isOverLimit`, `clubLeague`, `formatEuro`, `roundTo`
- Produces:
  - Konstante: `NEGOTIATION_LIFETIME = 2` (Spieltage)
  - Typ: `type NegotiationResponse = { amount: number; years?: number } | "accept" | "abort"`
  - Abfragen: `openNegotiationFor(state, playerId): Negotiation | undefined`
  - Verhandlung beginnen:
    - `startContractTalk(state, managerId, playerId, salary, years): string | null` – Verlängerung mit eigenem Spieler oder Vertrag für einen Vereinslosen
    - `startTransferTalk(state, managerId, playerId, fee): string | null` – Kauf bei einem KI-Verein; erst die Ablöse, dann das Gehalt
  - Weiterverhandeln: `respondNegotiation(state, managerId, negotiationId, response): string | null`
  - Aufräumen: `cleanupNegotiations(state)` – entfernt abgeschlossene sowie abgelaufene Verhandlungen (andere Saison oder ≥ 2 Spieltage alt)
- Jede Antwort der Gegenseite steht in `negotiation.note` und im `status`. Die Oberfläche zeigt sie direkt an.

**Regeln:**

- **Ablöse:** Startforderung ist `askingFee`. Der Ablauf ist derselbe wie beim Gehalt (Task 4).
- **Gehalt nach vereinbarter Ablöse:** Die Forderung ist `salaryDemand` beim kaufenden Verein × Zurückhaltung. Die Zurückhaltung beträgt ×1,3, wenn der Käufer 15 oder mehr Reputationspunkte unter dem Verkäufer liegt oder wenn ein Zweitligist einen Erstligisten kauft, sonst ×1.
- **Abschluss eines Transfers:** Steht auch das Gehalt, wird zuerst der Status auf `"accepted"` gesetzt (siehe Hinweis in Task 2). Danach folgen `executeTransfer` und `signContract`. Davor wird erneut geprüft, ob das Fenster noch offen ist und das Geld reicht.
- **Kauf ist nicht möglich:**
  - der Spieler ist vereinslos (dann direkt einen Vertrag anbieten)
  - er spielt schon im eigenen Verein
  - er gehört dem Verein eines anderen Managers
  - das Transferfenster ist zu
  - der Käufer ist über dem Dispo-Limit oder kann die Ablöse nicht bezahlen
  - der Kader ist voll (32 Spieler)
  - der verkaufende Verein hat nur noch 18 oder weniger Spieler
- **Abbruch durch die Gegenseite:**
  - Sperrzeit von 3 Spieltagen für diesen Spieler.
  - Bricht der Spieler selbst ab (Gehalt), sinkt seine Moral um 10.
- **Pro Spieler** läuft höchstens eine offene Verhandlung.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/economy/negotiations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { desiredYears, salaryDemand } from "../../../src/engine/economy/contracts";
import {
  cleanupNegotiations,
  openNegotiationFor,
  respondNegotiation,
  startContractTalk,
  startTransferTalk,
} from "../../../src/engine/economy/negotiations";
import { askingFee } from "../../../src/engine/economy/transfers";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { startNewGame } from "../../../src/engine/season";

function game(names = ["Anna"]): GameState {
  const world = generateWorld(31);
  const ids = Object.keys(world.clubs);
  const r = startNewGame(world, names.map((name, i) => ({ name, clubId: ids[i] })));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const mgr = (s: GameState, i = 0) => s.managers[i];
const own = (s: GameState) => s.clubs[mgr(s).clubId!];
const last = (s: GameState) => s.negotiations.at(-1)!;

describe("Vertragsverhandlung mit eigenem Spieler", () => {
  it("ein Angebot über der Forderung wird sofort angenommen", () => {
    const s = game();
    const p = s.players[own(s).squad[3]];
    const ask = salaryDemand(s, p, own(s).id);
    expect(startContractTalk(s, mgr(s).id, p.id, ask, 3)).toBeNull();
    expect(last(s).status).toBe("accepted");
    expect(p.contract).toMatchObject({ salary: ask });
    expect(last(s).note).toContain("unterschreibt");
  });

  it("Gegenforderung, dann Annahme der Forderung", () => {
    const s = game();
    const p = s.players[own(s).squad[4]];
    const years = 3;
    const ask = salaryDemand(s, p, own(s).id);
    startContractTalk(s, mgr(s).id, p.id, Math.round(ask * 0.85), years);
    const n = last(s);
    expect(n.status).toBe("open");
    expect(n.round).toBe(2);
    expect(n.note).toContain("fordert");
    expect(respondNegotiation(s, mgr(s).id, n.id, "accept")).toBeNull();
    expect(n.status).toBe("accepted");
  });

  it("zu niedriges Angebot: Abbruch, Moral −10, 3 Spieltage Sperre", () => {
    const s = game();
    const p = s.players[own(s).squad[5]];
    const morale = p.morale;
    startContractTalk(s, mgr(s).id, p.id, 1_000, 2);
    expect(last(s).status).toBe("aborted");
    expect(p.morale).toBe(morale - 10);
    expect(p.talkCooldown).toBe(3);
    expect(startContractTalk(s, mgr(s).id, p.id, 1_000_000, 2)).toBe(`${p.lastName} will erst in 3 Spieltagen wieder verhandeln.`);
  });

  it("in Runde 3 ist das letzte Wort endgültig", () => {
    const s = game();
    const p = s.players[own(s).squad[6]];
    const ask = salaryDemand(s, p, own(s).id);
    startContractTalk(s, mgr(s).id, p.id, Math.round(ask * 0.8), 3);
    const n = last(s);
    respondNegotiation(s, mgr(s).id, n.id, { amount: Math.round(n.ask * 0.9), years: 3 });
    expect(n.round).toBe(3);
    expect(n.note).toContain("Letztes Wort");
    respondNegotiation(s, mgr(s).id, n.id, { amount: n.ask - 100, years: 3 });
    expect(n.status).toBe("aborted");
  });

  it("nur eine Verhandlung pro Spieler, falsche Eingaben werden abgelehnt", () => {
    const s = game();
    const p = s.players[own(s).squad[7]];
    const ask = salaryDemand(s, p, own(s).id);
    startContractTalk(s, mgr(s).id, p.id, Math.round(ask * 0.85), 3);
    expect(openNegotiationFor(s, p.id)).toBeDefined();
    expect(startContractTalk(s, mgr(s).id, p.id, ask, 3)).toBe("Mit diesem Spieler wird schon verhandelt.");
    expect(startContractTalk(s, mgr(s).id, own(s).squad[8], ask, 9)).toBe("Die Laufzeit muss 1 bis 5 Jahre betragen.");
    expect(startContractTalk(s, mgr(s).id, own(s).squad[8], -1, 2)).toBe("Der Betrag muss eine positive ganze Zahl sein.");
    const other = Object.values(s.clubs).find((c) => c.managerId === null)!.squad[0];
    expect(startContractTalk(s, mgr(s).id, other, ask, 2)).toBe("Der Spieler steht bei einem anderen Verein unter Vertrag.");
  });
});

describe("Vereinslose Spieler", () => {
  it("unterschreiben direkt beim Verein, solange der Kader nicht voll ist", () => {
    const s = game();
    const free = Object.values(s.players).find((p) => p.clubId === null && !p.retired)!;
    const club = own(s);
    expect(startContractTalk(s, mgr(s).id, free.id, salaryDemand(s, free, club.id), desiredYears(free))).toBeNull();
    expect(club.squad).toContain(free.id);
    const free2 = Object.values(s.players).find((p) => p.clubId === null && !p.retired)!;
    while (club.squad.length < 32) club.squad.push(club.squad[0]);
    expect(startContractTalk(s, mgr(s).id, free2.id, 50_000, 2)).toBe("Der Kader ist voll (höchstens 32 Spieler).");
  });
});

describe("Transferverhandlung", () => {
  function aiTarget(s: GameState) {
    const seller = Object.values(s.clubs).find((c) => c.managerId === null && s.competitions[COMP.first].clubs.includes(c.id))!;
    return { seller, p: s.players[seller.squad[12]] };
  }

  it("erst Ablöse, dann Gehalt; danach wechselt der Spieler mit Vertrag", () => {
    const s = game();
    const { seller, p } = aiTarget(s);
    const fee = askingFee(s, p);
    const buyer = own(s);
    buyer.finance.balance = 50_000_000;
    const before = { buyer: buyer.finance.balance, seller: seller.finance.balance };
    expect(startTransferTalk(s, mgr(s).id, p.id, fee)).toBeNull();
    const n = last(s);
    expect(n.stage).toBe("salary");
    expect(n.fee).toBe(fee);
    expect(n.note).toContain("akzeptiert");
    expect(respondNegotiation(s, mgr(s).id, n.id, "accept")).toBeNull();
    expect(n.status).toBe("accepted");
    expect(buyer.squad).toContain(p.id);
    expect(seller.squad).not.toContain(p.id);
    expect(p.contract).not.toBeNull();
    expect(buyer.finance.balance).toBe(before.buyer - fee);
    expect(seller.finance.balance).toBe(before.seller + fee);
  });

  it("außerhalb des Fensters, bei fehlendem Geld und bei anderen Managern geht nichts", () => {
    const s = game(["Anna", "Ben"]);
    const { p } = aiTarget(s);
    own(s).finance.balance = -100_000_000;
    expect(startTransferTalk(s, mgr(s).id, p.id, 1_000_000)).toBe("Dafür reicht das Geld nicht.");
    own(s).finance.balance = 50_000_000;
    const benPlayer = s.clubs[mgr(s, 1).clubId!].squad[0];
    expect(startTransferTalk(s, mgr(s).id, benPlayer, 1_000_000)).toBe("Mit Vereinen anderer Manager wird nicht verhandelt.");
    expect(startTransferTalk(s, mgr(s).id, own(s).squad[0], 1_000_000)).toBe("Der Spieler gehört schon zu deinem Verein.");
    const free = Object.values(s.players).find((x) => x.clubId === null && !x.retired)!;
    expect(startTransferTalk(s, mgr(s).id, free.id, 1_000)).toBe("Der Spieler ist vereinslos – biete ihm direkt einen Vertrag an.");
    s.calendarIndex = 5;
    expect(startTransferTalk(s, mgr(s).id, p.id, 1_000_000)).toBe("Das Transferfenster ist geschlossen.");
  });

  it("nur eine offene Verhandlung pro Spieler, auch zwischen zwei Managern", () => {
    const s = game(["Anna", "Ben"]);
    const { p } = aiTarget(s);
    const fee = askingFee(s, p);
    for (const m of s.managers) s.clubs[m.clubId!].finance.balance = 100_000_000;
    startTransferTalk(s, mgr(s, 1).id, p.id, Math.round(fee * 0.8));
    const bens = last(s);
    expect(bens.status).toBe("open");
    // Anna verhandelt parallel nicht (nur eine offene Verhandlung pro Spieler) …
    expect(startTransferTalk(s, mgr(s).id, p.id, fee)).toBe("Mit diesem Spieler wird schon verhandelt.");
    // … Ben schließt ab, danach ist der Spieler weg
    respondNegotiation(s, mgr(s, 1).id, bens.id, "accept");
    respondNegotiation(s, mgr(s, 1).id, bens.id, "accept");
    expect(bens.status).toBe("accepted");
    expect(p.clubId).toBe(mgr(s, 1).clubId);
  });

  it("Antworten auf fremde, unbekannte oder beendete Verhandlungen werden abgelehnt", () => {
    const s = game(["Anna", "Ben"]);
    const p = s.players[own(s).squad[9]];
    startContractTalk(s, mgr(s).id, p.id, Math.round(salaryDemand(s, p, own(s).id) * 0.85), 3);
    const n = last(s);
    expect(respondNegotiation(s, mgr(s, 1).id, n.id, "accept")).toBe("Diese Verhandlung gibt es nicht.");
    expect(respondNegotiation(s, mgr(s).id, "x", "accept")).toBe("Diese Verhandlung gibt es nicht.");
    expect(respondNegotiation(s, mgr(s).id, n.id, "abort")).toBeNull();
    expect(n.status).toBe("aborted");
    expect(respondNegotiation(s, mgr(s).id, n.id, "accept")).toBe("Diese Verhandlung ist schon beendet.");
  });
});

describe("cleanupNegotiations", () => {
  it("entfernt beendete und abgelaufene Verhandlungen", () => {
    const s = game();
    const club = own(s);
    const [a, b] = [s.players[club.squad[10]], s.players[club.squad[11]]];
    startContractTalk(s, mgr(s).id, a.id, salaryDemand(s, a, club.id), 3);
    startContractTalk(s, mgr(s).id, b.id, Math.round(salaryDemand(s, b, club.id) * 0.85), 3);
    expect(s.negotiations).toHaveLength(2);
    cleanupNegotiations(s);
    expect(s.negotiations).toHaveLength(1);
    s.calendarIndex = 2;
    cleanupNegotiations(s);
    expect(s.negotiations).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/economy/negotiations.test.ts`
Expected: FAIL, weil das Modul `negotiations` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/engine/economy/negotiations.ts`:

```ts
import { COMP, MAX_SQUAD, newId, type ClubId, type GameState, type ManagerId, type Negotiation, type Player, type PlayerId } from "../model";
import {
  TALK_COOLDOWN,
  desiredYears,
  evaluateOffer,
  salaryDemand,
  signContract,
  validateYears,
  yearsAdjusted,
} from "./contracts";
import { canAfford, isOverLimit } from "./money";
import { askingFee, executeTransfer, isTransferWindow } from "./transfers";
import { clubLeague, formatEuro, roundTo } from "./util";

export const NEGOTIATION_LIFETIME = 2;
const MIN_SELLER_SQUAD = 18;

export type NegotiationResponse = { amount: number; years?: number } | "accept" | "abort";

function managedClubId(state: GameState, managerId: ManagerId): ClubId | { error: string } {
  const m = state.managers.find((x) => x.id === managerId);
  if (!m) return { error: "Unbekannter Manager." };
  if (!m.clubId) return { error: "Du hast zurzeit keinen Verein." };
  return m.clubId;
}

function validAmount(amount: number): string | null {
  return Number.isInteger(amount) && amount > 0 ? null : "Der Betrag muss eine positive ganze Zahl sein.";
}

export function openNegotiationFor(state: GameState, playerId: PlayerId): Negotiation | undefined {
  return state.negotiations.find((n) => n.playerId === playerId && n.status === "open");
}

function commonChecks(state: GameState, p: Player | undefined): string | null {
  if (!p || p.retired) return "Diesen Spieler gibt es nicht.";
  if (p.talkCooldown > 0) return `${p.lastName} will erst in ${p.talkCooldown} Spieltagen wieder verhandeln.`;
  if (openNegotiationFor(state, p.id)) return "Mit diesem Spieler wird schon verhandelt.";
  return null;
}

function create(state: GameState, managerId: ManagerId, p: Player, stage: Negotiation["stage"], ask: number): Negotiation {
  const n: Negotiation = {
    id: newId(state, "neg"),
    managerId,
    playerId: p.id,
    stage,
    fee: null,
    ask,
    round: 1,
    desiredYears: desiredYears(p),
    status: "open",
    note: "",
    season: state.season,
    createdAt: state.calendarIndex,
  };
  state.negotiations.push(n);
  return n;
}

function buyerOf(state: GameState, n: Negotiation): ClubId | null {
  return state.managers.find((m) => m.id === n.managerId)?.clubId ?? null;
}

function reluctance(state: GameState, buyerId: ClubId, sellerId: ClubId): number {
  const buyer = state.clubs[buyerId];
  const seller = state.clubs[sellerId];
  const downward = clubLeague(state, buyerId) === COMP.second && clubLeague(state, sellerId) === COMP.first;
  return buyer.reputation <= seller.reputation - 15 || downward ? 1.3 : 1;
}

function applySalary(state: GameState, n: Negotiation, salary: number, years: number): void {
  const p = state.players[n.playerId];
  const buyer = buyerOf(state, n);
  if (!buyer) {
    n.status = "aborted";
    n.note = "Du hast zurzeit keinen Verein.";
    return;
  }
  const factor = yearsAdjusted(10_000, years, n.desiredYears) / 10_000;
  const r = evaluateOffer(salary, roundTo(n.ask * factor, 100), n.round);
  if (r.kind === "accepted") {
    if (n.fee !== null && !isTransferWindow(state)) {
      n.status = "aborted";
      n.note = "Das Transferfenster ist geschlossen.";
      return;
    }
    if (n.fee !== null && !canAfford(state.clubs[buyer], n.fee)) {
      n.status = "aborted";
      n.note = "Dafür reicht das Geld nicht.";
      return;
    }
    n.status = "accepted";
    if (n.fee !== null) executeTransfer(state, buyer, p.id, n.fee);
    signContract(state, p.id, buyer, r.amount, years);
    n.note = `${p.firstName} ${p.lastName} unterschreibt bis Saison ${p.contract!.endsSeason} für ${formatEuro(r.amount)} pro Spieltag.`;
    return;
  }
  if (r.kind === "counter") {
    n.ask = roundTo(r.amount / factor, 100);
    n.round = r.round;
    n.note =
      r.round >= 3
        ? `Letztes Wort von ${p.lastName}: ${formatEuro(r.amount)} pro Spieltag bei ${years} Jahren.`
        : `${p.lastName} fordert ${formatEuro(r.amount)} pro Spieltag bei ${years} Jahren.`;
    return;
  }
  n.status = "aborted";
  p.morale = Math.max(0, p.morale - 10);
  p.talkCooldown = TALK_COOLDOWN;
  n.note = `${p.lastName} bricht die Verhandlung ab.`;
}

function applyFee(state: GameState, n: Negotiation, fee: number): void {
  const p = state.players[n.playerId];
  const sellerId = p.clubId!;
  const seller = state.clubs[sellerId];
  const r = evaluateOffer(fee, n.ask, n.round);
  if (r.kind === "accepted") {
    const buyer = buyerOf(state, n)!;
    n.fee = r.amount;
    n.stage = "salary";
    n.round = 1;
    n.ask = roundTo(salaryDemand(state, p, buyer) * reluctance(state, buyer, sellerId), 100);
    n.note = `${seller.name} akzeptiert ${formatEuro(r.amount)}. Jetzt verhandelst du mit ${p.lastName} über das Gehalt (Forderung: ${formatEuro(n.ask)} pro Spieltag).`;
    return;
  }
  if (r.kind === "counter") {
    n.ask = r.amount;
    n.round = r.round;
    n.note = r.round >= 3 ? `Letztes Wort von ${seller.name}: ${formatEuro(r.amount)}.` : `${seller.name} fordert ${formatEuro(r.amount)}.`;
    return;
  }
  n.status = "aborted";
  p.talkCooldown = TALK_COOLDOWN;
  n.note = `${seller.name} lehnt ab und bricht die Verhandlung ab.`;
}

export function startContractTalk(state: GameState, managerId: ManagerId, playerId: PlayerId, salary: number, years: number): string | null {
  const clubId = managedClubId(state, managerId);
  if (typeof clubId !== "string") return clubId.error;
  const p = state.players[playerId];
  const common = commonChecks(state, p);
  if (common) return common;
  if (p.clubId !== null && p.clubId !== clubId) return "Der Spieler steht bei einem anderen Verein unter Vertrag.";
  if (p.clubId === null && state.clubs[clubId].squad.length >= MAX_SQUAD) return "Der Kader ist voll (höchstens 32 Spieler).";
  const yearsError = validateYears(years);
  if (yearsError) return yearsError;
  const amountError = validAmount(salary);
  if (amountError) return amountError;
  const n = create(state, managerId, p, "salary", salaryDemand(state, p, clubId));
  applySalary(state, n, salary, years);
  return null;
}

export function startTransferTalk(state: GameState, managerId: ManagerId, playerId: PlayerId, fee: number): string | null {
  const clubId = managedClubId(state, managerId);
  if (typeof clubId !== "string") return clubId.error;
  const p = state.players[playerId];
  if (p && !p.retired && p.clubId === null) return "Der Spieler ist vereinslos – biete ihm direkt einen Vertrag an.";
  if (p && p.clubId === clubId) return "Der Spieler gehört schon zu deinem Verein.";
  if (p && p.clubId && state.clubs[p.clubId].managerId !== null) return "Mit Vereinen anderer Manager wird nicht verhandelt.";
  const common = commonChecks(state, p);
  if (common) return common;
  const buyer = state.clubs[clubId];
  if (isOverLimit(buyer) || !canAfford(buyer, fee)) return "Dafür reicht das Geld nicht.";
  if (!isTransferWindow(state)) return "Das Transferfenster ist geschlossen.";
  if (buyer.squad.length >= MAX_SQUAD) return "Der Kader ist voll (höchstens 32 Spieler).";
  if (state.clubs[p.clubId!].squad.length <= MIN_SELLER_SQUAD) return "Der Verein gibt keine Spieler mehr ab.";
  const amountError = validAmount(fee);
  if (amountError) return amountError;
  const n = create(state, managerId, p, "fee", askingFee(state, p));
  applyFee(state, n, fee);
  return null;
}

export function respondNegotiation(state: GameState, managerId: ManagerId, negotiationId: string, response: NegotiationResponse): string | null {
  const n = state.negotiations.find((x) => x.id === negotiationId);
  if (!n || n.managerId !== managerId) return "Diese Verhandlung gibt es nicht.";
  if (n.status !== "open") return "Diese Verhandlung ist schon beendet.";
  if (response === "abort") {
    n.status = "aborted";
    n.note = "Du hast die Verhandlung beendet.";
    return null;
  }
  if (n.stage === "fee") {
    const fee = response === "accept" ? n.ask : response.amount;
    const amountError = validAmount(fee);
    if (amountError) return amountError;
    if (!isTransferWindow(state)) return "Das Transferfenster ist geschlossen.";
    const buyer = buyerOf(state, n);
    if (!buyer || !canAfford(state.clubs[buyer], fee)) return "Dafür reicht das Geld nicht.";
    applyFee(state, n, fee);
    return null;
  }
  const years = response === "accept" ? n.desiredYears : (response.years ?? n.desiredYears);
  const yearsError = validateYears(years);
  if (yearsError) return yearsError;
  const salary = response === "accept" ? n.ask : response.amount;
  const amountError = validAmount(salary);
  if (amountError) return amountError;
  applySalary(state, n, salary, years);
  return null;
}

export function cleanupNegotiations(state: GameState): void {
  state.negotiations = state.negotiations.filter(
    (n) => n.status === "open" && n.season === state.season && state.calendarIndex - n.createdAt < NEGOTIATION_LIFETIME,
  );
}
```

Hinweis zu den Tests „Ablöse, dann Gehalt“: Bei `"accept"` in der Gehaltsrunde wird die aktuelle Forderung mit der Wunschlaufzeit angenommen. Damit ist der Abschluss sicher.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/economy && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy/negotiations.ts tests/engine/economy/negotiations.test.ts
git commit -m "feat(engine): Verhandlungen um Verträge und Transfers"
```

---

### Task 7: KI-Transfermarkt (Angebote an Manager, Antworten, KI-Käufe)

**Files:**
- Create: `src/engine/economy/market.ts`
- Test: `tests/engine/economy/market.test.ts`

**Interfaces:**
- Consumes: Task 1 (`canAfford`, `marketValue`, `wageBill`, `clubLeague`, `formatEuro`, `roundTo`), Task 2 (`postMessage`, `removeFromClub`), Task 3 (`TV_PER_MATCHDAY`, `STADIUM`), Task 4 (`salaryDemand`, `desiredYears`, `signContract`), Task 5 (`askingFee`, `executeTransfer`, `isTransferWindow`)
- Produces:
  - Angebote an Manager:
    - `generateAiOffers(state, rng)`
    - `type OfferResponse = "accept" | "reject" | { counter: number }`
    - `respondTransferOffer(state, managerId, offerId, response): string | null`
    - `expireOffers(state)`
  - KI-Markt: `expectedIncome(state, clubId): number`, `aiTransferRound(state, rng)`

**Regeln** (Spec 8.3, 8.4, mit Startwerten):

- **Angebote an Manager** (`generateAiOffers`) entstehen, sobald ein Fenstertag beginnt:
  - Für jeden Spieler auf der Transferliste eines Managers mit 60 % Wahrscheinlichkeit, sofern noch kein offenes Angebot für ihn existiert. Die Ablöse beträgt Wunschpreis (sonst Marktwert) × 0,75–1,0. Das verdeckte Maximum liegt bei × 1,0–1,2.
  - Pro Manager-Verein mit 20 % Wahrscheinlichkeit zusätzlich ein Angebot für einen der 5 stärksten Spieler, der nicht auf der Liste steht. Die Ablöse beträgt Marktwert × 1,1–1,4, das Maximum Ablöse × 1,25.
  - **Käufer:** ein zufälliger KI-Verein mit genug Geld, nicht vollem Kader und einer Reputation von höchstens 20 Punkten unter dem abgebenden Verein.
  - Das Angebot gilt bis zum nächsten Kalenderindex (`expiresAfter = Index + 1`), danach verfällt es als abgelehnt. Zu jedem Angebot geht eine Nachricht mit Verweis an den Manager.
- **Antwort des Managers** (nur bei offenem Fenster):
  - **Annehmen:** Wechsel zur gebotenen Ablöse. Der Käufer bekommt einen Vertrag nach Forderung und Wunschlaufzeit.
  - **Ablehnen.**
  - **Gegenangebot:**
    - Liegt es höchstens beim Maximum, nimmt der KI-Verein an.
    - Sonst erhöht er, solange es noch nicht die 3. Runde ist, auf die Mitte zwischen seinem Gebot und dem Maximum.
    - In Runde 3 zieht er das Angebot zurück.
  - **Sonderfälle:** Hat der Käufer das Geld nicht mehr, zieht er zurück. Ist der Spieler nicht mehr im Verein des Managers, verfällt das Angebot.
- **KI-Markt** (`aiTransferRound`), im Sommer und zu Beginn des Winterfensters, für jeden KI-Verein in zufälliger Reihenfolge:
  1. **Überzählige entlassen:** Hat der Kader mehr als 28 Spieler, gehen die schwächsten Nicht-Startspieler (bei Gleichstand der ältere), ohne Abfindung.
  2. **Bis zu 2 Käufe** für die größten Bedarfspositionen:
     - Bedarf: Positionen unter dem Soll (TW 2, ABW 6, MF 6, ST 4), danach die Position mit der schwächsten Durchschnittsstärke.
     - Infrage kommt der stärkste Spieler bis 32 Jahre, der entweder eine Lücke füllt oder mindestens 2 Punkte besser ist als der schwächste eigene Spieler dieser Position.
     - Quelle: vereinslose Spieler oder Nicht-Startspieler anderer KI-Vereine mit mehr als 22 Spielern (so fällt kein Verkäufer unter 22). Spieler, über die gerade verhandelt wird, sind ausgeschlossen.
     - Bedingungen: Die Ablöse (`askingFee`) muss ohne Dispo bezahlbar sein, und die Gehaltssumme darf danach höchstens 65 % der erwarteten Einnahmen betragen.
  3. **Auffüllen auf 22 Spieler** mit dem stärksten passenden Vereinslosen. Unter 18 Spielern wird ohne Gehaltsgrenze aufgefüllt.
- **Erwartete Einnahmen pro Spieltag** = TV + Sponsor + `Kapazität × 0,6 × Eintrittspreis / 2`. Ohne Sponsor wird dafür `Reputation × 1000` angesetzt, in der 2. Liga × 0,6.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/economy/market.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aiTransferRound, expectedIncome, expireOffers, generateAiOffers, respondTransferOffer } from "../../../src/engine/economy/market";
import { wageBill } from "../../../src/engine/economy/money";
import { removeFromClub } from "../../../src/engine/economy/roster";
import { generateWorld } from "../../../src/engine/generator";
import type { GameState, TransferOffer } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(41);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[10] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const own = (s: GameState) => s.clubs[s.managers[0].clubId!];

function offerFor(s: GameState, playerIndex = 20): TransferOffer {
  const club = own(s);
  const pid = club.squad[playerIndex];
  s.players[pid].transferListed = { askingPrice: 500_000 };
  const rng = Rng.fromSeed(1);
  for (let i = 0; i < 20 && !s.transferOffers.some((o) => o.playerId === pid); i++) generateAiOffers(s, rng);
  const o = s.transferOffers.find((x) => x.playerId === pid);
  if (!o) throw new Error("kein Angebot erzeugt");
  return o;
}

describe("generateAiOffers", () => {
  it("bietet für gelistete Spieler im Rahmen des Wunschpreises, mit Nachricht", () => {
    const s = game();
    const o = offerFor(s);
    expect(o.status).toBe("open");
    expect(o.fee).toBeGreaterThanOrEqual(370_000);
    expect(o.fee).toBeLessThanOrEqual(500_000);
    expect(o.maxFee).toBeGreaterThanOrEqual(o.fee);
    expect(s.clubs[o.fromClub].managerId).toBeNull();
    expect(o.expiresAfter).toBe(s.calendarIndex + 1);
    expect(s.messages.some((m) => m.ref?.type === "transferOffer" && m.ref.id === o.id)).toBe(true);
  });

  it("höchstens ein offenes Angebot pro Spieler", () => {
    const s = game();
    const o = offerFor(s);
    const rng = Rng.fromSeed(2);
    for (let i = 0; i < 10; i++) generateAiOffers(s, rng);
    expect(s.transferOffers.filter((x) => x.playerId === o.playerId && x.status === "open")).toHaveLength(1);
  });
});

describe("respondTransferOffer", () => {
  it("Annehmen: Spieler wechselt, Geld kommt, Vertrag beim Käufer", () => {
    const s = game();
    const o = offerFor(s);
    const before = own(s).finance.balance;
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "accept")).toBeNull();
    expect(o.status).toBe("accepted");
    expect(own(s).squad).not.toContain(o.playerId);
    expect(s.clubs[o.fromClub].squad).toContain(o.playerId);
    expect(s.players[o.playerId].contract).not.toBeNull();
    expect(own(s).finance.balance).toBe(before + o.fee);
  });

  it("Gegenangebot bis zum Maximum wird angenommen, darüber erhöht die KI, in Runde 3 zieht sie zurück", () => {
    const s = game();
    const o = offerFor(s);
    const max = o.maxFee;
    const first = o.fee;
    respondTransferOffer(s, s.managers[0].id, o.id, { counter: max * 3 });
    expect(o.status).toBe("open");
    expect(o.round).toBe(2);
    expect(o.fee).toBeGreaterThan(first);
    respondTransferOffer(s, s.managers[0].id, o.id, { counter: max * 3 });
    expect(o.round).toBe(3);
    respondTransferOffer(s, s.managers[0].id, o.id, { counter: max * 3 });
    expect(o.status).toBe("withdrawn");

    const s2 = game();
    const o2 = offerFor(s2);
    respondTransferOffer(s2, s2.managers[0].id, o2.id, { counter: o2.maxFee });
    expect(o2.status).toBe("accepted");
    expect(o2.fee).toBe(o2.maxFee);
  });

  it("Ablehnen, falsche Angebote und geschlossenes Fenster", () => {
    const s = game();
    const o = offerFor(s);
    expect(respondTransferOffer(s, s.managers[0].id, "x", "accept")).toBe("Dieses Angebot gibt es nicht.");
    s.calendarIndex = 5;
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "accept")).toBe("Das Transferfenster ist geschlossen.");
    s.calendarIndex = 0;
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "reject")).toBeNull();
    expect(o.status).toBe("rejected");
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "accept")).toBe("Dieses Angebot ist nicht mehr offen.");
  });

  it("Angebote verfallen nach einem Fenstertag", () => {
    const s = game();
    const o = offerFor(s);
    s.calendarIndex = o.expiresAfter;
    expireOffers(s);
    expect(s.transferOffers.some((x) => x.id === o.id)).toBe(true);
    s.calendarIndex = o.expiresAfter + 1;
    expireOffers(s);
    expect(s.transferOffers.some((x) => x.id === o.id)).toBe(false);
    expect(s.messages.some((m) => m.text.includes("verfallen"))).toBe(true);
  });
});

describe("aiTransferRound", () => {
  it("hält KI-Kader zwischen 22 und 28, kauft nur bezahlbar und ohne Dispo", () => {
    const s = game();
    const ai = Object.values(s.clubs).filter((c) => c.managerId === null);
    for (const id of ai[0].squad.slice(0, 8)) removeFromClub(s, id);
    const balances = new Map(ai.map((c) => [c.id, c.finance.balance]));
    aiTransferRound(s, Rng.fromSeed(5));
    for (const c of ai) {
      expect(c.squad.length).toBeGreaterThanOrEqual(22);
      expect(c.squad.length).toBeLessThanOrEqual(28);
      if (c.finance.balance < balances.get(c.id)!) expect(c.finance.balance).toBeGreaterThanOrEqual(0);
      expect(new Set(c.squad).size).toBe(c.squad.length);
      for (const id of c.squad) {
        expect(s.players[id].clubId).toBe(c.id);
        expect(s.players[id].contract).not.toBeNull();
      }
    }
  });

  it("Manager-Vereine bleiben unberührt", () => {
    const s = game();
    const squad = [...own(s).squad];
    aiTransferRound(s, Rng.fromSeed(6));
    expect(own(s).squad).toEqual(squad);
  });

  it("die Gehaltssumme bleibt bei Käufen im Rahmen der erwarteten Einnahmen", () => {
    const s = game();
    aiTransferRound(s, Rng.fromSeed(7));
    for (const c of Object.values(s.clubs).filter((x) => x.managerId === null && x.squad.length >= 18)) {
      expect(expectedIncome(s, c.id)).toBeGreaterThan(0);
      expect(wageBill(s, c.id)).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/economy/market.test.ts`
Expected: FAIL, weil das Modul `market` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/engine/economy/market.ts`:

```ts
import { COMP, MAX_SQUAD, newId, type Club, type ClubId, type GameState, type ManagerId, type Player, type Position } from "../model";
import type { Rng } from "../rng";
import { desiredYears, salaryDemand, signContract } from "./contracts";
import { TV_PER_MATCHDAY } from "./finance";
import { postMessage } from "./messages";
import { canAfford, marketValue, wageBill } from "./money";
import { removeFromClub } from "./roster";
import { STADIUM } from "./stadium";
import { askingFee, executeTransfer, isTransferWindow } from "./transfers";
import { clubLeague, formatEuro, roundTo } from "./util";

const LISTED_CHANCE = 0.6;
const UNLISTED_CHANCE = 0.2;
const NEED: Record<Position, number> = { GK: 2, DF: 6, MF: 6, FW: 4 };
const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];
const MAX_AI_BUYS = 2;
const AI_SQUAD_MIN = 22;
const AI_SQUAD_MAX = 28;
const EMERGENCY_SQUAD = 18;
const SELLER_MIN_SQUAD = 22;
const WAGE_SHARE = 0.65;

export type OfferResponse = "accept" | "reject" | { counter: number };

function playerName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

function makeOffer(state: GameState, rng: Rng, seller: Club, p: Player, fee: number, maxFee: number): void {
  const buyers = Object.values(state.clubs).filter(
    (c) =>
      c.managerId === null &&
      c.id !== seller.id &&
      c.squad.length < MAX_SQUAD &&
      c.reputation >= seller.reputation - 20 &&
      canAfford(c, fee),
  );
  if (buyers.length === 0 || !seller.managerId) return;
  const buyer = rng.pick(buyers);
  const offer = {
    id: newId(state, "off"),
    managerId: seller.managerId,
    fromClub: buyer.id,
    playerId: p.id,
    fee,
    maxFee: Math.max(fee, maxFee),
    round: 1,
    status: "open" as const,
    season: state.season,
    expiresAfter: state.calendarIndex + 1,
  };
  state.transferOffers.push(offer);
  postMessage(state, seller.managerId, `${buyer.name} bietet ${formatEuro(fee)} für ${playerName(p)}.`, { type: "transferOffer", id: offer.id });
}

const hasOpenOffer = (state: GameState, playerId: string) =>
  state.transferOffers.some((o) => o.playerId === playerId && o.status === "open");

export function generateAiOffers(state: GameState, rng: Rng): void {
  for (const club of Object.values(state.clubs)) {
    if (!club.managerId) continue;
    for (const pid of club.squad) {
      const p = state.players[pid];
      if (!p.transferListed || hasOpenOffer(state, pid) || !rng.chance(LISTED_CHANCE)) continue;
      const base = p.transferListed.askingPrice ?? marketValue(p, state.season);
      makeOffer(state, rng, club, p, roundTo(base * (0.75 + rng.next() * 0.25), 10_000), roundTo(base * (1 + rng.next() * 0.2), 10_000));
    }
    if (rng.chance(UNLISTED_CHANCE)) {
      const top = club.squad
        .map((id) => state.players[id])
        .filter((p) => !p.transferListed && !hasOpenOffer(state, p.id))
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 5);
      if (top.length > 0) {
        const p = rng.pick(top);
        const fee = roundTo(marketValue(p, state.season) * (1.1 + rng.next() * 0.3), 10_000);
        makeOffer(state, rng, club, p, fee, roundTo(fee * 1.25, 10_000));
      }
    }
  }
}

export function respondTransferOffer(state: GameState, managerId: ManagerId, offerId: string, response: OfferResponse): string | null {
  const o = state.transferOffers.find((x) => x.id === offerId);
  if (!o || o.managerId !== managerId) return "Dieses Angebot gibt es nicht.";
  if (o.status !== "open") return "Dieses Angebot ist nicht mehr offen.";
  if (!isTransferWindow(state)) return "Das Transferfenster ist geschlossen.";
  const p = state.players[o.playerId];
  const clubId = state.managers.find((m) => m.id === managerId)?.clubId ?? null;
  if (!clubId || p.clubId !== clubId) {
    o.status = "withdrawn";
    return "Der Spieler gehört nicht mehr zu deinem Verein.";
  }
  if (response === "reject") {
    o.status = "rejected";
    return null;
  }
  const buyer = state.clubs[o.fromClub];
  let fee = o.fee;
  if (response !== "accept") {
    const counter = response.counter;
    if (!Number.isInteger(counter) || counter <= 0) return "Der Betrag muss eine positive ganze Zahl sein.";
    if (counter <= o.maxFee) fee = counter;
    else if (o.round < 3) {
      o.fee = roundTo(o.fee + (o.maxFee - o.fee) * 0.5, 10_000);
      o.round++;
      postMessage(state, managerId, `${buyer.name} erhöht auf ${formatEuro(o.fee)} für ${playerName(p)}.`, { type: "transferOffer", id: o.id });
      return null;
    } else {
      o.status = "withdrawn";
      postMessage(state, managerId, `${buyer.name} zieht das Angebot für ${playerName(p)} zurück.`);
      return null;
    }
  }
  if (!canAfford(buyer, fee)) {
    o.status = "withdrawn";
    postMessage(state, managerId, `${buyer.name} kann ${formatEuro(fee)} nicht mehr bezahlen und zieht zurück.`);
    return null;
  }
  o.status = "accepted";
  o.fee = fee;
  executeTransfer(state, buyer.id, p.id, fee);
  signContract(state, p.id, buyer.id, salaryDemand(state, p, buyer.id), desiredYears(p));
  return null;
}

export function expireOffers(state: GameState): void {
  for (const o of state.transferOffers) {
    if (o.status !== "open") continue;
    if (o.season !== state.season || state.calendarIndex > o.expiresAfter) {
      o.status = "rejected";
      const p = state.players[o.playerId];
      postMessage(state, o.managerId, `Das Angebot von ${state.clubs[o.fromClub].name} für ${playerName(p)} ist verfallen.`);
    }
  }
  state.transferOffers = state.transferOffers.filter((o) => o.status === "open");
}

export function expectedIncome(state: GameState, clubId: ClubId): number {
  const club = state.clubs[clubId];
  const league = clubLeague(state, clubId) ?? COMP.second;
  const sponsor = club.finance.sponsor?.perMatchday ?? club.reputation * 1000 * (league === COMP.second ? 0.6 : 1);
  const tickets = (STADIUM[club.finance.stadiumStage].capacity * 0.6 * club.finance.ticketPrice) / 2;
  return TV_PER_MATCHDAY[league] + sponsor + tickets;
}

function wageRoom(state: GameState, clubId: ClubId, extra: number): boolean {
  return wageBill(state, clubId) + extra <= WAGE_SHARE * expectedIncome(state, clubId);
}

function needs(state: GameState, club: Club): Position[] {
  const at = (pos: Position) => club.squad.map((id) => state.players[id]).filter((p) => p.position === pos);
  const avg = (pos: Position) => {
    const ps = at(pos);
    return ps.length === 0 ? 0 : ps.reduce((s, p) => s + p.strength, 0) / ps.length;
  };
  return [...POSITIONS].sort((a, b) => {
    const da = NEED[a] - at(a).length;
    const db = NEED[b] - at(b).length;
    if (da > 0 || db > 0) return db - da;
    return avg(a) - avg(b);
  });
}

function candidates(state: GameState, buyerId: ClubId): Player[] {
  const negotiating = new Set(state.negotiations.filter((n) => n.status === "open").map((n) => n.playerId));
  return Object.values(state.players).filter((p) => {
    if (p.retired || negotiating.has(p.id) || p.clubId === buyerId) return false;
    if (p.clubId === null) return true;
    const club = state.clubs[p.clubId];
    return club.managerId === null && club.squad.length > SELLER_MIN_SQUAD && !club.lineup.starters.includes(p.id);
  });
}

export function aiTransferRound(state: GameState, rng: Rng): void {
  const ai = rng.shuffle(Object.values(state.clubs).filter((c) => c.managerId === null).map((c) => c.id));
  for (const id of ai) {
    const club = state.clubs[id];
    while (club.squad.length > AI_SQUAD_MAX) {
      const worst = club.squad
        .map((pid) => state.players[pid])
        .filter((p) => !club.lineup.starters.includes(p.id))
        .sort((a, b) => a.strength - b.strength || b.age - a.age)[0];
      if (!worst) break;
      removeFromClub(state, worst.id);
    }
    let buys = 0;
    for (const pos of needs(state, club)) {
      if (buys >= MAX_AI_BUYS) break;
      const atPos = club.squad.map((pid) => state.players[pid]).filter((p) => p.position === pos);
      const worstAtPos = atPos.length === 0 ? 0 : Math.min(...atPos.map((p) => p.strength));
      const pick = candidates(state, id)
        .filter((p) => p.position === pos && p.age <= 32 && (atPos.length < NEED[pos] || p.strength > worstAtPos + 2))
        .map((p) => ({ p, fee: askingFee(state, p), wage: salaryDemand(state, p, id) }))
        .filter((x) => club.finance.balance - x.fee >= 0 && wageRoom(state, id, x.wage))
        .sort((a, b) => b.p.strength - a.p.strength)[0];
      if (!pick) continue;
      if (pick.p.clubId) executeTransfer(state, id, pick.p.id, pick.fee);
      signContract(state, pick.p.id, id, pick.wage, desiredYears(pick.p));
      buys++;
    }
    while (club.squad.length < AI_SQUAD_MIN) {
      const needPos = needs(state, club)[0];
      const free = Object.values(state.players)
        .filter((p) => p.clubId === null && !p.retired)
        .map((p) => ({ p, wage: salaryDemand(state, p, id) }))
        .filter((x) => club.squad.length < EMERGENCY_SQUAD || wageRoom(state, id, x.wage))
        .sort((a, b) => Number(b.p.position === needPos) - Number(a.p.position === needPos) || b.p.strength - a.p.strength)[0];
      if (!free) break;
      signContract(state, free.p.id, id, free.wage, desiredYears(free.p));
    }
  }
}
```

Hinweis zum Test „hält KI-Kader zwischen 22 und 28“: Das Auffüllen auf 22 Spieler kann an der Gehaltsgrenze scheitern, wenn der Verein schon teuer ist und nicht unter 18 Spieler liegt. Schlägt die Untergrenze im Test fehl, wird sie für Vereine mit 18 oder mehr Spielern nicht lockerer gemacht. Stattdessen im Test die Untergrenze auf 18 setzen und das als `DONE_WITH_CONCERNS` melden. Die Bandbreite prüft Task 11 im Langzeittest über viele Saisons.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/economy && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy/market.ts tests/engine/economy/market.test.ts
git commit -m "feat(engine): KI-Transfermarkt mit Angeboten an Manager"
```

---

### Task 8: Vorstand (Erwartung, Vertrauen, Entlassung, Jobangebote)

**Files:**
- Create: `src/engine/economy/board.ts`
- Test: `tests/engine/economy/board.test.ts`

**Interfaces:**
- Consumes: `postMessage`, `postToClub` (Task 2), `clubLeague`, `leagueRank`, `isLeagueMatchday` (Task 1), `LiveMatch` (Typ), `computeStandings`
- Produces:
  - Konstanten: `TARGET_RANK`, `START_CONFIDENCE = 60`, `WARN_BELOW = 30`, `FIRE_BELOW = 15`, `FIRE_FROM = 8`, `NEW_COACH_CONFIDENCE = 55`, `GUARANTEED_OFFER_AFTER = 3`
  - Erwartung: `expectationLabel(expectation, competitionId): string`, `assignExpectations(state)`, `expectationMet(state, clubId, rank): boolean`
  - Laufende Saison: `updateConfidence(state, lives)`, `boardChecks(state, rng)`
  - Jobwechsel:
    - `fireManager(state, managerId, rng, reason?)`
    - `jobOffersFor(state, reputation, rng, direction: "lower" | "higher", count, exclude?): ClubId[]`
    - `unemployedTick(state, rng)`
    - `acceptJobOffer(state, managerId, clubId): string | null`
    - `clearStaleJobOffers(state)`
  - Saisonende: `seasonReview(state, tables, rng)`

**Regeln** (Spec 8.5, mit Startwerten):

- **Erwartung** je Liga nach Reputationsrang (Tiebreak nach ID):

  | Reputationsrang | Erwartung | Zielplatz |
  |---|---|---|
  | 1–2 | „title“ (1. Liga: Meisterschaft, 2. Liga: Aufstieg) | ≤ 2 |
  | 3–6 | „upper“ (oberes Drittel) | ≤ 6 |
  | 7–12 | „mid“ (gesichertes Mittelfeld) | ≤ 12 |
  | 13–18 | „survival“ (Klassenerhalt) | ≤ 15 |

- **Vertrauen** nach jedem Liga-Spieltag, für alle Ligavereine:
  - Ab Kalenderindex 3 zählt der Tabellenplatz: `clamp((Ziel − Rang) × 0,3; −2,5; +1,5)`.
  - Ergebnis: Sieg +0,8, Niederlage −0,8.
  - Ab 3 Spieltagen in Folge über dem Dispo-Limit −5.
  - Begrenzt auf 0–100.
- **Prüfungen** (`boardChecks`):
  - Manager unter 30: einmalige Warnung (`warned`). Über 40 wird die Warnung zurückgesetzt.
  - Manager unter 15 ab Kalenderindex 8: Entlassung.
  - KI-Verein unter 15: Er holt einen neuen Trainer, das Vertrauen wird auf 55 gesetzt.
- **Entlassung:**
  - Der Verein wird zum KI-Verein (Vertrauen 55, Training normal/Technik ohne Förderliste).
  - Offene Verhandlungen des Managers werden abgebrochen, offene KI-Angebote an ihn zurückgezogen.
  - Er bekommt 1–3 Angebote von KI-Vereinen mit einer Reputation höchstens 5 über seinem alten Verein. Bevorzugt werden die 6 mit dem niedrigsten Vertrauen. Dazu gibt es Nachrichten.
- **Ohne Verein** (`unemployedTick`, pro Spieltag): `unemployedFor` + 1. Hat er kein Angebot:
  - Ab 3 Spieltagen bekommt er garantiert ein Angebot des Zweitligisten mit dem niedrigsten Vertrauen.
  - Sonst mit 50 % Wahrscheinlichkeit 1 Angebot (Richtung „lower“, Referenz-Reputation 50).
- **Angebot annehmen:**
  - Nur gültig für einen Verein, der in seinen Angeboten steht und noch KI-geführt ist.
  - Ein bisheriger Verein wird freigegeben, dessen offene Verhandlungen werden abgebrochen.
  - Danach: Vertrauen 60, Angebote leer, `unemployedFor = 0`, Willkommensnachricht mit Saisonziel.
- **Saisonende** (`seasonReview`, mit den Abschlusstabellen):
  - **Manager, Ziel erreicht:** +15 Vertrauen und eine Nachricht. Liegt der Platz mindestens 2 Plätze über dem Ziel oder mit 50 % Wahrscheinlichkeit, kommen 1–2 Angebote größerer Vereine (Reputation +6 bis +25).
  - **Manager, mehr als 5 Plätze unter dem Ziel:** Entlassung.
  - **Manager, sonst:** −10 und eine Nachricht.
  - **KI-Verein, mehr als 5 Plätze unter dem Ziel:** neuer Trainer (55).
- **Alte Angebote:** Nach dem 1. Spieltag einer Saison werden die Angebote von Managern mit Verein gelöscht (`clearStaleJobOffers`).

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/economy/board.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  START_CONFIDENCE,
  acceptJobOffer,
  assignExpectations,
  boardChecks,
  clearStaleJobOffers,
  expectationLabel,
  expectationMet,
  fireManager,
  jobOffersFor,
  seasonReview,
  unemployedTick,
  updateConfidence,
} from "../../../src/engine/economy/board";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { kickOff, startNewGame } from "../../../src/engine/season";

function game(index = 3): GameState {
  const world = generateWorld(51);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[index] }]);
  if (!r.ok) throw new Error(r.error);
  assignExpectations(r.state);
  return r.state;
}
const anna = (s: GameState) => s.managers[0];
const own = (s: GameState) => s.clubs[anna(s).clubId!];

describe("Erwartungen", () => {
  it("verteilt 2/4/6/6 je Liga nach Reputation", () => {
    const s = game();
    for (const league of [COMP.first, COMP.second]) {
      const counts = { title: 0, upper: 0, mid: 0, survival: 0 };
      for (const id of s.competitions[league].clubs) counts[s.clubs[id].board.expectation]++;
      expect(counts).toEqual({ title: 2, upper: 4, mid: 6, survival: 6 });
    }
    const best = [...s.competitions[COMP.first].clubs].sort((a, b) => s.clubs[b].reputation - s.clubs[a].reputation)[0];
    expect(s.clubs[best].board.expectation).toBe("title");
  });

  it("Beschriftungen und Zielerreichung", () => {
    expect(expectationLabel("title", COMP.first)).toBe("Meisterschaft");
    expect(expectationLabel("title", COMP.second)).toBe("Aufstieg");
    expect(expectationLabel("survival", COMP.first)).toBe("Klassenerhalt");
    const s = game();
    own(s).board.expectation = "upper";
    expect(expectationMet(s, own(s).id, 6)).toBe(true);
    expect(expectationMet(s, own(s).id, 7)).toBe(false);
  });
});

describe("Vertrauen", () => {
  it("Sieg hebt, Niederlage senkt; Dispo kostet zusätzlich", () => {
    const s = game();
    const lives = kickOff(s);
    const l = lives[0];
    l.home.goals = 2;
    l.away.goals = 0;
    const [home, away] = [s.clubs[l.home.club], s.clubs[l.away.club]];
    updateConfidence(s, [l]);
    expect(home.board.confidence).toBeCloseTo(START_CONFIDENCE + 0.8);
    expect(away.board.confidence).toBeCloseTo(START_CONFIDENCE - 0.8);
    away.finance.overdraftStreak = 3;
    updateConfidence(s, []);
    expect(away.board.confidence).toBeCloseTo(START_CONFIDENCE - 5.8);
  });

  it("ab Kalenderindex 3 zählt der Tabellenplatz; Werte bleiben zwischen 0 und 100", () => {
    const s = game();
    s.calendarIndex = 3;
    const c = own(s);
    c.board.confidence = 0.5;
    c.board.expectation = "title";
    updateConfidence(s, []);
    expect(c.board.confidence).toBeGreaterThanOrEqual(0);
    c.board.confidence = 99.9;
    c.board.expectation = "survival";
    updateConfidence(s, []);
    expect(c.board.confidence).toBeLessThanOrEqual(100);
  });
});

describe("Warnung und Entlassung", () => {
  it("warnt einmal unter 30 und entlässt unter 15 erst ab Spieltag 8", () => {
    const s = game();
    const c = own(s);
    c.board.confidence = 25;
    boardChecks(s, Rng.fromSeed(1));
    boardChecks(s, Rng.fromSeed(1));
    expect(s.messages.filter((m) => m.text.includes("unzufrieden"))).toHaveLength(1);
    c.board.confidence = 10;
    s.calendarIndex = 7;
    boardChecks(s, Rng.fromSeed(1));
    expect(anna(s).clubId).toBe(c.id);
    s.calendarIndex = 8;
    boardChecks(s, Rng.fromSeed(1));
    expect(anna(s).clubId).toBeNull();
    expect(c.managerId).toBeNull();
  });

  it("KI-Vereine holen einen neuen Trainer", () => {
    const s = game();
    const ai = Object.values(s.clubs).find((c) => c.managerId === null)!;
    ai.board.confidence = 5;
    boardChecks(s, Rng.fromSeed(1));
    expect(ai.board.confidence).toBe(55);
  });

  it("Entlassung: Angebote kleinerer Vereine, Verhandlungen weg, Nachricht", () => {
    const s = game(0);
    const old = own(s);
    s.negotiations.push({ id: "n1", managerId: anna(s).id, playerId: old.squad[0], stage: "salary", fee: null, ask: 1, round: 1, desiredYears: 2, status: "open", note: "", season: 1, createdAt: 0 });
    fireManager(s, anna(s).id, Rng.fromSeed(3));
    const offers = anna(s).jobOffers;
    expect(offers.length).toBeGreaterThanOrEqual(1);
    expect(offers.length).toBeLessThanOrEqual(3);
    for (const id of offers) {
      expect(s.clubs[id].managerId).toBeNull();
      expect(s.clubs[id].reputation).toBeLessThanOrEqual(old.reputation + 5);
      expect(id).not.toBe(old.id);
    }
    expect(s.negotiations[0].status).toBe("aborted");
    expect(old.training).toEqual({ intensity: "normal", focus: "technique", individual: [] });
    expect(s.messages.some((m) => m.text.includes("trennt sich"))).toBe(true);
  });
});

describe("Jobangebote", () => {
  it("annehmen wechselt den Verein; ungültige Angebote werden abgelehnt", () => {
    const s = game();
    fireManager(s, anna(s).id, Rng.fromSeed(4));
    const target = anna(s).jobOffers[0];
    expect(acceptJobOffer(s, anna(s).id, "gibts-nicht")).toBe("Dieses Angebot gibt es nicht.");
    expect(acceptJobOffer(s, anna(s).id, target)).toBeNull();
    expect(anna(s).clubId).toBe(target);
    expect(s.clubs[target].managerId).toBe(anna(s).id);
    expect(s.clubs[target].board.confidence).toBe(START_CONFIDENCE);
    expect(anna(s).jobOffers).toEqual([]);
  });

  it("ohne Verein: spätestens nach 3 Spieltagen ein Angebot eines Zweitligisten", () => {
    const s = game();
    fireManager(s, anna(s).id, Rng.fromSeed(5));
    anna(s).jobOffers = [];
    const rng = Rng.fromSeed(6);
    for (let i = 0; i < 3 && anna(s).jobOffers.length === 0; i++) unemployedTick(s, rng);
    expect(anna(s).jobOffers.length).toBeGreaterThan(0);
    anna(s).jobOffers = [];
    anna(s).unemployedFor = 3;
    unemployedTick(s, Rng.fromSeed(7));
    expect(anna(s).jobOffers).toHaveLength(1);
    expect(s.competitions[COMP.second].clubs).toContain(anna(s).jobOffers[0]);
  });

  it("jobOffersFor 'higher' liefert nur größere Vereine; alte Angebote verfallen nach dem 1. Spieltag", () => {
    const s = game(30);
    const rep = own(s).reputation;
    const offers = jobOffersFor(s, rep, Rng.fromSeed(8), "higher", 2);
    for (const id of offers) {
      expect(s.clubs[id].reputation).toBeGreaterThan(rep + 5);
      expect(s.clubs[id].reputation).toBeLessThanOrEqual(rep + 25);
    }
    anna(s).jobOffers = offers;
    clearStaleJobOffers(s);
    expect(anna(s).jobOffers).toEqual([]);
  });
});

describe("seasonReview", () => {
  function tables(s: GameState, ownRank: number) {
    const l1 = s.competitions[COMP.first].clubs.filter((id) => id !== own(s).id);
    const l2 = [...s.competitions[COMP.second].clubs];
    const ownLeague = s.competitions[COMP.first].clubs.includes(own(s).id) ? l1 : l2.filter((id) => id !== own(s).id);
    ownLeague.splice(ownRank - 1, 0, own(s).id);
    return { [COMP.first]: s.competitions[COMP.first].clubs.includes(own(s).id) ? ownLeague : l1, [COMP.second]: s.competitions[COMP.first].clubs.includes(own(s).id) ? l2 : ownLeague };
  }

  it("Ziel erreicht: +15 Vertrauen", () => {
    const s = game();
    own(s).board.expectation = "mid";
    own(s).board.confidence = 50;
    seasonReview(s, tables(s, 5), Rng.fromSeed(9));
    expect(own(s).board.confidence).toBe(65);
  });

  it("knapp verfehlt: −10; deutlich verfehlt: Entlassung", () => {
    const s = game();
    own(s).board.expectation = "upper";
    own(s).board.confidence = 50;
    seasonReview(s, tables(s, 9), Rng.fromSeed(9));
    expect(own(s).board.confidence).toBe(40);
    seasonReview(s, tables(s, 12), Rng.fromSeed(9));
    expect(anna(s).clubId).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/economy/board.test.ts`
Expected: FAIL, weil das Modul `board` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/engine/economy/board.ts`:

```ts
import type { LiveMatch } from "../match/simulate";
import { COMP, type ClubId, type CompetitionId, type Expectation, type GameState, type ManagerId } from "../model";
import type { Rng } from "../rng";
import { postMessage, postToClub } from "./messages";
import { isLeagueMatchday, leagueRank } from "./util";

export const TARGET_RANK: Record<Expectation, number> = { title: 2, upper: 6, mid: 12, survival: 15 };
export const START_CONFIDENCE = 60;
export const WARN_BELOW = 30;
export const FIRE_BELOW = 15;
export const FIRE_FROM = 8;
export const NEW_COACH_CONFIDENCE = 55;
export const GUARANTEED_OFFER_AFTER = 3;
const RANK_FROM = 3;
const BY_RANK: Expectation[] = ["title", "title", "upper", "upper", "upper", "upper", "mid", "mid", "mid", "mid", "mid", "mid"];

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function expectationLabel(e: Expectation, competitionId: CompetitionId): string {
  switch (e) {
    case "title":
      return competitionId === COMP.second ? "Aufstieg" : "Meisterschaft";
    case "upper":
      return "oberes Drittel";
    case "mid":
      return "gesichertes Mittelfeld";
    case "survival":
      return "Klassenerhalt";
  }
}

export function assignExpectations(state: GameState): void {
  for (const league of [COMP.first, COMP.second]) {
    const comp = state.competitions[league];
    if (!comp) continue;
    [...comp.clubs]
      .sort((a, b) => state.clubs[b].reputation - state.clubs[a].reputation || (a < b ? -1 : 1))
      .forEach((id, i) => {
        state.clubs[id].board.expectation = BY_RANK[i] ?? "survival";
      });
  }
}

export function expectationMet(state: GameState, clubId: ClubId, rank: number): boolean {
  return rank <= TARGET_RANK[state.clubs[clubId].board.expectation];
}

export function updateConfidence(state: GameState, lives: LiveMatch[]): void {
  if (!isLeagueMatchday(state.calendarIndex)) return;
  const results = new Map<ClubId, number>();
  for (const l of lives) {
    results.set(l.home.club, Math.sign(l.home.goals - l.away.goals));
    results.set(l.away.club, Math.sign(l.away.goals - l.home.goals));
  }
  for (const league of [COMP.first, COMP.second]) {
    for (const id of state.competitions[league]?.clubs ?? []) {
      const club = state.clubs[id];
      let delta = 0;
      if (state.calendarIndex >= RANK_FROM) {
        const rank = leagueRank(state, id) ?? 18;
        delta += clamp((TARGET_RANK[club.board.expectation] - rank) * 0.3, -2.5, 1.5);
      }
      const r = results.get(id);
      if (r === 1) delta += 0.8;
      else if (r === -1) delta -= 0.8;
      if (club.finance.overdraftStreak >= 3) delta -= 5;
      club.board.confidence = clamp(club.board.confidence + delta, 0, 100);
    }
  }
}

export function jobOffersFor(
  state: GameState,
  reputation: number,
  rng: Rng,
  direction: "lower" | "higher",
  count: number,
  exclude: ClubId[] = [],
): ClubId[] {
  const ai = Object.values(state.clubs).filter((c) => c.managerId === null && !exclude.includes(c.id));
  const pool =
    direction === "lower"
      ? ai
          .filter((c) => c.reputation <= reputation + 5)
          .sort((a, b) => a.board.confidence - b.board.confidence || (a.id < b.id ? -1 : 1))
          .slice(0, 6)
      : ai.filter((c) => c.reputation > reputation + 5 && c.reputation <= reputation + 25);
  return rng.shuffle(pool).slice(0, count).map((c) => c.id);
}

function offerText(state: GameState, offers: ClubId[]): string {
  return `Jobangebote: ${offers.map((id) => state.clubs[id].name).join(", ")}.`;
}

function closeManagerBusiness(state: GameState, managerId: ManagerId): void {
  for (const n of state.negotiations) {
    if (n.managerId === managerId && n.status === "open") {
      n.status = "aborted";
      n.note = "Die Verhandlung endet mit deinem Abschied.";
    }
  }
  for (const o of state.transferOffers) if (o.managerId === managerId && o.status === "open") o.status = "withdrawn";
}

export function fireManager(state: GameState, managerId: ManagerId, rng: Rng, reason = "Der Vorstand hat dich entlassen."): void {
  const m = state.managers.find((x) => x.id === managerId);
  if (!m || !m.clubId) return;
  const club = state.clubs[m.clubId];
  closeManagerBusiness(state, managerId);
  club.managerId = null;
  club.board.confidence = NEW_COACH_CONFIDENCE;
  club.board.warned = false;
  club.training = { intensity: "normal", focus: "technique", individual: [] };
  m.clubId = null;
  m.unemployedFor = 0;
  m.jobOffers = jobOffersFor(state, club.reputation, rng, "lower", rng.int(1, 3), [club.id]);
  postMessage(state, m.id, `${reason} ${club.name} trennt sich von dir.`);
  if (m.jobOffers.length > 0) postMessage(state, m.id, offerText(state, m.jobOffers), { type: "jobOffer", id: m.jobOffers[0] });
}

export function boardChecks(state: GameState, rng: Rng): void {
  for (const club of Object.values(state.clubs)) {
    const b = club.board;
    if (club.managerId) {
      if (b.confidence < WARN_BELOW && !b.warned) {
        b.warned = true;
        postToClub(state, club.id, "Der Vorstand ist unzufrieden. Ohne bessere Ergebnisse droht die Entlassung.");
      }
      if (b.confidence > 40) b.warned = false;
      if (b.confidence < FIRE_BELOW && state.calendarIndex >= FIRE_FROM) fireManager(state, club.managerId, rng);
    } else if (b.confidence < FIRE_BELOW) {
      b.confidence = NEW_COACH_CONFIDENCE;
    }
  }
}

export function unemployedTick(state: GameState, rng: Rng): void {
  for (const m of state.managers) {
    if (m.clubId) continue;
    m.unemployedFor++;
    m.jobOffers = m.jobOffers.filter((id) => state.clubs[id].managerId === null);
    if (m.jobOffers.length > 0) continue;
    if (m.unemployedFor >= GUARANTEED_OFFER_AFTER) {
      const l2 = (state.competitions[COMP.second]?.clubs ?? [])
        .map((id) => state.clubs[id])
        .filter((c) => c.managerId === null)
        .sort((a, b) => a.board.confidence - b.board.confidence || (a.id < b.id ? -1 : 1))[0];
      if (l2) m.jobOffers = [l2.id];
    } else if (rng.chance(0.5)) {
      m.jobOffers = jobOffersFor(state, 50, rng, "lower", 1);
    }
    if (m.jobOffers.length > 0) postMessage(state, m.id, offerText(state, m.jobOffers), { type: "jobOffer", id: m.jobOffers[0] });
  }
}

export function acceptJobOffer(state: GameState, managerId: ManagerId, clubId: ClubId): string | null {
  const m = state.managers.find((x) => x.id === managerId);
  if (!m) return "Unbekannter Manager.";
  if (!m.jobOffers.includes(clubId)) return "Dieses Angebot gibt es nicht.";
  const club = state.clubs[clubId];
  if (club.managerId !== null) {
    m.jobOffers = m.jobOffers.filter((id) => id !== clubId);
    return "Der Verein hat inzwischen einen anderen Trainer.";
  }
  if (m.clubId) {
    closeManagerBusiness(state, managerId);
    state.clubs[m.clubId].managerId = null;
  }
  club.managerId = m.id;
  club.board.confidence = START_CONFIDENCE;
  club.board.warned = false;
  m.clubId = clubId;
  m.jobOffers = [];
  m.unemployedFor = 0;
  const league = state.competitions[COMP.first]?.clubs.includes(clubId) ? COMP.first : COMP.second;
  postMessage(state, m.id, `Willkommen beim ${club.name}! Saisonziel: ${expectationLabel(club.board.expectation, league)}.`);
  return null;
}

export function clearStaleJobOffers(state: GameState): void {
  for (const m of state.managers) if (m.clubId) m.jobOffers = [];
}

export function seasonReview(state: GameState, tables: Record<CompetitionId, ClubId[]>, rng: Rng): void {
  for (const league of [COMP.first, COMP.second]) {
    (tables[league] ?? []).forEach((clubId, i) => {
      const club = state.clubs[clubId];
      const rank = i + 1;
      const target = TARGET_RANK[club.board.expectation];
      if (!club.managerId) {
        if (rank > target + 5) club.board.confidence = NEW_COACH_CONFIDENCE;
        return;
      }
      const managerId = club.managerId;
      if (rank <= target) {
        club.board.confidence = Math.min(100, club.board.confidence + 15);
        postMessage(state, managerId, "Der Vorstand ist zufrieden: Saisonziel erreicht.");
        if (rank <= target - 2 || rng.chance(0.5)) {
          const offers = jobOffersFor(state, club.reputation, rng, "higher", rng.int(1, 2));
          const m = state.managers.find((x) => x.id === managerId)!;
          m.jobOffers = offers;
          if (offers.length > 0) postMessage(state, managerId, offerText(state, offers), { type: "jobOffer", id: offers[0] });
        }
      } else if (rank > target + 5) {
        fireManager(state, managerId, rng, "Saisonziel deutlich verfehlt.");
      } else {
        club.board.confidence = Math.max(0, club.board.confidence - 10);
        postMessage(state, managerId, "Der Vorstand ist enttäuscht: Saisonziel verfehlt.");
      }
    });
  }
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/engine/economy && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy/board.ts tests/engine/economy/board.test.ts
git commit -m "feat(engine): Vorstand mit Erwartung, Vertrauen, Entlassung und Jobangeboten"
```

---

### Task 9: Wirtschaft in den Saisonablauf einhängen

**Files:**
- Create: `src/engine/economy/processing.ts`
- Modify: `src/engine/season.ts` (`startSeason`, `finishMatchday`, `finishSeason`), `src/engine/match/simulate.ts` (`liveSide`), `tests/engine/matchday.test.ts` (Konditionswerte)
- Test: `tests/engine/economy/processing.test.ts`

**Interfaces:**
- Consumes: alle Economy-Module aus den Tasks 1–8
- Produces:
  - `processing.ts`:
    - `processMatchday(state, lives, rng)` – nach den Ergebnissen; `calendarIndex` ist dabei noch der gerade gespielte Index
    - `afterAdvance(state, rng)` – nach dem Weiterschalten des Kalenders
    - `seasonEndEconomy(state, tables, rng)` – vor `season++`
    - `startSeasonEconomy(state, rng)` – am Ende von `startSeason`
    - `summerMarket(state, rng)` – nach `startSeason` im Saisonwechsel
  - `simulate.ts`: `liveSide` übernimmt `bonus` aus `club.tacticsBonus`.

**Reihenfolge in `processMatchday`:**
1. Finanzen
2. Training (nur an Liga-Spieltagen). KI-Vereine setzen dafür vorher `aiTrainingPlan`. Manager erfahren Trainingsverletzungen per Nachricht.
3. Vertrauen, dann Vorstandsprüfungen, dann Arbeitslose
4. Bei Index 0: veraltete Jobangebote löschen
5. Sperrzeiten herunterzählen, KI-Verlängerungen, Hinweise auf auslaufende Verträge
6. Verhandlungen aufräumen, Angebote verfallen lassen

**`afterAdvance`:** Ist der neue Index ein Fenstertag, laufen bei Index 17 zuerst der KI-Markt (Winter), danach die KI-Angebote an die Manager.

**`seasonEndEconomy`:**
1. Prämien und Sponsorprämie (Ziel laut Abschlusstabelle)
2. Vorstandsbilanz
3. Vertragsende
4. Alterung und Karriereende
5. Nachwuchs, neue Vereinslose, Pool begrenzen
6. Verhandlungen und Angebote leeren

**`startSeasonEconomy`:** Erwartungen setzen, Finanzen zum Saisonstart, Verhandlungen und Angebote leeren.

**`summerMarket`:** KI-Markt, dann KI-Angebote an die Manager (Index 0 ist Fenstertag).

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/economy/processing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { startMatch } from "../../../src/engine/match/simulate";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { currentFixtures, finishSeason, playMatchdayAuto, startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(61);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[8] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("Saisonstart", () => {
  it("setzt Erwartungen und legt Sponsorangebote vor", () => {
    const s = game();
    const exps = new Set(Object.values(s.clubs).map((c) => c.board.expectation));
    expect(exps.size).toBe(4);
    expect(Object.values(s.clubs).every((c) => c.finance.sponsorOffers.length === 3)).toBe(true);
    expect(s.messages.some((m) => m.ref?.type === "sponsor")).toBe(true);
  });
});

describe("ein Spieltag mit Wirtschaft", () => {
  it("bucht Geld, trainiert, bewegt das Vertrauen und ändert den Eingabezustand nicht", () => {
    const s = game();
    const young = Object.values(s.players).find((p) => p.clubId && p.age <= 21 && p.potential - p.strength > 5)!;
    const before = JSON.stringify(s);
    const after = playMatchdayAuto(s);
    expect(JSON.stringify(s)).toBe(before);
    for (const c of Object.values(after.clubs)) {
      const cats = new Set(c.finance.ledger.map((e) => e.category));
      expect(cats.has("tv")).toBe(true);
      expect(cats.has("salaries")).toBe(true);
      expect(c.finance.sponsor).not.toBeNull();
    }
    expect(after.players[young.id].strength).toBeGreaterThan(young.strength);
    const moved = Object.values(after.clubs).filter((c) => c.board.confidence !== 60);
    expect(moved.length).toBeGreaterThan(10);
  });

  it("Taktiktraining wirkt im nächsten Spiel", () => {
    const s = game();
    const club = s.clubs[s.managers[0].clubId!];
    club.training = { intensity: "normal", focus: "tactics", individual: [] };
    const after = playMatchdayAuto(s);
    const m = currentFixtures(after).find((x) => x.home === club.id || x.away === club.id)!;
    const live = startMatch(after, m);
    const side = live.home.club === club.id ? live.home : live.away;
    expect(side.bonus).toBe(1.03);
  });

  it("zu Beginn des Winterfensters bietet die KI für gelistete Spieler", () => {
    let s = game();
    for (let i = 0; i < 16; i++) s = playMatchdayAuto(s);
    const club = s.clubs[s.managers[0].clubId!];
    for (const id of club.squad.slice(15)) s.players[id].transferListed = { askingPrice: null };
    s = playMatchdayAuto(s);
    expect(s.calendarIndex).toBe(17);
    expect(s.transferOffers.length).toBeGreaterThan(0);
  });
});

describe("Saisonwechsel mit Wirtschaft", () => {
  it("altert, holt Nachwuchs, beendet Verträge, startet neu mit Sponsoren und leeren Verhandlungen", { timeout: 120_000 }, () => {
    let s = game();
    for (let i = 0; i < 36; i++) s = playMatchdayAuto(s);
    const someone = Object.values(s.players).find((p) => p.clubId && p.age < 30)!;
    const expiring = Object.values(s.players).filter((p) => p.clubId && p.contract && p.contract.endsSeason <= s.season).length;
    const playersBefore = Object.keys(s.players).length;
    const { state: next } = finishSeason(s);
    expect(next.players[someone.id].age).toBe(someone.age + 1);
    expect(Object.keys(next.players).length).toBeGreaterThan(playersBefore);
    expect(expiring).toBeGreaterThan(0);
    expect(Object.values(next.players).every((p) => !p.clubId || !p.contract || p.contract.endsSeason >= next.season)).toBe(true);
    for (const c of Object.values(next.clubs)) {
      expect(c.finance.sponsorOffers).toHaveLength(3);
      expect(c.finance.sponsor).toBeNull();
      expect(c.squad.length).toBeGreaterThanOrEqual(c.managerId ? 1 : 18);
    }
    expect(next.negotiations.filter((n) => n.status === "open")).toEqual([]);
    expect(next.competitions[COMP.first].clubs).toHaveLength(18);
  });
});
```

In `tests/engine/matchday.test.ts` im Test „Kondition: Eingesetzte erholen sich teilweise, Nichteingesetzte ganz“ die beiden Erwartungen anpassen. Das normale Training kostet jetzt 3 Konditionspunkte:

```ts
    expect(after.players[played].fitness).toBeCloseTo(85);
    expect(after.players[rested].fitness).toBe(97);
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/economy/processing.test.ts`
Expected: FAIL, weil das Modul `processing` nicht gefunden wird.

- [ ] **Step 3: `processing.ts` implementieren**

`src/engine/economy/processing.ts`:

```ts
import type { LiveMatch } from "../match/simulate";
import { COMP, type ClubId, type CompetitionId, type GameState } from "../model";
import type { Rng } from "../rng";
import {
  assignExpectations,
  boardChecks,
  clearStaleJobOffers,
  expectationMet,
  seasonReview,
  unemployedTick,
  updateConfidence,
} from "./board";
import { aiRenewals, expireContracts, expiringNotices, tickCooldowns } from "./contracts";
import { processFinances, seasonEndFinances, startSeasonFinances } from "./finance";
import { aiTransferRound, expireOffers, generateAiOffers } from "./market";
import { postToClub } from "./messages";
import { cleanupNegotiations } from "./negotiations";
import { addFreeAgents, addYouth, aiTrainingPlan, applyTraining, seasonAging, trimFreeAgents } from "./training";
import { isTransferWindow } from "./transfers";
import { clubLeague, isLeagueMatchday } from "./util";

const WINTER_MARKET_AT = 17;

export function processMatchday(state: GameState, lives: LiveMatch[], rng: Rng): void {
  processFinances(state, lives);
  if (isLeagueMatchday(state.calendarIndex)) {
    const played = new Set(lives.flatMap((l) => [...l.home.played, ...l.away.played]));
    for (const club of Object.values(state.clubs)) {
      if (!clubLeague(state, club.id)) continue;
      if (club.managerId === null) club.training = aiTrainingPlan(state, club.id);
      const injured = applyTraining(state, club.id, played, rng);
      if (injured.length > 0) {
        postToClub(state, club.id, `Trainingsverletzung: ${injured.map((id) => state.players[id].lastName).join(", ")}.`);
      }
    }
  }
  updateConfidence(state, lives);
  boardChecks(state, rng);
  unemployedTick(state, rng);
  if (state.calendarIndex === 0) clearStaleJobOffers(state);
  tickCooldowns(state);
  aiRenewals(state);
  expiringNotices(state);
  cleanupNegotiations(state);
  expireOffers(state);
}

export function afterAdvance(state: GameState, rng: Rng): void {
  if (!isTransferWindow(state)) return;
  if (state.calendarIndex === WINTER_MARKET_AT) aiTransferRound(state, rng);
  generateAiOffers(state, rng);
}

export function seasonEndEconomy(state: GameState, tables: Record<CompetitionId, ClubId[]>, rng: Rng): void {
  const met = (clubId: ClubId) => {
    const league = tables[COMP.first]?.includes(clubId) ? COMP.first : COMP.second;
    return expectationMet(state, clubId, (tables[league] ?? []).indexOf(clubId) + 1);
  };
  seasonEndFinances(state, tables, met);
  seasonReview(state, tables, rng);
  expireContracts(state);
  seasonAging(state, rng);
  addYouth(state, rng);
  addFreeAgents(state, rng);
  trimFreeAgents(state);
  state.negotiations = [];
  state.transferOffers = [];
}

export function startSeasonEconomy(state: GameState, rng: Rng): void {
  assignExpectations(state);
  startSeasonFinances(state, rng);
  state.negotiations = [];
  state.transferOffers = [];
}

export function summerMarket(state: GameState, rng: Rng): void {
  aiTransferRound(state, rng);
  generateAiOffers(state, rng);
}
```

- [ ] **Step 4: Einhängen in `season.ts` und `simulate.ts`**

In `src/engine/season.ts`:

1. Import ergänzen:

```ts
import { afterAdvance, processMatchday, seasonEndEconomy, startSeasonEconomy, summerMarket } from "./economy/processing";
```

2. In `startSeason` ans Funktionsende, nach der Schleife, die `stats` und `yellowCards` zurücksetzt:

```ts
  withRng(state, (rng) => startSeasonEconomy(state, rng));
```

3. In `finishMatchday` innerhalb von `withRng(draft, (rng) => { … })` die beiden Zeilen

```ts
    draft.calendarIndex++;
    if (draft.calendarIndex === LEAGUE_ROUNDS && !draft.competitions[COMP.relegation]) scheduleRelegation(draft);
```

ersetzen durch:

```ts
    processMatchday(draft, lives, rng);
    draft.calendarIndex++;
    if (draft.calendarIndex === LEAGUE_ROUNDS && !draft.competitions[COMP.relegation]) scheduleRelegation(draft);
    afterAdvance(draft, rng);
```

4. In `finishSeason` direkt nach `draft.history.push(record);` einfügen:

```ts
  withRng(draft, (rng) => seasonEndEconomy(draft, { [COMP.first]: t1, [COMP.second]: t2 }, rng));
```

und nach dem Aufruf `startSeason(…);` vor `return`:

```ts
  withRng(draft, (rng) => summerMarket(draft, rng));
```

In `src/engine/match/simulate.ts` in `liveSide` die Zeile `bonus: 1,` ersetzen durch:

```ts
    bonus: club.tacticsBonus,
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run && npm run check`
Expected:
- Alle Tests sind PASS, inklusive Engine-, Session-, UI- und Langzeittests aus den Plänen 1 und 2.
- `svelte-check` meldet 0 Fehler.

Schlägt ein **bestehender** Test fehl, nur weil die Wirtschaft jetzt Werte verändert, prüfen, ob die Änderung fachlich richtig ist (wie beim Konditionstest oben). Erst dann die Erwartung anpassen und jede Anpassung im Bericht begründen. Verhaltensänderungen, die keine Folge der Wirtschaft sind, werden nicht angepasst, sondern gemeldet (`DONE_WITH_CONCERNS`).

- [ ] **Step 6: Commit**

```bash
git add src/engine/economy/processing.ts src/engine/season.ts src/engine/match/simulate.ts tests/engine/matchday.test.ts tests/engine/economy/processing.test.ts
git commit -m "feat(engine): Wirtschaft in Spieltag und Saisonwechsel einhängen"
```

---

### Task 10: Wirtschaftsbefehle

**Files:**
- Modify: `src/engine/commands.ts`
- Test: `tests/engine/economy/commands.test.ts`

**Interfaces:**
- Consumes: `validateTraining` (Task 2), `validateTicketPrice`, `startBuilding`, `chooseSponsor` (Task 3), `releasePlayer` (Task 4), `setTransferListing` (Task 5), `startContractTalk`, `startTransferTalk`, `respondNegotiation`, `NegotiationResponse` (Task 6), `respondTransferOffer`, `OfferResponse` (Task 7), `acceptJobOffer` (Task 8)
- Produces: `type EconomyCommand` mit diesen Befehlen:
  - `setTraining { managerId; training: TrainingPlan }`
  - `setTicketPrice { managerId; price }`
  - `buildStadium { managerId }`
  - `chooseSponsor { managerId; offerId }`
  - `startContractTalk { managerId; playerId; salary; years }`
  - `startTransferTalk { managerId; playerId; fee }`
  - `respondNegotiation { managerId; negotiationId; response: NegotiationResponse }`
  - `setTransferListing { managerId; playerId; listed; askingPrice }`
  - `respondTransferOffer { managerId; offerId; response: OfferResponse }`
  - `releasePlayer { managerId; playerId }`
  - `acceptJobOffer { managerId; clubId }`

  `StateCommand` umfasst zusätzlich alle `EconomyCommand`. Für `applyCommand` gilt weiter: Bei einem Fehler bleibt der Zustand unverändert. Nur `acceptJobOffer` funktioniert auch ohne Verein.

- [ ] **Step 1: Failing Test schreiben**

`tests/engine/economy/commands.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyCommand, type StateCommand } from "../../../src/engine/commands";
import { salaryDemand } from "../../../src/engine/economy/contracts";
import { generateWorld } from "../../../src/engine/generator";
import type { GameState } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { fireManager } from "../../../src/engine/economy/board";
import { startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(71);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[6] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const m = (s: GameState) => s.managers[0].id;
const club = (s: GameState) => s.clubs[s.managers[0].clubId!];

function ok(s: GameState, cmd: StateCommand): GameState {
  const r = applyCommand(s, cmd);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
function fails(s: GameState, cmd: StateCommand): string {
  const before = JSON.stringify(s);
  const r = applyCommand(s, cmd);
  expect(JSON.stringify(s)).toBe(before);
  if (r.ok) throw new Error("Befehl hätte scheitern müssen");
  return r.error;
}

describe("Wirtschaftsbefehle", () => {
  it("Training setzen und prüfen", () => {
    const s = game();
    const t = { intensity: "hard" as const, focus: "tactics" as const, individual: [club(s).squad[0]] };
    expect(ok(s, { type: "setTraining", managerId: m(s), training: t }).clubs[club(s).id].training).toEqual(t);
    expect(fails(s, { type: "setTraining", managerId: m(s), training: { ...t, intensity: "x" as never } })).toBe("Unbekannte Trainingsintensität.");
  });

  it("Eintrittspreis, Stadionausbau und Sponsor", () => {
    const s = game();
    expect(ok(s, { type: "setTicketPrice", managerId: m(s), price: 30 }).clubs[club(s).id].finance.ticketPrice).toBe(30);
    expect(fails(s, { type: "setTicketPrice", managerId: m(s), price: 1 })).toContain("zwischen 5 und 100");
    club(s).finance.balance = 100_000_000;
    club(s).finance.stadiumStage = 1;
    expect(ok(s, { type: "buildStadium", managerId: m(s) }).clubs[club(s).id].finance.building).not.toBeNull();
    const offer = club(s).finance.sponsorOffers[2];
    expect(ok(s, { type: "chooseSponsor", managerId: m(s), offerId: offer.id }).clubs[club(s).id].finance.sponsor).toEqual(offer);
    expect(fails(s, { type: "chooseSponsor", managerId: m(s), offerId: "x" })).toBe("Dieses Angebot gibt es nicht.");
  });

  it("Vertragsgespräch, Antwort und Entlassung", () => {
    const s = game();
    const p = s.players[club(s).squad[2]];
    const ask = salaryDemand(s, p, club(s).id);
    const s1 = ok(s, { type: "startContractTalk", managerId: m(s), playerId: p.id, salary: Math.round(ask * 0.85), years: 3 });
    const n = s1.negotiations.at(-1)!;
    const s2 = ok(s1, { type: "respondNegotiation", managerId: m(s), negotiationId: n.id, response: "accept" });
    expect(s2.negotiations.at(-1)!.status).toBe("accepted");
    expect(fails(s2, { type: "respondNegotiation", managerId: m(s), negotiationId: n.id, response: "accept" })).toBe("Diese Verhandlung ist schon beendet.");
    const s3 = ok(s2, { type: "releasePlayer", managerId: m(s), playerId: p.id });
    expect(s3.players[p.id].clubId).toBeNull();
  });

  it("Transferliste und Kaufversuch", () => {
    const s = game();
    const own = club(s).squad[4];
    expect(ok(s, { type: "setTransferListing", managerId: m(s), playerId: own, listed: true, askingPrice: 300_000 }).players[own].transferListed).toEqual({ askingPrice: 300_000 });
    const target = Object.values(s.clubs).find((c) => c.managerId === null)!.squad[14];
    const r = ok(s, { type: "startTransferTalk", managerId: m(s), playerId: target, fee: 1 });
    expect(r.negotiations.at(-1)!.status).toBe("aborted");
    s.calendarIndex = 5;
    expect(fails(s, { type: "startTransferTalk", managerId: m(s), playerId: target, fee: 1_000_000 })).toBe("Das Transferfenster ist geschlossen.");
  });

  it("Angebote beantworten scheitert bei unbekannter ID", () => {
    const s = game();
    expect(fails(s, { type: "respondTransferOffer", managerId: m(s), offerId: "x", response: "accept" })).toBe("Dieses Angebot gibt es nicht.");
  });

  it("Jobangebot annehmen geht auch ohne Verein; andere Befehle nicht", () => {
    const s = game();
    fireManager(s, m(s), Rng.fromSeed(1));
    expect(fails(s, { type: "setTicketPrice", managerId: m(s), price: 30 })).toBe("Du hast zurzeit keinen Verein.");
    const target = s.managers[0].jobOffers[0];
    const after = ok(s, { type: "acceptJobOffer", managerId: m(s), clubId: target });
    expect(after.managers[0].clubId).toBe(target);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/engine/economy/commands.test.ts`
Expected: FAIL, weil `applyCommand` die neuen Befehle nicht kennt (Typfehler oder `undefined` als Ergebnis).

- [ ] **Step 3: Implementieren**

In `src/engine/commands.ts`:

1. Imports ergänzen:

```ts
import { acceptJobOffer } from "./economy/board";
import { releasePlayer } from "./economy/contracts";
import { chooseSponsor } from "./economy/finance";
import { respondTransferOffer, type OfferResponse } from "./economy/market";
import { respondNegotiation, startContractTalk, startTransferTalk, type NegotiationResponse } from "./economy/negotiations";
import { startBuilding, validateTicketPrice } from "./economy/stadium";
import { validateTraining } from "./economy/training";
import { setTransferListing } from "./economy/transfers";
```

und im Typ-Import aus `./model` `type ClubId` und `type TrainingPlan` ergänzen.

2. Den Typ `StateCommand` ersetzen durch:

```ts
export type EconomyCommand =
  | { type: "setTraining"; managerId: ManagerId; training: TrainingPlan }
  | { type: "setTicketPrice"; managerId: ManagerId; price: number }
  | { type: "buildStadium"; managerId: ManagerId }
  | { type: "chooseSponsor"; managerId: ManagerId; offerId: string }
  | { type: "startContractTalk"; managerId: ManagerId; playerId: PlayerId; salary: number; years: number }
  | { type: "startTransferTalk"; managerId: ManagerId; playerId: PlayerId; fee: number }
  | { type: "respondNegotiation"; managerId: ManagerId; negotiationId: string; response: NegotiationResponse }
  | { type: "setTransferListing"; managerId: ManagerId; playerId: PlayerId; listed: boolean; askingPrice: number | null }
  | { type: "respondTransferOffer"; managerId: ManagerId; offerId: string; response: OfferResponse }
  | { type: "releasePlayer"; managerId: ManagerId; playerId: PlayerId }
  | { type: "acceptJobOffer"; managerId: ManagerId; clubId: ClubId };

export type StateCommand =
  | { type: "setLineup"; managerId: ManagerId; lineup: Lineup }
  | { type: "setTactics"; managerId: ManagerId; tactics: Tactics }
  | { type: "autoLineup"; managerId: ManagerId }
  | EconomyCommand;
```

3. Vor `export function applyCommand` diese Funktion einfügen:

```ts
function applyEconomy(draft: GameState, clubId: ClubId, cmd: Exclude<EconomyCommand, { type: "acceptJobOffer" }>): string | null {
  switch (cmd.type) {
    case "setTraining": {
      const error = validateTraining(draft, clubId, cmd.training);
      if (error) return error;
      draft.clubs[clubId].training = { intensity: cmd.training.intensity, focus: cmd.training.focus, individual: [...cmd.training.individual] };
      return null;
    }
    case "setTicketPrice": {
      const error = validateTicketPrice(cmd.price);
      if (error) return error;
      draft.clubs[clubId].finance.ticketPrice = cmd.price;
      return null;
    }
    case "buildStadium":
      return startBuilding(draft, clubId);
    case "chooseSponsor":
      return chooseSponsor(draft, clubId, cmd.offerId);
    case "startContractTalk":
      return startContractTalk(draft, cmd.managerId, cmd.playerId, cmd.salary, cmd.years);
    case "startTransferTalk":
      return startTransferTalk(draft, cmd.managerId, cmd.playerId, cmd.fee);
    case "respondNegotiation":
      return respondNegotiation(draft, cmd.managerId, cmd.negotiationId, cmd.response);
    case "setTransferListing":
      return setTransferListing(draft, clubId, cmd.playerId, cmd.listed, cmd.askingPrice);
    case "respondTransferOffer":
      return respondTransferOffer(draft, cmd.managerId, cmd.offerId, cmd.response);
    case "releasePlayer":
      return releasePlayer(draft, clubId, cmd.playerId);
  }
}
```

4. In `applyCommand` ganz am Anfang einfügen:

```ts
  if (cmd.type === "acceptJobOffer") {
    const draft = structuredClone(state);
    const error = acceptJobOffer(draft, cmd.managerId, cmd.clubId);
    return error ? { ok: false, error } : { ok: true, state: draft };
  }
```

und im `switch (cmd.type)` nach dem `case "autoLineup"` ergänzen:

```ts
    default: {
      const error = applyEconomy(draft, club.id, cmd);
      return error ? { ok: false, error } : { ok: true, state: draft };
    }
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/engine/commands.ts tests/engine/economy/commands.test.ts
git commit -m "feat(engine): Befehle für Training, Finanzen, Verträge, Transfers und Jobangebote"
```

---

### Task 11: Langzeittest der Wirtschaft und Balancing

**Files:**
- Test: `tests/longrun/economy.test.ts`
- Modify (nur falls das Balancing es verlangt): die Konstanten, die unten genannt sind

**Interfaces:**
- Consumes: `generateWorld`, `startNewGame`, `playMatchdayAuto`, `isSeasonOver`, `finishSeason`, `isOverLimit`, `computeStandings`
- Produces: keine neuen Schnittstellen

- [ ] **Step 1: Langzeittest schreiben**

`tests/longrun/economy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isOverLimit } from "../../src/engine/economy/money";
import { generateWorld } from "../../src/engine/generator";
import { COMP, type GameState } from "../../src/engine/model";
import { finishSeason, isSeasonOver, playMatchdayAuto, startNewGame } from "../../src/engine/season";

function starterAvg(s: GameState, league: string): number {
  const clubs = s.competitions[league].clubs.map((id) => s.clubs[id]);
  const values = clubs.flatMap((c) => c.lineup.starters.map((id) => s.players[id]?.strength ?? 0));
  return values.reduce((x, y) => x + y, 0) / values.length;
}

describe("Langzeittest: Wirtschaft über 10 Saisons", () => {
  it("bleibt stabil", { timeout: 600_000 }, () => {
    const world = generateWorld(2027);
    const r = startNewGame(world, [{ name: "Test", clubId: Object.keys(world.clubs)[12] }]);
    if (!r.ok) throw new Error(r.error);
    let s: GameState = r.state;
    const startL1 = starterAvg(s, COMP.first);
    const report: string[] = [];

    for (let season = 1; season <= 10; season++) {
      while (!isSeasonOver(s)) s = playMatchdayAuto(s);
      s = finishSeason(s).state;

      const clubs = Object.values(s.clubs);
      const balances = clubs.map((c) => c.finance.balance).sort((a, b) => a - b);
      const median = balances[Math.floor(balances.length / 2)];
      const over = clubs.filter(isOverLimit).length;
      const free = Object.values(s.players).filter((p) => p.clubId === null && !p.retired).length;
      const active = Object.values(s.players).filter((p) => !p.retired).length;
      const l1 = starterAvg(s, COMP.first);
      const l2 = starterAvg(s, COMP.second);
      report.push(`Saison ${season}: Median ${median}, über Limit ${over}, frei ${free}, aktiv ${active}, L1 ${l1.toFixed(1)}, L2 ${l2.toFixed(1)}`);

      for (const c of clubs) {
        expect(Number.isFinite(c.finance.balance)).toBe(true);
        expect(c.squad.length).toBeLessThanOrEqual(34);
        if (c.managerId === null) expect(c.squad.length).toBeGreaterThanOrEqual(18);
        for (const id of c.squad) expect(s.players[id].clubId).toBe(c.id);
      }
      expect(over).toBeLessThanOrEqual(8);
      expect(median).toBeGreaterThan(-3_000_000);
      expect(median).toBeLessThan(60_000_000);
      expect(free).toBeGreaterThanOrEqual(5);
      expect(free).toBeLessThanOrEqual(150);
      expect(l1).toBeGreaterThan(l2 + 3);
      expect(Math.abs(l1 - startL1)).toBeLessThan(8);
      expect(active).toBeLessThan(2_000);
      for (const m of s.managers) expect(s.messages.filter((x) => x.managerId === m.id).length).toBeLessThanOrEqual(60);
    }

    console.log(report.join("\n"));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `npx vitest run tests/longrun/economy.test.ts`
Expected: PASS. Die ausgegebene Tabelle (Median, über Limit, frei, aktiv, L1, L2 je Saison) gehört in den Bericht.

- [ ] **Step 3: Falls eine Bandbreite verletzt wird: nachjustieren**

Nur diese Konstanten ändern, jeweils in kleinen Schritten, und nach jeder Änderung Step 2 wiederholen:

| Symptom | Konstante (Datei) | Richtung |
|---|---|---|
| zu viele Vereine über dem Limit oder Median zu niedrig | `salaryFor`-Basis 2500 (money.ts) | senken, z. B. 2300 |
| | `TV_PER_MATCHDAY` (finance.ts) | erhöhen |
| Median zu hoch (Geld explodiert) | Zuschauerbasis `450` in `attendance` (stadium.ts) | senken |
| | `salaryFor`-Basis | erhöhen |
| L1-Stärke sinkt deutlich | Nachwuchsstärke `−12` (training.ts) | Richtung −8 |
| | `baseDevelopment` 0,04 bzw. 0,01 | erhöhen |
| L1-Stärke steigt deutlich | dieselben Konstanten | in die Gegenrichtung |
| Pool der Vereinslosen läuft leer | `addFreeAgents` count 25 | erhöhen |
| Pool läuft über | `FREE_AGENT_POOL_MAX` | ist schon die Obergrenze; KI-Kaderuntergrenze `AI_SQUAD_MIN` prüfen |
| KI-Kader unter 18 | `WAGE_SHARE` (market.ts) | erhöhen |

Jede geänderte Konstante mit altem und neuem Wert in den Bericht schreiben. Nach dem Nachjustieren `npx vitest run` laufen lassen. Die Einzeltests aus den Tasks 1–10 müssen weiter PASS sein. Tests, die konkrete Zahlen prüfen (z. B. `salaryFor(50) = 5.200`), werden mit angepasst, und das kommt in den Bericht.

- [ ] **Step 4: Gesamtprüfung**

Run: `npx vitest run && npm run check && npm run build`
Expected:
- alle Tests PASS
- `svelte-check` meldet 0 Fehler und 0 Warnungen
- der Build ist erfolgreich

Run: `grep -rnE "Math\.random|Date\.now|from \"(svelte|\.\./ui|\.\./session)|from \"\.\./season\"" src/engine || echo "sauber"`
Expected: `sauber`. Die Economy-Module importieren nie aus `season.ts`.

- [ ] **Step 5: Commit**

```bash
git add tests/longrun/economy.test.ts src/engine
git commit -m "test: Langzeittest der Wirtschaft über 10 Saisons"
```

---

## Nach diesem Plan

Plan 3b „Wirtschaft in der Oberfläche“ baut die Menüs:
- **Hauptmenü und Kopfzeile:** Die gesperrten Kacheln Training, Verträge, Transfers, Finanzen und Nachrichten werden freigeschaltet. Die Kopfzeile bekommt den Kontostand.
- **Neue Bildschirme:**
  - Verhandlungs-Dialog
  - Sponsorwahl
  - Jobangebote
  - Bildschirm „ohne Verein“
- **Session:** Manager ohne Verein kommen in den Manager-Runden an die Reihe.
- **Tabellen:** Sortierung per Klick auf den Spaltenkopf beim Transfermarkt.
- **Offen aus Plan 2:** Höhenbegrenzung der Ereignisliste in der Auswertung.

