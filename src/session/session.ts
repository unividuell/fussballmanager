import { applyCommand, applyHalftime, findLiveFor, type HalftimeCommand, type StateCommand } from "../engine/commands";
import type { LiveMatch } from "../engine/match/simulate";
import type { GameState, ManagerId, SeasonRecord } from "../engine/model";
import {
  aiHalftimeAll,
  finishMatchday,
  finishSeason,
  isSeasonOver,
  kickOff,
  playHalf,
  prepareMatchday,
  type Notice,
} from "../engine/season";

export type Phase =
  | { kind: "managerTurns"; pending: ManagerId[] }
  | { kind: "firstHalf" }
  | { kind: "halftime"; pending: ManagerId[] }
  | { kind: "secondHalf" }
  | { kind: "results" }
  | { kind: "seasonEnd"; record: SeasonRecord };

export type SessionCommand = StateCommand | HalftimeCommand | { type: "endTurn"; managerId: ManagerId };

export interface Snapshot {
  state: GameState;
  phase: Phase;
  lives: LiveMatch[];
  notices: Notice[];
}

export type Mode = "hotseat" | "parallel";

const NOT_YOUR_TURN = "Du bist gerade nicht dran.";

export class Session {
  private snap: Snapshot;
  private readonly listeners = new Set<(s: Snapshot) => void>();

  constructor(
    state: GameState,
    private readonly mode: Mode = "hotseat",
  ) {
    this.snap = { state, phase: { kind: "managerTurns", pending: [] }, lives: [], notices: [] };
    this.beginTurns();
  }

  get snapshot(): Snapshot {
    return this.snap;
  }

  subscribe(fn: (s: Snapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    return () => {
      this.listeners.delete(fn);
    };
  }

  dispatch(cmd: SessionCommand): string | null {
    const { phase } = this.snap;
    if (cmd.type === "halftimeChanges") {
      if (phase.kind !== "halftime") return "Das geht nur in der Halbzeit.";
      const denied = this.denied(cmd.managerId, phase.pending);
      if (denied) return denied;
      const r = applyHalftime(this.snap.state, this.snap.lives, cmd);
      if (!r.ok) return r.error;
      this.set({ lives: r.lives });
      return null;
    }
    if (cmd.type === "endTurn") {
      if (phase.kind !== "managerTurns" && phase.kind !== "halftime") return "Das geht gerade nicht.";
      const denied = this.denied(cmd.managerId, phase.pending);
      if (denied) return denied;
      const pending = phase.pending.filter((id) => id !== cmd.managerId);
      if (pending.length > 0) this.set({ phase: { ...phase, pending } });
      else if (phase.kind === "managerTurns") this.startMatchday();
      else this.startSecondHalf();
      return null;
    }
    if (phase.kind !== "managerTurns") return "Das geht nur vor dem Spieltag.";
    const denied = this.denied(cmd.managerId, phase.pending);
    if (denied) return denied;
    const r = applyCommand(this.snap.state, cmd);
    if (!r.ok) return r.error;
    this.set({ state: r.state });
    return null;
  }

  advance(): string | null {
    const { phase, state, lives } = this.snap;
    switch (phase.kind) {
      case "firstHalf": {
        const pending = state.managers.filter((m) => findLiveFor(state, lives, m.id) !== null).map((m) => m.id);
        if (pending.length > 0) this.set({ phase: { kind: "halftime", pending } });
        else this.startSecondHalf();
        return null;
      }
      case "secondHalf":
        this.set({ state: finishMatchday(state, lives), phase: { kind: "results" } });
        return null;
      case "results":
        if (isSeasonOver(state)) {
          const { state: next, record } = finishSeason(state);
          this.set({ state: next, lives: [], notices: [], phase: { kind: "seasonEnd", record } });
        } else this.beginTurns();
        return null;
      case "seasonEnd":
        this.beginTurns();
        return null;
      default:
        return "Hier warten wir auf die Manager.";
    }
  }

  private denied(managerId: ManagerId, pending: ManagerId[]): string | null {
    if (!pending.includes(managerId)) return NOT_YOUR_TURN;
    if (this.mode === "hotseat" && pending[0] !== managerId) return NOT_YOUR_TURN;
    return null;
  }

  private beginTurns(): void {
    const pending = this.snap.state.managers.filter((m) => m.clubId !== null).map((m) => m.id);
    this.set({ lives: [], notices: [], phase: { kind: "managerTurns", pending } });
    if (pending.length === 0) this.startMatchday();
  }

  private startMatchday(): void {
    const { state, notices } = prepareMatchday(this.snap.state);
    const first = playHalf(state, kickOff(state), 1);
    this.set({ state: first.state, lives: first.lives, notices, phase: { kind: "firstHalf" } });
  }

  private startSecondHalf(): void {
    const lives = aiHalftimeAll(this.snap.state, this.snap.lives);
    const second = playHalf(this.snap.state, lives, 2);
    this.set({ state: second.state, lives: second.lives, phase: { kind: "secondHalf" } });
  }

  private set(next: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...next };
    for (const fn of this.listeners) fn(this.snap);
  }
}
