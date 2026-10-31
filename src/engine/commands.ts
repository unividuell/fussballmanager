import { autoLineup, repairLineup, validateLineup } from "./lineup";
import { changeTactics, substitute, type LiveMatch, type Side } from "./match/simulate";
import {
  FORMATION_LIST,
  isAvailable,
  slotPositions,
  type Club,
  type Formation,
  type GameState,
  type Hardness,
  type Lineup,
  type ManagerId,
  type PlayerId,
  type Style,
  type Tactics,
} from "./model";
import type { Result } from "./season";

export type StateCommand =
  | { type: "setLineup"; managerId: ManagerId; lineup: Lineup }
  | { type: "setTactics"; managerId: ManagerId; tactics: Tactics }
  | { type: "autoLineup"; managerId: ManagerId };

export interface HalftimeCommand {
  type: "halftimeChanges";
  managerId: ManagerId;
  substitutions: { out: PlayerId; in: PlayerId }[];
  tactics: Partial<Tactics> | null;
}

const STYLES: Style[] = ["defensive", "normal", "offensive"];
const HARDNESSES: Hardness[] = ["fair", "normal", "hard"];

/** Prüft Taktik-Eingaben. Mit requireAll fehlen Felder als Fehler, sonst werden nur vorhandene geprüft. */
function validateTactics(t: Partial<Tactics>, requireAll: boolean): string | null {
  if ((requireAll || t.formation !== undefined) && !FORMATION_LIST.includes(t.formation as Formation)) return "Unbekannte Formation.";
  if ((requireAll || t.style !== undefined) && !STYLES.includes(t.style as Style)) return "Unbekannte Spielweise.";
  if ((requireAll || t.hardness !== undefined) && !HARDNESSES.includes(t.hardness as Hardness)) return "Unbekannte Härte.";
  return null;
}

function managedClub(state: GameState, managerId: ManagerId): Club | string {
  const m = state.managers.find((x) => x.id === managerId);
  if (!m) return "Unbekannter Manager.";
  if (!m.clubId) return "Du hast zurzeit keinen Verein.";
  return state.clubs[m.clubId];
}

/** Bisherige Startspieler behalten ihren Platz, wenn er zu ihrer Position passt; den Rest füllt repairLineup. */
function reslot(state: GameState, club: Club, lineup: Lineup, tactics: Tactics): Lineup {
  const pool = lineup.starters.map((id) => state.players[id]).filter((p) => p && club.squad.includes(p.id) && isAvailable(p));
  const starters = slotPositions(tactics.formation).map((pos) => {
    const i = pool.findIndex((p) => p.position === pos);
    return i >= 0 ? pool.splice(i, 1)[0].id : "";
  });
  return repairLineup(state, club.id, { starters, bench: lineup.bench }, tactics.formation);
}

export function applyCommand(state: GameState, cmd: StateCommand): Result {
  const found = managedClub(state, cmd.managerId);
  if (typeof found === "string") return { ok: false, error: found };
  const draft = structuredClone(state);
  const club = draft.clubs[found.id];
  switch (cmd.type) {
    case "setLineup": {
      const error = validateLineup(draft, club.id, cmd.lineup);
      if (error) return { ok: false, error };
      club.lineup = { starters: [...cmd.lineup.starters], bench: [...cmd.lineup.bench] };
      return { ok: true, state: draft };
    }
    case "setTactics": {
      const tacticsError = validateTactics(cmd.tactics, true);
      if (tacticsError) return { ok: false, error: tacticsError };
      const formationChanged = cmd.tactics.formation !== club.tactics.formation;
      club.tactics = { ...cmd.tactics };
      if (formationChanged) {
        club.lineup = reslot(draft, club, club.lineup, club.tactics);
        const lineupError = validateLineup(draft, club.id, club.lineup);
        if (lineupError) return { ok: false, error: lineupError };
      }
      return { ok: true, state: draft };
    }
    case "autoLineup":
      club.lineup = autoLineup(draft, club.id, club.tactics.formation);
      return { ok: true, state: draft };
  }
}

export function findLiveFor(state: GameState, lives: LiveMatch[], managerId: ManagerId): { index: number; side: Side } | null {
  const clubId = state.managers.find((m) => m.id === managerId)?.clubId;
  if (!clubId) return null;
  const index = lives.findIndex((l) => l.home.club === clubId || l.away.club === clubId);
  if (index < 0) return null;
  return { index, side: lives[index].home.club === clubId ? "home" : "away" };
}

export function applyHalftime(
  state: GameState,
  lives: LiveMatch[],
  cmd: HalftimeCommand,
): { ok: true; lives: LiveMatch[] } | { ok: false; error: string } {
  const found = managedClub(state, cmd.managerId);
  if (typeof found === "string") return { ok: false, error: found };
  const loc = findLiveFor(state, lives, cmd.managerId);
  if (!loc) return { ok: false, error: "Dein Verein spielt heute nicht." };
  if (cmd.tactics) {
    const tacticsError = validateTactics(cmd.tactics, false);
    if (tacticsError) return { ok: false, error: tacticsError };
  }
  const out = structuredClone(lives);
  const live = out[loc.index];
  for (const s of cmd.substitutions) {
    const error = substitute(state, live, loc.side, s.out, s.in);
    if (error) return { ok: false, error };
  }
  if (cmd.tactics) changeTactics(state, live, loc.side, cmd.tactics);
  return { ok: true, lives: out };
}
