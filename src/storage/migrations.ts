import { isObject } from "./guards";
import type { Migration } from "./migrate";

const START_CONFIDENCE_V2 = 60;

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
    m.clubId = free ? free.id : null;
    if (!free) continue;
    free.managerId = m.id;
    if (isObject(free.board)) {
      free.board.confidence = START_CONFIDENCE_V2;
      free.board.warned = false;
    }
  }
  if (Array.isArray(raw.messages)) {
    for (const msg of raw.messages) if (isObject(msg) && isObject(msg.ref) && msg.ref.type === "jobOffer") msg.ref = null;
  }
  return { ...raw, version: 2 };
};
