import ballFxUrl from "./assets/ball-effekte.png";
import netUrl from "./assets/netz.png";
import shooterUrl from "./assets/schuetze.png";
import sprites from "./assets/sprites.json";
import stadiumUrl from "./assets/stadion.png";
import keeperUrl from "./assets/torwart.png";
import { hash01 } from "./hash";
import { SCENE_MS, type SceneEvent, type SceneOutcome, type SceneVariant } from "./scenes";

// Szenenkoordinaten (320×200), gemessen am aufbereiteten Stadionbild.
export const GOAL = { l: 92, r: 228, bar: 58, line: 95, cx: 160 } as const;
const BALL0 = { x: 76, y: 192 };
const T_HIT = SCENE_MS.kick + SCENE_MS.fly;
const DIVE_FRAME = { low: 4, mid: 5, high: 6 } as const;
const KEEPER_COLORS = ["#3cb043", "#d4b000", "#2b2b2b", "#e05a00", "#9a9a9a"];
const KEYS = { keeper: [0, 255, 0], shirt: [255, 0, 255], shorts: [0, 255, 255] } as const;
const KEY_TOLERANCE = 90;

type Height = "low" | "mid" | "high";
type Sheet = { cell: number[]; cols: number; frames: (number[] | null)[] };
const SPR = sprites as { torwart: Sheet; schuetze: Sheet; effekte: Sheet };

export interface ShotPlan {
  outcome: SceneOutcome;
  variant: SceneVariant;
  side: -1 | 1;
  height: Height;
  target: { x: number; y: number };
  diveSide: -1 | 1;
  diveReach: number;
}

export interface SceneSheets {
  shooter: CanvasImageSource;
  keeper: CanvasImageSource;
}

const IMG: Partial<Record<"stadium" | "keeper" | "shooter" | "fx" | "net", HTMLImageElement>> = {};
let loading: Promise<void> | null = null;

/** Lädt die Szenenbilder einmal. */
export function loadSceneImages(): Promise<void> {
  loading ??= Promise.all(
    Object.entries({ stadium: stadiumUrl, keeper: keeperUrl, shooter: shooterUrl, fx: ballFxUrl, net: netUrl }).map(
      ([k, url]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = url;
          IMG[k as keyof typeof IMG] = img;
        }),
    ),
  ).then(() => undefined);
  return loading;
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

const recolorCache = new Map<string, CanvasImageSource>();
function recolor(img: HTMLImageElement | undefined, pairs: [readonly number[], number[]][]): CanvasImageSource {
  const key = `${img?.src}|${JSON.stringify(pairs)}`;
  const hit = recolorCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  if (!img?.width) return cv;
  cv.width = img.width;
  cv.height = img.height;
  const cx = cv.getContext("2d");
  if (!cx) return cv;
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, cv.width, cv.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const pair = pairs.find(([from]) => distance(from, [px[i], px[i + 1], px[i + 2]]) < KEY_TOLERANCE);
    if (pair) [px[i], px[i + 1], px[i + 2]] = pair[1];
  }
  cx.putImageData(data, 0, 0);
  recolorCache.set(key, cv);
  return cv;
}

/** Umgefärbte Sprite-Sheets (zwischengespeichert pro Farbkombination). */
export function sceneSheets(shirt: string, shorts: string, keeper: string): SceneSheets {
  return {
    shooter: recolor(IMG.shooter, [[KEYS.shirt, rgb(shirt)], [KEYS.shorts, rgb(shorts)]]),
    keeper: recolor(IMG.keeper, [[KEYS.keeper, rgb(keeper)]]),
  };
}

/** Torwartfarbe, die sich von beiden Vereinsfarben deutlich abhebt. */
export function keeperColor(clubColors: [string, string]): string {
  const far = (c: string) => clubColors.every((d) => distance(rgb(d), rgb(c)) > 160);
  return KEEPER_COLORS.find(far) ?? KEEPER_COLORS[0];
}

/** Wohin der Ball geht und was der Torwart macht – deterministisch aus Spiel, Minute und Schütze. */
export function planShot(s: SceneEvent): ShotPlan {
  const h = (key: string) => hash01(s.matchId, s.minute, s.player, key);
  const r = (a: number, b: number, key: string) => a + (b - a) * h(key);
  const side: -1 | 1 = h("seite") < 0.5 ? -1 : 1;
  const height: Height = (["low", "mid", "high"] as const)[Math.floor(h("hoehe") * 3)];
  const ty = { low: 90, mid: 76, high: 64 }[height];
  const base = { outcome: s.outcome, variant: s.variant, side, height };
  switch (s.outcome) {
    case "goal": {
      const diveSide: -1 | 1 = h("falsch") < 0.6 ? (-side as -1 | 1) : side;
      return { ...base, target: { x: GOAL.cx + side * r(42, 60, "x"), y: ty }, diveSide, diveReach: diveSide === side ? 22 : 30 };
    }
    case "save": {
      const target = s.variant === "catch" ? { x: GOAL.cx + side * r(0, 8, "x"), y: 82 } : { x: GOAL.cx + side * r(32, 52, "x"), y: ty };
      return { ...base, target, diveSide: side, diveReach: Math.abs(target.x - GOAL.cx) };
    }
    case "wide": {
      const target = s.variant === "over" ? { x: GOAL.cx + side * r(10, 60, "x"), y: r(38, 48, "y") } : { x: GOAL.cx + side * r(78, 92, "x"), y: ty };
      return { ...base, target, diveSide: side, diveReach: 30 };
    }
    case "post": {
      const target = s.variant === "bar" ? { x: GOAL.cx + side * r(15, 55, "x"), y: GOAL.bar - 1 } : { x: GOAL.cx + side * 69, y: r(64, 90, "y") };
      return { ...base, target, diveSide: side, diveReach: 34 };
    }
  }
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

function drawFrame(ctx: CanvasRenderingContext2D, sheet: CanvasImageSource | undefined, meta: Sheet, f: number, x: number, y: number, anchor: "feet" | "center", flip = false): void {
  const b = meta.frames[f];
  if (!sheet || !b) return;
  const [cw, ch] = meta.cell;
  const mx = (b[0] + b[2]) / 2;
  const my = anchor === "feet" ? b[3] : (b[1] + b[3]) / 2;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sheet, (f % meta.cols) * cw, Math.floor(f / meta.cols) * ch, cw, ch, Math.round(-mx), Math.round(-my), cw, ch);
  ctx.restore();
}

// Der Ball wird pixelweise gezeichnet; die ChatGPT-Bälle verlieren beim Verkleinern ihr Muster.
function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, d: number, spin: number): void {
  const r = d / 2;
  const x0 = Math.round(x - r);
  const y0 = Math.round(y - r);
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) {
      const dist = Math.hypot(i + 0.5 - r, j + 0.5 - r);
      if (dist > r) continue;
      ctx.fillStyle = dist > r - 1 ? "#0b0d0a" : "#f6f2e6";
      ctx.fillRect(x0 + i, y0 + j, 1, 1);
    }
  }
  if (d < 5) return;
  ctx.fillStyle = "#0b0d0a";
  const a = spin * 1.7;
  const k = Math.max(1, Math.floor(d / 4));
  ctx.fillRect(Math.round(x + Math.cos(a) * r * 0.35 - k / 2), Math.round(y + Math.sin(a) * r * 0.35 - k / 2), k, k);
  if (d >= 8) ctx.fillRect(Math.round(x - Math.cos(a) * r * 0.45), Math.round(y - Math.sin(a) * r * 0.45), 1, 1);
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, d: number): void {
  ctx.fillStyle = "rgba(0,0,0,.35)";
  const w = Math.max(3, Math.round(d * 1.2));
  const h = Math.max(1, Math.round(d / 3));
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}

function ballAt(p: ShotPlan, t: number): { x: number; y: number; gy: number; d: number } | null {
  if (t < SCENE_MS.kick) return { x: BALL0.x, y: BALL0.y, gy: BALL0.y + 2, d: 9 };
  const u = clamp01((t - SCENE_MS.kick) / SCENE_MS.fly);
  const e = 1 - Math.pow(1 - u, 1.6);
  const gy = lerp(BALL0.y + 2, GOAL.line + 1, e);
  if (t <= T_HIT) {
    const h = lerp(0, GOAL.line - p.target.y, e) + Math.sin(Math.PI * e) * 10;
    return { x: lerp(BALL0.x, p.target.x, e), y: gy - h, gy, d: Math.round(lerp(9, 5, e)) };
  }
  const v = clamp01((t - T_HIT) / 450);
  const { x: tx, y: ty } = p.target;
  switch (p.outcome) {
    case "goal":
      return { x: tx + (GOAL.cx - tx) * 0.05 * v, y: ty - 2 * v, gy: GOAL.line - 2, d: 5 };
    case "save":
      if (p.variant === "catch") return null; // Ball liegt in den Händen
      return { x: tx + p.side * 26 * v, y: lerp(ty, GOAL.line + 6, v) - Math.sin(Math.PI * v) * 8, gy: GOAL.line + 6 * v, d: 4 + Math.round(v) };
    case "wide":
      return { x: tx + p.side * 20 * v, y: ty - 8 * v, gy: GOAL.line - 6 * v, d: 4 };
    case "post":
      return { x: tx - p.side * 40 * v, y: lerp(ty, 150, v) - Math.sin(Math.PI * v) * 18, gy: lerp(GOAL.line, 152, v), d: Math.round(lerp(4, 7, v)) };
  }
}

const RUN_UP: [number, number, number][] = [
  [0, 0, 34],
  [200, 1, 40],
  [380, 2, 46],
  [560, 3, 52],
  [SCENE_MS.kick - 60, 4, 54],
  [SCENE_MS.kick + 80, 5, 54],
];

/** Zeichnet die Szene zum Zeitpunkt t (ms ab Szenenstart) auf ein 320×200-Canvas. */
export function renderScene(ctx: CanvasRenderingContext2D, plan: ShotPlan, t: number, sheets: SceneSheets): void {
  ctx.clearRect(0, 0, 320, 200);
  if (IMG.stadium) ctx.drawImage(IMG.stadium, 0, 0);

  if (plan.outcome === "goal" && IMG.net && t > T_HIT && t < T_HIT + 900 && Math.floor((t - T_HIT) / 150) % 2 === 0) ctx.drawImage(IMG.net, GOAL.l, GOAL.bar);

  // Torwart
  const K = SPR.torwart;
  const kx0 = GOAL.cx;
  const ky0 = GOAL.line + 1;
  const dv = clamp01((t - SCENE_MS.dive) / (T_HIT - SCENE_MS.dive));
  const reachX = kx0 + plan.diveSide * Math.max(0, plan.diveReach - 18) * dv;
  const diveY = { low: 86, mid: 76, high: 68 }[plan.height];
  const flip = plan.diveSide < 0;
  if (t < SCENE_MS.kick - 120) drawFrame(ctx, sheets.keeper, K, 0, kx0, ky0, "feet");
  else if (t < SCENE_MS.dive) drawFrame(ctx, sheets.keeper, K, 1, kx0, ky0, "feet");
  else if (plan.variant === "catch") drawFrame(ctx, sheets.keeper, K, t < T_HIT + 1100 ? 3 : 11, kx0, ky0, "feet");
  else if (plan.variant === "bar") {
    const jumping = t < T_HIT + 500;
    drawFrame(ctx, sheets.keeper, K, jumping ? 8 : 0, kx0, ky0 - (jumping ? 6 * Math.sin(Math.PI * dv) : 0), "feet");
  } else if (t < T_HIT + 350) drawFrame(ctx, sheets.keeper, K, DIVE_FRAME[plan.height], reachX, lerp(ky0 - 16, diveY, dv), "center", flip);
  else if (t < T_HIT + 1100) drawFrame(ctx, sheets.keeper, K, 7, reachX, GOAL.line - 1, "feet", flip);
  else drawFrame(ctx, sheets.keeper, K, plan.outcome === "goal" ? 10 : plan.outcome === "save" ? 11 : 0, reachX, ky0, "feet", flip);

  // Ball samt Schatten, Grasbüschel beim Schuss, Funke am Aluminium
  const b = ballAt(plan, t);
  if (b) {
    drawShadow(ctx, b.x, b.gy, b.d);
    drawBall(ctx, b.x, b.y, b.d, t / 60);
  }
  if (t > SCENE_MS.kick && t < SCENE_MS.kick + 240) drawFrame(ctx, IMG.fx, SPR.effekte, 21 + Math.floor((t - SCENE_MS.kick) / 80), BALL0.x, BALL0.y + 3, "center");
  if (plan.outcome === "post" && t > T_HIT && t < T_HIT + 300) drawFrame(ctx, IMG.fx, SPR.effekte, 18 + Math.floor((t - T_HIT) / 100), plan.target.x, plan.target.y, "center");

  // Schütze (vorne, zuletzt gezeichnet)
  let [, frame, x] = RUN_UP[0];
  for (const [from, f, sx] of RUN_UP) if (t >= from) [frame, x] = [f, sx];
  if (t > T_HIT + 300) {
    frame = plan.outcome === "goal" ? 6 : 7;
    if (plan.outcome === "goal") x = 54 - Math.min(30, (t - T_HIT - 300) / 30);
  }
  drawFrame(ctx, sheets.shooter, SPR.schuetze, frame, x, 199, "feet");
}
