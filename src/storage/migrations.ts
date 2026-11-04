import { isObject } from "./guards";
import type { Migration } from "./migrate";

const START_CONFIDENCE_V2 = 60;

/** Der Verein bekommt einen neuen Trainer: offene Angebote und Verhandlungen um seine Spieler enden. */
function closeOpenBusiness(raw: Record<string, unknown>, clubId: string): void {
  if (Array.isArray(raw.transferOffers)) {
    for (const o of raw.transferOffers) if (isObject(o) && o.status === "open" && o.fromClub === clubId) o.status = "withdrawn";
  }
  if (Array.isArray(raw.negotiations)) {
    const players = isObject(raw.players) ? (raw.players as Record<string, unknown>) : {};
    for (const n of raw.negotiations) {
      if (!isObject(n) || n.status !== "open") continue;
      const p = players[String(n.playerId)];
      if (isObject(p) && p.clubId === clubId) {
        n.status = "aborted";
        n.note = "Der Verein hat einen neuen Trainer.";
      }
    }
  }
}

/**
 * v1 → v2 (2026-11-04): keine Entlassungen mehr.
 * Manager haben immer einen Verein; Jobangebote und die Zeit ohne Verein entfallen.
 * Ein Manager ohne Verein übernimmt den schwächsten freien Zweitligisten.
 */
export const v1ToV2: Migration = (raw) => {
  const clubs = (isObject(raw.clubs) ? raw.clubs : {}) as Record<string, Record<string, unknown>>;
  const comps = (isObject(raw.competitions) ? raw.competitions : {}) as Record<string, Record<string, unknown>>;
  const l2 = isObject(comps.L2) && Array.isArray(comps.L2.clubs) ? (comps.L2.clubs as string[]) : [];
  const managers = Array.isArray(raw.managers) ? raw.managers : [];
  for (const m of managers) {
    if (!isObject(m)) continue;
    delete m.jobOffers;
    delete m.unemployedFor;
    if (typeof m.clubId === "string") continue;
    const free = l2
      .map((id) => clubs[id])
      .filter((c) => isObject(c) && c.managerId === null)
      .sort((a, b) => Number(a.reputation) - Number(b.reputation) || (String(a.id) < String(b.id) ? -1 : 1))[0];
    // Gibt es keinen freien Zweitligisten (bei höchstens 4 Managern und 18 Zweitligisten unmöglich),
    // bleibt clubId null und die Validierung meldet den Spielstand als beschädigt.
    m.clubId = free ? free.id : null;
    if (!free) continue;
    free.managerId = m.id;
    if (isObject(free.board)) {
      free.board.confidence = START_CONFIDENCE_V2;
      free.board.warned = false;
    }
    closeOpenBusiness(raw, String(free.id));
    if (!Array.isArray(raw.messages)) raw.messages = [];
    const nextId = typeof raw.nextId === "number" ? raw.nextId : 0;
    (raw.messages as unknown[]).push({
      id: `msg${nextId}`,
      managerId: m.id,
      season: raw.season,
      calendarIndex: raw.calendarIndex,
      text: `Willkommen beim ${String(free.name)}!`,
      ref: null,
    });
    raw.nextId = nextId + 1;
  }
  if (Array.isArray(raw.messages)) {
    for (const msg of raw.messages) if (isObject(msg) && isObject(msg.ref) && msg.ref.type === "jobOffer") msg.ref = null;
  }
  return { ...raw, version: 2 };
};
