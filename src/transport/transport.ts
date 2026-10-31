import type { Session, SessionCommand, Snapshot } from "../session/session";

/** Verbindung zwischen einer Oberfläche (Laptop oder später Handy) und der Session auf dem Host. */
export interface Transport {
  send(cmd: SessionCommand): Promise<string | null>;
  subscribe(fn: (s: Snapshot) => void): () => void;
}

/** Schritt 1: Die Oberfläche läuft im selben Browser wie die Session. */
export class LocalTransport implements Transport {
  constructor(private readonly session: Session) {}

  async send(cmd: SessionCommand): Promise<string | null> {
    return this.session.dispatch(cmd);
  }

  subscribe(fn: (s: Snapshot) => void): () => void {
    return this.session.subscribe(fn);
  }
}
