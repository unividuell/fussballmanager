import { isObject } from "./guards";

const OBJECTS = ["clubs", "players", "competitions"] as const;
const ARRAYS = ["managers", "calendar", "history", "negotiations", "transferOffers", "messages"] as const;
const COUNTERS = ["season", "calendarIndex", "nextId"] as const;

/** Grundlegende Konsistenz eines geladenen Spielstands. null = in Ordnung, sonst eine kurze deutsche Beschreibung des ersten Fehlers. */
export function validateState(raw: unknown): string | null {
  if (!isObject(raw)) return "kein Spielstand";
  for (const key of OBJECTS) if (!isObject(raw[key])) return `${key} fehlt`;
  for (const key of ARRAYS) if (!Array.isArray(raw[key])) return `${key} fehlt`;
  for (const key of COUNTERS) if (!Number.isInteger(raw[key])) return `${key} fehlt`;
  if (!isObject(raw.rngState)) return "Zufallszustand fehlt";

  const clubs = raw.clubs as Record<string, Record<string, unknown>>;
  const players = raw.players as Record<string, Record<string, unknown>>;
  const managers = raw.managers as Record<string, unknown>[];
  const hasClub = (id: unknown) => typeof id === "string" && Object.hasOwn(clubs, id);
  const hasPlayer = (id: unknown) => typeof id === "string" && Object.hasOwn(players, id);
  const ids = (x: unknown): unknown[] => (Array.isArray(x) ? x : [null]);

  if ((raw.calendarIndex as number) < 0 || (raw.calendarIndex as number) > (raw.calendar as unknown[]).length) return "Kalender passt nicht";

  for (const [id, p] of Object.entries(players)) {
    if (!isObject(p) || p.id !== id) return `Spieler ${id} fehlerhaft`;
    if (p.clubId !== null && !hasClub(p.clubId)) return `Verein ${String(p.clubId)} fehlt`;
  }

  for (const [id, c] of Object.entries(clubs)) {
    if (!isObject(c) || c.id !== id) return `Verein ${id} fehlerhaft`;
    if (!Array.isArray(c.squad) || c.squad.length === 0) return `Verein ${id} hat keinen Kader`;
    for (const pid of c.squad) {
      if (!hasPlayer(pid)) return `Spieler ${String(pid)} fehlt`;
      if (players[pid as string].clubId !== id) return `Spieler ${String(pid)} gehört nicht zu ${id}`;
    }
    const lineup = isObject(c.lineup) ? c.lineup : {};
    const training = isObject(c.training) ? c.training : {};
    for (const pid of [...ids(lineup.starters), ...ids(lineup.bench), ...ids(training.individual)]) {
      if (!hasPlayer(pid)) return `Spieler ${String(pid)} fehlt`;
    }
    if (c.managerId !== null && !managers.some((m) => isObject(m) && m.id === c.managerId)) return `Manager ${String(c.managerId)} fehlt`;
  }

  for (const m of managers) {
    if (!isObject(m) || typeof m.id !== "string") return "Manager fehlerhaft";
    if (!hasClub(m.clubId)) return `Verein ${String(m.clubId)} fehlt`;
    if (clubs[m.clubId as string].managerId !== m.id) return `Verein ${String(m.clubId)} gehört nicht zu ${m.id}`;
  }

  for (const [id, comp] of Object.entries(raw.competitions as Record<string, unknown>)) {
    if (!isObject(comp) || !Array.isArray(comp.clubs) || !Array.isArray(comp.matches)) return `Wettbewerb ${id} fehlerhaft`;
    for (const cid of comp.clubs) if (!hasClub(cid)) return `Verein ${String(cid)} fehlt`;
    for (const match of comp.matches) {
      if (!isObject(match) || !hasClub(match.home) || !hasClub(match.away)) return `Spiel in ${id} fehlerhaft`;
    }
  }

  for (const n of raw.negotiations as unknown[]) {
    if (isObject(n) && n.status === "open" && !hasPlayer(n.playerId)) return `Spieler ${String(n.playerId)} fehlt`;
  }
  for (const o of raw.transferOffers as unknown[]) {
    if (isObject(o) && o.status === "open" && (!hasPlayer(o.playerId) || !hasClub(o.fromClub))) return "Transferangebot fehlerhaft";
  }
  return null;
}
