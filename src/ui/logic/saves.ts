import type { SlotId } from "../../storage/store";

export function slotName(slot: SlotId): string {
  return slot === "auto" ? "Autosave" : `Slot ${slot.slice(4)}`;
}

export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
