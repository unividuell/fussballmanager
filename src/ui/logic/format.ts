import { COMP, type GameState, type Hardness, type MatchEvent, type Player, type Position, type Style } from "../../engine/model";

export const POSITION_LABEL: Record<Position, string> = { GK: "TW", DF: "ABW", MF: "MF", FW: "ST" };
export const STYLE_LABEL: Record<Style, string> = { defensive: "defensiv", normal: "normal", offensive: "offensiv" };
export const HARDNESS_LABEL: Record<Hardness, string> = { fair: "fair", normal: "normal", hard: "hart" };

export function playerName(p: Player): string {
  return `${p.firstName.charAt(0)}. ${p.lastName}`;
}

export function formText(form: number): string {
  const r = Math.trunc(form);
  return r > 0 ? `+${r}` : r < 0 ? String(r) : "0";
}

export function fitnessText(fitness: number): string {
  return `${Math.round(fitness)}%`;
}

export function statusText(p: Player): string {
  if (p.injury) return `verl. ${p.injury.matchesLeft}`;
  if (p.suspension) return `gesp. ${p.suspension.matchesLeft}`;
  return "";
}

export function eventText(state: GameState, e: MatchEvent): string {
  const name = (id: string) => state.players[id]?.lastName ?? "?";
  switch (e.type) {
    case "goal":
      return `${e.minute}' TOR! ${name(e.player)}`;
    case "yellow":
      return `${e.minute}' Gelb: ${name(e.player)}`;
    case "red":
      return `${e.minute}' ${e.secondYellow ? "Gelb-Rot" : "Rot"}: ${name(e.player)}`;
    case "injury":
      return `${e.minute}' verletzt: ${name(e.player)}`;
    case "sub":
      return `${e.minute}' ${name(e.in)} für ${name(e.out)}`;
  }
}

/** Beschriftung des nächsten bzw. laufenden Kalendereintrags. */
export function matchdayLabel(state: GameState): string {
  const entry = state.calendar[state.calendarIndex];
  const rel = entry?.fixtures.find((f) => f.competitionId === COMP.relegation);
  if (rel) return rel.round === 1 ? "Relegation – Hinspiel" : "Relegation – Rückspiel";
  return `${Math.min(state.calendarIndex + 1, 34)}. Spieltag`;
}
