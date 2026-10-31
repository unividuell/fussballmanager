import { generatePlayer } from "./generator";
import { isAvailable, type ClubId, type GameState, type Player, type Position } from "./model";
import type { Rng } from "./rng";

/** 11 Startspieler + 2 Ersatz – darunter muss ein Torwart sein. */
export const MIN_AVAILABLE = 13;

export function ensureMinimumSquad(state: GameState, clubId: ClubId, rng: Rng): Player[] {
  const club = state.clubs[clubId];
  const squad = () => club.squad.map((id) => state.players[id]);
  const avg = squad().reduce((s, p) => s + p.strength, 0) / Math.max(1, club.squad.length);
  const base = Math.max(25, avg - 15);
  const added: Player[] = [];
  const add = (pos: Position) => {
    const p = generatePlayer(state, rng, clubId, pos, base, rng.int(19, 30));
    club.squad.push(p.id);
    added.push(p);
  };
  if (!squad().some((p) => p.position === "GK" && isAvailable(p))) add("GK");
  const order: Position[] = ["DF", "MF", "FW"];
  let i = 0;
  while (squad().filter(isAvailable).length < MIN_AVAILABLE) add(order[i++ % order.length]);
  return added;
}
