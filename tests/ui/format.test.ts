import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../src/engine/model";
import { playMatchdayAuto } from "../../src/engine/season";
import { eventText, fitnessText, formText, matchdayLabel, playerName, statusText } from "../../src/ui/logic/format";
import { newTestGame } from "./game";

describe("format", () => {
  const s = newTestGame();
  const p = Object.values(s.players)[0];

  it("kürzt den Vornamen ab", () => {
    expect(playerName({ ...p, firstName: "Markus", lastName: "Krämer" })).toBe("M. Krämer");
  });

  it("zeigt Form mit Vorzeichen und Kondition in Prozent", () => {
    expect(formText(2)).toBe("+2");
    expect(formText(0)).toBe("0");
    expect(formText(-0.25)).toBe("0");
    expect(formText(-1.5)).toBe("-1");
    expect(fitnessText(83.4)).toBe("83%");
  });

  it("zeigt Verletzung und Sperre mit Restdauer", () => {
    expect(statusText(p)).toBe("");
    expect(statusText({ ...p, injury: { matchesLeft: 3 } })).toBe("verl. 3");
    expect(statusText({ ...p, suspension: { matchesLeft: 1 } })).toBe("gesp. 1");
  });

  it("beschreibt Spielereignisse", () => {
    const ev = (e: MatchEvent) => eventText(s, e);
    const name = p.lastName;
    expect(ev({ minute: 67, type: "goal", club: "x", player: p.id })).toBe(`67' TOR! ${name}`);
    expect(ev({ minute: 12, type: "yellow", club: "x", player: p.id })).toBe(`12' Gelb: ${name}`);
    expect(ev({ minute: 80, type: "red", club: "x", player: p.id, secondYellow: true })).toBe(`80' Gelb-Rot: ${name}`);
    expect(ev({ minute: 81, type: "red", club: "x", player: p.id, secondYellow: false })).toBe(`81' Rot: ${name}`);
    expect(ev({ minute: 30, type: "injury", club: "x", player: p.id })).toBe(`30' verletzt: ${name}`);
    const q = Object.values(s.players)[1];
    expect(ev({ minute: 46, type: "sub", club: "x", out: p.id, in: q.id })).toBe(`46' ${q.lastName} für ${name}`);
  });

  it("benennt den Spieltag", () => {
    expect(matchdayLabel(s)).toBe("1. Spieltag");
    let t = s;
    for (let i = 0; i < 34; i++) t = playMatchdayAuto(t);
    expect(matchdayLabel(t)).toBe("Relegation – Hinspiel");
    t = playMatchdayAuto(t);
    expect(matchdayLabel(t)).toBe("Relegation – Rückspiel");
  });
});
