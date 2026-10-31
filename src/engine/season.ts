import { createLeague, matchesOfRound } from "./competition/schedule";
import { COMP, LEAGUE_SIZE, newId, type ClubId, type CompetitionId, type GameState, type Match } from "./model";
import { Rng } from "./rng";

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
  if (managers.some((m) => !world.clubs[m.clubId])) return { ok: false, error: "Diesen Verein gibt es nicht." };
  if (new Set(managers.map((m) => m.clubId)).size !== managers.length)
    return { ok: false, error: "Zwei Manager können nicht denselben Verein übernehmen." };

  const state = structuredClone(world);
  for (const m of managers) {
    const id = newId(state, "mgr");
    state.managers.push({ id, name: m.name.trim(), clubId: m.clubId });
    state.clubs[m.clubId].managerId = id;
  }
  const byReputation = Object.values(state.clubs)
    .sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id))
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
