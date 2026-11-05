// Torszene mit den aufbereiteten Pixelgrafiken (Wegwerf-Entwurf).
// Szenenkoordinaten: 320×200, Tor innen x 92–228, Latte unten y 58, Torlinie y 95.
const SPR = {{sprites.json}};
const SRC = { stadion: "{{stadion.png}}", torwart: "{{torwart.png}}", schuetze: "{{schuetze.png}}", fx: "{{ball-effekte.png}}", netz: "{{netz.png}}" };
const IMG = {};
for (const [k, v] of Object.entries(SRC)) { IMG[k] = new Image(); IMG[k].src = v; }

const GOAL = { l: 92, r: 228, bar: 58, line: 95, cx: 160 };
const BALL0 = { x: 76, y: 192 };

function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
const recolorCache = {};
function recolor(name, pairs) {
  const key = name + JSON.stringify(pairs);
  if (recolorCache[key]) return recolorCache[key];
  const img = IMG[name], cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, cv.width, cv.height), px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    for (const [from, to] of pairs) {
      if (Math.abs(px[i] - from[0]) + Math.abs(px[i + 1] - from[1]) + Math.abs(px[i + 2] - from[2]) < 90) {
        px[i] = to[0]; px[i + 1] = to[1]; px[i + 2] = to[2]; break;
      }
    }
  }
  cx.putImageData(d, 0, 0);
  return (recolorCache[key] = cv);
}

// Zeichnet Pose f eines Sheets. anchor "feet": Mitte unten auf (x,y); "center": Rahmenmitte auf (x,y).
function drawFrame(ctx, sheet, meta, f, x, y, anchor, flip) {
  const [cw, ch] = meta.cell, b = meta.frames[f];
  const sx = (f % meta.cols) * cw, sy = Math.floor(f / meta.cols) * ch;
  const mx = (b[0] + b[2]) / 2, my = anchor === "feet" ? b[3] : (b[1] + b[3]) / 2;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sheet, sx, sy, cw, ch, Math.round(-mx), Math.round(-my), cw, ch);
  ctx.restore();
}

// Kleine Bälle zeichne ich pixelweise; die ChatGPT-Bälle verlieren beim Verkleinern ihr Muster.
function drawBall(ctx, x, y, d, spin) {
  const r = d / 2, x0 = Math.round(x - r), y0 = Math.round(y - r);
  for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) {
    const dist = Math.hypot(i + .5 - r, j + .5 - r);
    if (dist > r) continue;
    ctx.fillStyle = dist > r - 1 ? "#0b0d0a" : "#f6f2e6";
    ctx.fillRect(x0 + i, y0 + j, 1, 1);
  }
  if (d >= 5) {
    ctx.fillStyle = "#0b0d0a";
    const a = spin * 1.7, k = Math.max(1, Math.floor(d / 4));
    ctx.fillRect(Math.round(x + Math.cos(a) * r * .35 - k / 2), Math.round(y + Math.sin(a) * r * .35 - k / 2), k, k);
    if (d >= 8) ctx.fillRect(Math.round(x - Math.cos(a) * r * .45), Math.round(y - Math.sin(a) * r * .45), 1, 1);
  }
}
function drawShadow(ctx, x, y, d) {
  ctx.fillStyle = "rgba(0,0,0,.35)";
  const w = Math.max(3, Math.round(d * 1.2)), h = Math.max(1, Math.round(d / 3));
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}
function drawFx(ctx, f, x, y) { drawFrame(ctx, IMG.fx, SPR.effekte, f, x, y, "center", false); }

const lerp = (a, b, u) => a + (b - a) * u;
const clamp01 = (u) => Math.max(0, Math.min(1, u));

// Plant den Ablauf einer Szene: wohin geht der Ball, was macht der Torwart.
function planScene(outcome) {
  const side = Math.random() < .5 ? -1 : 1;
  const height = pick(["low", "mid", "high"]);
  const ty = { low: 90, mid: 76, high: 64 }[height];
  const p = { outcome, side, height };
  if (outcome === "goal") {
    p.target = { x: GOAL.cx + side * rnd(42, 60), y: ty };
    p.diveSide = Math.random() < .6 ? -side : side;           // falsche Ecke oder zu kurz
    p.diveReach = p.diveSide === side ? 22 : 30;
  } else if (outcome === "save") {
    const central = Math.random() < .25;
    p.target = { x: GOAL.cx + (central ? side * rnd(0, 8) : side * rnd(32, 52)), y: central ? 82 : ty };
    p.catch = central; p.diveSide = side; p.diveReach = Math.abs(p.target.x - GOAL.cx);
  } else if (outcome === "wide") {
    const over = Math.random() < .4;
    p.target = over ? { x: GOAL.cx + side * rnd(10, 60), y: rnd(38, 48) } : { x: GOAL.cx + side * rnd(78, 92), y: ty };
    p.over = over; p.diveSide = side; p.diveReach = 30;
  } else {                                                     // Pfosten oder Latte
    const bar = Math.random() < .4;
    p.target = bar ? { x: GOAL.cx + side * rnd(15, 55), y: GOAL.bar - 1 } : { x: GOAL.cx + side * 69, y: rnd(64, 90) };
    p.bar = bar; p.diveSide = side; p.diveReach = 34;
  }
  p.label = { goal: "TOR!", save: "GEHALTEN!", wide: p.over ? "DRÜBER!" : "VORBEI!", post: p.bar ? "LATTE!" : "PFOSTEN!" }[outcome];
  return p;
}

const T_KICK = 760, T_FLY = 520, T_DIVE = 980, T_HIT = T_KICK + T_FLY, T_END = 3400;
const DIVE_FRAME = { low: 4, mid: 5, high: 6 };

function ballAt(p, t) {
  const u = clamp01((t - T_KICK) / T_FLY), e = 1 - Math.pow(1 - u, 1.6);
  if (t < T_KICK) return { x: BALL0.x, y: BALL0.y, gy: BALL0.y + 2, d: 9 };
  const gy = lerp(BALL0.y + 2, GOAL.line + 1, e);
  if (t <= T_HIT) {
    const h = lerp(0, GOAL.line - p.target.y, e) + Math.sin(Math.PI * e) * 10;
    return { x: lerp(BALL0.x, p.target.x, e), y: gy - h, gy, d: Math.round(lerp(9, 5, e)) };
  }
  const v = clamp01((t - T_HIT) / 450);
  const tx = p.target.x, ty = p.target.y;
  if (p.outcome === "goal") return { x: tx + (GOAL.cx - tx) * .05 * v, y: ty - 2 * v, gy: GOAL.line - 2, d: 5 };
  if (p.outcome === "save") {
    if (p.catch) return null;                                   // Ball liegt in den Händen
    return { x: tx + p.side * 26 * v, y: lerp(ty, GOAL.line + 6, v) - Math.sin(Math.PI * v) * 8, gy: GOAL.line + 6 * v, d: 4 + Math.round(v) };
  }
  if (p.outcome === "wide") return { x: tx + p.side * 20 * v, y: ty - 8 * v, gy: GOAL.line - 6 * v, d: 4 };
  // Pfosten/Latte: Ball springt Richtung Kamera zurück
  return { x: tx - p.side * 40 * v, y: lerp(ty, 150, v) - Math.sin(Math.PI * v) * 18, gy: lerp(GOAL.line, 152, v), d: Math.round(lerp(4, 7, v)) };
}

function renderScene(ctx, p, t, sheets) {
  ctx.clearRect(0, 0, 320, 200);
  ctx.drawImage(IMG.stadion, 0, 0);

  // Netz beult aus
  if (p.outcome === "goal" && t > T_HIT && t < T_HIT + 900 && Math.floor((t - T_HIT) / 150) % 2 === 0)
    ctx.drawImage(IMG.netz, GOAL.l, GOAL.bar);

  // Torwart
  const kx0 = GOAL.cx, ky0 = GOAL.line + 1;
  const dv = clamp01((t - T_DIVE) / (T_HIT - T_DIVE));
  const reachX = kx0 + p.diveSide * Math.max(0, p.diveReach - 18) * dv;
  const diveY = { low: 86, mid: 76, high: 68 }[p.height];
  const flip = p.diveSide < 0;
  if (t < T_KICK - 120) drawFrame(ctx, sheets.keeper, SPR.torwart, 0, kx0, ky0, "feet");
  else if (t < T_DIVE) drawFrame(ctx, sheets.keeper, SPR.torwart, 1, kx0, ky0, "feet");
  else if (p.outcome === "save" && p.catch) drawFrame(ctx, sheets.keeper, SPR.torwart, t < T_HIT + 1100 ? 3 : 11, kx0, ky0, "feet");
  else if (p.outcome === "post" && p.bar) drawFrame(ctx, sheets.keeper, SPR.torwart, t < T_HIT + 500 ? 8 : 0, kx0, ky0 - (t < T_HIT + 500 ? 6 * Math.sin(Math.PI * dv) : 0), "feet");
  else if (t < T_HIT + 350) drawFrame(ctx, sheets.keeper, SPR.torwart, DIVE_FRAME[p.height], reachX, lerp(ky0 - 16, diveY, dv), "center", flip);
  else if (t < T_HIT + 1100) drawFrame(ctx, sheets.keeper, SPR.torwart, 7, reachX, GOAL.line - 1, "feet", flip);
  else drawFrame(ctx, sheets.keeper, SPR.torwart, p.outcome === "goal" ? 10 : p.outcome === "save" ? 11 : 0, reachX, ky0, "feet", flip);

  // Ball samt Schatten
  const b = ballAt(p, t);
  if (b) {
    drawShadow(ctx, b.x, b.gy, b.d);
    drawBall(ctx, b.x, b.y, b.d, t / 60);
  }
  if (t > T_KICK && t < T_KICK + 240) drawFx(ctx, 21 + Math.floor((t - T_KICK) / 80), BALL0.x, BALL0.y + 3);
  if (p.outcome === "post" && t > T_HIT && t < T_HIT + 300) drawFx(ctx, 18 + Math.floor((t - T_HIT) / 100), p.target.x, p.target.y);

  // Schütze (vorne, zuletzt gezeichnet)
  const run = [[0, 34], [200, 1, 40], [380, 2, 46], [560, 3, 52], [T_KICK - 60, 4, 54], [T_KICK + 80, 5, 54]];
  let sf = 0, sx = 34;
  for (const r of run) if (t >= r[0]) { sf = r.length === 3 ? r[1] : 0; sx = r.length === 3 ? r[2] : r[1]; }
  if (t > T_HIT + 300) {
    sf = p.outcome === "goal" ? 6 : 7;
    if (p.outcome === "goal") sx = 54 - Math.min(30, (t - T_HIT - 300) / 30);
  }
  drawFrame(ctx, sheets.shooter, SPR.schuetze, sf, sx, 199, "feet");
}

function keeperColor(def) {
  const opts = ["#3cb043", "#d4b000", "#2b2b2b", "#e05a00", "#9a9a9a"];
  const far = (c) => [def[1], def[2]].every(d => hex(d).reduce((s, v, i) => s + Math.abs(v - hex(c)[i]), 0) > 160);
  return opts.find(far) || opts[0];
}

function startScene(i, home) {
  const g = games[i], att = home ? g.home : g.away, def = home ? g.away : g.home;
  const shooterName = pick(NAMES);
  const r = Math.random();
  const outcome = r < .45 ? "goal" : r < .75 ? "save" : r < .9 ? "wide" : "post";
  const p = planScene(outcome);
  scene = { idx: i };
  const q = stage.children[i];
  q.innerHTML = quadHTML(g, i);
  const sc = q.querySelector(".scene"), out = q.querySelector(".s-out");
  q.querySelector(".s-cap").innerHTML = `<b>GROSSCHANCE ${minute}'</b> ${shooterName} · ${short(att[0])}`;
  sc.classList.add("on");
  const ctx = sc.querySelector("canvas").getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const sheets = {
    shooter: recolor("schuetze", [[[255, 0, 255], hex(att[1])], [[0, 255, 255], hex(att[2])]]),
    keeper: recolor("torwart", [[[0, 255, 0], hex(keeperColor(def))]])
  };
  const minuteAtShot = minute;
  let done = false;
  const t0 = performance.now();
  function frame(now) {
    const t = now - t0;
    renderScene(ctx, p, t, sheets);
    if (!done && t >= T_HIT) {
      done = true;
      out.textContent = p.label; out.classList.add("on");
      out.classList.toggle("goal", outcome === "goal");
      if (outcome === "goal") {
        if (home) g.gh++; else g.ga++;
        g.ticker.unshift(`TOR! ${minuteAtShot}' ${shooterName} (${short(att[0])})`);
        g.flash = 3;
      } else {
        g.ticker.unshift(`${minuteAtShot}' ${shooterName}: ${p.label.replace("!", "").toLowerCase()}`);
      }
      g.marks.push({ min: minuteAtShot, home, goal: outcome === "goal" });
    }
    if (t < T_END) requestAnimationFrame(frame);
    else { scene = null; render(); }
  }
  requestAnimationFrame(frame);
}

function sceneHTML() {
  return `<div class="scene"><canvas width="320" height="200"></canvas><div class="s-cap"></div><div class="s-out"></div></div>`;
}
