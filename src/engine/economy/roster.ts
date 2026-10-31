import { repairLineup } from "../lineup";
import type { GameState, PlayerId } from "../model";

/** Nimmt einen Spieler aus seinem Verein (Verkauf, Vertragsende, Entlassung, Karriereende). */
export function removeFromClub(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  const clubId = p.clubId;
  if (clubId) {
    const club = state.clubs[clubId];
    club.squad = club.squad.filter((id) => id !== playerId);
    const placeholder = {
      starters: club.lineup.starters.map((id) => (id === playerId ? "" : id)),
      bench: club.lineup.bench.filter((id) => id !== playerId),
    };
    club.lineup = repairLineup(state, clubId, placeholder, club.tactics.formation);
    club.training = { ...club.training, individual: club.training.individual.filter((id) => id !== playerId) };
  }
  p.clubId = null;
  p.contract = null;
  p.transferListed = null;
  for (const n of state.negotiations) {
    if (n.playerId === playerId && n.status === "open") {
      n.status = "aborted";
      n.note = `${p.lastName} ist nicht mehr verfügbar.`;
    }
  }
  for (const o of state.transferOffers) if (o.playerId === playerId && o.status === "open") o.status = "withdrawn";
}
