import type { ClubId, GameState, Player, PlayerId } from "../model";
import { postToClub } from "./messages";
import { book, marketValue } from "./money";
import { removeFromClub } from "./roster";
import { formatEuro, roundTo } from "./util";

export const WINDOW_INDICES: readonly number[] = [0, 17, 18];

export function isTransferWindow(state: GameState): boolean {
  return WINDOW_INDICES.includes(state.calendarIndex);
}

export function askingFee(state: GameState, p: Player): number {
  if (!p.clubId) return 0;
  const mv = marketValue(p, state.season);
  if (p.transferListed) return p.transferListed.askingPrice ?? mv;
  const starter = state.clubs[p.clubId].lineup.starters.includes(p.id);
  return roundTo(mv * (starter ? 1.5 : 1.2), 10_000);
}

/** Wechsel mit Ablöse; der neue Vertrag wird danach mit signContract gesetzt. */
export function executeTransfer(state: GameState, toClubId: ClubId, playerId: PlayerId, fee: number): void {
  const p = state.players[playerId];
  const fromClubId = p.clubId;
  if (fromClubId) {
    if (fee > 0) book(state, fromClubId, "transfers", fee);
    postToClub(state, fromClubId, `${p.firstName} ${p.lastName} wechselt für ${formatEuro(fee)} zu ${state.clubs[toClubId].name}.`);
    removeFromClub(state, playerId);
  }
  if (fee > 0) book(state, toClubId, "transfers", -fee);
  p.clubId = toClubId;
  const to = state.clubs[toClubId];
  if (!to.squad.includes(playerId)) to.squad.push(playerId);
}

export function setTransferListing(
  state: GameState,
  clubId: ClubId,
  playerId: PlayerId,
  listed: boolean,
  askingPrice: number | null,
): string | null {
  const p = state.players[playerId];
  if (!p || p.clubId !== clubId) return "Der Spieler gehört nicht zum Kader.";
  if (askingPrice !== null && (!Number.isInteger(askingPrice) || askingPrice <= 0)) return "Der Wunschpreis muss eine positive ganze Zahl sein.";
  p.transferListed = listed ? { askingPrice } : null;
  return null;
}
