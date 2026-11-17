# Traditionsvereine aus der Regionalliga – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 64 Vereine: 54 in drei Ligen, 10 Traditionsvereine in einer spiellosen „Regionalliga“. Traditionsvereine sind wählbar mit Startliga, der schwächste Drittligist rutscht dafür in die Regionalliga.

**Architecture:** Der Datensatz bekommt die Startliga `"RL"`. Der Generator erzeugt die RL-Vereine nach allen bisherigen Vereinen und Vereinslosen, damit die Startwelt der Ligen gleich bleibt. Die Startliga-Logik behandelt RL als Stufe unter der 3. Liga. Im Saisonlauf sind RL-Vereine an genau den Stellen ausgenommen, an denen sie die Ligen berühren würden, und ihr Kader wird zu jedem Saisonbeginn aufgefüllt.

**Tech Stack:** TypeScript, Svelte 5, Vitest

**Spec:** `docs/superpowers/specs/2026-11-17-traditionsvereine-design.md`

## Global Constraints

- Immer 64 Vereine: 18/18/18 in den Ligen und 10 ohne Liga.
- Startwelt der 54 Ligavereine bei gleichem Seed unverändert.
- Spielstand-Version 5, ältere werden mit `TOO_OLD` abgelehnt.
- RL-Vereine: keine Ligaspiele, keine Finanzen, kein Vorstand, kein Markt, keine Jugend, keine auslaufenden Verträge, Auffüllen auf 25 zu Saisonbeginn.
- Texte deutsch, 1280×800 ohne Überlauf.

## Review Focus

1. **Traditionsverein in die 1. Liga zusammen mit Bayern in die 3. Liga:** Ketten und Sperren über vier Stufen. Am Ende 64 Vereine, kein Verein wechselt zweimal. Test in Task 2.
2. **RL-Verein ohne Startliga** in `startNewGame`: wird mit verständlicher Meldung abgelehnt. Test in Task 2.
3. **Ein Manager wählt einen Verein, der durch die Kette in die RL rutschen würde:** Er ist gesperrt, also rutscht der nächstschwächere. Test in Task 2.
4. **RL-Spieler im Transfermarkt eines Managers:** Sie erscheinen nicht, und `startTransferTalk` lehnt sie ab. Test in Task 3.
5. **Saisonwechsel mit vielen Karriereenden in einem RL-Kader:** Nach dem Saisonstart hat der Kader trotzdem 25 Spieler und eine gültige Aufstellung. Test in Task 3.

---

### Task 1: Datensatz, Welt mit 64 Vereinen, Spielstand v5

**Files:**
- Modify: `src/engine/clubs.ts` (`StartLeague` um `"RL"`, 10 Einträge), `src/engine/generator.ts`, `src/engine/model.ts` (`version: 5`), `src/engine/season.ts` (`startingLeagues` ignoriert RL), `src/storage/migrate.ts`
- Create: `src/engine/regionalliga.ts` mit `isRegionalliga(state, clubId): boolean` (Verein steht in keiner Liga)
- Test: `tests/engine/clubs.test.ts`, `tests/engine/generator.test.ts`, `tests/engine/worldSnapshot.test.ts`, `tests/storage/savefile.test.ts`

- [ ] **Step 1: Schnappschuss der heutigen Startwelt aufnehmen, bevor Code geändert wird.** In `worldSnapshot.test.ts`: Für die Seeds 11 und 2027 werden Namen, Ruf, Kader-IDs und Spielerwerte (ID, Stärke, Alter, Potenzial, Gehalt) der 54 Ligavereine und der Vereinslosen gesammelt. Daraus wird per `toMatchSnapshot()` ein Schnappschuss. Laufen lassen → Schnappschuss wird geschrieben, committen als `test: Schnappschuss der Startwelt vor den Traditionsvereinen`.
- [ ] **Step 2: Tests schreiben:**
  - `clubs.test.ts`: 64 Einträge, davon 10 mit `"RL"` und genau den Namen aus Spec 3. Kurznamen eindeutig. Jede RL-Kaderstärke ist kleiner als die kleinste der 3. Liga. Die bisherigen Ligatests gelten unverändert für L1 bis L3.
  - `generator.test.ts`: 64 Vereine.
  - `worldSnapshot.test.ts`: Der Schnappschuss aus Step 1 bleibt gleich (der Test filtert auf Nicht-RL-Vereine).
  - `newgame`: Nach dem Spielstart gibt es 18/18/18 in den Ligen, 10 Vereine sind `isRegionalliga`.
  - `savefile.test.ts`: Ein frisches Spiel hat Version 5, Version 4 wird mit `TOO_OLD` abgelehnt.
- [ ] **Step 3: Laufen lassen** → FAIL
- [ ] **Step 4: Umsetzen.** Generator-Reihenfolge: erst die Ligavereine aus `CLUBS` (wie bisher), dann die Vereinslosen, dann die RL-Vereine. Gehaltsfaktor der RL: 0,5. Kaderstärke der RL-Einträge etwa 10–17, Ruf nach Spec 3.
- [ ] **Step 5: Laufen lassen:** `npm test` → PASS (Tests, die 54 als Gesamtzahl annehmen, inhaltsgleich auf 64 bzw. „Ligavereine“ umstellen, mit Ledger-Zeile), `npm run check` → 0 Fehler
- [ ] **Step 6: Commit** `feat(engine): 10 Traditionsvereine in der Regionalliga, 64 Vereine`

### Task 2: Traditionsvereine wählen

**Files:**
- Modify: `src/engine/startLeague.ts`, `src/engine/season.ts` (`startNewGame`)
- Test: `tests/engine/startLeague.test.ts`

**Interfaces:**
- Consumes: `isRegionalliga`, Datensatz mit `"RL"` (Task 1)
- Produces: `applyStartLeagues` kennt RL als vierte Stufe unter L3. `leagueProfile("RL", …)` funktioniert. `startNewGame` lehnt einen RL-Verein ohne `league` mit „Bitte wähle für den Traditionsverein eine Startliga.“ ab und `league: "RL"` mit „Diese Liga gibt es nicht.“.

- [ ] **Step 1: Tests schreiben:**
  - `"1860 in die 3. Liga"`: 1860 steht in L3, der schwächste Drittligist ist RL und hat Ruf `leagueProfile("RL","highest").reputation`, insgesamt 64 Vereine.
  - `"1860 in die 1. Liga"`: Je der schwächste Verein wechselt L1→L2, L2→L3 und L3→RL.
  - `"1860 in die 1. Liga und Bayern in die 3. Liga"` (Review Focus 1): 18/18/18, 10 RL-Vereine, kein Verein mehr als eine Stufe von seiner echten entfernt außer den Manager-Vereinen.
  - `"RL-Verein ohne Startliga wird abgelehnt"` (Review Focus 2)
  - `"ein Manager-Verein rutscht nie in die RL"` (Review Focus 3): A wählt 1860 in die 3. Liga, B den schwächsten Drittligisten. B bleibt in L3, der nächstschwächere rutscht.
- [ ] **Step 2: Laufen lassen** → FAIL
- [ ] **Step 3: Umsetzen.** In `applyStartLeagues` wird intern mit der Stufenliste `[L1, L2, L3, RL]` gerechnet. Die RL-Menge wird mitgeführt, zurückgegeben werden weiter nur die drei Ligen.
- [ ] **Step 4: Laufen lassen:** `npx vitest run tests/engine` → PASS
- [ ] **Step 5: Commit** `feat(engine): Traditionsvereine mit Startliga wählen`

### Task 3: Regionalliga im Saisonlauf

**Files:**
- Modify: `src/engine/economy/contracts.ts` (`expireContracts`, `aiRenewals` überspringen RL), `src/engine/economy/training.ts` (`addYouth` überspringt RL), `src/engine/economy/market.ts` (`aiTransferRound` nur Ligavereine, `candidates` und `generateAiOffers` ohne RL-Spieler und RL-Käufer), `src/engine/economy/negotiations.ts` (`startTransferTalk` lehnt RL-Spieler ab), `src/ui/logic/economy.ts` (Marktliste ohne RL-Spieler), `src/engine/regionalliga.ts` (`refillRegionalliga(state, rng)`), `src/engine/economy/processing.ts` (Aufruf zu Saisonbeginn)
- Test: `tests/engine/regionalliga.test.ts`, `tests/longrun/seasons.test.ts`

**Interfaces:**
- Produces: `refillRegionalliga(state: GameState, rng: Rng): void` füllt jeden RL-Kader auf 25 auf (Stärke wie `leagueProfile("RL","median")`, Gehaltsfaktor 0,5) und stellt neu auf.

- [ ] **Step 1: Tests schreiben** (`regionalliga.test.ts`):
  - `"RL-Verträge laufen nicht aus"`: Nach `finishSeason` sind alle RL-Spieler noch im Verein, außer denen mit Karriereende.
  - `"RL-Kader nach dem Saisonwechsel wieder 25 Spieler mit gültiger Aufstellung"` (Review Focus 5): Vorher 8 RL-Spieler auf `retired`/Alter 36 setzen.
  - `"RL-Spieler sind nicht im Markt"` (Review Focus 4): `marketView` bzw. die Marktliste enthält keine RL-Spieler, und `startTransferTalk` liefert eine Fehlermeldung.
  - `"RL-Vereine kaufen nicht und bekommen keine Jugend"`: Nach `aiTransferRound` und `addYouth` sind die RL-Kader unverändert.
  - `"RL-Vereine buchen nichts"`: Nach einem Spieltag ist das Kassenbuch der RL-Vereine leer.
  - `tests/longrun/seasons.test.ts`: Über 10 Saisons bleibt es bei 64 Vereinen, 18/18/18 plus 10. Jeder RL-Verein hat zu jedem Saisonbeginn mindestens 22 Spieler.
- [ ] **Step 2: Laufen lassen** → FAIL
- [ ] **Step 3: Umsetzen** an den genannten Stellen. `refillRegionalliga` läuft in `startSeasonEconomy`.
- [ ] **Step 4: Laufen lassen:** `npm test` → PASS (Langzeit inklusive), `npm run check` → 0 Fehler
- [ ] **Step 5: Commit** `feat(engine): Regionalliga ohne Spiele, Kader bleiben erhalten`

### Task 4: Traditionsvereine in „Neues Spiel“

**Files:**
- Modify: `src/ui/screens/NewGame.svelte`
- Test: `tests/ui/newgame.test.ts`

- [ ] **Step 1: Tests schreiben:**
  - Vier Gruppen, die vierte heißt „Traditionsvereine (Regionalliga)“ und hat 10 Einträge.
  - Die Startliga springt bei 1860 auf „3. Liga“, die Startliga-Auswahl bietet weiter nur die drei Ligen.
  - Ein Spiel mit 1860 in der 3. Liga startet dort.
- [ ] **Step 2: Laufen lassen** → FAIL
- [ ] **Step 3: Umsetzen.** `realLeague` liefert für RL-Vereine L3 als Vorauswahl.
- [ ] **Step 4: Laufen lassen:** `npm test` → PASS, `npm run check` → 0 Fehler
- [ ] **Step 5: Commit** `feat(ui): Traditionsvereine in „Neues Spiel“`
