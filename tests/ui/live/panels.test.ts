// @vitest-environment jsdom
import { render, screen } from "@testing-library/svelte";
import { beforeAll, describe, expect, it } from "vitest";
import { kickOff } from "../../../src/engine/season";
import type { MatchEvent } from "../../../src/engine/model";
import LiveTable from "../../../src/ui/live/LiveTable.svelte";
import MatchPanel from "../../../src/ui/live/MatchPanel.svelte";
import PressureGraph from "../../../src/ui/live/PressureGraph.svelte";
import SceneView from "../../../src/ui/live/SceneView.svelte";
import { sceneOf } from "../../../src/ui/live/scenes";
import { newTestGame } from "../game";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({} as Record<string, unknown>, {
      get: (t, k) => (typeof k === "string" && k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })),
      set: (t, k, v) => ((t[k as string] = v), true),
    });
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const state = newTestGame(["Anna"]);
const live = kickOff(state).find((l) => l.home.club === state.managers[0].clubId || l.away.club === state.managers[0].clubId)!;
const scorer = state.clubs[live.home.club].squad[5];
state.players[scorer].lastName = "Müller";
const ev = (minute: number, type: "goal" | "yellow" = "yellow"): MatchEvent => ({ minute, type, club: live.home.club, player: scorer });
const goal34 = ev(34, "goal");
const scene = sceneOf(live, goal34);
const base = { state, live, minute: 34, score: { home: 0, away: 0 }, revealed: [] as MatchEvent[], active: null, flash: false };

describe("MatchPanel", () => {
  it("zeigt Spielstand, Minute und die letzten 3 Meldungen, neueste oben", () => {
    render(MatchPanel, { props: { ...base, score: { home: 1, away: 0 }, revealed: [ev(10), ev(20), ev(30), ev(33)] } });
    expect(screen.getByText("1:0")).toBeTruthy();
    expect(screen.getByText("34'")).toBeTruthy();
    const lines = Array.from(document.querySelectorAll(".tick div")).map((d) => d.textContent);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^33'/);
    expect(document.querySelector(".graph")).toBeTruthy();
  });

  it("während einer Szene zeigt es die Szene mit Szenenzeile statt Kurve", () => {
    render(MatchPanel, { props: { ...base, active: { scene, elapsed: 500, revealed: false } } });
    expect(document.querySelector(".cap")?.textContent).toBe(`GROSSCHANCE 34' Müller · ${state.clubs[live.home.club].name}`);
    expect(document.querySelector(".graph")).toBeNull();
  });
});

describe("PressureGraph", () => {
  const graph = { curve: Array(90).fill(0.5), minute: 50, marks: [], homeColor: "#c8102e", awayColor: "#1d4fa3", homeName: "A", awayName: "B", chances: [3, 1] as [number, number] };
  it("zeigt nur Minuten bis zur aktuellen, der Verlauf der 1. Halbzeit bleibt", () => {
    render(PressureGraph, { props: graph });
    expect(document.querySelectorAll(".col")).toHaveLength(50);
    expect(screen.getByText(/Chancen 3 : 1/)).toBeTruthy();
  });
  it("zeichnet Chancen und Tore als Punkte", () => {
    render(PressureGraph, { props: { ...graph, marks: [{ minute: 10, home: true, goal: false }, { minute: 20, home: false, goal: true }] } });
    expect(document.querySelectorAll(".mark")).toHaveLength(2);
    expect(document.querySelectorAll(".mark.goal")).toHaveLength(1);
  });
});

describe("SceneView", () => {
  it("Einblendung erst nach der Auflösung", async () => {
    const r = render(SceneView, { props: { state, scene, defender: live.away.club, elapsed: 1279, revealed: false } });
    expect(screen.queryByText("TOR!")).toBeNull();
    await r.rerender({ state, scene, defender: live.away.club, elapsed: 1280, revealed: true });
    expect(screen.getByText("TOR!")).toBeTruthy();
  });
});

describe("LiveTable", () => {
  it("rechnet Live-Stände ein und hebt Manager-Vereine hervor", () => {
    render(LiveTable, { props: { state, competitionId: live.competitionId, scores: { [live.matchId]: { home: 2, away: 0 } } } });
    const managed = document.querySelector(".managed");
    expect(managed?.textContent).toContain(state.clubs[state.managers[0].clubId].name);
    expect(document.querySelectorAll("tbody tr").length).toBe(state.competitions[live.competitionId].clubs.length);
  });
});
