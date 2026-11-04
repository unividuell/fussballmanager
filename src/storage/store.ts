import type { GameState } from "../engine/model";
import { decodeSave, encodeSave, makeMeta, parseMeta, type Decoded, type SaveMeta } from "./savefile";

export type SlotId = "auto" | "slot1" | "slot2" | "slot3";
export type ManualSlot = Exclude<SlotId, "auto">;
export const SLOTS: SlotId[] = ["auto", "slot1", "slot2", "slot3"];

export interface SlotInfo {
  slot: SlotId;
  /** null = leer oder beschädigt */
  meta: SaveMeta | null;
  damaged: boolean;
}

export const EMPTY_SLOT = "Dieser Slot ist leer.";

const DB_NAME = "fussballmanager";
const DB_VERSION = 1;
const STORE = "spielstaende";

interface SaveRecord {
  slot: SlotId;
  meta: unknown;
  /** der Spielstand als JSON-Text (encodeSave) */
  data: string;
}

function result<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaktion abgebrochen"));
  });
}

/** Spielstände in IndexedDB: ein Autosave und 3 manuelle Slots. */
export class SaveStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  async list(): Promise<SlotInfo[]> {
    const db = await this.open();
    const records = await result(db.transaction(STORE).objectStore(STORE).getAll() as IDBRequest<SaveRecord[]>);
    return SLOTS.map((slot) => {
      const rec = records.find((r) => r.slot === slot);
      if (!rec) return { slot, meta: null, damaged: false };
      const meta = parseMeta(rec.meta);
      return { slot, meta, damaged: meta === null };
    });
  }

  save(slot: SlotId, state: GameState, label: string, now: Date): Promise<void> {
    const meta = makeMeta(state, label, now);
    return this.put(slot, meta, encodeSave(state, meta));
  }

  async load(slot: SlotId): Promise<Decoded> {
    const db = await this.open();
    const rec = await result(db.transaction(STORE).objectStore(STORE).get(slot) as IDBRequest<SaveRecord | undefined>);
    if (!rec) return { ok: false, error: EMPTY_SLOT };
    return decodeSave(rec.data);
  }

  /** Schreibt einen Datensatz unverändert – für save() und für Tests mit beschädigten Daten. */
  async put(slot: SlotId, meta: unknown, data: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, "readwrite");
    const record: SaveRecord = { slot, meta, data };
    tx.objectStore(STORE).put(record);
    await done(tx);
  }

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise<IDBDatabase>((resolve, reject) => {
        const req = this.factory.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "slot" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("Datenbank blockiert"));
      });
      // Scheitert das Öffnen, versucht es der nächste Aufruf erneut.
      this.db.catch(() => (this.db = null));
    }
    return this.db;
  }
}
