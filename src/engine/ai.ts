import { autoLineup } from "./lineup";
import { bestBenchFor, changeTactics, sideOf, substitute, type LiveMatch, type Side } from "./match/simulate";
import { teamStrength } from "./match/strength";
import { FORMATION_LIST, MAX_SUBS, slotPositions, type ClubId, type Formation, type GameState } from "./model";

const TIRED = 70;
const MAX_AI_HALFTIME_SUBS = 3;

export function teamRating(state: GameState, clubId: ClubId, formation: Formation, home: boolean): number {
  const lineup = autoLineup(state, clubId, formation);
  const slots = slotPositions(formation);
  const pitch = lineup.starters.map((id, i) => ({ id, slot: slots[i] }));
  const t = teamStrength(state.players, pitch, {}, { formation, style: "normal", hardness: "normal" }, home);
  return t.defense + t.midfield + t.attack;
}

export function aiChooseFormation(state: GameState, clubId: ClubId): Formation {
  let best: Formation = "4-4-2";
  let bestRating = -Infinity;
  for (const f of FORMATION_LIST) {
    const r = teamRating(state, clubId, f, false);
    if (r > bestRating + 1e-9) {
      bestRating = r;
      best = f;
    }
  }
  return best;
}

export function aiPrepare(state: GameState, clubId: ClubId, opponentId: ClubId, home: boolean): void {
  const club = state.clubs[clubId];
  const formation = aiChooseFormation(state, clubId);
  const own = teamRating(state, clubId, formation, home);
  const opp = teamRating(state, opponentId, state.clubs[opponentId].tactics.formation, !home);
  const ratio = own / opp;
  club.tactics = {
    formation,
    style: ratio > 1.1 ? "offensive" : ratio < 0.9 ? "defensive" : "normal",
    hardness: "normal",
  };
  club.lineup = autoLineup(state, clubId, formation);
}

export function aiHalftime(state: GameState, live: LiveMatch, side: Side): void {
  const own = sideOf(live, side);
  const other = sideOf(live, side === "home" ? "away" : "home");
  const diff = own.goals - other.goals;
  if (diff < 0) changeTactics(state, live, side, { style: "offensive" });
  else if (diff >= 2) changeTactics(state, live, side, { style: "defensive" });

  const tired = own.pitch
    .filter((pp) => pp.slot !== "GK" && own.fitness[pp.id] < TIRED)
    .sort((a, b) => own.fitness[a.id] - own.fitness[b.id]);
  let done = 0;
  for (const pp of tired) {
    if (done >= MAX_AI_HALFTIME_SUBS || own.subsUsed >= MAX_SUBS) break;
    const inId = bestBenchFor(state, own, pp.slot);
    if (!inId) break;
    if (substitute(state, live, side, pp.id, inId) === null) done++;
  }
}
