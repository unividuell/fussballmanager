export type SoundKind = "goal" | "whistle";

export interface Sound {
  play(kind: SoundKind): void;
}

export const silentSound: Sound = { play: () => {} };

/** Frequenz in Hz (0 = Pause) und Dauer in Sekunden. */
const TUNES: Record<SoundKind, [number, number][]> = {
  goal: [[523, 0.08], [659, 0.08], [784, 0.18]],
  whistle: [[1760, 0.22], [0, 0.08], [1760, 0.45]],
};

/** Kurze Rechteck-Töne wie aus einem Heimcomputer der 90er. Ohne Web Audio bleibt es still. */
export function createChiptune(): Sound {
  let ctx: AudioContext | null = null;
  return {
    play(kind) {
      try {
        if (typeof AudioContext === "undefined") return;
        ctx ??= new AudioContext();
        if (ctx.state === "suspended") void ctx.resume();
        let t = ctx.currentTime;
        for (const [freq, dur] of TUNES[kind]) {
          if (freq > 0) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "square";
            osc.frequency.value = freq;
            gain.gain.value = 0.05;
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + dur);
          }
          t += dur;
        }
      } catch {
        // ohne Ton weiterspielen
      }
    },
  };
}
