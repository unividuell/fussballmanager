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
  type PlayerId,
  type SeasonRecord,
} from "./model";
import { Rng } from "./rng";
import { ensureMinimumSquad } from "./squad";

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
  if (managers.some((m) => !Object.hasOwn(world.clubs, m.clubId))) return { ok: false, error: "Diesen Verein gibt es nicht." };
  if (new Set(managers.map((m) => m.clubId)).size !== managers.length)
    return { ok: false, error: "Zwei Manager können nicht denselben Verein übernehmen." };

  const state = structuredClone(world);
  for (const m of managers) {
    const id = newId(state, "mgr");
    state.managers.push({ id, name: m.name.trim(), clubId: m.clubId });
    state.clubs[m.clubId].managerId = id;
  }
  const byReputation = Object.values(state.clubs)
    .sort((a, b) => b.reputation - a.reputation || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
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
      match.events = [...live.events];
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
