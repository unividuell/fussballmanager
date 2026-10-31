import { describe, expect, it } from "vitest";
import { findLiveFor } from "../../src/engine/commands";
import { generateWorld } from "../../src/engine/generator";
import type { GameState } from "../../src/engine/model";
import { startNewGame } from "../../src/engine/season";
import { Session, type Snapshot } from "../../src/session/session";
import { LocalTransport } from "../../src/transport/transport";

function twoManagers(): GameState {
  const world = generateWorld(8);
  const ids = Object.keys(world.clubs);
  const r = startNewGame(world, [{ name: "Anna", clubId: ids[0] }, { name: "Ben", clubId: ids[20] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function endAll(session: Session): void {
  const p = session.snapshot.phase;
  if (p.kind !== "managerTurns" && p.kind !== "halftime") throw new Error(`falsche Phase ${p.kind}`);
  for (const id of [...p.pending]) expect(session.dispatch({ type: "endTurn", managerId: id })).toBeNull();
}

function playMatchday(session: Session): void {
  endAll(session);
  expect(session.snapshot.phase.kind).toBe("firstHalf");
  session.advance();
  if (session.snapshot.phase.kind === "halftime") endAll(session);
  expect(session.snapshot.phase.kind).toBe("secondHalf");
  session.advance();
  expect(session.snapshot.phase.kind).toBe("results");
  session.advance();
}

describe("Session", () => {
  it("beginnt mit den Manager-Runden in der Reihenfolge der Manager", () => {
    const s = twoManagers();
    const session = new Session(s);
    expect(session.snapshot.phase).toEqual({ kind: "managerTurns", pending: s.managers.map((m) => m.id) });
  });

  it("Hot-Seat: nur der Manager, der dran ist, darf handeln", () => {
    const s = twoManagers();
    const session = new Session(s);
    const [anna, ben] = s.managers;
    expect(session.dispatch({ type: "autoLineup", managerId: ben.id })).toBe("Du bist gerade nicht dran.");
    expect(session.dispatch({ type: "autoLineup", managerId: anna.id })).toBeNull();
    expect(session.dispatch({ type: "endTurn", managerId: anna.id })).toBeNull();
    expect(session.dispatch({ type: "autoLineup", managerId: ben.id })).toBeNull();
  });

  it("Parallel: jeder wartende Manager darf handeln", () => {
    const s = twoManagers();
    const session = new Session(s, "parallel");
    expect(session.dispatch({ type: "autoLineup", managerId: s.managers[1].id })).toBeNull();
  });

  it("lehnt Befehle in der falschen Phase ab", () => {
    const s = twoManagers();
    const session = new Session(s);
    expect(session.dispatch({ type: "halftimeChanges", managerId: s.managers[0].id, substitutions: [], tactics: null })).toBe("Das geht nur in der Halbzeit.");
    endAll(session);
    expect(session.dispatch({ type: "autoLineup", managerId: s.managers[0].id })).toBe("Das geht nur vor dem Spieltag.");
    expect(session.dispatch({ type: "endTurn", managerId: s.managers[0].id })).toBe("Das geht gerade nicht.");
  });

  it("advance() in den Manager-Runden wird abgelehnt", () => {
    const session = new Session(twoManagers());
    expect(session.advance()).toBe("Hier warten wir auf die Manager.");
  });

  it("spielt einen kompletten Spieltag inklusive Halbzeitwechsel", () => {
    const s = twoManagers();
    const session = new Session(s);
    const anna = s.managers[0];
    endAll(session);
    let snap = session.snapshot;
    expect(snap.lives).toHaveLength(18);
    expect(snap.lives.every((l) => l.minute === 45)).toBe(true);
    session.advance();
    snap = session.snapshot;
    expect(snap.phase).toEqual({ kind: "halftime", pending: s.managers.map((m) => m.id) });
    const loc = findLiveFor(snap.state, snap.lives, anna.id)!;
    const side = snap.lives[loc.index][loc.side];
    const inId = side.bench[1];
    expect(
      session.dispatch({ type: "halftimeChanges", managerId: anna.id, substitutions: [{ out: side.pitch[7].id, in: inId }], tactics: null }),
    ).toBeNull();
    expect(session.snapshot.lives[loc.index][loc.side].played).toContain(inId);
    endAll(session);
    snap = session.snapshot;
    expect(snap.phase.kind).toBe("secondHalf");
    expect(snap.lives.every((l) => l.minute === 90)).toBe(true);
    session.advance();
    expect(session.snapshot.phase.kind).toBe("results");
    expect(session.snapshot.state.calendarIndex).toBe(1);
    expect(session.snapshot.state.players[inId].stats.apps).toBe(1);
    session.advance();
    expect(session.snapshot.phase.kind).toBe("managerTurns");
    expect(session.snapshot.lives).toEqual([]);
  });

  it("benachrichtigt Abonnenten sofort und bei jeder Änderung", () => {
    const session = new Session(twoManagers());
    const seen: Snapshot[] = [];
    const off = session.subscribe((x) => seen.push(x));
    expect(seen).toHaveLength(1);
    session.dispatch({ type: "endTurn", managerId: session.snapshot.state.managers[0].id });
    expect(seen).toHaveLength(2);
    off();
    session.dispatch({ type: "endTurn", managerId: session.snapshot.state.managers[1].id });
    expect(seen).toHaveLength(2);
  });

  it("spielt eine ganze Saison bis zum Saisonende und startet Saison 2", () => {
    const session = new Session(twoManagers());
    for (let i = 0; i < 36; i++) playMatchday(session);
    const snap = session.snapshot;
    expect(snap.phase.kind).toBe("seasonEnd");
    if (snap.phase.kind === "seasonEnd") expect(snap.phase.record.season).toBe(1);
    expect(snap.state.season).toBe(2);
    session.advance();
    expect(session.snapshot.phase.kind).toBe("managerTurns");
  });
});

describe("LocalTransport", () => {
  it("leitet Befehle an die Session weiter und liefert Fehler zurück", async () => {
    const session = new Session(twoManagers());
    const t = new LocalTransport(session);
    const ben = session.snapshot.state.managers[1];
    await expect(t.send({ type: "autoLineup", managerId: ben.id })).resolves.toBe("Du bist gerade nicht dran.");
    let last: Snapshot | null = null;
    t.subscribe((x) => (last = x));
    expect(last).not.toBeNull();
  });
});
