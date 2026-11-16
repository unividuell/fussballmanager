# Startliga wählen – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Manager wählt zum Verein eine Startliga. Ein versetzter Verein und alle Nachrücker werden vollständig an ihre neue Liga angepasst.

**Architecture:** Ein neues Engine-Modul `src/engine/startLeague.ts` verschiebt Vereine nach den Regeln der Spec und passt sie an. `startNewGame` ruft es nach dem Anlegen der Manager auf, vor `startSeason`. Die Kadererzeugung wird aus `generateWorld` als `generateSquad` herausgelöst und wiederverwendet. Die Oberfläche bekommt pro Manager eine zweite Auswahl.

**Tech Stack:** TypeScript, Svelte 5, Vitest

**Spec:** `docs/superpowers/specs/2026-11-16-startliga-design.md`

## Global Constraints

- Ohne abweichende Startliga entsteht bei gleichem Seed exakt dieselbe Welt wie bisher. Kein Zufallszug, wenn niemand wechselt.
- Manager-Vereine rücken nie nach. Jeder Verein wechselt beim Spielstart höchstens einmal.
- Die Spielstand-Version bleibt 4. Die Form des Spielstands ändert sich nicht.
- 1280×800 ohne Überlauf, Texte deutsch.

## Review Focus

1. **Zwei Manager in derselben Kette:** Manager A setzt Bayern in L3, Manager B Havelse in L1. Kein Verein wechselt zweimal, alle Ligen haben 18 Vereine. Test in Task 1.
2. **Manager wählt seine echte Liga ausdrücklich:** Das Ergebnis ist dasselbe wie ohne Angabe. Test in Task 1.
3. **Alte Spieler eines angepassten Vereins:** Sie verschwinden vollständig. Keine Verweise in `players`, Kader oder Aufstellung bleiben, und `validateState` ist grün. Test in Task 1.
4. **Vereinswechsel in der Oberfläche nach geänderter Startliga:** Die Startliga springt auf die echte Liga des neuen Vereins. Test in Task 2.
5. **Sprung um zwei Ligen** (L1 → L3 und L3 → L1): Aus jeder Zwischenliga rückt genau ein Verein nach. Test in Task 1.

---

### Task 1: Startligen in der Engine

**Files:**
- Create: `src/engine/startLeague.ts`
- Modify: `src/engine/generator.ts` (`generateSquad` herauslösen und exportieren)
- Modify: `src/engine/season.ts` (`startNewGame` nimmt `league?`)
- Test: `tests/engine/startLeague.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // generator.ts
  export function generateSquad(state: GameState, rng: Rng, clubId: ClubId, baseStrength: number, wageFactor: number): void;
  // fügt dem Verein den Kader nach SQUAD_PLAN hinzu und setzt die Aufstellung; generateWorld nutzt es in identischer Zufallsfolge
  // startLeague.ts
  export type Profile = "median" | "lowest" | "highest";
  export function leagueProfile(league: CompetitionId, profile: Profile): { reputation: number; strength: number };
  export function adaptClub(state: GameState, rng: Rng, clubId: ClubId, league: CompetitionId, profile: Profile): void;
  export function applyStartLeagues(state: GameState, leagues: Record<CompetitionId, ClubId[]>, choices: { clubId: ClubId; league: CompetitionId }[], rng: Rng): Record<CompetitionId, ClubId[]>;
  // season.ts
  export function startNewGame(world: GameState, managers: { name: string; clubId: ClubId; league?: CompetitionId }[]): Result;
  ```

- [ ] **Step 1: Tests schreiben** (`startLeague.test.ts`, Welt `generateWorld(2027)`):
  - `"ohne abweichende Startliga dieselbe Welt"`: `startNewGame` mit und ohne `league` gleich der echten Liga ergibt per `JSON.stringify` identische Spielstände (Review Focus 2).
  - `"Bayern in die 3. Liga: Kette nach oben"`:
    - Alle Ligen haben 18 Vereine, Bayern steht in L3.
    - Der Datensatz-stärkste Zweitligist steht in L1, der stärkste Drittligist in L2 (Review Focus 5).
    - Bayerns Ruf gleich `leagueProfile("L3","median").reputation`, Startkapital `startBalance(Ruf)`, Stadionstufe `initialStage(Ruf, 2)`.
    - Mittlere Stammelf von Bayern liegt zwischen dem schwächsten und dem stärksten L3-Verein.
    - Der Nachrücker in L1 hat Ruf `leagueProfile("L1","lowest").reputation`.
  - `"Havelse in die 1. Liga: Kette nach unten"`: spiegelbildlich, mit `highest` für die Absteiger.
  - `"zwei Manager in derselben Kette"`: Manager A setzt Bayern in L3, Manager B Havelse in L1. Kein Verein ist in beiden Ketten, alle Ligen haben 18 Vereine (Review Focus 1).
  - `"ein Manager-Verein rückt nie nach"`: A setzt Bayern in L3, B wählt den stärksten Zweitligisten in seiner echten Liga. B bleibt in L2, der nächststärkere Zweitligist rückt nach.
  - `"alte Spieler verschwinden vollständig"`: Nach dem Anpassen kommt keine alte Spieler-ID mehr in `players` vor, und `validateState` liefert `null` (Review Focus 3).
- [ ] **Step 2: Laufen lassen:** `npx vitest run tests/engine/startLeague.test.ts` → FAIL
- [ ] **Step 3: Umsetzen.**
  - `leagueProfile` bildet Median, Minimum oder Maximum über die `CLUBS` der Liga, getrennt für Ruf und Kaderstärke. Beim Median wird bei geradem Umfang der Mittelwert der beiden mittleren Werte gerundet.
  - `adaptClub` setzt Ruf, Startkapital, Stadionstufe und Startpreis neu. Es entfernt die alten Spieler aus `players`, aus dem Kader und aus `training.individual` und ruft `generateSquad` mit dem Gehaltsfaktor der Liga auf.
  - `applyStartLeagues` geht die Wahlen der Reihe nach durch und arbeitet mit aktuellen Ligalisten und einer Sperrmenge (Manager-Vereine und schon gewechselte Vereine).
  - `startNewGame` ruft `applyStartLeagues` mit `withRng` nur auf, wenn mindestens eine Wahl abweicht.
- [ ] **Step 4: Laufen lassen:** `npm test` → PASS (Determinismus-Tests und Fingerabdruck unverändert), `npm run check` → 0 Fehler
- [ ] **Step 5: Commit** `feat(engine): Startliga wählen, Vereine rücken angepasst nach`

### Task 2: Startliga in „Neues Spiel“

**Files:**
- Modify: `src/ui/screens/NewGame.svelte`, `src/ui/controller.svelte.ts` (`startGame` reicht `league` durch)
- Test: `tests/ui/newgame.test.ts`

**Interfaces:**
- Consumes: `startNewGame(world, managers mit league?)` aus Task 1
- Produces: `GameController.startGame(world, managers: { name: string; clubId: ClubId; league?: CompetitionId }[])`

- [ ] **Step 1: Tests schreiben:**
  - `"jede Manager-Zeile hat eine Startliga-Auswahl mit drei Ligen"`
  - `"die Startliga springt auf die echte Liga des gewählten Vereins"`: Bayern wählen ergibt „1. Liga“. Startliga auf „3. Liga“ setzen, dann Havelse wählen, ergibt „3. Liga“. Dann Hertha wählen ergibt „2. Liga“ (Review Focus 4).
  - `"Bayern in der 3. Liga startet dort"`: Nach „Anpfiff!“ steht Bayern in `competitions.L3`.
- [ ] **Step 2: Laufen lassen:** `npx vitest run tests/ui/newgame.test.ts` → FAIL
- [ ] **Step 3: Umsetzen.** Eine zweite `<select aria-label="Startliga Manager {i}">` je Zeile. Die Zeile bleibt bei 1280×800 einzeilig, notfalls mit schmaleren Feldern.
- [ ] **Step 4: Laufen lassen:** `npm test` → PASS, `npm run check` → 0 Fehler
- [ ] **Step 5: Commit** `feat(ui): Startliga in „Neues Spiel“`
