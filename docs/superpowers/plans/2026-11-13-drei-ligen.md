# Drei Ligen mit echten Vereinen – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 54 echte Vereine in drei Ligen mit je 18 Teams, Auf- und Abstieg an zwei Grenzen, getrennte Werte für Kaderstärke und Ruf, Wirtschaft für die 3. Liga.

**Architecture:** Ein fester Datensatz (`src/engine/clubs.ts`) ersetzt die zufälligen Fantasievereine. Die Engine verallgemeinert „zwei Ligen, eine Relegation“ zu einer Liste von Ligen (`LEAGUES`) und Grenzen (`BOUNDARIES`). Die Wirtschaft rechnet mit einer Ligastufe (0, 1, 2) statt mit „ist 2. Liga“. Die Oberfläche liest Ligen und Grenzen aus denselben Listen.

**Tech Stack:** TypeScript, Svelte 5, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-13-drei-ligen-echte-vereine-design.md` (ergänzt Haupt-Spec und `2026-11-12-wirtschaft-balancing-design.md`)

## Global Constraints

- An der Spielsimulation (`src/engine/match/`) ändert sich nichts. `tests/engine/rngFingerprint.test.ts` bleibt unverändert grün.
- 3 Ligen × 18 Vereine, 34 Spieltage, danach 2 Relegationstage für beide Relegationen gemeinsam.
- Startliga kommt aus dem Datensatz, nie aus Ruf oder Kaderstärke.
- Kaderstärke nur für die Spielererzeugung beim Spielstart; alles Wirtschaftliche und die Vorstandserwartung hängt am Ruf.
- Die Korridore der Wirtschafts-Spec (4.1, 5.1) halten weiter, für 54 Vereine. Dazu kommen die Korridore der 3. Liga (Spec 5).
- Fläche 1280×800, kein Überlauf. Lange Namen nur, wo Platz ist, sonst Kurzname.
- Spielstand-Version 4. Ältere Spielstände werden mit Meldung abgelehnt, es gibt keine Migration.
- Texte deutsch.

## Review Focus

1. **Relegationssieg des Unterklassigen an beiden Grenzen gleichzeitig:** Der 3. der 3. Liga gewinnt und der 3. der 2. Liga gewinnt. Dann steigen aus der 2. Liga 3 Vereine ab und 3 auf, und alle Ligen haben trotzdem 18 Vereine. Test in Task 2.
2. **Manager-Verein in einer Relegation, Manager-Verein in der 3. Liga:** Das Live-Spiel läuft, Saisonziel-Beschriftung und Tabellen-Zonen der 3. Liga stimmen (kein Abstieg, Aufstieg oben). Tests in Task 2 und Task 4.
3. **Traditionsverein mit hohem Ruf in der 3. Liga:** Er hat einen ligaüblichen Kader, aber ein volles Stadion und rutscht nicht ins Minus. Test in Task 3.
4. **Gleich lange Kurznamen, lange Vereinsnamen:** „Borussia Mönchengladbach“, „SG Sonnenhof Großaspach“ in Vereinsauswahl und Tabellen ohne Überlauf, „1. FC Köln“ und „SC Fortuna Köln“ unterscheidbar. Tests in Task 1 (Kurznamen eindeutig) und Task 4 (Auswahl).
5. **Alter Spielstand:** Ein v3-Spielstand wird nicht geladen, die Meldung sagt warum, und das Spiel stürzt nicht ab. Test in Task 2.

---

### Task 1: Vereinsdatensatz

**Files:**
- Create: `src/engine/clubs.ts`
- Test: `tests/engine/clubs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type StartLeague = "L1" | "L2" | "L3";
  export interface ClubSeed {
    name: string; shortName: string; colors: [string, string]; crest: CrestPattern;
    reputation: number; // Ruf 1–100: Tradition, Fans, Geld
    strength: number;   // Kaderstärke 1–100: Eingabe für baseStrengthFor beim Spielstart
    league: StartLeague;
  }
  export const CLUBS: readonly ClubSeed[]; // 54 Einträge, Reihenfolge: Liga, dann wie in Spec 3
  ```

- [ ] **Step 1: Tests schreiben** (`clubs.test.ts`):
  - `"54 Vereine, je 18 pro Liga"`
  - `"Namen und Kurznamen sind eindeutig, Kurznamen höchstens 10 Zeichen"`
  - `"Ruf und Kaderstärke zwischen 1 und 100, zwei verschiedene Farben im Format #rrggbb"`
  - `"die Bundesliga enthält FC Bayern München, die 3. Liga TSV Havelse und keine Zweitvertretung"` (kein Name endet auf „ II“)
  - `"Kaderstärke liegt im Band der Liga"`: min(L1) > Mittel(L2) und max(L3) < Mittel(L2)
  - `"Traditionsvereine haben in unteren Ligen einen hohen Ruf"`: Ruf von Fortuna Düsseldorf > Median-Ruf der 2. Liga; Ruf von Hertha BSC > Median-Ruf der 1. Liga
  - `"Bayern hat den höchsten Ruf und die höchste Kaderstärke"`
- [ ] **Step 2: Laufen lassen:** `npx vitest run tests/engine/clubs.test.ts` → FAIL (Modul fehlt)
- [ ] **Step 3: Datensatz schreiben.** Namen exakt wie in Spec 3. Kaderstärke-Bänder auf der bisherigen Ruf-Skala, damit `baseStrengthFor` unverändert bleibt: 1. Liga etwa 62–96, 2. Liga etwa 40–60, 3. Liga etwa 18–38, innerhalb der Liga nach echter Stärke 2026/27. Den Ruf vergibt der Umsetzer nach Spec 3. Die Farben sind die echten Vereinsfarben, auf dunklem Holz lesbar (Schwarz wird z. B. zu `#1a1a1a`), das Muster wählt der Umsetzer aus `CrestPattern`.
- [ ] **Step 4: Laufen lassen** → PASS
- [ ] **Step 5: Commit** `feat(engine): Datensatz der 54 Vereine`

### Task 2: Drei Ligen, zwei Grenzen, Spielstand v4

**Files:**
- Modify: `src/engine/model.ts` (COMP, LEAGUES, BOUNDARIES, SeasonRecord, GameState.version)
- Modify: `src/engine/generator.ts` (Vereine aus `CLUBS`, `CLUB_COUNT = 54`)
- Modify: `src/engine/season.ts` (startSeason, startNewGame, leagueOf, Relegationen, isSeasonOver, finishSeason)
- Modify: `src/engine/economy/util.ts` (`clubLeague` über `LEAGUES`)
- Modify: `src/storage/migrate.ts`, `src/storage/messages.ts`; Delete: `src/storage/migrations.ts`
- Test: `tests/engine/seasonend.test.ts`, `tests/engine/newgame.test.ts`, `tests/engine/generator.test.ts`, `tests/storage/migrations.test.ts`, `tests/storage/savefile.test.ts`, `tests/longrun/seasons.test.ts`, sowie alle Tests, die an zwei Ligen hängen

**Interfaces:**
- Consumes: `CLUBS`, `ClubSeed` (Task 1)
- Produces:
  ```ts
  // model.ts
  export const COMP = { first: "L1", second: "L2", third: "L3", relegation: "REL", relegation2: "REL2" } as const;
  export const LEAGUES: readonly CompetitionId[] = [COMP.first, COMP.second, COMP.third];
  export interface Boundary { upper: CompetitionId; lower: CompetitionId; relegation: CompetitionId }
  export const BOUNDARIES: readonly Boundary[] = [
    { upper: COMP.first, lower: COMP.second, relegation: COMP.relegation },
    { upper: COMP.second, lower: COMP.third, relegation: COMP.relegation2 },
  ];
  export interface Movement { upper: CompetitionId; lower: CompetitionId; promoted: ClubId[]; relegated: ClubId[] }
  export interface SeasonRecord { season: number; champions: Record<CompetitionId, ClubId>; movements: Movement[];
    topScorers: Record<CompetitionId, { player: PlayerId; goals: number } | null> }
  export function leagueLevel(id: CompetitionId): number; // L1 → 0, L2 → 1, L3 → 2, sonst -1
  // season.ts
  export function startSeason(state: GameState, leagues: Record<CompetitionId, ClubId[]>): void;
  export function startingLeagues(state: GameState): Record<CompetitionId, ClubId[]>; // nach CLUBS[i].league, Zuordnung über den Vereinsnamen
  export function relegationWinner(state: GameState, relegationId: CompetitionId): ClubId | null;
  // storage
  export const CURRENT_VERSION = 4; export const TOO_OLD: string; // in messages.ts
  ```
  Ligennamen in `createLeague`: „1. Liga“, „2. Liga“, „3. Liga“.

- [ ] **Step 1: Tests schreiben bzw. umschreiben:**
  - `newgame.test.ts` `"jeder Verein startet in der Liga aus dem Datensatz"`: Nach `startNewGame(generateWorld(11), …)` gilt für jeden Verein `leagueOf` gleich der Liga des `CLUBS`-Eintrags gleichen Namens. Fortuna Düsseldorf steht in L3, obwohl ihr Ruf höher ist als der einiger Vereine in L2.
  - `generator.test.ts` `"Kaderstärke folgt der Kaderstärke, nicht dem Ruf"`: Die mittlere Stammelf jedes L1-Vereins liegt über dem Mittel aller L2-Vereine, die jedes L3-Vereins darunter (Spec 8). Die Stammelf von Fortuna Düsseldorf liegt unter der jedes L1-Vereins.
  - `seasonend.test.ts` umschreiben auf `movements`: An beiden Grenzen steigen 17. und 18. ab und 1. und 2. auf. Der Relegationssieger bestimmt den dritten Wechsel. Neuer Test `"beide Unterklassigen gewinnen die Relegation"` (Review Focus 1): Ergebnisse der Relegationsspiele so setzen, dass beide Unterklassigen gewinnen. Dann hat jede Grenze 3 Wechsel in jede Richtung, und alle drei Ligen haben 18 Vereine. Champions und Torschützen gibt es für alle drei Ligen.
  - `seasonend.test.ts` `"beide Relegationen liegen an denselben zwei Kalendertagen"`: Nach Spieltag 34 hat `state.calendar` 36 Einträge, Eintrag 34 enthält REL Runde 1 und REL2 Runde 1, Eintrag 35 beide Runde 2. `isSeasonOver` ist erst nach beiden wahr.
  - `migrations.test.ts`/`savefile.test.ts`: Die v1-Fixture und ein v3-Spielstand werden mit `TOO_OLD` abgelehnt (Review Focus 5). Ein frisches Spiel speichert und lädt als Version 4. Die v1→v2- und v2→v3-Tests entfallen.
  - `tests/longrun/seasons.test.ts`: Pro Grenze gilt `promoted.length === relegated.length` und liegt in [2, 3], danach haben alle drei Ligen 18 Vereine. Die Torquote wird weiter ohne Spiele des Manager-Vereins gemessen.
- [ ] **Step 2: Laufen lassen:** `npx vitest run tests/engine tests/storage` → FAIL
- [ ] **Step 3: Umsetzen.**
  - Die Generator-Schleife läuft über `CLUBS`, mit `baseStrengthFor(seed.strength)` und `reputation: seed.reputation`. Die Spieler bleiben zufällig, `TOWNS` und `clubName` entfallen.
  - `startNewGame` ruft `startSeason(state, startingLeagues(state))` auf. `finishSeason` baut die neuen Ligen pro Grenze von oben nach unten auf. Erster Spielstand der Saisonhistorie: `seasonReview` bekommt die Tabellen aller drei Ligen.
  - Migrationen: `migrate` lehnt `version < CURRENT_VERSION` mit `TOO_OLD` ab, Text: „Dieser Spielstand stammt aus einer älteren Version mit erfundenen Vereinen und kann nicht mehr geladen werden.“
- [ ] **Step 4: Ganze Suite laufen lassen:** `npm test`. Tests, die nur an fest verdrahteten zwei Ligen oder Weltindizes hängen, inhaltsgleich anpassen. Jede Änderung an einer Testerwartung mit Bedeutung (nicht nur Index) bekommt eine Zeile im Ledger. → PASS, `npm run check` → 0 Fehler
- [ ] **Step 5: Commit** `feat(engine): drei Ligen mit echten Vereinen, Relegation an zwei Grenzen, Spielstand v4`

### Task 3: Wirtschaft für drei Ligastufen

**Files:**
- Modify: `src/engine/economy/finance.ts` (TV, Prämien, Sponsor, expectedIncome), `stadium.ts` (Nachfrage- und Zahlungsfaktor), `board.ts` (Schleifen über `LEAGUES`), `negotiations.ts` (Wechsel in niedrigere Liga über `leagueLevel`), `processing.ts` (Liga-Zuordnung über `LEAGUES`)
- Modify: `tests/longrun/economy.test.ts`, `tests/longrun/measure.ts`
- Create: `tests/longrun/timing.test.ts`
- Test: `tests/engine/economy/finance.test.ts`, `stadium.test.ts`, `negotiations.test.ts`, `board.test.ts`

**Interfaces:**
- Consumes: `LEAGUES`, `leagueLevel`, `COMP.third` (Task 2)
- Produces: Wirtschaftswerte pro Ligastufe als Tabellen, z. B. `TV_PER_MATCHDAY: Record<CompetitionId, number>` mit Einträgen für L1, L2 und L3. `PRIZE_POOL` analog. Die Faktoren für Sponsor, Nachfrage und Zahlungsbereitschaft stehen als Arrays nach `leagueLevel`.

- [ ] **Step 1: Tests schreiben:**
  - `finance.test.ts` `"TV-Geld und Prämien sinken nach unten"`: Für L1, L2 und L3 jeweils ≥ der nächsten Liga, L2 > L3.
  - `finance.test.ts` `"Sponsorangebote der 3. Liga sind im Schnitt niedriger als die der 2. Liga"` (gleicher Ruf, gleiche RNG).
  - `stadium.test.ts` `"3. Liga hat bei gleichem Ruf weniger Zuschauer als die 2. Liga"`.
  - `stadium.test.ts` `"Traditionsverein der 3. Liga ist zum Start fast voll"` (Review Focus 3): Fortuna Düsseldorf hat beim Startpreis gegen einen typischen L3-Gegner ≥ 0,9 Auslastung.
  - `negotiations.test.ts` `"ein Wechsel von der 2. in die 3. Liga gilt als Abstieg"`: gleiche Wirkung wie bisher von L1 nach L2.
  - `board.test.ts` `"Erwartungen in allen drei Ligen 2/4/6/6"` und `"Aufstieg als Titel-Ziel in der 3. Liga"`.
  - `tests/longrun/economy.test.ts`:
    - Die Referenzvereine pro Liga werden nach Ruf gewählt: groß, mittel und klein, also Ruf-Rang 1, 9 und 18 innerhalb der Liga. Die Korridore für L1 und L2 bleiben wie bisher. Neu für L3: mittel Ø zwischen 0 und 1,1 Mio, klein Ø ≥ 0.
    - Neu: `"großer Verein in unterer Liga bleibt im Plus"`: Fortuna Düsseldorf (L3) und Hertha BSC (L2) mit vernünftigem Manager haben im Mittel ein Ergebnis vor Transfers ≥ 0.
    - Neu: `"Aufstieg lohnt sich"`: Für Aufsteiger L3→L2 liegt die Summe aus TV-Geld, Sponsor und Tickets in der ersten L2-Saison um mindestens 30 % über der letzten L3-Saison (im 10-Saisons-KI-Lauf, gemittelt über alle Aufsteiger).
    - Die KI-Korridore (Median, Maximum, Dispo, Auslastung) gelten für alle 54 Vereine.
  - `tests/longrun/timing.test.ts` `"ein automatischer Spieltag bleibt schnell"`: Mittel über 20 `playMatchdayAuto` nach 3 Aufwärmtagen ≤ 220 ms. Richtwert gemessen am 2026-11-13 mit 36 Vereinen: 126–136 ms, also etwa das 1,6-Fache.
- [ ] **Step 2: Laufen lassen** → FAIL
- [ ] **Step 3: Umsetzen.** Alle `=== COMP.second`-Vergleiche in der Wirtschaft durch `leagueLevel` ersetzen. Werte für L3 festlegen und mit `tests/longrun/measure.ts` abstimmen, bis die Korridore halten. Der Mess-Helfer zählt Liga-Tabellen für alle `LEAGUES`.
- [ ] **Step 4: Laufen lassen:** `npm test` → PASS (inklusive Langzeit und Zeitmessung)
- [ ] **Step 5: Commit** `feat(engine): Wirtschaft der 3. Liga` mit den Kennzahlen im Commit-Text

### Task 4: Oberfläche für drei Ligen

**Files:**
- Modify: `src/ui/screens/NewGame.svelte`, `Tables.svelte`, `SeasonEnd.svelte`, `Results.svelte`
- Modify: `src/ui/logic/tables.ts` (`zoneFor`), `src/ui/logic/format.ts` (Relegationstage), `src/ui/live/layout.ts`
- Test: `tests/ui/newgame.test.ts`, `tests/ui/tables.test.ts`, `tests/ui/tablesScreen.test.ts`, `tests/ui/results.test.ts`, `tests/ui/flow.test.ts`, `tests/ui/live/*`, `tests/e2e/*.spec.ts`

**Interfaces:**
- Consumes: `LEAGUES`, `BOUNDARIES`, `startingLeagues`, `SeasonRecord.movements` (Task 2)
- Produces: `zoneFor(competitionId, rank)`: L1 Platz 1 champion, 16 playoff, 17/18 relegation. L2 Platz 1/2 promotion, 3 playoff, 16 playoff, 17/18 relegation. L3 Platz 1/2 promotion, 3 playoff, sonst null.

- [ ] **Step 1: Tests schreiben:**
  - `newgame.test.ts` `"die Vereinsauswahl bietet alle 54 Vereine nach Liga gruppiert"`: drei Gruppen „1. Liga“, „2. Liga“, „3. Liga“ mit je 18 Einträgen. TSV Havelse ist wählbar und startet ein Spiel in L3.
  - `tables.test.ts` `zoneFor` für alle drei Ligen wie oben, inklusive L3 Platz 18 → null (Review Focus 2).
  - `tablesScreen.test.ts` `"Umschalter mit drei Ligen, Start bei der Liga des Managers"` (Manager in L3 sieht zuerst die 3. Liga).
  - `results.test.ts`/`format`: An Kalendertag 34/35 heißt der Spieltag „Relegation“, beide Relegationen erscheinen in der Ergebnisübersicht.
  - `SeasonEnd`: Meister und Torschützenkönig aller drei Ligen, Auf- und Absteiger je Grenze („Aufsteiger in die 1. Liga: …“, „Absteiger in die 3. Liga: …“).
  - `tests/ui/live/layout`: Bei zwei Managern in L2 und L3 enthalten die freien Felder die Tabellen ihrer Ligen, zuerst die Liga des ersten Managers.
  - E2E (`tests/e2e/layout.spec.ts`): Die Vereinsauswahl und die Tabelle der 3. Liga haben keinen Überlauf.
- [ ] **Step 2: Laufen lassen:** `npx vitest run tests/ui` → FAIL
- [ ] **Step 3: Umsetzen.** Für die Vereinsauswahl bei 1280×800 drei Spalten oder eine Liste mit Liga-Umschalter, nach Wahl des Umsetzers. Wo der Platz knapp ist, wird der Kurzname angezeigt.
- [ ] **Step 4: Laufen lassen:** `npm test` → PASS, `npm run check` → 0 Fehler. E2E nur, falls der Browser in der Umgebung startet; sonst Ledger-Eintrag wie beim letzten Plan.
- [ ] **Step 5: Commit** `feat(ui): drei Ligen in Vereinsauswahl, Tabellen, Live und Saisonende`

### Task 5: Abschluss-Messung

- [ ] **Step 1:** `runSeasons` über die Seeds 11, 2027 und 4242 mit je 5 Saisons laufen lassen, mit 4 passiven Managern (je ein großer Verein pro Liga plus ein kleiner Drittligist). Festhalten:
  - KI-Median und -Maximum
  - Ergebnis je Liga und Größe
  - Auslastung
  - Kontostände der passiven Manager
  - Zeit pro Spieltag
- [ ] **Step 2:** Die Kennzahlen als Abschnitt „Ergebnis“ an die Spec anhängen.
- [ ] **Step 3: Commit** `docs(spec): Ergebnis drei Ligen`
