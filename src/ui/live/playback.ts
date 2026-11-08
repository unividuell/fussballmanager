import type { LiveMatch } from "../../engine/match/simulate";
import type { MatchEvent, MatchId, Score } from "../../engine/model";
import { TEMPOS } from "../logic/ticker";
import { SCENE_MS, isSceneEvent, sceneOf, type SceneEvent } from "./scenes";

export interface PlaybackOptions {
  lives: LiveMatch[];
  /** Spiele, die Szenen bekommen (Spiele mit Manager) */
  managed: MatchId[];
  from: number;
  to: number;
  /** Option „Torszenen“ */
  scenes: boolean;
}

export interface ActiveScene {
  scene: SceneEvent;
  elapsed: number;
  revealed: boolean;
}

interface Running {
  scene: SceneEvent;
  startedAt: number;
  revealed: boolean;
}

interface Track {
  live: LiveMatch;
  withScenes: boolean;
  queue: SceneEvent[];
  running: Running | null;
  revealed: MatchEvent[];
}

/**
 * Spielt eine Halbzeit ab: gemeinsame Uhr, pro Spiel eine Szenen-Warteschlange. Szenen-Ereignisse
 * gelten erst bei der Auflösung (SCENE_MS.reveal nach Szenenstart) als geschehen, alles andere in
 * seiner Minute. Zeit kommt von außen (`now` in ms), damit sich alles ohne echte Uhr testen lässt.
 */
export class Playback {
  private readonly tracks = new Map<MatchId, Track>();
  private readonly to: number;
  private currentMinute: number;

  constructor(o: PlaybackOptions) {
    this.to = o.to;
    this.currentMinute = o.from;
    for (const live of o.lives) {
      this.tracks.set(live.matchId, {
        live,
        withScenes: o.scenes && o.managed.includes(live.matchId),
        queue: [],
        running: null,
        revealed: live.events.filter((e) => e.minute <= o.from),
      });
    }
  }

  get minute(): number {
    return this.currentMinute;
  }

  /** Uhr um eine Minute weiter (höchstens bis `to`). Liefert die sofort aufgelösten Ereignisse. */
  step(now: number): MatchEvent[] {
    if (this.currentMinute >= this.to) return this.update(now);
    this.currentMinute++;
    const out: MatchEvent[] = [];
    for (const t of this.tracks.values()) {
      for (const e of t.live.events) {
        if (e.minute !== this.currentMinute) continue;
        if (t.withScenes && isSceneEvent(e)) t.queue.push(sceneOf(t.live, e));
        else {
          t.revealed.push(e);
          out.push(e);
        }
      }
    }
    return [...out, ...this.update(now)];
  }

  /** Schreibt die Szenen fort. Liefert die Szenen-Ereignisse, die jetzt aufgelöst wurden. */
  update(now: number): MatchEvent[] {
    const out: MatchEvent[] = [];
    for (const t of this.tracks.values()) {
      if (t.running) {
        const elapsed = now - t.running.startedAt;
        if (!t.running.revealed && elapsed >= SCENE_MS.reveal) {
          t.running.revealed = true;
          t.revealed.push(t.running.scene.event);
          out.push(t.running.scene.event);
        }
        if (elapsed >= SCENE_MS.end) t.running = null;
      }
      if (!t.running && t.queue.length > 0) t.running = { scene: t.queue.shift()!, startedAt: now, revealed: false };
    }
    return out;
  }

  /** Leertaste: Uhr ans Ende, alles bis dahin aufgelöst, keine Szene mehr offen. */
  skipToEnd(): MatchEvent[] {
    const out: MatchEvent[] = [];
    for (const t of this.tracks.values()) {
      const pending = [...(t.running && !t.running.revealed ? [t.running.scene.event] : []), ...t.queue.map((s) => s.event)];
      const later = t.live.events.filter((e) => e.minute > this.currentMinute && e.minute <= this.to);
      for (const e of [...pending, ...later]) {
        t.revealed.push(e);
        out.push(e);
      }
      t.running = null;
      t.queue = [];
    }
    this.currentMinute = this.to;
    return out;
  }

  msPerMinute(tempo: number): number {
    return this.sceneRunning ? TEMPOS[0] : TEMPOS[tempo];
  }

  active(matchId: MatchId, now: number): ActiveScene | null {
    const r = this.tracks.get(matchId)?.running;
    return r ? { scene: r.scene, elapsed: now - r.startedAt, revealed: r.revealed } : null;
  }

  revealed(matchId: MatchId): MatchEvent[] {
    return this.tracks.get(matchId)?.revealed ?? [];
  }

  score(matchId: MatchId): Score {
    const t = this.tracks.get(matchId);
    const score = { home: 0, away: 0 };
    if (!t) return score;
    for (const e of t.revealed) if (e.type === "goal") score[e.club === t.live.home.club ? "home" : "away"]++;
    return score;
  }

  get sceneRunning(): boolean {
    for (const t of this.tracks.values()) if (t.running) return true;
    return false;
  }

  get finished(): boolean {
    if (this.currentMinute < this.to) return false;
    for (const t of this.tracks.values()) if (t.running || t.queue.length > 0) return false;
    return true;
  }
}
