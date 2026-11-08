import type { LiveMatch } from "../../engine/match/simulate";
import type { ClubId, GameState, MatchEvent, MatchId, PlayerId } from "../../engine/model";
import { eventText } from "../logic/format";
import { hash01 } from "./hash";

export type SceneOutcome = "goal" | "save" | "wide" | "post";
export type SceneVariant = "catch" | "parry" | "side" | "over" | "post" | "bar" | null;
export type SceneLabel = "TOR!" | "GEHALTEN!" | "VORBEI!" | "DRÜBER!" | "PFOSTEN!" | "LATTE!";

export interface SceneEvent {
  matchId: MatchId;
  minute: number;
  club: ClubId;
  player: PlayerId;
  home: boolean;
  outcome: SceneOutcome;
  variant: SceneVariant;
  /** das auslösende goal- bzw. chance-Ereignis (dasselbe Objekt wie in live.events) */
  event: MatchEvent;
}

/** Zeiten einer Szene in ms ab Szenenstart (abgenommen im Klick-Entwurf). */
export const SCENE_MS = { kick: 760, fly: 520, dive: 980, reveal: 1280, end: 3400 } as const;

const MISS_TEXTS = ["Schuss von %s, drüber", "%s köpft, knapp vorbei", "Schuss von %s, geblockt", "%s zieht ab, Ecke", "Flanke, %s verpasst"];

export function isSceneEvent(e: MatchEvent): boolean {
  return e.type === "goal" || (e.type === "chance" && e.big);
}

export function sceneOf(live: LiveMatch, e: MatchEvent): SceneEvent {
  if (e.type !== "goal" && e.type !== "chance") throw new Error(`Keine Szene für ${e.type}`);
  const base = { matchId: live.matchId, minute: e.minute, club: e.club, player: e.player, home: e.club === live.home.club, event: e };
  if (e.type === "goal") return { ...base, outcome: "goal", variant: null };
  const u = hash01(live.matchId, e.minute, e.player, "ausgang");
  const v = hash01(live.matchId, e.minute, e.player, "variante");
  if (u < 0.55) return { ...base, outcome: "save", variant: v < 0.25 ? "catch" : "parry" };
  if (u < 0.85) return { ...base, outcome: "wide", variant: v < 0.4 ? "over" : "side" };
  return { ...base, outcome: "post", variant: v < 0.4 ? "bar" : "post" };
}

export function sceneLabel(s: SceneEvent): SceneLabel {
  switch (s.outcome) {
    case "goal":
      return "TOR!";
    case "save":
      return "GEHALTEN!";
    case "wide":
      return s.variant === "over" ? "DRÜBER!" : "VORBEI!";
    case "post":
      return s.variant === "bar" ? "LATTE!" : "PFOSTEN!";
  }
}

/** Meldungszeile im Viertel. Großchancen melden ihren Szenenausgang, kleine Chancen einen kurzen Text. */
export function liveEventText(state: GameState, live: LiveMatch, e: MatchEvent): string {
  if (e.type !== "chance") return eventText(state, e);
  const name = state.players[e.player]?.lastName ?? "?";
  if (e.big) return `${e.minute}' ${name}: ${sceneLabel(sceneOf(live, e)).replace("!", "").toLowerCase()}`;
  const tpl = MISS_TEXTS[Math.floor(hash01(live.matchId, e.minute, "text") * MISS_TEXTS.length)];
  return `${e.minute}' ${tpl.replace("%s", name)}`;
}
