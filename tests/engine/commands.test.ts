import { describe, expect, it } from "vitest";
import { applyCommand, applyHalftime, findLiveFor } from "../../src/engine/commands";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { slotPositions, type GameState } from "../../src/engine/model";
import { kickOff, prepareMatchday, startNewGame } from "../../src/engine/season";

function game(): { s: GameState; mid: string; clubId: string } {
  const world = generateWorld(5);
  const clubId = Object.keys(world.clubs)[2];
  const r = startNewGame(world, [{ name: "M", clubId }]);
  if (!r.ok) throw new Error(r.error);
  return { s: r.state, mid: r.state.managers[0].id, clubId };
}

describe("applyCommand", () => {
  it("setLineup übernimmt eine gültige Aufstellung", () => {
    const { s, mid, clubId } = game();
    const club = s.clubs[clubId];
    const swapped = { starters: [...club.lineup.starters], bench: [...club.lineup.bench] };
    const benchMf = swapped.bench.find((id) => s.players[id].position !== "GK")!;
    const idx = swapped.starters.findIndex((id) => s.players[id].position === s.players[benchMf].position);
    const outId = swapped.starters[idx];
    swapped.starters[idx] = benchMf;
    swapped.bench = swapped.bench.map((id) => (id === benchMf ? outId : id));
    const r = applyCommand(s, { type: "setLineup", managerId: mid, lineup: swapped });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.clubs[clubId].lineup).toEqual(swapped);
    expect(s.clubs[clubId].lineup).not.toEqual(swapped);
  });

  it("setLineup lehnt ungültige Aufstellungen mit Meldung ab", () => {
    const { s, mid, clubId } = game();
    const bad = { starters: s.clubs[clubId].lineup.starters.slice(0, 9), bench: [] };
    expect(applyCommand(s, { type: "setLineup", managerId: mid, lineup: bad })).toEqual({ ok: false, error: "Die Startelf braucht genau 11 Spieler." });
  });

  it("unbekannter Manager wird abgelehnt", () => {
    const { s } = game();
    expect(applyCommand(s, { type: "autoLineup", managerId: "nix" })).toMatchObject({ ok: false, error: "Unbekannter Manager." });
  });

  it("setTactics mit neuer Formation verteilt die Spieler passend und bleibt gültig", () => {
    const { s, mid, clubId } = game();
    const r = applyCommand(s, { type: "setTactics", managerId: mid, tactics: { formation: "3-5-2", style: "offensive", hardness: "hard" } });
    if (!r.ok) throw new Error(r.error);
    const club = r.state.clubs[clubId];
    expect(club.tactics).toEqual({ formation: "3-5-2", style: "offensive", hardness: "hard" });
    expect(validateLineup(r.state, clubId, club.lineup)).toBeNull();
    const slots = slotPositions("3-5-2");
    const onNatural = club.lineup.starters.filter((id, i) => r.state.players[id].position === slots[i]).length;
    expect(onNatural).toBe(11);
  });

  it("setTactics mit unbekannter Formation wird abgelehnt und lässt den Zustand unverändert", () => {
    const { s, mid } = game();
    const before = JSON.stringify(s);
    const r = applyCommand(s, { type: "setTactics", managerId: mid, tactics: { formation: "9-9-9" as never, style: "normal", hardness: "normal" } });
    expect(r).toEqual({ ok: false, error: "Unbekannte Formation." });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("setTactics mit unbekannter Spielweise wird abgelehnt", () => {
    const { s, mid } = game();
    const r = applyCommand(s, { type: "setTactics", managerId: mid, tactics: { formation: "4-4-2", style: "x" as never, hardness: "normal" } });
    expect(r).toEqual({ ok: false, error: "Unbekannte Spielweise." });
  });

  it("setTactics mit unbekannter Härte wird abgelehnt", () => {
    const { s, mid } = game();
    const r = applyCommand(s, { type: "setTactics", managerId: mid, tactics: { formation: "4-4-2", style: "normal", hardness: "x" as never } });
    expect(r).toEqual({ ok: false, error: "Unbekannte Härte." });
  });

  it("setTactics nur mit geänderter Spielweise klappt auch bei ungültiger gespeicherter Aufstellung", () => {
    const { s, mid, clubId } = game();
    const club = s.clubs[clubId];
    s.players[club.lineup.starters[4]].injury = { matchesLeft: 2 };
    const r = applyCommand(s, { type: "setTactics", managerId: mid, tactics: { ...club.tactics, style: "offensive" } });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.clubs[clubId].tactics.style).toBe("offensive");
  });

  it("autoLineup setzt die beste gültige Elf", () => {
    const { s, mid, clubId } = game();
    s.clubs[clubId].lineup = { starters: [], bench: [] };
    const r = applyCommand(s, { type: "autoLineup", managerId: mid });
    if (!r.ok) throw new Error(r.error);
    expect(validateLineup(r.state, clubId, r.state.clubs[clubId].lineup)).toBeNull();
  });
});

describe("applyHalftime", () => {
  function atHalftime() {
    const g = game();
    const s = prepareMatchday(g.s).state;
    return { ...g, s, lives: kickOff(s) };
  }

  it("führt Wechsel und Taktikänderung aus, ohne das Original zu verändern", () => {
    const { s, mid, lives } = atHalftime();
    const loc = findLiveFor(s, lives, mid)!;
    const side = lives[loc.index][loc.side];
    const out = side.pitch[6].id;
    const inId = side.bench[2];
    const r = applyHalftime(s, lives, { type: "halftimeChanges", managerId: mid, substitutions: [{ out, in: inId }], tactics: { style: "offensive" } });
    if (!r.ok) throw new Error(r.error);
    const after = r.lives[loc.index][loc.side];
    expect(after.pitch.map((pp) => pp.id)).toContain(inId);
    expect(after.tactics.style).toBe("offensive");
    expect(lives[loc.index][loc.side].pitch.map((pp) => pp.id)).toContain(out);
  });

  it("ungültige Taktik bei Halbzeit wird abgelehnt und lässt lives unverändert", () => {
    const { s, mid, lives } = atHalftime();
    const before = JSON.stringify(lives);
    const r = applyHalftime(s, lives, { type: "halftimeChanges", managerId: mid, substitutions: [], tactics: { formation: "9-9-9" as never } });
    expect(r).toEqual({ ok: false, error: "Unbekannte Formation." });
    expect(JSON.stringify(lives)).toBe(before);
  });

  it("ist alles oder nichts: ein ungültiger Wechsel verwirft auch die gültigen", () => {
    const { s, mid, lives } = atHalftime();
    const before = JSON.stringify(lives);
    const loc = findLiveFor(s, lives, mid)!;
    const side = lives[loc.index][loc.side];
    const r = applyHalftime(s, lives, {
      type: "halftimeChanges",
      managerId: mid,
      substitutions: [
        { out: side.pitch[6].id, in: side.bench[2] },
        { out: "gibts-nicht", in: side.bench[3] },
      ],
      tactics: null,
    });
    expect(r).toEqual({ ok: false, error: "Der Spieler steht nicht auf dem Platz." });
    expect(JSON.stringify(lives)).toBe(before);
  });

  it("lehnt Wechsel von Spielern des Gegners ab", () => {
    const { s, mid, lives } = atHalftime();
    const loc = findLiveFor(s, lives, mid)!;
    const other = lives[loc.index][loc.side === "home" ? "away" : "home"];
    const r = applyHalftime(s, lives, { type: "halftimeChanges", managerId: mid, substitutions: [{ out: other.pitch[3].id, in: other.bench[0] }], tactics: null });
    expect(r).toEqual({ ok: false, error: "Der Spieler steht nicht auf dem Platz." });
  });

  it("findet kein Spiel für einen Manager ohne Verein", () => {
    const { s, lives } = atHalftime();
    expect(findLiveFor(s, lives, "nix")).toBeNull();
  });
});
