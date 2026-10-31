import {
  BENCH_SIZE,
  STARTERS,
  isAvailable,
  slotPositions,
  type ClubId,
  type Formation,
  type GameState,
  type Lineup,
  type Player,
  type PlayerId,
  type Position,
} from "./model";

const LINE_ORDER = { DF: 0, MF: 1, FW: 2 } as const;

export function positionFactor(natural: Position, slot: Position): number {
  if (natural === slot) return 1;
  if (natural === "GK" || slot === "GK") return 0.3;
  return Math.abs(LINE_ORDER[natural] - LINE_ORDER[slot]) === 1 ? 0.85 : 0.65;
}

export function playerValue(p: Player): number {
  return p.strength * (1 + 0.03 * p.form) * (0.7 + 0.3 * (p.fitness / 100));
}

export function validateLineup(state: GameState, clubId: ClubId, lineup: Lineup): string | null {
  const club = state.clubs[clubId];
  if (lineup.starters.length !== STARTERS) return "Die Startelf braucht genau 11 Spieler.";
  if (lineup.bench.length > BENCH_SIZE) return `Höchstens ${BENCH_SIZE} Ersatzspieler.`;
  const all = [...lineup.starters, ...lineup.bench];
  if (new Set(all).size !== all.length) return "Ein Spieler ist doppelt aufgestellt.";
  for (const id of all) {
    const p = state.players[id];
    if (!p || !club.squad.includes(id)) return "Ein Spieler gehört nicht zum Kader.";
    if (p.injury) return `${p.lastName} ist verletzt.`;
    if (p.suspension) return `${p.lastName} ist gesperrt.`;
  }
  return null;
}

/** Füllt leere Plätze: erst mit Spielern der passenden Position, dann mit dem besten Rest. Verändert `slots`. */
export function fillSlots(slots: (PlayerId | null)[], slotPos: Position[], candidates: Player[]): void {
  const used = new Set(slots.filter((s): s is PlayerId => s !== null));
  const pool = candidates.filter((p) => !used.has(p.id)).sort((a, b) => playerValue(b) - playerValue(a));
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] !== null) continue;
    const idx = pool.findIndex((p) => p.position === slotPos[i]);
    if (idx >= 0) {
      slots[i] = pool[idx].id;
      pool.splice(idx, 1);
    }
  }
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] !== null || pool.length === 0) continue;
    const score = (p: Player) => playerValue(p) * positionFactor(p.position, slotPos[i]);
    let best = 0;
    for (let j = 1; j < pool.length; j++) if (score(pool[j]) > score(pool[best])) best = j;
    slots[i] = pool[best].id;
    pool.splice(best, 1);
  }
}

export function repairLineup(state: GameState, clubId: ClubId, lineup: Lineup, formation: Formation): Lineup {
  const club = state.clubs[clubId];
  const ok = (id: PlayerId) => club.squad.includes(id) && state.players[id] !== undefined && isAvailable(state.players[id]);
  const slotPos = slotPositions(formation);
  const seen = new Set<PlayerId>();
  const slots: (PlayerId | null)[] = slotPos.map((_, i) => {
    const id = lineup.starters[i];
    if (id === undefined || !ok(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  const available = club.squad.map((id) => state.players[id]).filter(isAvailable);
  fillSlots(slots, slotPos, available);
  const starters = slots.filter((s): s is PlayerId => s !== null);

  const bench: PlayerId[] = [];
  for (const id of lineup.bench) {
    if (ok(id) && !starters.includes(id) && !bench.includes(id)) bench.push(id);
  }
  const rest = available
    .filter((p) => !starters.includes(p.id) && !bench.includes(p.id))
    .sort((a, b) => playerValue(b) - playerValue(a));
  if (!bench.some((id) => state.players[id].position === "GK")) {
    const gk = rest.findIndex((p) => p.position === "GK");
    if (gk >= 0) bench.unshift(rest.splice(gk, 1)[0].id);
  }
  while (bench.length < BENCH_SIZE && rest.length > 0) bench.push(rest.shift()!.id);
  return { starters, bench: bench.slice(0, BENCH_SIZE) };
}

export function autoLineup(state: GameState, clubId: ClubId, formation: Formation): Lineup {
  return repairLineup(state, clubId, { starters: [], bench: [] }, formation);
}

export function lineupsEqual(a: Lineup, b: Lineup): boolean {
  return (
    a.starters.length === b.starters.length &&
    a.bench.length === b.bench.length &&
    a.starters.every((id, i) => b.starters[i] === id) &&
    a.bench.every((id, i) => b.bench[i] === id)
  );
}
