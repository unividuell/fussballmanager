import { positionFactor } from "../lineup";
import type { Player, PlayerId, Position, Tactics } from "../model";

export const HOME_FACTOR = 1.07;
const REFERENCE = { DF: 4, MF: 4, FW: 2 } as const;
const EMPTY_UNIT = 10;
const SHORT_HANDED = 0.95;

export interface PitchPlayer {
  id: PlayerId;
  slot: Position;
}

export interface TeamStrength {
  defense: number;
  midfield: number;
  attack: number;
  keeper: number;
}

export function effectiveStrength(p: Player, slot: Position, fitness: number): number {
  return p.strength * positionFactor(p.position, slot) * (1 + 0.03 * p.form) * (0.7 + 0.3 * (fitness / 100));
}

export function teamStrength(
  players: Record<PlayerId, Player>,
  pitch: PitchPlayer[],
  fitness: Record<PlayerId, number>,
  tactics: Tactics,
  home: boolean,
  bonus = 1,
): TeamStrength {
  const by: Record<Position, number[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const pp of pitch) {
    const p = players[pp.id];
    by[pp.slot].push(effectiveStrength(p, pp.slot, fitness[pp.id] ?? p.fitness));
  }
  const unit = (pos: "DF" | "MF" | "FW") => {
    const a = by[pos];
    if (a.length === 0) return EMPTY_UNIT;
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    return mean * (1 + 0.1 * (a.length - REFERENCE[pos]));
  };
  const keeper = by.GK.length > 0 ? by.GK[0] : EMPTY_UNIT;
  let defense = 0.85 * unit("DF") + 0.15 * keeper;
  let midfield = unit("MF");
  let attack = unit("FW");
  if (tactics.style === "offensive") {
    attack *= 1.1;
    defense *= 0.9;
  } else if (tactics.style === "defensive") {
    attack *= 0.9;
    defense *= 1.1;
  }
  if (tactics.hardness === "hard") midfield *= 1.05;
  const f = (home ? HOME_FACTOR : 1) * bonus * Math.pow(SHORT_HANDED, Math.max(0, 11 - pitch.length));
  return { defense: defense * f, midfield: midfield * f, attack: attack * f, keeper: keeper * f };
}
