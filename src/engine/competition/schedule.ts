import type { Rng } from "../rng";
import { newId, type ClubId, type Competition, type CompetitionId, type GameState, type Match } from "../model";

/** Doppeltes Kreisverfahren: Hinrunde nach Berger, Rückrunde mit getauschtem Heimrecht. */
export function roundRobin(clubs: ClubId[]): [ClubId, ClubId][][] {
  const n = clubs.length;
  if (n % 2 !== 0) throw new Error("Für den Spielplan ist eine gerade Anzahl Vereine nötig.");
  const arr = [...clubs];
  const first: [ClubId, ClubId][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [ClubId, ClubId][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      const swap = i === 0 ? r % 2 === 1 : i % 2 === 1;
      round.push(swap ? [b, a] : [a, b]);
    }
    first.push(round);
    arr.splice(1, 0, arr.pop()!);
  }
  const second = first.map((round) => round.map(([h, a]) => [a, h] as [ClubId, ClubId]));
  return [...first, ...second];
}

export function createLeague(state: GameState, id: CompetitionId, name: string, clubs: ClubId[], rng: Rng): Competition {
  const rounds = roundRobin(rng.shuffle(clubs));
  const matches: Match[] = [];
  rounds.forEach((pairs, r) => {
    for (const [home, away] of pairs) {
      matches.push({ id: newId(state, "m"), competitionId: id, round: r + 1, home, away, result: null, events: [], penalties: null });
    }
  });
  return { id, name, format: "league", clubs: [...clubs], rounds: rounds.length, matches };
}

export function matchesOfRound(c: Competition, round: number): Match[] {
  return c.matches.filter((m) => m.round === round);
}
