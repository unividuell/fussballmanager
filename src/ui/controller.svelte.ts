import type { ClubId, GameState, ManagerId } from "../engine/model";
import { startNewGame } from "../engine/season";
import { Session, type SessionCommand, type Snapshot } from "../session/session";
import { LocalTransport } from "../transport/transport";

export type TurnScreen = "turnStart" | "menu" | "squad" | "tables";

export type View =
  | { kind: "newGame" }
  | { kind: TurnScreen; managerId: ManagerId }
  | { kind: "conference"; half: 1 | 2 }
  | { kind: "halftime"; managerId: ManagerId }
  | { kind: "results" }
  | { kind: "resultsTables" }
  | { kind: "seasonEnd" };

function phaseKey(s: Snapshot): string {
  const p = s.phase;
  const who = "pending" in p ? (p.pending[0] ?? "") : "";
  return `${p.kind}|${who}|${s.state.season}|${s.state.calendarIndex}`;
}

/** Verbindet die Oberfläche mit der Session: hält den Snapshot und leitet den Bildschirm daraus ab. */
export class GameController {
  snapshot = $state.raw<Snapshot | null>(null);
  screen = $state<TurnScreen>("turnStart");
  showResultsTables = $state(false);
  message = $state<string | null>(null);
  view: View = $derived.by(() => this.computeView());

  private session: Session | null = null;
  private transport: LocalTransport | null = null;
  private lastKey = "";

  startGame(world: GameState, managers: { name: string; clubId: ClubId }[]): string | null {
    const r = startNewGame(world, managers);
    if (!r.ok) return r.error;
    this.session = new Session(r.state);
    this.transport = new LocalTransport(this.session);
    this.transport.subscribe((s) => this.receive(s));
    return null;
  }

  open(screen: TurnScreen): void {
    this.screen = screen;
    this.message = null;
  }

  async send(cmd: SessionCommand): Promise<boolean> {
    if (!this.transport) return false;
    const error = await this.transport.send(cmd);
    this.message = error;
    return error === null;
  }

  endTurn(managerId: ManagerId): Promise<boolean> {
    return this.send({ type: "endTurn", managerId });
  }

  advance(): void {
    if (!this.session) return;
    this.message = this.session.advance();
  }

  setResultsTables(show: boolean): void {
    this.showResultsTables = show;
  }

  managerName(managerId: ManagerId): string {
    return this.snapshot?.state.managers.find((m) => m.id === managerId)?.name ?? "?";
  }

  private receive(s: Snapshot): void {
    const key = phaseKey(s);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.screen = "turnStart";
      this.showResultsTables = false;
      this.message = null;
    }
    this.snapshot = s;
  }

  private computeView(): View {
    const s = this.snapshot;
    if (!s) return { kind: "newGame" };
    const p = s.phase;
    switch (p.kind) {
      case "managerTurns":
        return { kind: this.screen, managerId: p.pending[0] };
      case "firstHalf":
        return { kind: "conference", half: 1 };
      case "secondHalf":
        return { kind: "conference", half: 2 };
      case "halftime":
        return { kind: "halftime", managerId: p.pending[0] };
      case "results":
        return this.showResultsTables ? { kind: "resultsTables" } : { kind: "results" };
      case "seasonEnd":
        return { kind: "seasonEnd" };
    }
  }
}
