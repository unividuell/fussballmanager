import type { ClubId, GameState, ManagerId } from "../engine/model";
import { startNewGame } from "../engine/season";
import { Session, type SessionCommand, type Snapshot } from "../session/session";
import { decodeSave, encodeSave, makeMeta, type Decoded } from "../storage/savefile";
import type { ManualSlot, SaveStore, SlotId, SlotInfo } from "../storage/store";
import { LocalTransport } from "../transport/transport";
import { matchdayLabel } from "./logic/format";
import { loadOptions, saveOptions, type Options, type PrefsStorage } from "./logic/options";
import { silentSound, type Sound, type SoundKind } from "./sound";

export type TurnScreen =
  | "turnStart"
  | "menu"
  | "squad"
  | "tables"
  | "training"
  | "contracts"
  | "transfers"
  | "finance"
  | "messages"
  | "jobs"
  | "save"
  | "options";

export type StartScreen = "newGame" | "loadGame" | "startOptions";

export type TransferTab = "market" | "mine" | "offers";

/** Bildschirme, die auch ohne Verein funktionieren. */
const WITHOUT_CLUB: TurnScreen[] = ["turnStart", "jobs", "messages", "tables", "save", "options"];

export type View =
  | { kind: StartScreen }
  | { kind: TurnScreen; managerId: ManagerId }
  | { kind: "conference"; half: 1 | 2 }
  | { kind: "halftime"; managerId: ManagerId }
  | { kind: "results" }
  | { kind: "resultsTables" }
  | { kind: "seasonEnd" };

export const NO_STORE = "Speichern ist in diesem Browser nicht möglich.";
export const SAVE_ONLY_BEFORE = "Speichern geht nur vor dem Spieltag.";

export interface ControllerDeps {
  store?: SaveStore | null;
  prefs?: PrefsStorage | null;
  sound?: Sound;
}

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
  failure = $state<{ retry: () => void } | null>(null);
  /** true, solange der letzte Autosave gescheitert ist; unabhängig von `message`, damit es sichtbar bleibt. */
  autosaveFailed = $state(false);
  transferTab = $state<TransferTab>("market");
  view: View = $derived.by(() => this.computeView());

  startScreen = $state<StartScreen>("newGame");
  slots = $state.raw<SlotInfo[]>([]);
  options = $state.raw<Options>(loadOptions(null));
  /** Für Tests: der zuletzt angestoßene Autosave. */
  lastAutosave: Promise<void> = Promise.resolve();

  private session: Session | null = null;
  private transport: LocalTransport | null = null;
  private lastKey = "";
  private readonly store: SaveStore | null;
  private readonly prefs: PrefsStorage | null;
  private readonly sound: Sound;
  private unsubscribe: (() => void) | null = null;

  constructor(deps: ControllerDeps = {}) {
    this.store = deps.store ?? null;
    this.prefs = deps.prefs ?? null;
    this.sound = deps.sound ?? silentSound;
    this.options = loadOptions(this.prefs);
    void this.refreshSlots();
  }

  setOptions(patch: Partial<Options>): void {
    this.options = { ...this.options, ...patch };
    saveOptions(this.prefs, this.options);
  }

  playSound(kind: SoundKind): void {
    if (this.options.sound) this.sound.play(kind);
  }

  get hasStore(): boolean {
    return this.store !== null;
  }

  startGame(world: GameState, managers: { name: string; clubId: ClubId }[]): string | null {
    const r = startNewGame(world, managers);
    if (!r.ok) return r.error;
    this.begin(r.state);
    this.lastAutosave = this.autosave(r.state);
    return null;
  }

  openStart(s: StartScreen): void {
    if (this.failure !== null) return;
    this.startScreen = s;
    this.message = null;
  }

  async refreshSlots(): Promise<void> {
    if (!this.store) return;
    try {
      this.slots = await this.store.list();
    } catch {
      this.slots = [];
    }
  }

  async saveTo(slot: ManualSlot): Promise<boolean> {
    const snap = this.snapshot;
    if (!this.store) return this.fail(NO_STORE);
    if (!snap || snap.phase.kind !== "managerTurns") return this.fail(SAVE_ONLY_BEFORE);
    try {
      await this.store.save(slot, snap.state, matchdayLabel(snap.state), new Date());
    } catch {
      return this.fail("Speichern fehlgeschlagen.");
    }
    await this.refreshSlots();
    this.message = "Gespeichert.";
    return true;
  }

  async loadFrom(slot: SlotId): Promise<boolean> {
    if (!this.store) return this.fail(NO_STORE);
    let r: Decoded;
    try {
      r = await this.store.load(slot);
    } catch {
      r = { ok: false, error: "Laden fehlgeschlagen." };
    }
    if (!r.ok) return this.fail(r.error);
    this.begin(r.file.state);
    return true;
  }

  importText(text: string): boolean {
    const r = decodeSave(text);
    if (!r.ok) return this.fail(r.error);
    this.begin(r.file.state);
    return true;
  }

  exportFile(): { name: string; text: string } | null {
    const gs = this.snapshot?.state;
    if (!gs) return null;
    return {
      name: `fussballmanager-s${gs.season}-t${gs.calendarIndex + 1}.json`,
      text: encodeSave(gs, makeMeta(gs, matchdayLabel(gs), new Date())),
    };
  }

  /** Startet eine Session auf einem neuen oder geladenen Spielstand; eine alte Session wird abgehängt. */
  private begin(gs: GameState): void {
    this.failure = null;
    this.autosaveFailed = false;
    this.unsubscribe?.();
    this.session = new Session(gs, "hotseat", { autosave: (s) => (this.lastAutosave = this.autosave(s)) });
    this.transport = new LocalTransport(this.session);
    this.lastKey = "";
    this.unsubscribe = this.transport.subscribe((s) => this.receive(s));
  }

  private async autosave(gs: GameState): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.save("auto", gs, matchdayLabel(gs), new Date());
    } catch {
      this.autosaveFailed = true;
      return;
    }
    this.autosaveFailed = false;
    await this.refreshSlots();
  }

  private fail(message: string): false {
    this.message = message;
    return false;
  }

  open(screen: TurnScreen): void {
    if (this.failure !== null) return;
    this.screen = screen;
    this.message = null;
  }

  openTransfers(tab: TransferTab): void {
    if (this.failure !== null) return;
    this.transferTab = tab;
    this.open("transfers");
  }

  async send(cmd: SessionCommand): Promise<boolean> {
    if (!this.transport || this.failure !== null) return false;
    let error: string | null;
    try {
      error = await this.transport.send(cmd);
    } catch (e) {
      this.crashed(e, () => void this.send(cmd));
      return false;
    }
    this.message = error;
    return error === null;
  }

  endTurn(managerId: ManagerId): Promise<boolean> {
    return this.send({ type: "endTurn", managerId });
  }

  advance(): void {
    if (!this.session || this.failure !== null) return;
    try {
      this.message = this.session.advance();
    } catch (e) {
      this.crashed(e, () => this.advance());
    }
  }

  retryFailure(): void {
    const f = this.failure;
    this.failure = null;
    f?.retry();
  }

  async loadAutosaveAfterFailure(): Promise<void> {
    if (await this.loadFrom("auto")) this.failure = null;
  }

  private crashed(e: unknown, retry: () => void): void {
    console.error("Fehler beim Berechnen des Spieltags:", e);
    this.message = null;
    this.failure = { retry };
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
      this.transferTab = "market";
    }
    this.snapshot = s;
  }

  private computeView(): View {
    const s = this.snapshot;
    if (!s) return { kind: this.startScreen };
    const p = s.phase;
    switch (p.kind) {
      case "managerTurns": {
        const managerId = p.pending[0];
        const hasClub = s.state.managers.find((m) => m.id === managerId)?.clubId != null;
        const screen = !hasClub && !WITHOUT_CLUB.includes(this.screen) ? "jobs" : this.screen;
        return { kind: screen, managerId };
      }
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
