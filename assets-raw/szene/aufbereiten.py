"""Bereitet die ChatGPT-Rohbilder als pixelgenaue Sprites auf (Wegwerf-Werkzeug für den Entwurf).

Aufruf: uv run --no-project --with pillow --with numpy --with scipy python assets-raw/szene/aufbereiten.py
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

RAW = Path(__file__).parent
OUT = RAW.parent.parent / "src/ui/live/assets"
OUT.mkdir(parents=True, exist_ok=True)

KEYS = {"magenta": (255, 0, 255), "cyan": (0, 255, 255), "green": (0, 255, 0)}


def load(name):
    return np.array(Image.open(RAW / name).convert("RGBA")).astype(np.int16)


def background_mask(a, strict=False):
    rgb = a[..., :3]
    bright = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    return (bright > 225) & (sat < 15) if strict else (bright > 150) & (sat < 40)


def cut_cells(a, cols, rows):
    """Entfernt pro Zelle alles Hintergrundartige, das mit dem Zellrand verbunden ist."""
    h, w = a.shape[:2]
    bg = background_mask(a)
    for r in range(rows):
        for c in range(cols):
            y0, y1 = round(r * h / rows), round((r + 1) * h / rows)
            x0, x1 = round(c * w / cols), round((c + 1) * w / cols)
            lab, _ = ndimage.label(bg[y0:y1, x0:x1])
            edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
            kill = np.isin(lab, edge[edge > 0])
            a[y0:y1, x0:x1, 3][kill] = 0
    return a


def downscale(a, tw, th):
    """Blockweise: Deckung per Mehrheit, Farbe als Median der deckenden Pixel."""
    h, w = a.shape[:2]
    out = np.zeros((th, tw, 4), np.uint8)
    for y in range(th):
        ys = slice(round(y * h / th), round((y + 1) * h / th))
        for x in range(tw):
            blk = a[ys, round(x * w / tw):round((x + 1) * w / tw)].reshape(-1, 4)
            op = blk[blk[:, 3] > 127]
            if len(op) * 2 >= len(blk):
                out[y, x, :3] = np.median(op[:, :3], axis=0)
                out[y, x, 3] = 255
    return out


def snap_keys(o, keys):
    r, g, b = (o[..., i].astype(int) for i in range(3))
    rules = {
        "magenta": (r > 150) & (b > 150) & (g < 110),
        "cyan": (g > 150) & (b > 150) & (r < 110),
        "green": (g > 140) & (r < 130) & (b < 110),
    }
    for k in keys:
        m = rules[k] & (o[..., 3] > 0)
        o[m, :3] = KEYS[k]
    return o


def quantize(o, colors):
    img = Image.fromarray(o, "RGBA")
    alpha = img.getchannel("A")
    q = img.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGB")
    q.putalpha(alpha.point(lambda v: 255 if v > 127 else 0))
    return q


def save(img, name):
    img.save(OUT / name)
    img.resize((img.width * 4, img.height * 4), Image.NEAREST).save(RAW / f"vorschau-{name}")
    print(name, img.size)


# Stadion: 320×200
st = load("stadion.webp")
save(quantize(downscale(st, 320, 200), 32), "stadion.png")

# Torwart: 4×3 Zellen à 64×56
kp = cut_cells(load("torwart.webp"), 4, 3)
save(quantize(snap_keys(downscale(kp, 256, 168), ["green"]), 24), "torwart.png")

# Schütze: 4×2 Zellen à 72×96
sh = cut_cells(load("schuetze.webp"), 4, 2)
save(quantize(snap_keys(downscale(sh, 288, 192), ["magenta", "cyan"]), 24), "schuetze.png")

# Ball und Effekte: 6×4 Zellen à 16×16
bl = cut_cells(load("ball-effekte.webp"), 6, 4)
save(quantize(downscale(bl, 96, 64), 16), "ball-effekte.png")

# Netz: Weiß in den Maschen wird durchsichtig
nt = load("netz.webp")
nt[..., 3][background_mask(nt, strict=True)] = 0
net = downscale(nt, 136, 37)
net[net[..., :3].mean(axis=2) < 140, 3] = 0  # schwarze Umrisse weg, nur die hellen Maschen bleiben
save(quantize(net, 6), "netz.png")


def frames(name, cols, rows):
    """Begrenzungsrahmen jeder Pose in Zellkoordinaten, damit die Szene Füße bzw. Körpermitte ausrichten kann."""
    a = np.array(Image.open(OUT / name))[..., 3]
    ch, cw = a.shape[0] // rows, a.shape[1] // cols
    out = []
    for r in range(rows):
        for c in range(cols):
            ys, xs = np.nonzero(a[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw])
            out.append([int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1] if len(xs) else None)
    return {"cell": [cw, ch], "cols": cols, "frames": out}


import json
meta = {"torwart": frames("torwart.png", 4, 3), "schuetze": frames("schuetze.png", 4, 2), "effekte": frames("ball-effekte.png", 6, 4)}
(OUT / "sprites.json").write_text(json.dumps(meta))
print(json.dumps(meta))


# Entwurf zusammensetzen: Szene-Skript und Bilder direkt in die HTML-Datei einbetten,
# damit sie als einzelne Datei funktioniert (Canvas darf file://-Bilder nicht auslesen).
import base64

MOCK = RAW.parent.parent / "docs/superpowers/mockups"
html = (MOCK / "live-viertel.template.html").read_text()
html = html.replace("{{szene.js}}", (MOCK / "szene.js").read_text())
html = html.replace("{{sprites.json}}", (OUT / "sprites.json").read_text())
for png in OUT.glob("*.png"):
    html = html.replace("{{" + png.name + "}}", "data:image/png;base64," + base64.b64encode(png.read_bytes()).decode())
(MOCK / "live-viertel.html").write_text(html)
print("live-viertel.html", len(html) // 1024, "KB")
