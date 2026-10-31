import type { HalftimeCommand } from "../../engine/commands";
import type { LiveSide } from "../../engine/match/simulate";
import type { PitchPlayer } from "../../engine/match/strength";
import { MAX_SUBS, type ManagerId, type PlayerId, type Tactics } from "../../engine/model";

export interface HalftimeDraft {
  subs: { out: PlayerId; in: PlayerId }[];
  tactics: Partial<Tactics>;
}

export function emptyDraft(): HalftimeDraft {
  return { subs: [], tactics: {} };
}

export function remainingSubs(side: LiveSide, draft: HalftimeDraft): number {
  return Math.max(0, MAX_SUBS - side.subsUsed - draft.subs.length);
}

export function currentPitch(side: LiveSide, draft: HalftimeDraft): PitchPlayer[] {
  let pitch = side.pitch.map((pp) => ({ ...pp }));
  for (const s of draft.subs) pitch = pitch.map((pp) => (pp.id === s.out ? { id: s.in, slot: pp.slot } : pp));
  return pitch;
}

export function currentBench(side: LiveSide, draft: HalftimeDraft): PlayerId[] {
  const used = new Set(draft.subs.map((s) => s.in));
  return side.bench.filter((id) => !used.has(id));
}

export function addSub(side: LiveSide, draft: HalftimeDraft, out: PlayerId, inId: PlayerId): HalftimeDraft | string {
  if (remainingSubs(side, draft) <= 0) return "Keine Wechsel mehr übrig.";
  if (!currentPitch(side, draft).some((pp) => pp.id === out)) return "Der Spieler steht nicht auf dem Platz.";
  if (!currentBench(side, draft).includes(inId)) return "Der Spieler sitzt nicht auf der Bank.";
  return { ...draft, subs: [...draft.subs, { out, in: inId }] };
}

export function removeSub(draft: HalftimeDraft, index: number): HalftimeDraft {
  return { ...draft, subs: draft.subs.filter((_, i) => i !== index) };
}

export function toCommand(managerId: ManagerId, draft: HalftimeDraft): HalftimeCommand | null {
  const hasTactics = Object.keys(draft.tactics).length > 0;
  if (draft.subs.length === 0 && !hasTactics) return null;
  return {
    type: "halftimeChanges",
    managerId,
    substitutions: draft.subs.map((s) => ({ ...s })),
    tactics: hasTactics ? { ...draft.tactics } : null,
  };
}
