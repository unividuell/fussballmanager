import { aiHalftime, aiPrepare } from "./ai";
import { createLeague, matchesOfRound } from "./competition/schedule";
import { computeStandings } from "./competition/standings";
import { repairLineup, validateLineup } from "./lineup";
import { finalScore, penaltyShootout, simulateHalf, startMatch, type LiveMatch, type LiveSide } from "./match/simulate";
import { CLUBS } from "./clubs";
import { applyStartLeagues } from "./startLeague";
import {
  BOUNDARIES,
  LEAGUES,
  leagueLevel,
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
  type PlayerId,
  type CalendarEntry,
  type Movement,
  type SeasonRecord,
} from "./model";
import { applyRelegationClauses } from "./economy/contracts";
import { afterAdvance, processMatchday, seasonEndEconomy, startSeasonEconomy, summerMarket } from "./economy/processing";
import { Rng } from "./rng";
import { ensureMinimumSquad } from "./squad";

export type Result = { ok: true; state: GameState } | { ok: false; error: string };

export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = Rng.fromState(state.rngState);
  const out = fn(rng);
  state.rngState = rng.state();
  return out;
}

const LEAGUE_NAMES: Record<CompetitionId, string> = { L1: "1. Liga", L2: "2. Liga", L3: "3. Liga" };

export function startSeason(state: GameState, leagues: Record<CompetitionId, ClubId[]>): void {
  withRng(state, (rng) => {
    const comps = LEAGUES.map((id) => createLeague(state, id, LEAGUE_NAMES[id], leagues[id], rng));
    state.competitions = Object.fromEntries(comps.map((c) => [c.id, c]));
    state.calendar = Array.from({ length: comps[0].rounds }, (_, i) => ({
      fixtures: comps.map((c) => ({ competitionId: c.id, round: i + 1 })),
    }));
    state.calendarIndex = 0;
  });
  for (const p of Object.values(state.players)) {
    p.stats = { apps: 0, goals: 0 };
    p.yellowCards = 0;
  }
  withRng(state, (rng) => startSeasonEconomy(state, rng));
}

export function startNewGame(world: GameState, managers: { name: string; clubId: ClubId; league?: CompetitionId }[]): Result {
  if (managers.length < 1 || managers.length > 4) return { ok: false, error: "Es können 1 bis 4 Manager mitspielen." };
  if (managers.some((m) => m.name.trim() === "")) return { ok: false, error: "Jeder Manager braucht einen Namen." };
  if (managers.some((m) => !Object.hasOwn(world.clubs, m.clubId))) return { ok: false, error: "Diesen Verein gibt es nicht." };
  if (new Set(managers.map((m) => m.clubId)).size !== managers.length)
    return { ok: false, error: "Zwei Manager können nicht denselben Verein übernehmen." };
  if (managers.some((m) => m.league !== undefined && !LEAGUES.includes(m.league))) return { ok: false, error: "Diese Liga gibt es nicht." };

  const state = structuredClone(world);
  for (const m of managers) {
    const id = newId(state, "mgr");
    state.managers.push({ id, name: m.name.trim(), clubId: m.clubId });
    state.clubs[m.clubId].managerId = id;
  }
  let leagues = startingLeagues(state);
  const real = (id: ClubId) => LEAGUES.find((l) => leagues[l].includes(id))!;
  const choices = managers.map((m) => ({ clubId: m.clubId, league: m.league ?? real(m.clubId) }));
  if (choices.some((c) => c.league !== real(c.clubId))) {
    withRng(state, (rng) => {
      leagues = applyStartLeagues(state, leagues, choices, rng);
    });
  }
  startSeason(state, leagues);
  return { ok: true, state };
}

/** Startligen aus dem Vereinsdatensatz, zugeordnet über den Vereinsnamen. */
export function startingLeagues(state: GameState): Record<CompetitionId, ClubId[]> {
  const out: Record<CompetitionId, ClubId[]> = Object.fromEntries(LEAGUES.map((l) => [l, []]));
  for (const club of Object.values(state.clubs)) {
    const seed = CLUBS.find((c) => c.name === club.name);
    if (seed && seed.league !== "RL") out[seed.league].push(club.id);
  }
  return out;
}

export function currentFixtures(state: GameState): Match[] {
  const entry = state.calendar[state.calendarIndex];
  if (!entry) return [];
  return entry.fixtures.flatMap((f) => matchesOfRound(state.competitions[f.competitionId], f.round));
}

export function leagueOf(state: GameState, clubId: ClubId): CompetitionId | null {
  for (const id of LEAGUES) {
    if (state.competitions[id]?.clubs.includes(clubId)) return id;
  }
  return null;
}

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
  // Die Simulation liest den Spielstand nur und schreibt in die Live-Spiele; neu ist allein der Zufallszustand.
  // Eine flache Kopie genügt und spart pro Halbzeit eine Kopie aller Spieler.
  const draft = { ...state };
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

/** Beide Relegationen (16. der oberen gegen 3. der unteren Liga) an denselben zwei Kalendertagen. */
function scheduleRelegations(state: GameState): void {
  const days: CalendarEntry["fixtures"][] = [[], []];
  for (const b of BOUNDARIES) {
    const sixteenth = computeStandings(state.competitions[b.upper])[15].club;
    const third = computeStandings(state.competitions[b.lower])[2].club;
    const mk = (round: number, home: ClubId, away: ClubId): Match => ({
      id: newId(state, "m"),
      competitionId: b.relegation,
      round,
      home,
      away,
      result: null,
      events: [],
      penalties: null,
    });
    state.competitions[b.relegation] = {
      id: b.relegation,
      name: `Relegation ${leagueLevel(b.upper) + 1}./${leagueLevel(b.lower) + 1}. Liga`,
      format: "knockout",
      clubs: [sixteenth, third],
      rounds: 2,
      matches: [mk(1, third, sixteenth), mk(2, sixteenth, third)],
    };
    days[0].push({ competitionId: b.relegation, round: 1 });
    days[1].push({ competitionId: b.relegation, round: 2 });
  }
  state.calendar.push({ fixtures: days[0] }, { fixtures: days[1] });
}

const isRelegation = (id: CompetitionId) => BOUNDARIES.some((b) => b.relegation === id);

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
      match.events = [...live.events];
      applySide(draft, live, live.home, score.home, score.away, rng);
      applySide(draft, live, live.away, score.away, score.home, rng);
      if (isRelegation(match.competitionId) && match.round === 2) {
        const agg = relegationAggregate(draft.competitions[match.competitionId]);
        if (agg && agg.first === agg.second) match.penalties = penaltyShootout(rng);
      }
    }
    processMatchday(draft, lives, rng);
    draft.calendarIndex++;
    if (draft.calendarIndex === LEAGUE_ROUNDS && !draft.competitions[BOUNDARIES[0].relegation]) scheduleRelegations(draft);
    afterAdvance(draft, rng);
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

export function relegationWinner(state: GameState, relegationId: CompetitionId): ClubId | null {
  const rel = state.competitions[relegationId];
  if (!rel) return null;
  const agg = relegationAggregate(rel);
  if (!agg) return null;
  const m2 = rel.matches.find((m) => m.round === 2)!;
  if (agg.first !== agg.second) return agg.first > agg.second ? m2.home : m2.away;
  if (!m2.penalties) return null;
  return m2.penalties.home > m2.penalties.away ? m2.home : m2.away;
}

export function isSeasonOver(state: GameState): boolean {
  return BOUNDARIES.every((b) => state.competitions[b.relegation] !== undefined) && state.calendarIndex >= state.calendar.length;
}

export function topScorer(c: Competition): { player: PlayerId; goals: number } | null {
  const goals = new Map<PlayerId, number>();
  for (const m of c.matches) for (const e of m.events) if (e.type === "goal") goals.set(e.player, (goals.get(e.player) ?? 0) + 1);
  let best: { player: PlayerId; goals: number } | null = null;
  for (const [player, n] of [...goals.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (!best || n > best.goals) best = { player, goals: n };
  }
  return best;
}

export function finishSeason(state: GameState): { state: GameState; record: SeasonRecord } {
  if (!isSeasonOver(state)) throw new Error("Die Saison ist noch nicht vorbei.");
  const draft = structuredClone(state);
  const tables: Record<CompetitionId, ClubId[]> = Object.fromEntries(
    LEAGUES.map((l) => [l, computeStandings(draft.competitions[l]).map((r) => r.club)]),
  );
  const movements: Movement[] = BOUNDARIES.map((b) => {
    const up = tables[b.upper];
    const low = tables[b.lower];
    const relegated = [up[16], up[17]];
    const promoted = [low[0], low[1]];
    if (relegationWinner(draft, b.relegation) === low[2]) {
      relegated.push(up[15]);
      promoted.push(low[2]);
    }
    return { upper: b.upper, lower: b.lower, promoted, relegated };
  });
  const record: SeasonRecord = {
    season: draft.season,
    champions: Object.fromEntries(LEAGUES.map((l) => [l, tables[l][0]])),
    movements,
    topScorers: Object.fromEntries(LEAGUES.map((l) => [l, topScorer(draft.competitions[l])])),
  };
  draft.history.push(record);
  withRng(draft, (rng) => seasonEndEconomy(draft, tables, rng));
  applyRelegationClauses(draft, movements);
  draft.season++;
  const next: Record<CompetitionId, ClubId[]> = Object.fromEntries(LEAGUES.map((l) => [l, [...tables[l]]]));
  for (const m of movements) {
    next[m.upper] = next[m.upper].filter((c) => !m.relegated.includes(c)).concat(m.promoted);
    next[m.lower] = next[m.lower].filter((c) => !m.promoted.includes(c)).concat(m.relegated);
  }
  startSeason(draft, next);
  withRng(draft, (rng) => summerMarket(draft, rng));
  return { state: draft, record };
}
