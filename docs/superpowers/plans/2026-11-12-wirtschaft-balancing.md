# Wirtschafts-Balancing, Stadion und Vorstand – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Geldmenge bremsen, Königstransfer ermöglichen, Stadion und Eintrittspreis zu echten Entscheidungen machen, Saisonziel und Vorstandsvertrauen sichtbar machen.

**Architecture:** Die Engine bekommt neue Board-Felder (Vertrauensverlauf, Saisonhistorie) mit Spielstand v3, eine neue Nachfrage- und KI-Stadionlogik in `economy/stadium.ts` und neu kalibrierte Gehälter, Marktwerte und Geldflüsse. Ein Mess-Helfer in `tests/longrun/` liefert die Kennzahlen, gegen die der Langzeittest die Zielkorridore der Spec prüft. Die Oberfläche bekommt zwei neue Bildschirme (`Stadium.svelte`, `Board.svelte`) und ein Hauptmenü mit 10 Kacheln.

**Tech Stack:** TypeScript, Svelte 5, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-12-wirtschaft-balancing-design.md` (ergänzt `2026-10-31-fussballmanager-design.md`). Entwurf B: https://claude.ai/artifact/D2vWoBDgddqzgk7H1Y1wzM

## Global Constraints

- An der Spielsimulation (`src/engine/match/`) ändert sich nichts. `tests/engine/rngFingerprint.test.ts` muss unverändert grün bleiben.
- Die Fläche bleibt 1280×800, kein Überlauf (`tests/e2e/layout.spec.ts`, `tests/ui/sizes.test.ts`).
- Alle Texte sind deutsch, im Stil der bestehenden Meldungen.
- Spielstand-Version wird 3. v2-Spielstände laden mit leeren neuen Feldern, ohne Umrechnung von Geld, Stadion, Preisen oder Verträgen.
- Höchstens 2–3 KI-Transfers pro Fenster (`MAX_AI_BUYS` bleibt).
- Manager werden nie entlassen. Das Vertrauen hat außer Nachrichten keine Folgen.
- Zielkorridore der Wirtschaft stehen in Spec 4.1, Stadion in 5.1, Vertrauen in 6.5. Alle Zahlenwerte und Formeln sind dem Umsetzer überlassen, solange die Korridore erreicht werden.

## Review Focus

1. **Liga-Wechsel und Saisonhistorie:** Ein Verein steigt ab oder auf. Der Eintrag der abgelaufenen Saison muss die alte Liga und das alte Ziel tragen, die Beschriftung muss also „Aufstieg“ oder „Meisterschaft“ passend zur damaligen Liga zeigen. Test in Task 2.
2. **Vorstandsseite vor dem ersten Spiel:** Bei Kalenderindex 0 ist der Verlauf leer und die Tabelle hat keine Spiele. Die Seite muss ohne Fehler rendern, mit Trend „–“ und dem Platz aus der Starttabelle. Test in Task 6.
3. **Extreme Eintrittspreise:** Bei 5 € und 100 € liegen die Zuschauer immer zwischen 0 und der Kapazität. Bei 100 € dürfen es 0 sein, ohne Absturz. Test in Task 3.
4. **Relegationsspieltage:** An den Kalenderindizes 34 und 35 ändern sich Vertrauen und Verlauf nicht, und die KI passt ihren Preis nicht an. Zuschauer werden trotzdem berechnet. Test in Task 2 (Vertrauen) und Task 3 (KI-Preis).
5. **KI baut ohne Geld:** Ein KI-Verein mit knappem Konto startet keinen Ausbau, der ihn unter null bringt. Test in Task 3.

---

### Task 1: Board-Felder und Spielstand v3

**Files:**
- Modify: `src/engine/model.ts` (Board, GameState.version)
- Modify: `src/engine/generator.ts:121`
- Modify: `tests/engine/fixtures.ts:62`
- Modify: `src/storage/migrate.ts`, `src/storage/migrations.ts`
- Test: `tests/storage/migrations.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface BoardSeason { season: number; competitionId: CompetitionId; expectation: Expectation; rank: number; met: boolean }
  export interface Board { expectation: Expectation; confidence: number; warned: boolean; trend: number[]; seasons: BoardSeason[] }
  // GameState.version: 3
  export const v2ToV3: Migration // in src/storage/migrations.ts
  // CURRENT_VERSION = 3, MIGRATIONS = { 1: v1ToV2, 2: v2ToV3 }
  ```

- [ ] **Step 1: Tests schreiben** in `tests/storage/migrations.test.ts`, neuer `describe("Migration v2 → v3")`:
  - `"ergänzt trend und seasons leer, sonst unverändert"`: v1-Fixture durch `migrate` laden. Erwartet `state.version === 3` und für jeden Verein `board.trend` gleich `[]` und `board.seasons` gleich `[]`. `finance.balance` und `finance.stadiumStage` eines beliebigen Vereins sind gleich wie in der Fixture.
  - `"ein neues Spiel hat Version 3 und leere Board-Historie"`: `startNewGame(generateWorld(11), …)`, alle Vereine haben `trend: []` und `seasons: []`.
  - Den bestehenden Test `"die eingefrorene v1-Datei lädt als v2"` auf Version 3 umstellen.
- [ ] **Step 2: Tests laufen lassen:** `npx vitest run tests/storage` → FAIL (version 2, trend undefined)
- [ ] **Step 3: Umsetzen.** Model-Typen erweitern, `generator.ts` und `fixtures.ts` mit `trend: [], seasons: []`. `v2ToV3` setzt für jeden Verein mit `board`-Objekt `trend = []` und `seasons = []`, falls sie fehlen, und gibt `{ ...raw, version: 3 }` zurück. `CURRENT_VERSION = 3`.
- [ ] **Step 4: Alles laufen lassen:** `npx vitest run tests/storage tests/engine` → PASS. `npm run check` → 0 Fehler.
- [ ] **Step 5: Commit** `feat(engine): Board-Verlauf und Saisonhistorie, Spielstand v3`

### Task 2: Vertrauen ausgewogen, Verlauf und Saisonhistorie

**Files:**
- Modify: `src/engine/economy/board.ts` (`updateConfidence`, `seasonReview`)
- Test: `tests/engine/economy/board.test.ts`

**Interfaces:**
- Consumes: `Board.trend`, `Board.seasons`, `BoardSeason` aus Task 1
- Produces: `export const TREND_LENGTH = 5;` in `board.ts`. `updateConfidence` hängt für Vereine mit Manager nach jedem Liga-Spieltag den neuen Wert an `trend` und kürzt auf die letzten `TREND_LENGTH`. `seasonReview` hängt für Vereine mit Manager `{ season: state.season, competitionId: league, expectation, rank, met }` an `board.seasons`.

- [ ] **Step 1: Tests schreiben** in `board.test.ts`:
  - `"Gewinn und Verlust sind symmetrisch"`: Gleiche Ausgangslage mit Confidence 50. Ein Verein steht 4 Plätze über dem Ziel und gewinnt, ein anderer steht 4 Plätze darunter und verliert. `|Δ gut| ≈ |Δ schlecht|` mit Toleranz 0,01.
  - `"knapp neben dem Ziel kostet wenig"`: 1 Platz unter dem Ziel und Unentschieden ergibt `Δ` zwischen −0,5 und 0.
  - `"eine halbe Saison deutlich unter dem Ziel: unter 30, aber nicht 0"`: Start 60, 17 Liga-Spieltage auf Platz Ziel+6 mit abwechselnd Niederlage und Unentschieden. Ergebnis `< 30` und `> 0`.
  - `"Verlauf hält die letzten 5 Werte nur für Manager-Vereine"`: 7 Liga-Spieltage verarbeiten. `trend.length === 5`, letzter Wert gleich `confidence`. Ein KI-Verein hat `trend` gleich `[]`.
  - `"Relegationstage ändern weder Vertrauen noch Verlauf"`: `calendarIndex = 34`, Werte unverändert.
  - `"Saisonhistorie mit alter Liga und altem Ziel"`: Manager-Verein in der 1. Liga mit Ziel `survival` auf Platz 17. Nach `finishSeason` steht er in der 2. Liga, und `board.seasons[0]` ist gleich `{ season: 1, competitionId: COMP.first, expectation: "survival", rank: 17, met: false }`.
  - Bestehende Tests zu den alten Grenzen (`-2.5` und `1.5`) an die neue Formel anpassen. Die Saisonbilanz-Tests (+15, −10, −15) bleiben.
- [ ] **Step 2: Laufen lassen:** `npx vitest run tests/engine/economy/board.test.ts` → FAIL
- [ ] **Step 3: Umsetzen.** Die Formel wählt der Umsetzer. Vorgabe ist Spec 6.5: gleich große Ausschläge, kleiner Malus für 1–2 Plätze daneben. Weil `seasonReview` vor `startSeason` läuft, ist die Liga in `tables` noch die alte.
- [ ] **Step 4: Laufen lassen:** `npx vitest run tests/engine` → PASS
- [ ] **Step 5: Commit** `feat(engine): Vorstandsvertrauen ausgewogen, mit Verlauf und Saisonhistorie`

### Task 3: Nachfrage, Kapazität, Eintrittspreis und KI-Stadion

**Files:**
- Modify: `src/engine/economy/stadium.ts` (STADIUM, `initialStage`, `attendance`, `optimalPrice`/`referencePrice`)
- Modify: `src/engine/economy/processing.ts` (`processMatchday`)
- Modify: `src/engine/economy/finance.ts` (`startSeasonFinances` nutzt KI-Startpreis)
- Modify: `src/engine/generator.ts:112` (`startPrice` statt `optimalPrice`)
- Modify: `src/ui/screens/Finance.svelte:66` (die Zeile „Richtwert“ entfällt, weil `optimalPrice` wegfällt; der Hinweis kommt in Task 6)
- Test: `tests/engine/economy/finance.test.ts`, neu `tests/engine/economy/stadium.test.ts`

**Interfaces:**
- Produces in `stadium.ts`:
  ```ts
  export function aiStadiumDecisions(state: GameState): void   // KI-Preis anpassen und ggf. ausbauen; nur an Liga-Spieltagen aufgerufen
  export function startPrice(reputation: number): number       // Startpreis für alle Vereine (ersetzt optimalPrice in generator.ts und finance.ts)
  ```
  `attendance(state, homeId, awayId): number` behält die Signatur.
- `processMatchday` ruft `aiStadiumDecisions(state)` direkt nach `processFinances` auf, nur wenn `isLeagueMatchday(state.calendarIndex)`.

- [ ] **Step 1: Tests schreiben** in `stadium.test.ts`. Welt aus `generateWorld(2027)` mit `startNewGame`. Für „voll“ und „leer“ eine Tabellenlage nach 10 gespielten Runden herstellen (`playMatchdayAuto` 10×):
  - `"große Vereine sind zum Start ausverkauft"`: Die 3 Erstligisten mit dem höchsten Ruf haben beim Startpreis und Tabellenplatz 1–3 gegen einen Durchschnittsgegner `attendance ≥ 0.98 × Kapazität`.
  - `"kleine Vereine haben im Startstadion Lücken"`: Die 3 Zweitligisten mit dem niedrigsten Ruf liegen im Mittelfeld bei `attendance < 0.9 × Kapazität`.
  - `"Abstiegskandidat hat Lücken"`: Ein Erstligist auf Platz 17 hat beim Startpreis `attendance < 0.85 × Kapazität`.
  - `"voll: höherer Preis bringt mehr Erlös"`: Bei einem ausverkauften Verein ist der Erlös bei Preis +5 € größer als beim Startpreis.
  - `"leer: niedrigerer Preis bringt mehr Erlös"`: Bei einem Verein unter 70 % Auslastung ist der Erlös bei Preis −5 € größer.
  - `"Ausbau bringt einem vollen Verein mehr Zuschauer"`: Ein ausverkaufter Verein mit `stadiumStage + 1` hat mehr Zuschauer als vorher.
  - `"extreme Preise bleiben im Rahmen"` (Review Focus 3): Für 5 € und 100 € gilt `0 ≤ attendance ≤ Kapazität`.
  - `"KI erhöht bei vollem Haus, senkt bei leerem"`: `aiStadiumDecisions` hebt bei `lastAttendance === capacity` den Preis und senkt ihn bei `lastAttendance < 0.75 × capacity`. Preise bleiben in `[5, 100]`. Manager-Vereine bleiben unberührt.
  - `"KI passt an Relegationstagen nichts an"` (Review Focus 4): `processMatchday` mit `calendarIndex = 34` ändert keinen KI-Preis.
  - `"KI baut nur mit Geld"` (Review Focus 5): Ein ausverkaufter KI-Verein mit Kontostand knapp unter den Baukosten startet keinen Ausbau. Mit genug Polster (Baukosten plus eine Reserve nach Wahl des Umsetzers) startet er einen.
  - In `finance.test.ts` die Tests anpassen, die an `optimalPrice` und den alten STADIUM-Werten hängen. `"Saisonstart … KI mit optimalem Preis"` wird zu „KI behält ihren Preis“ oder „KI startet mit `startPrice`“, je nach Umsetzung.
- [ ] **Step 2: Laufen lassen:** `npx vitest run tests/engine/economy` → FAIL
- [ ] **Step 3: Umsetzen.** Die Nachfrage soll so abgestimmt sein, dass Kapazität die Grenze ist. Preisfaktor, Kapazitäten und Startstufe sind frei wählbar, die 5 Stufen bleiben. KI-Preisregel und Ausbaubedingung entscheidet der Umsetzer. Ein Ausbau soll sich für einen vorher vollen Verein in etwa 3–5 Saisons amortisieren.
- [ ] **Step 4: Laufen lassen:** `npx vitest run tests/engine` → PASS, `npm run check` → 0 Fehler
- [ ] **Step 5: Commit** `feat(engine): Stadien werden voll, Preis nach Auslastung, KI baut aus`

### Task 4: Marktwerte und Gehälter für Topspieler

**Files:**
- Modify: `src/engine/economy/money.ts` (`salaryFor`, `marketValue`)
- Test: `tests/engine/economy/money.test.ts`

**Interfaces:**
- Produces: unveränderte Signaturen `salaryFor(strength: number): number` und `marketValue(p: Player, season: number): number`

- [ ] **Step 1: Tests schreiben** in `money.test.ts`:
  - `"Spitze kostet 15–25 Mio"`: In `startNewGame(generateWorld(s))` für die Seeds 11, 2027 und 4242 haben 5–10 Vereinsspieler einen Marktwert über 15 Mio, der teuerste liegt zwischen 20 und 25 Mio.
  - `"schwache Spieler bleiben billig"`: Ein Spieler mit Stärke 50 kostet höchstens 300.000 €. *(Grenze nach Wahl des Umsetzers, falls die Kalibrierung es verlangt. Wichtig ist nur, dass das untere Ende nicht mitwächst.)*
  - Die festen Erwartungen `salaryFor(40/50/70)` an die neue Kurve anpassen. Die Eigenschaften „exponentiell“, „alt = billiger“ und „Vertragsende senkt den Wert“ bleiben als Tests.
- [ ] **Step 2: Laufen lassen** → FAIL
- [ ] **Step 3: Umsetzen.** Die Kurven werden oben steiler. Gehälter steigen für Stars so weit, dass die Zielkorridore in Task 5 erreichbar sind. Das wird in Task 5 feinjustiert.
- [ ] **Step 4: Laufen lassen:** `npx vitest run tests/engine` → PASS
- [ ] **Step 5: Commit** `feat(engine): Topspieler kosten 15–25 Mio`

### Task 5: Geldflüsse und KI-Ausgaben auf die Zielkorridore abstimmen

**Files:**
- Create: `tests/longrun/measure.ts` (Mess-Helfer, kein Test)
- Modify: `tests/longrun/economy.test.ts`
- Modify nach Bedarf: `src/engine/economy/finance.ts` (TV, Prämien, Sponsor), `stadium.ts` (Unterhalt, Nachfragehöhe), `money.ts`, `market.ts` (KI-Budget, `candidates`, `WAGE_SHARE`)

**Interfaces:**
- Consumes: Tasks 3 und 4
- Produces in `tests/longrun/measure.ts`:
  ```ts
  export interface SeasonMetrics {
    season: number;
    aiMedianBalance: number; aiMaxBalance: number; aiOverLimit: number;
    resultBeforeTransfers: Record<ClubId, number>;   // Summe Kassenbuch ohne "transfers" und "stadium"
    utilization: Record<ClubId, number>;             // Ø Zuschauer / Kapazität der Heimspiele
    topMarketValues: number[];                       // absteigend, Top 10
  }
  export function runSeasons(seed: number, seasons: number, managers?: { name: string; clubId: ClubId }[]): { metrics: SeasonMetrics[]; start: { aiMedianBalance: number }; state: GameState }
  ```

- [ ] **Step 1: Mess-Helfer schreiben** (`measure.ts`). Er spielt mit `prepareMatchday`/`kickOff`/`playHalf`/`aiHalftimeAll`/`finishMatchday`, sammelt die Auslastung pro Heimspiel und liest das Kassenbuch vor `finishSeason`.
- [ ] **Step 2: Langzeittest auf Spec 4.1 umstellen** in `economy.test.ts`. 10 Saisons, Seed 2027, nur KI:
  - `aiMedianBalance` jeder Saison liegt zwischen 0,7× und 2,5× des Startwerts, und Saison 10 liegt höchstens 1,5× über Saison 5 (kein Aufwärtstrend).
  - `aiMaxBalance ≤ 40_000_000`, `aiOverLimit ≤ 1` in jeder Saison.
  - Die Erstligisten mit Ruf ≥ 85 kommen im Mittel über die Saisons auf `resultBeforeTransfers` zwischen 8 und 12 Mio. Die mittleren Erstligisten (Tabellenplätze 7–12 nach Ruf) liegen zwischen 2 und 5 Mio. Kein Zweitligist liegt im Mittel unter 0, und ihr Median liegt bei höchstens 2 Mio.
  - Die Erstligisten mit dem höchsten Ruf (Top 3) haben im Mittel eine Auslastung ≥ 0,9, die drei letzten der 1. Liga am Saisonende liegen im Mittel unter 0,85.
  - `topMarketValues[0]` liegt in jeder Saison zwischen 15 und 30 Mio (Spitze driftet nicht weg).
  - Die bestehenden Stabilitätsprüfungen (Kadergrößen, Stärke, freie Spieler, Nachrichtenzahl) bleiben.
- [ ] **Step 3: Königstransfer-Test** in `economy.test.ts`: `"großer Erstligist kann nach höchstens 2 Saisons 20 Mio zahlen"`. Ein Manager übernimmt den Erstligisten mit dem höchsten Ruf. Ein Hilfsschritt verlängert vor jedem Saisonende alle auslaufenden Verträge seiner Stammspieler mit `signContract(state, id, clubId, salaryDemand(state, p, clubId), 2)` (gepflegter Kader, keine Transfers). Nach 2 Saisons gilt `balance ≥ 20_000_000`.
- [ ] **Step 4: Laufen lassen:** `npx vitest run tests/longrun` → FAIL (alte Geldflüsse)
- [ ] **Step 5: Abstimmen.** Die Stellschrauben aus Spec 4.2 so lange anpassen, bis Step 2 und Step 3 grün sind. KI-Vereine sollen Überschuss ausgeben. Erlaubt sind ein höheres Transferbudget, Käufe von Stammspielern anderer KI-Vereine gegen deutlich über Marktwert und Stadionausbau aus Task 3. `MAX_AI_BUYS` bleibt. Die Zwischenstände mit `runSeasons` über 3 Seeds (11, 2027, 4242) prüfen, damit ein Seed nicht zufällig passt.
- [ ] **Step 6: Alles laufen lassen:** `npm test` → PASS. Auch `tests/engine/calibration.test.ts` und `rngFingerprint.test.ts` bleiben grün.
- [ ] **Step 7: Commit** `feat(engine): Geldflüsse gebremst, KI gibt Überschuss aus` mit den Kennzahlen (Median, Max, Erstliga-Ergebnis) im Commit-Text

### Task 6: Kopfzeile, Hauptmenü mit 10 Kacheln, Stadion- und Vorstandsseite

**Files:**
- Modify: `src/ui/controller.svelte.ts` (`TurnScreen` um `"stadium" | "board"`)
- Modify: `src/App.svelte` (Routing)
- Modify: `src/ui/screens/ClubHeader.svelte`, `MainMenu.svelte`, `Finance.svelte`
- Create: `src/ui/screens/Stadium.svelte`, `src/ui/screens/Board.svelte`
- Create: `src/ui/logic/board.ts`, `src/ui/logic/stadium.ts`
- Test: `tests/ui/menu.test.ts`, `tests/ui/finance.test.ts`, neu `tests/ui/stadium.test.ts`, `tests/ui/board.test.ts`, `tests/e2e/layout.spec.ts`, `tests/e2e/season.spec.ts`, `tests/e2e/dialogs.spec.ts`

**Interfaces:**
- Consumes: `Board.trend`, `Board.seasons` (Task 1/2), `expectationLabel`, `TARGET_RANK`, `WARN_BELOW` aus `board.ts`, `clubPlace` aus `ui/logic/tables.ts`
- Produces:
  ```ts
  // src/ui/logic/board.ts
  export type Trend = "steigend" | "gleich" | "fallend" | "–";
  export function confidenceTrend(trend: number[]): Trend;  // < 2 Werte → "–"; Differenz letzter–erster: > 1 steigend, < −1 fallend, sonst gleich
  export function targetRange(e: Expectation): [number, number]; // title [1,2], upper [1,6], mid [1,12], survival [1,15]
  export function boardRemark(rank: number, e: Expectation): string; // ein Satz je Lage, Texte frei
  // src/ui/logic/stadium.ts
  export function priceHint(lastAttendance: number, capacity: number): string | null;
  // ≥ 98 %: "Ausverkauft – ein höherer Preis bringt vermutlich mehr."
  // < 75 % und > 0: "Viele freie Plätze – ein niedrigerer Preis lockt mehr Zuschauer."
  // sonst null
  ```

- [ ] **Step 1: Logik-Tests schreiben** (`tests/ui/board.test.ts`, `tests/ui/stadium.test.ts`, Teil Logik):
  - `confidenceTrend([])` und `([50])` ergeben `"–"`, `([40, 45])` ergibt `"steigend"`, `([50, 49.5])` ergibt `"gleich"`, `([60, 50])` ergibt `"fallend"`.
  - `targetRange("title")` ergibt `[1, 2]`, `targetRange("survival")` ergibt `[1, 15]`.
  - `priceHint(28_000, 28_000)` ergibt den Ausverkauft-Text, `priceHint(10_000, 28_000)` den Text zu freien Plätzen, `priceHint(0, 28_000)` und `priceHint(25_000, 28_000)` ergeben `null`.
- [ ] **Step 2: Bildschirm-Tests schreiben:**
  - `menu.test.ts`: `"hat 10 Kacheln, keine gesperrt"`. Die Tasten `1..9, 0` öffnen `squad, training, contracts, transfers, finance, stadium, board, tables, messages`, und `0` startet den Spieltag. Enter startet weiterhin den Spieltag. Die bisherigen Tests zu den Tasten 6, 7 und 8 umschreiben.
  - `ClubHeader`: Im Hauptmenü steht `Ziel: Klassenerhalt` (bzw. das Label des Vereins) in der Kopfzeile.
  - `stadium.test.ts`: Die Seite zeigt Kapazität, Stufe, „x von y“ beim letzten Heimspiel samt Prozent und den Hinweis. Sie setzt den Preis (gültig und ungültig) und baut aus, wenn das Geld reicht. Die Tests `"setzt den Eintrittspreis …"` und `"baut das Stadion aus …"` ziehen aus `finance.test.ts` hierher um. Esc führt zurück ins Menü.
  - `board.test.ts` (Bildschirm): Bei Kalenderindex 0 rendert die Seite mit Trend „–“ und einer leeren Historie, in der nur die laufende Saison „läuft“ zeigt (Review Focus 2). Nach einer gespielten Saison zeigt die Historie Liga, Ziel, Platz und „erreicht“/„verfehlt“. Die Zielplätze sind auf der Leiter markiert, der eigene Platz ist hervorgehoben. Der Sponsorbonus erscheint nur mit gewähltem Sponsor. Esc führt zurück.
  - `finance.test.ts`: Die Finanzseite zeigt keinen Eintritts- und keinen Stadionbereich mehr.
- [ ] **Step 3: Laufen lassen:** `npx vitest run tests/ui` → FAIL
- [ ] **Step 4: Umsetzen** nach Entwurf B und Spec 6.1–6.4, mit den Theme-Bausteinen `Panel`, `Tile` und `.btn`. Das Menüraster hat 5 Spalten × 2 Zeilen. Die Kachel-Symbole wählt der Umsetzer (Entwurf: `[]` Stadion, `^` Vorstand). Die Tastenbelegung im Stadion-Bildschirm übernimmt die bestehende Logik aus `Finance.svelte`.
- [ ] **Step 5: E2E anpassen:** In `layout.spec.ts` bekommt die Kachelliste die Einträge `["6", "STADION"]`, `["7", "VORSTAND"]`, `["8", "TABELLE"]` und `["9", "NACHRICHTEN"]`, `"5"` prüft weiter `"BILANZ"`. Der Spieltag startet mit `"0"`. In `season.spec.ts` und überall sonst wird `press("8")` für „Weiter“ zu `press("0")`.
- [ ] **Step 6: Alles laufen lassen:** `npm test` → PASS, `npm run check` → 0 Fehler, `npm run test:e2e -- --trace off` → PASS
- [ ] **Step 7: Commit** `feat(ui): Vorstand und Stadion im Hauptmenü, Saisonziel in der Kopfzeile`

### Task 7: Abschluss-Messung

**Files:**
- Modify: `docs/superpowers/specs/2026-11-12-wirtschaft-balancing-design.md` (Abschnitt „Ergebnis der Abstimmung“ anhängen)

- [ ] **Step 1:** `runSeasons` für die Seeds 11, 2027 und 4242 über je 5 Saisons mit 4 passiven Managern laufen lassen (wie die Testsaison aus Spec 1: Ruf-Rang 3 und 16 der 1. Liga, Rang 2 und 17 der 2. Liga). Festhalten:
  - Median und Maximum der KI-Kontostände
  - Ergebnis vor Transfers je Vereinsgröße
  - Auslastung
  - Marktwertspitze
  - Kontostände der passiven Manager
- [ ] **Step 2:** Die Kennzahlen als kurze Tabelle in der Spec unter „Ergebnis der Abstimmung“ anhängen. Prüfen, dass ein passiver Manager nicht reicher wird als ein KI-Verein ähnlicher Größe (Spec 4.2). Falls doch, zurück zu Task 5, Step 5.
- [ ] **Step 3: Commit** `docs(spec): Ergebnis der Wirtschafts-Abstimmung`
