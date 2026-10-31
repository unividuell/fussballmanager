# Oberfläche Hot-Seat (Plan 2 von 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Spiel wird im Browser spielbar. 1–4 Manager starten ein neues Spiel und wechseln sich am Laptop ab (Hot-Seat). Sie stellen Mannschaft und Taktik ein, sehen Tabelle und Spielplan, verfolgen die Konferenz, wechseln in der Halbzeit, sehen die Auswertung und spielen Saison für Saison weiter – im Stil „Rasen & Holztafel“.

**Architecture:** Die Oberfläche (`src/ui/`) spricht nur über einen `GameController` mit der Session aus Plan 1. Der Controller hält den aktuellen `Snapshot` als `$state.raw` und leitet daraus den angezeigten Bildschirm ab (`view`). Er schickt Befehle über den `LocalTransport`. Alles, was keine Darstellung ist (Skalierung, Ticker-Stand, Tabellen-Aufbereitung, Aufstellungs-Tausch, Halbzeit-Entwurf, Texte), liegt in reinen TypeScript-Modulen unter `src/ui/logic/` und wird ohne Browser getestet. Svelte-Komponenten werden mit Testing Library in jsdom getestet.

**Tech Stack:** Svelte 5.57.3 (Runes), Vite 8.3.5, Vitest 5.0.5, TypeScript 5.6.3, @testing-library/svelte 5.4.2, @testing-library/user-event 14.6.8, jsdom 30.1.3, @fontsource/vt323 5.3.0, @fontsource/press-start-2p 5.3.0.

**Spec:** `docs/superpowers/specs/2026-10-31-fussballmanager-design.md` (Abschnitt 4 Optik, 3.2 Spieltag, 3.3 Saisonende). Referenz-Mockups: https://claude.ai/artifact/7yPio9FvtHP7uZX4d14hiv (Variante B).

**Umfang:**
- **Enthalten:** Neues Spiel, Manager-Wechsel, Hauptmenü, Mannschaft (Aufstellung und Taktik), Tabelle und Spielplan, Konferenz, Halbzeit, Auswertung und Saisonende.
- **Nicht enthalten:** Training, Verträge, Transfers, Finanzen und Nachrichten. Sie erscheinen im Hauptmenü als gesperrte Kacheln mit dem Hinweis „folgt“ und kommen in Plan 3. Speichern, Laden und Optionen kommen in Plan 4.

## Global Constraints

- **Abhängigkeiten:** Versionen exakt pinnen (`--save-exact`). Neue Laufzeit-Abhängigkeiten sind nur `@fontsource/vt323` und `@fontsource/press-start-2p`, Test-Abhängigkeiten nur die drei oben genannten.
- **Spielstand nur über Befehle:** Die UI verändert den `GameState` nie direkt. Jede Änderung läuft über `controller.send(cmd)` oder `controller.advance()`.
- **Engine bleibt unverändert:** `src/engine/`, `src/session/` und `src/transport/` werden in diesem Plan nicht verändert.
- **Zufall:** `Math.random()` ist in der UI nur für den vorgeschlagenen Welt-Seed in „Neues Spiel“ erlaubt.
- **Bildschirm:** Die logische Fläche ist 640×400 px. Sie wird mit dem größten ganzzahligen Faktor skaliert, der passt. Ist das Fenster kleiner als 640×400, wird mit Faktor < 1 verkleinert (mindestens 0,25). Die Seite scrollt nie.
- **Schriften:** „Press Start 2P“ für Überschriften, „VT323“ für Text. Beide werden lokal über `@fontsource` gebündelt, ohne CDN.
- **Farben:** Alle Farben kommen als Tokens aus `src/ui/theme/theme.css`. Es gibt bewusst nur einen einzigen dunklen Retro-Look und keinen Hell-Modus.
- **Texte:** Alle sichtbaren Texte sind deutsch, die Code-Bezeichner englisch.
- **Tasten** (Spec Abschnitt 4):
  - 1–8: Kachel im Hauptmenü
  - Enter: Weiter / Bestätigen
  - Esc: zurück
  - Konferenz: TAB wechselt die Liga, + und − ändern das Tempo, die Leertaste überspringt
- **Konferenz-Tempo:** 1000 / 500 / 200 ms pro Spielminute, Standard ist 500 ms (also etwa 45 s pro Spiel).
- **Tests:**
  - Logik-Tests laufen in der Node-Umgebung.
  - Komponenten-Tests beginnen mit `// @vitest-environment jsdom`.
  - Test-Hilfskomponenten liegen unter `tests/ui/`.

## Review Focus

1. **Hot-Seat-Übergabe:** Wenn Manager A „Weiter“ drückt, beginnt Manager B immer beim „… ist dran“-Bildschirm und nie im Untermenü von A. Abgesichert in Task 6 (Controller-Test) und Task 13 (Ablauftest).
2. **Konferenz verlassen, während der Timer läuft:** Nach „Weiter“ läuft kein Timer weiter, und `advance()` wird nicht zweimal ausgelöst. Enter wirkt erst, wenn die Halbzeit bzw. das Spiel zu Ende ist. Abgesichert in Task 11.
3. **Verletzten Spieler in die Startelf tauschen:** Es erscheint eine sichtbare Fehlermeldung, und die Aufstellung bleibt unverändert. Abgesichert in Task 9.
4. **Fenster kleiner als 640×400** (z. B. ein Handy quer): Die Fläche wird verkleinert und es gibt keinen Scrollbalken. Abgesichert in Task 1.
5. **Halbzeit ohne freie Wechsel** (5 Wechsel schon durch Verletzungen verbraucht): Der Entwurf lehnt weitere Wechsel mit Meldung ab, und „Fertig“ funktioniert trotzdem. Abgesichert in Task 5 und Task 12.

## Dateistruktur

```
src/
├─ main.ts                        # Schriften + Theme laden, App mit GameController mounten
├─ App.svelte                     # Bildschirm je nach controller.view
└─ ui/
   ├─ controller.svelte.ts        # GameController: Session, Snapshot, View, Befehle
   ├─ logic/
   │  ├─ scale.ts                 # Skalierungsfaktor
   │  ├─ format.ts                # Beschriftungen, Spielernamen, Ereignistexte
   │  ├─ tables.ts                # Tabelle, Spielplan, Vereinsbewertung, Platzierung
   │  ├─ ticker.ts                # Konferenz-Stand zu einer Minute, Tempo
   │  ├─ lineupEdit.ts            # Kaderzeilen, Spieler tauschen
   │  └─ halftimeDraft.ts         # Halbzeit-Entwurf → HalftimeCommand
   ├─ theme/
   │  ├─ theme.css                # Tokens, Grundstil, Buttons, Tabellen
   │  ├─ Screen.svelte            # 640×400-Fläche, skaliert
   │  ├─ Panel.svelte             # Holztafel
   │  ├─ Tile.svelte              # Menü-Kachel
   │  └─ Crest.svelte             # Vereinswappen (SVG)
   └─ screens/
      ├─ NewGame.svelte
      ├─ ClubHeader.svelte
      ├─ TurnStart.svelte
      ├─ MainMenu.svelte
      ├─ Squad.svelte
      ├─ Tables.svelte
      ├─ Conference.svelte
      ├─ Halftime.svelte
      ├─ Results.svelte
      └─ SeasonEnd.svelte
tests/ui/                          # Logik- und Komponententests, Test-Helfer
```

---

### Task 1: UI-Setup, Theme und skalierte Bildschirmfläche

**Files:**
- Modify: `package.json` (über npm), `vite.config.ts`, `src/main.ts`, `src/App.svelte`
- Create: `src/ui/logic/scale.ts`, `src/ui/theme/theme.css`, `src/ui/theme/Screen.svelte`
- Test: `tests/ui/scale.test.ts`, `tests/ui/screen.test.ts`

**Interfaces:**
- Produces:
  - `BASE_W = 640`, `BASE_H = 400`
  - `fitScale(viewW: number, viewH: number): number`
  - `Screen.svelte` mit den Props `{ children: Snippet; scanlines?: boolean }`
  - CSS-Tokens:
    - Rasen: `--grass-1`, `--grass-2`
    - Holz: `--wood`, `--wood-light`, `--wood-edge`, `--wood-dark`
    - Text und Akzente: `--cream`, `--gold`, `--leaf`, `--rust`
    - Hintergrund: `--ink`
    - Schriften: `--font-display`, `--font-body`
  - Globale Klassen `.btn` (mit Variante `.btn.primary`), `.board-table` und `.msg`

- [ ] **Step 1: Abhängigkeiten installieren und Vitest für Svelte-Komponenten einrichten**

```bash
cd /home/claude/projects/fussballmanager
npm install --save-exact @fontsource/vt323@5.3.0 @fontsource/press-start-2p@5.3.0
npm install --save-exact -D @testing-library/svelte@5.4.2 @testing-library/user-event@14.6.8 jsdom@30.1.3
```

`vite.config.ts` komplett ersetzen:

```ts
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  base: "./",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
```

- [ ] **Step 2: Failing Tests schreiben**

`tests/ui/scale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BASE_H, BASE_W, fitScale } from "../../src/ui/logic/scale";

describe("fitScale", () => {
  it("nimmt den größten ganzzahligen Faktor, der passt", () => {
    expect(fitScale(BASE_W, BASE_H)).toBe(1);
    expect(fitScale(1280, 800)).toBe(2);
    expect(fitScale(1920, 1080)).toBe(2);
    expect(fitScale(3840, 2160)).toBe(5);
    expect(fitScale(1366, 768)).toBe(1);
  });

  it("verkleinert stufenlos, wenn das Fenster kleiner als 640×400 ist", () => {
    expect(fitScale(320, 200)).toBeCloseTo(0.5);
    expect(fitScale(640, 200)).toBeCloseTo(0.5);
    expect(fitScale(100, 50)).toBe(0.25);
  });
});
```

`tests/ui/screen.test.ts`:

```ts
// @vitest-environment jsdom
import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import Screen from "../../src/ui/theme/Screen.svelte";

const content = createRawSnippet(() => ({ render: () => "<p>Inhalt</p>" }));

describe("Screen", () => {
  it("zeigt den Inhalt auf einer 640×400-Fläche mit Skalierung", () => {
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const { container, getByText } = render(Screen, { children: content });
    expect(getByText("Inhalt")).toBeTruthy();
    const screen = container.querySelector(".screen") as HTMLElement;
    expect(screen.style.width).toBe("640px");
    expect(screen.style.height).toBe("400px");
    expect(screen.style.transform).toBe("scale(2)");
  });

  it("schaltet Scanlines ein, wenn gewünscht", () => {
    const { container } = render(Screen, { children: content, scanlines: true });
    expect(container.querySelector(".screen.scanlines")).not.toBeNull();
  });
});
```

- [ ] **Step 3: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/ui`
Expected: FAIL, weil die Module `scale` und `Screen.svelte` nicht gefunden werden.

- [ ] **Step 4: Implementieren**

`src/ui/logic/scale.ts`:

```ts
export const BASE_W = 640;
export const BASE_H = 400;
const MIN_SCALE = 0.25;

/** Größter ganzzahliger Faktor, der ins Fenster passt; bei kleinen Fenstern stufenlos verkleinert. */
export function fitScale(viewW: number, viewH: number): number {
  const exact = Math.min(viewW / BASE_W, viewH / BASE_H);
  if (exact >= 1) return Math.floor(exact);
  return Math.max(MIN_SCALE, exact);
}
```

`src/ui/theme/theme.css`:

```css
/* Look „Rasen & Holztafel“: gestreifter Rasen, dunkle Holztafeln, cremefarbene Pixel-Schrift. Bewusst nur ein Look. */
:root {
  --grass-1: #1f5c22;
  --grass-2: #246a27;
  --wood: #3b2614;
  --wood-light: #5a3a1c;
  --wood-edge: #7a5230;
  --wood-dark: #1a1009;
  --cream: #f3e7c9;
  --gold: #ffcc33;
  --leaf: #a8d08d;
  --rust: #b8401f;
  --ink: #0b0d0a;
  --font-display: "Press Start 2P", "Courier New", monospace;
  --font-body: "VT323", "Courier New", monospace;
  color-scheme: dark;
}

html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: var(--ink);
  color: var(--cream);
  font-family: var(--font-body);
  font-size: 16px;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: normal;
  color: var(--gold);
  margin: 0;
  line-height: 1.4;
}
h1 { font-size: 16px; }
h2 { font-size: 8px; letter-spacing: 0.04em; }

.btn {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1;
  color: var(--cream);
  background: var(--wood-light);
  border: 2px solid var(--wood-edge);
  padding: 3px 8px;
  cursor: pointer;
}
.btn:hover:not(:disabled) { border-color: var(--gold); }
.btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn.primary { color: var(--wood-dark); background: var(--gold); border-color: var(--cream); }
.btn.selected { border-color: var(--gold); color: var(--gold); }

.board-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.board-table th {
  text-align: left;
  color: var(--leaf);
  font-weight: normal;
  border-bottom: 1px solid var(--wood-edge);
  cursor: default;
}
.board-table td,
.board-table th { padding: 0 4px; white-space: nowrap; }
.board-table td.num,
.board-table th.num { text-align: right; }
.board-table tr.mine td { color: var(--gold); }
.board-table tr.clickable { cursor: pointer; }
.board-table tr.clickable:hover td { background: var(--wood-light); }
.board-table tr.picked td { background: var(--rust); color: var(--cream); }

.msg {
  color: var(--cream);
  background: var(--rust);
  border: 2px solid var(--cream);
  padding: 2px 6px;
}
```

`src/ui/theme/Screen.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import { BASE_H, BASE_W, fitScale } from "../logic/scale";

  let { children, scanlines = false }: { children: Snippet; scanlines?: boolean } = $props();
  let viewW = $state(BASE_W);
  let viewH = $state(BASE_H);
  const scale = $derived(fitScale(viewW, viewH));
</script>

<svelte:window bind:innerWidth={viewW} bind:innerHeight={viewH} />

<div class="stage">
  <div
    class="screen"
    class:scanlines
    style:width="{BASE_W}px"
    style:height="{BASE_H}px"
    style:transform="scale({scale})"
  >
    {@render children()}
  </div>
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: var(--ink);
  }
  .screen {
    position: relative;
    overflow: hidden;
    flex: none;
    transform-origin: center;
    image-rendering: pixelated;
    background: repeating-linear-gradient(90deg, var(--grass-1) 0 40px, var(--grass-2) 40px 80px);
  }
  .screen.scanlines::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.22) 0 1px, transparent 1px 3px);
  }
</style>
```

`src/main.ts` komplett ersetzen:

```ts
import "@fontsource/vt323";
import "@fontsource/press-start-2p";
import "./ui/theme/theme.css";
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
```

`src/App.svelte` komplett ersetzen (Zwischenstand, Task 7 ersetzt ihn):

```svelte
<script lang="ts">
  import Screen from "./ui/theme/Screen.svelte";
</script>

<Screen>
  <p style="padding: 16px">Fussballmanager</p>
</Screen>
```

- [ ] **Step 5: Tests, Typprüfung und Build laufen lassen**

Run: `npx vitest run tests/ui && npm run check && npm run build`
Expected: Die UI-Tests sind PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen, und der Build ist erfolgreich (`dist/assets` enthält die woff2-Schriftdateien).

- [ ] **Step 6: Gesamte Testsuite laufen lassen und committen**

Run: `npx vitest run`
Expected: alle Tests PASS (die Engine-Tests laufen weiter in Node).

```bash
git add package.json package-lock.json vite.config.ts src/main.ts src/App.svelte src/ui tests/ui
git commit -m "feat(ui): Theme, Schriften und skalierte 640×400-Fläche"
```

---

### Task 2: Holztafel, Menü-Kachel und Vereinswappen

**Files:**
- Create: `src/ui/theme/Panel.svelte`, `src/ui/theme/Tile.svelte`, `src/ui/theme/Crest.svelte`
- Test: `tests/ui/theme.test.ts`

**Interfaces:**
- Consumes: Tokens aus `theme.css` (Task 1), `CrestPattern` aus `src/engine/model.ts`
- Produces:
  - `Panel.svelte` mit den Props `{ title?: string; children: Snippet; class?: string }`. Es rendert ein `<section class="panel">`; mit Titel kommt ein `<h2>` dazu.
  - `Tile.svelte` mit den Props `{ shortcut: string; icon: string; label: string; disabled?: boolean; selected?: boolean; onclick: () => void }`. Es rendert einen `<button class="tile">`. Ist die Kachel gesperrt, zeigt sie „folgt“.
  - `Crest.svelte` mit den Props `{ colors: [string, string]; pattern: CrestPattern; size?: number }` (Standardgröße 16). Es rendert ein `<svg>` in Schildform.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/theme.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it, vi } from "vitest";
import Crest from "../../src/ui/theme/Crest.svelte";
import Panel from "../../src/ui/theme/Panel.svelte";
import Tile from "../../src/ui/theme/Tile.svelte";

const body = createRawSnippet(() => ({ render: () => "<p>Tafelinhalt</p>" }));

describe("Panel", () => {
  it("zeigt Titel und Inhalt", () => {
    const { getByText, container } = render(Panel, { title: "Kader", children: body });
    expect(getByText("Kader").tagName).toBe("H2");
    expect(getByText("Tafelinhalt")).toBeTruthy();
    expect(container.querySelector("section.panel")).not.toBeNull();
  });

  it("kommt ohne Titel aus", () => {
    const { container } = render(Panel, { children: body });
    expect(container.querySelector("h2")).toBeNull();
  });
});

describe("Tile", () => {
  it("ruft onclick auf und zeigt Taste und Beschriftung", async () => {
    const onclick = vi.fn();
    const { getByRole } = render(Tile, { shortcut: "1", icon: "11", label: "Mannschaft", onclick });
    const button = getByRole("button");
    expect(button.textContent).toContain("Mannschaft");
    expect(button.textContent).toContain("1");
    await fireEvent.click(button);
    expect(onclick).toHaveBeenCalledOnce();
  });

  it("ist gesperrt und zeigt „folgt“", async () => {
    const onclick = vi.fn();
    const { getByRole } = render(Tile, { shortcut: "2", icon: "++", label: "Training", disabled: true, onclick });
    const button = getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("folgt");
    await fireEvent.click(button);
    expect(onclick).not.toHaveBeenCalled();
  });
});

describe("Crest", () => {
  it("zeichnet ein Schild in den Vereinsfarben", () => {
    const { container } = render(Crest, { colors: ["#c0392b", "#f2f2f2"], pattern: "stripes", size: 32 });
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(container.innerHTML).toContain("#c0392b");
    expect(container.innerHTML).toContain("#f2f2f2");
  });

  it("„plain“ nutzt nur die Hauptfarbe für die Fläche", () => {
    const { container } = render(Crest, { colors: ["#1f4e9c", "#f1c40f"], pattern: "plain" });
    expect(container.querySelectorAll("[data-pattern]")).toHaveLength(0);
  });

  it("zwei Wappen auf einer Seite haben verschiedene Clip-IDs", () => {
    const a = render(Crest, { colors: ["#111111", "#ffffff"], pattern: "sash" });
    const b = render(Crest, { colors: ["#111111", "#ffffff"], pattern: "hoops" });
    const idA = a.container.querySelector("clipPath")!.id;
    const idB = b.container.querySelector("clipPath")!.id;
    expect(idA).not.toBe(idB);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/theme.test.ts`
Expected: FAIL, weil die Komponenten nicht gefunden werden.

- [ ] **Step 3: Implementieren**

`src/ui/theme/Panel.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, children, class: extra = "" }: { title?: string; children: Snippet; class?: string } = $props();
</script>

<section class="panel {extra}">
  {#if title}<h2>{title}</h2>{/if}
  {@render children()}
</section>

<style>
  .panel {
    background: var(--wood);
    border: 3px solid var(--wood-edge);
    box-shadow: inset 0 0 0 2px var(--wood-dark);
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
    min-width: 0;
  }
</style>
```

`src/ui/theme/Tile.svelte`:

```svelte
<script lang="ts">
  let {
    shortcut,
    icon,
    label,
    disabled = false,
    selected = false,
    onclick,
  }: {
    shortcut: string;
    icon: string;
    label: string;
    disabled?: boolean;
    selected?: boolean;
    onclick: () => void;
  } = $props();
</script>

<button class="tile" class:selected {disabled} {onclick}>
  <span class="key">{shortcut}</span>
  <b>{icon}</b>
  <span class="label">{label}</span>
  {#if disabled}<span class="soon">folgt</span>{/if}
</button>

<style>
  .tile {
    position: relative;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 6px;
    background: var(--wood);
    border: 3px solid var(--wood-edge);
    box-shadow: inset 0 0 0 2px var(--wood-dark);
    color: var(--cream);
    font-family: var(--font-body);
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
  }
  .tile:hover:not(:disabled),
  .tile:focus-visible,
  .tile.selected {
    border-color: var(--gold);
    background: var(--wood-light);
    outline: none;
  }
  .tile:disabled { opacity: 0.5; cursor: default; }
  b {
    font-family: var(--font-display);
    font-weight: normal;
    font-size: 16px;
    color: var(--gold);
  }
  .key {
    position: absolute;
    top: 3px;
    left: 5px;
    font-size: 14px;
    color: var(--leaf);
  }
  .soon {
    position: absolute;
    bottom: 3px;
    right: 5px;
    font-size: 13px;
    color: var(--leaf);
  }
</style>
```

`src/ui/theme/Crest.svelte`:

```svelte
<script lang="ts">
  import type { CrestPattern } from "../../engine/model";

  let { colors, pattern, size = 16 }: { colors: [string, string]; pattern: CrestPattern; size?: number } = $props();
  const uid = $props.id();
  const clipId = `crest-${uid}`;
  const SHIELD = "M1 1 H15 V9 Q15 15 8 17 Q1 15 1 9 Z";
</script>

<svg width={size} height={Math.round((size * 18) / 16)} viewBox="0 0 16 18" aria-hidden="true">
  <defs>
    <clipPath id={clipId}><path d={SHIELD} /></clipPath>
  </defs>
  <g clip-path="url(#{clipId})">
    <rect x="0" y="0" width="16" height="18" fill={colors[0]} />
    {#if pattern === "stripes"}
      <g data-pattern fill={colors[1]}>
        <rect x="3" y="0" width="2" height="18" /><rect x="7" y="0" width="2" height="18" /><rect x="11" y="0" width="2" height="18" />
      </g>
    {:else if pattern === "sash"}
      <polygon data-pattern fill={colors[1]} points="0,4 4,0 16,14 16,18 12,18 0,6" />
    {:else if pattern === "split"}
      <rect data-pattern fill={colors[1]} x="8" y="0" width="8" height="18" />
    {:else if pattern === "hoops"}
      <g data-pattern fill={colors[1]}>
        <rect x="0" y="4" width="16" height="2" /><rect x="0" y="9" width="16" height="2" /><rect x="0" y="14" width="16" height="2" />
      </g>
    {/if}
  </g>
  <path d={SHIELD} fill="none" stroke="var(--cream)" stroke-width="1" />
</svg>
```

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run tests/ui/theme.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/ui/theme tests/ui/theme.test.ts
git commit -m "feat(ui): Holztafel, Menü-Kachel und Vereinswappen"
```

---

### Task 3: Texte, Tabelle und Spielplan aufbereiten

**Files:**
- Create: `src/ui/logic/format.ts`, `src/ui/logic/tables.ts`
- Create: `tests/ui/game.ts` (Test-Helfer)
- Test: `tests/ui/format.test.ts`, `tests/ui/tables.test.ts`

**Interfaces:**
- Consumes: `computeStandings`, `StandingRow` (engine/competition/standings), `matchesOfRound` (engine/competition/schedule), `leagueOf` (engine/season), Modell-Typen, `COMP`
- Produces:
  - `format.ts`:
    - Beschriftungen: `POSITION_LABEL`, `STYLE_LABEL`, `HARDNESS_LABEL`
    - Werte als Text: `playerName(p)`, `formText(form)`, `fitnessText(f)`, `statusText(p)`
    - Spiel: `eventText(state, e: MatchEvent)`, `matchdayLabel(state)`
  - `tables.ts`:
    - Tabelle: `type Zone`, `zoneFor(competitionId, rank)`, `interface TableRowView`, `tableView(state, competitionId)`
    - Spielplan: `interface FixtureView`, `fixturesView(state, competitionId, round)`, `lastPlayedRound(state, competitionId)`
    - Vereine und Manager: `managerName(state, clubId)`, `clubRating(state, clubId)`, `clubPlace(state, clubId)`
  - `tests/ui/game.ts`: `newTestGame(names?: string[], seed?: number): GameState` – je Manager einer der ersten Vereine

- [ ] **Step 1: Test-Helfer und failing Tests schreiben**

`tests/ui/game.ts`:

```ts
import { generateWorld } from "../../src/engine/generator";
import type { GameState } from "../../src/engine/model";
import { startNewGame } from "../../src/engine/season";

/** Neues Spiel; Manager i übernimmt den (i·20)-ten Verein, damit Erst- und Zweitligisten dabei sind. */
export function newTestGame(names: string[] = ["Anna"], seed = 42): GameState {
  const world = generateWorld(seed);
  const ids = Object.keys(world.clubs);
  const r = startNewGame(world, names.map((name, i) => ({ name, clubId: ids[(i * 20) % ids.length] })));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
```

`tests/ui/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../src/engine/model";
import { playMatchdayAuto } from "../../src/engine/season";
import { eventText, fitnessText, formText, matchdayLabel, playerName, statusText } from "../../src/ui/logic/format";
import { newTestGame } from "./game";

describe("format", () => {
  const s = newTestGame();
  const p = Object.values(s.players)[0];

  it("kürzt den Vornamen ab", () => {
    expect(playerName({ ...p, firstName: "Markus", lastName: "Krämer" })).toBe("M. Krämer");
  });

  it("zeigt Form mit Vorzeichen und Kondition in Prozent", () => {
    expect(formText(2)).toBe("+2");
    expect(formText(0)).toBe("0");
    expect(formText(-0.25)).toBe("0");
    expect(formText(-1.5)).toBe("-1");
    expect(fitnessText(83.4)).toBe("83%");
  });

  it("zeigt Verletzung und Sperre mit Restdauer", () => {
    expect(statusText(p)).toBe("");
    expect(statusText({ ...p, injury: { matchesLeft: 3 } })).toBe("verl. 3");
    expect(statusText({ ...p, suspension: { matchesLeft: 1 } })).toBe("gesp. 1");
  });

  it("beschreibt Spielereignisse", () => {
    const ev = (e: MatchEvent) => eventText(s, e);
    const name = p.lastName;
    expect(ev({ minute: 67, type: "goal", club: "x", player: p.id })).toBe(`67' TOR! ${name}`);
    expect(ev({ minute: 12, type: "yellow", club: "x", player: p.id })).toBe(`12' Gelb: ${name}`);
    expect(ev({ minute: 80, type: "red", club: "x", player: p.id, secondYellow: true })).toBe(`80' Gelb-Rot: ${name}`);
    expect(ev({ minute: 81, type: "red", club: "x", player: p.id, secondYellow: false })).toBe(`81' Rot: ${name}`);
    expect(ev({ minute: 30, type: "injury", club: "x", player: p.id })).toBe(`30' verletzt: ${name}`);
    const q = Object.values(s.players)[1];
    expect(ev({ minute: 46, type: "sub", club: "x", out: p.id, in: q.id })).toBe(`46' ${q.lastName} für ${name}`);
  });

  it("benennt den Spieltag", () => {
    expect(matchdayLabel(s)).toBe("1. Spieltag");
    let t = s;
    for (let i = 0; i < 34; i++) t = playMatchdayAuto(t);
    expect(matchdayLabel(t)).toBe("Relegation – Hinspiel");
    t = playMatchdayAuto(t);
    expect(matchdayLabel(t)).toBe("Relegation – Rückspiel");
  });
});
```

`tests/ui/tables.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COMP } from "../../src/engine/model";
import { playMatchdayAuto } from "../../src/engine/season";
import {
  clubPlace,
  clubRating,
  fixturesView,
  lastPlayedRound,
  managerName,
  tableView,
  zoneFor,
} from "../../src/ui/logic/tables";
import { newTestGame } from "./game";

describe("zoneFor", () => {
  it("markiert Meister, Relegation und Abstieg in der 1. Liga", () => {
    expect(zoneFor(COMP.first, 1)).toBe("champion");
    expect(zoneFor(COMP.first, 2)).toBeNull();
    expect(zoneFor(COMP.first, 16)).toBe("playoff");
    expect(zoneFor(COMP.first, 17)).toBe("relegation");
    expect(zoneFor(COMP.first, 18)).toBe("relegation");
  });
  it("markiert Aufstieg und Relegation in der 2. Liga", () => {
    expect(zoneFor(COMP.second, 1)).toBe("promotion");
    expect(zoneFor(COMP.second, 2)).toBe("promotion");
    expect(zoneFor(COMP.second, 3)).toBe("playoff");
    expect(zoneFor(COMP.second, 18)).toBeNull();
  });
});

describe("tableView und fixturesView", () => {
  const start = newTestGame(["Anna", "Ben"]);
  const s = playMatchdayAuto(start);

  it("liefert 18 Zeilen mit Rang, Name und Manager", () => {
    const rows = tableView(s, COMP.first);
    expect(rows).toHaveLength(18);
    expect(rows.map((r) => r.rank)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(rows.every((r) => r.played === 1 && r.name.length > 0)).toBe(true);
    const annaClub = s.managers[0].clubId!;
    expect(rows.find((r) => r.club === annaClub)?.manager).toBe("Anna");
    expect(rows[0].zone).toBe("champion");
  });

  it("zeigt Paarungen mit Ergebnis, ungespielte ohne", () => {
    const played = fixturesView(s, COMP.first, 1);
    expect(played).toHaveLength(9);
    expect(played.every((f) => /^\d+:\d+$/.test(f.result ?? ""))).toBe(true);
    expect(fixturesView(s, COMP.first, 2).every((f) => f.result === null)).toBe(true);
    expect(fixturesView(s, "gibts-nicht", 1)).toEqual([]);
  });

  it("zeigt ein Elfmeterschießen im Ergebnis", () => {
    const t = structuredClone(s);
    const m = t.competitions[COMP.first].matches[0];
    m.result = { home: 1, away: 1 };
    m.penalties = { home: 5, away: 4 };
    expect(fixturesView(t, COMP.first, m.round).find((f) => f.id === m.id)?.result).toBe("1:1 (i.E. 5:4)");
  });

  it("kennt den zuletzt gespielten Spieltag", () => {
    expect(lastPlayedRound(start, COMP.first)).toBe(1);
    expect(lastPlayedRound(s, COMP.first)).toBe(1);
    expect(lastPlayedRound(playMatchdayAuto(s), COMP.first)).toBe(2);
  });

  it("bewertet Vereine, findet Platz und Manager", () => {
    const clubId = s.managers[1].clubId!;
    const rating = clubRating(s, clubId);
    expect(rating).toBeGreaterThan(20);
    expect(rating).toBeLessThan(99);
    expect(Number.isInteger(rating)).toBe(true);
    const place = clubPlace(s, clubId)!;
    expect([COMP.first, COMP.second]).toContain(place.competitionId);
    expect(place.rank).toBeGreaterThanOrEqual(1);
    expect(managerName(s, clubId)).toBe("Ben");
    const aiClub = Object.values(s.clubs).find((c) => c.managerId === null)!;
    expect(managerName(s, aiClub.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/ui/format.test.ts tests/ui/tables.test.ts`
Expected: FAIL, weil die Module `format` und `tables` nicht gefunden werden.

- [ ] **Step 3: Implementieren**

`src/ui/logic/format.ts`:

```ts
import { COMP, type GameState, type Hardness, type MatchEvent, type Player, type Position, type Style } from "../../engine/model";

export const POSITION_LABEL: Record<Position, string> = { GK: "TW", DF: "ABW", MF: "MF", FW: "ST" };
export const STYLE_LABEL: Record<Style, string> = { defensive: "defensiv", normal: "normal", offensive: "offensiv" };
export const HARDNESS_LABEL: Record<Hardness, string> = { fair: "fair", normal: "normal", hard: "hart" };

export function playerName(p: Player): string {
  return `${p.firstName.charAt(0)}. ${p.lastName}`;
}

export function formText(form: number): string {
  const r = Math.trunc(form);
  return r > 0 ? `+${r}` : r < 0 ? String(r) : "0";
}

export function fitnessText(fitness: number): string {
  return `${Math.round(fitness)}%`;
}

export function statusText(p: Player): string {
  if (p.injury) return `verl. ${p.injury.matchesLeft}`;
  if (p.suspension) return `gesp. ${p.suspension.matchesLeft}`;
  return "";
}

export function eventText(state: GameState, e: MatchEvent): string {
  const name = (id: string) => state.players[id]?.lastName ?? "?";
  switch (e.type) {
    case "goal":
      return `${e.minute}' TOR! ${name(e.player)}`;
    case "yellow":
      return `${e.minute}' Gelb: ${name(e.player)}`;
    case "red":
      return `${e.minute}' ${e.secondYellow ? "Gelb-Rot" : "Rot"}: ${name(e.player)}`;
    case "injury":
      return `${e.minute}' verletzt: ${name(e.player)}`;
    case "sub":
      return `${e.minute}' ${name(e.in)} für ${name(e.out)}`;
  }
}

/** Beschriftung des nächsten bzw. laufenden Kalendereintrags. */
export function matchdayLabel(state: GameState): string {
  const entry = state.calendar[state.calendarIndex];
  const rel = entry?.fixtures.find((f) => f.competitionId === COMP.relegation);
  if (rel) return rel.round === 1 ? "Relegation – Hinspiel" : "Relegation – Rückspiel";
  return `${Math.min(state.calendarIndex + 1, 34)}. Spieltag`;
}
```

Anmerkung zu `formText`: Die Form wird auf ganze Punkte **abgeschnitten**, damit −0,25 als „0“ und −1,5 als „-1“ erscheint. Die Form ändert sich in 0,25er- und 0,5er-Schritten. „+1“ erscheint deshalb erst ab einem vollen Punkt.

`src/ui/logic/tables.ts`:

```ts
import { matchesOfRound } from "../../engine/competition/schedule";
import { computeStandings, type StandingRow } from "../../engine/competition/standings";
import { COMP, type ClubId, type CompetitionId, type GameState } from "../../engine/model";
import { leagueOf } from "../../engine/season";

export type Zone = "champion" | "promotion" | "playoff" | "relegation" | null;

export interface TableRowView extends StandingRow {
  rank: number;
  name: string;
  manager: string | null;
  zone: Zone;
}

export interface FixtureView {
  id: string;
  home: string;
  away: string;
  homeClub: ClubId;
  awayClub: ClubId;
  result: string | null;
}

export function zoneFor(competitionId: CompetitionId, rank: number): Zone {
  if (competitionId === COMP.first) {
    if (rank === 1) return "champion";
    if (rank === 16) return "playoff";
    if (rank >= 17) return "relegation";
    return null;
  }
  if (competitionId === COMP.second) {
    if (rank <= 2) return "promotion";
    if (rank === 3) return "playoff";
  }
  return null;
}

export function managerName(state: GameState, clubId: ClubId): string | null {
  const id = state.clubs[clubId]?.managerId;
  if (!id) return null;
  return state.managers.find((m) => m.id === id)?.name ?? null;
}

export function tableView(state: GameState, competitionId: CompetitionId): TableRowView[] {
  const comp = state.competitions[competitionId];
  if (!comp) return [];
  return computeStandings(comp).map((row, i) => ({
    ...row,
    rank: i + 1,
    name: state.clubs[row.club].name,
    manager: managerName(state, row.club),
    zone: zoneFor(competitionId, i + 1),
  }));
}

export function fixturesView(state: GameState, competitionId: CompetitionId, round: number): FixtureView[] {
  const comp = state.competitions[competitionId];
  if (!comp) return [];
  return matchesOfRound(comp, round).map((m) => ({
    id: m.id,
    home: state.clubs[m.home].name,
    away: state.clubs[m.away].name,
    homeClub: m.home,
    awayClub: m.away,
    result: m.result
      ? `${m.result.home}:${m.result.away}${m.penalties ? ` (i.E. ${m.penalties.home}:${m.penalties.away})` : ""}`
      : null,
  }));
}

/** Höchste Runde mit mindestens einem Ergebnis, sonst 1. */
export function lastPlayedRound(state: GameState, competitionId: CompetitionId): number {
  const comp = state.competitions[competitionId];
  if (!comp) return 1;
  return comp.matches.reduce((max, m) => (m.result && m.round > max ? m.round : max), 1);
}

/** Durchschnittliche Stärke der Startelf (gerundet). */
export function clubRating(state: GameState, clubId: ClubId): number {
  const club = state.clubs[clubId];
  const ids = club.lineup.starters.length > 0 ? club.lineup.starters : club.squad.slice(0, 11);
  const sum = ids.reduce((s, id) => s + state.players[id].strength, 0);
  return Math.round(sum / Math.max(1, ids.length));
}

export function clubPlace(state: GameState, clubId: ClubId): { competitionId: CompetitionId; rank: number } | null {
  const competitionId = leagueOf(state, clubId);
  if (!competitionId) return null;
  const rank = tableView(state, competitionId).findIndex((r) => r.club === clubId) + 1;
  return { competitionId, rank };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/format.test.ts tests/ui/tables.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/logic/format.ts src/ui/logic/tables.ts tests/ui/game.ts tests/ui/format.test.ts tests/ui/tables.test.ts
git commit -m "feat(ui): Texte, Tabelle und Spielplan aufbereiten"
```

---

### Task 4: Konferenz-Ticker

**Files:**
- Create: `src/ui/logic/ticker.ts`
- Test: `tests/ui/ticker.test.ts`

**Interfaces:**
- Consumes: `LiveMatch` (engine/match/simulate), `eventText` (Task 3), Modell
- Produces:
  - `TEMPOS = [1000, 500, 200]`, `DEFAULT_TEMPO = 1` (Index in `TEMPOS`)
  - `halfBounds(half: 1 | 2): { from: number; to: number }` – für die 1. Halbzeit `{0, 45}`, für die 2. `{45, 90}`
  - `interface TickerRow { matchId; competitionId; homeClub; awayClub; home; away; homeGoals; awayGoals; last: string | null; goalNow: boolean; managed: boolean }`
  - `tickerRows(state, lives, minute): TickerRow[]` – zählt alle Ereignisse mit `minute ≤ minute`. `last` ist das letzte Tor, die letzte Rote Karte oder die letzte Verletzung. `goalNow` ist wahr, wenn genau in dieser Minute ein Tor fiel.
  - `competitionsOf(lives): CompetitionId[]` – in der Reihenfolge des ersten Auftretens
  - `competitionName(state, id): string`

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/ticker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COMP } from "../../src/engine/model";
import { kickOff, playHalf, prepareMatchday } from "../../src/engine/season";
import { competitionName, competitionsOf, halfBounds, tickerRows, TEMPOS, DEFAULT_TEMPO } from "../../src/ui/logic/ticker";
import { newTestGame } from "./game";

function firstHalf() {
  const s = prepareMatchday(newTestGame()).state;
  return playHalf(s, kickOff(s), 1);
}

describe("ticker", () => {
  it("Tempo und Halbzeitgrenzen", () => {
    expect(TEMPOS[DEFAULT_TEMPO]).toBe(500);
    expect(halfBounds(1)).toEqual({ from: 0, to: 45 });
    expect(halfBounds(2)).toEqual({ from: 45, to: 90 });
  });

  it("zu Minute 0 steht es überall 0:0 ohne Ereignis", () => {
    const { state, lives } = firstHalf();
    const rows = tickerRows(state, lives, 0);
    expect(rows).toHaveLength(18);
    expect(rows.every((r) => r.homeGoals === 0 && r.awayGoals === 0 && r.last === null && !r.goalNow)).toBe(true);
  });

  it("zu Minute 45 entspricht der Stand den Toren der 1. Halbzeit", () => {
    const { state, lives } = firstHalf();
    const rows = tickerRows(state, lives, 45);
    rows.forEach((r, i) => {
      expect(r.homeGoals).toBe(lives[i].home.goals);
      expect(r.awayGoals).toBe(lives[i].away.goals);
      expect(r.home).toBe(state.clubs[lives[i].home.club].name);
    });
  });

  it("zählt Tore erst ab ihrer Minute und markiert die Torminute", () => {
    const { state, lives } = firstHalf();
    const live = lives.find((l) => l.events.some((e) => e.type === "goal"));
    if (!live) return; // extrem unwahrscheinlich: keine Tore in 18 Halbzeiten
    const goal = live.events.find((e) => e.type === "goal")!;
    const idx = lives.indexOf(live);
    const before = tickerRows(state, lives, goal.minute - 1)[idx];
    const at = tickerRows(state, lives, goal.minute)[idx];
    expect(at.homeGoals + at.awayGoals).toBe(before.homeGoals + before.awayGoals + live.events.filter((e) => e.type === "goal" && e.minute === goal.minute).length);
    expect(at.goalNow).toBe(true);
    expect(at.last).toContain("TOR!");
  });

  it("gelbe Karten und Wechsel erscheinen nicht als letztes Ereignis", () => {
    const { state, lives } = firstHalf();
    const l = structuredClone(lives[0]);
    l.events = [{ minute: 10, type: "yellow", club: l.home.club, player: l.home.pitch[2].id }];
    expect(tickerRows(state, [l], 45)[0].last).toBeNull();
  });

  it("markiert Spiele mit menschlichem Manager", () => {
    const { state, lives } = firstHalf();
    const rows = tickerRows(state, lives, 0);
    expect(rows.filter((r) => r.managed)).toHaveLength(1);
  });

  it("listet Wettbewerbe in Reihenfolge und benennt sie", () => {
    const { state, lives } = firstHalf();
    expect(competitionsOf(lives)).toEqual([COMP.first, COMP.second]);
    expect(competitionName(state, COMP.first)).toBe("1. Liga");
    expect(competitionName(state, "XYZ")).toBe("XYZ");
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/ticker.test.ts`
Expected: FAIL, weil das Modul `ticker` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/ui/logic/ticker.ts`:

```ts
import type { LiveMatch } from "../../engine/match/simulate";
import type { ClubId, CompetitionId, GameState, MatchId } from "../../engine/model";
import { eventText } from "./format";

/** Millisekunden pro Spielminute: langsam, normal, schnell. */
export const TEMPOS = [1000, 500, 200] as const;
export const DEFAULT_TEMPO = 1;

export function halfBounds(half: 1 | 2): { from: number; to: number } {
  return half === 1 ? { from: 0, to: 45 } : { from: 45, to: 90 };
}

export interface TickerRow {
  matchId: MatchId;
  competitionId: CompetitionId;
  homeClub: ClubId;
  awayClub: ClubId;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  last: string | null;
  goalNow: boolean;
  managed: boolean;
}

export function tickerRows(state: GameState, lives: LiveMatch[], minute: number): TickerRow[] {
  return lives.map((l) => {
    const events = l.events.filter((e) => e.minute <= minute);
    const goals = events.filter((e) => e.type === "goal");
    const notable = events.filter((e) => e.type === "goal" || e.type === "red" || e.type === "injury");
    const last = notable.length > 0 ? notable[notable.length - 1] : null;
    return {
      matchId: l.matchId,
      competitionId: l.competitionId,
      homeClub: l.home.club,
      awayClub: l.away.club,
      home: state.clubs[l.home.club].name,
      away: state.clubs[l.away.club].name,
      homeGoals: goals.filter((e) => e.club === l.home.club).length,
      awayGoals: goals.filter((e) => e.club === l.away.club).length,
      last: last ? eventText(state, last) : null,
      goalNow: goals.some((e) => e.minute === minute),
      managed: state.clubs[l.home.club].managerId !== null || state.clubs[l.away.club].managerId !== null,
    };
  });
}

export function competitionsOf(lives: LiveMatch[]): CompetitionId[] {
  const out: CompetitionId[] = [];
  for (const l of lives) if (!out.includes(l.competitionId)) out.push(l.competitionId);
  return out;
}

export function competitionName(state: GameState, id: CompetitionId): string {
  return state.competitions[id]?.name ?? id;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/ticker.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/logic/ticker.ts tests/ui/ticker.test.ts
git commit -m "feat(ui): Konferenz-Ticker als reine Logik"
```

---

### Task 5: Aufstellung tauschen und Halbzeit-Entwurf

**Files:**
- Create: `src/ui/logic/lineupEdit.ts`, `src/ui/logic/halftimeDraft.ts`
- Test: `tests/ui/lineupEdit.test.ts`, `tests/ui/halftimeDraft.test.ts`

**Interfaces:**
- Consumes: `slotPositions`, `MAX_SUBS`, Modell-Typen; `LiveSide`, `PitchPlayer` (engine/match); `HalftimeCommand` (engine/commands)
- Produces:
  - `lineupEdit.ts`:
    - `type LineupArea = "starter" | "bench" | "reserve"`
    - `interface SquadRow { player: Player; area: LineupArea; slot: Position | null }`
    - `squadRows(state, clubId): SquadRow[]` – erst die Startelf in Platzreihenfolge, dann die Bank, dann die Reserve. Die Reserve ist nach TW, ABW, MF, ST und darin nach Stärke absteigend sortiert.
    - `swapPlayers(lineup, a, b): Lineup` – tauscht zwei Spieler zwischen Startelf, Bank und Reserve
  - `halftimeDraft.ts`:
    - `interface HalftimeDraft { subs: { out: PlayerId; in: PlayerId }[]; tactics: Partial<Tactics> }`
    - `emptyDraft()`
    - `remainingSubs(side, draft)`
    - `currentPitch(side, draft): PitchPlayer[]`
    - `currentBench(side, draft): PlayerId[]`
    - `addSub(side, draft, out, in): HalftimeDraft | string`
    - `removeSub(draft, index): HalftimeDraft`
    - `toCommand(managerId, draft): HalftimeCommand | null` – `null`, wenn nichts geändert wurde

- [ ] **Step 1: Failing Tests schreiben**

`tests/ui/lineupEdit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { slotPositions } from "../../src/engine/model";
import { squadRows, swapPlayers } from "../../src/ui/logic/lineupEdit";
import { newTestGame } from "./game";

describe("squadRows", () => {
  it("listet Startelf mit Plätzen, dann Bank, dann Reserve – jeder Spieler genau einmal", () => {
    const s = newTestGame();
    const club = s.clubs[s.managers[0].clubId!];
    const rows = squadRows(s, club.id);
    expect(rows).toHaveLength(club.squad.length);
    expect(new Set(rows.map((r) => r.player.id)).size).toBe(club.squad.length);
    const slots = slotPositions(club.tactics.formation);
    rows.slice(0, 11).forEach((r, i) => {
      expect(r.area).toBe("starter");
      expect(r.player.id).toBe(club.lineup.starters[i]);
      expect(r.slot).toBe(slots[i]);
    });
    const bench = rows.filter((r) => r.area === "bench");
    expect(bench.map((r) => r.player.id)).toEqual(club.lineup.bench);
    expect(bench.every((r) => r.slot === null)).toBe(true);
    const reserve = rows.filter((r) => r.area === "reserve");
    const order = ["GK", "DF", "MF", "FW"];
    for (let i = 1; i < reserve.length; i++) {
      const a = reserve[i - 1].player;
      const b = reserve[i].player;
      const byPos = order.indexOf(a.position) - order.indexOf(b.position);
      expect(byPos < 0 || (byPos === 0 && a.strength >= b.strength)).toBe(true);
    }
  });
});

describe("swapPlayers", () => {
  const lineup = { starters: ["a", "b", "c"], bench: ["d", "e"] };

  it("tauscht zwei Startspieler", () => {
    expect(swapPlayers(lineup, "a", "c")).toEqual({ starters: ["c", "b", "a"], bench: ["d", "e"] });
  });

  it("tauscht Startelf und Bank in beide Richtungen", () => {
    expect(swapPlayers(lineup, "b", "e")).toEqual({ starters: ["a", "e", "c"], bench: ["d", "b"] });
    expect(swapPlayers(lineup, "e", "b")).toEqual({ starters: ["a", "e", "c"], bench: ["d", "b"] });
  });

  it("holt einen Reservespieler auf den Platz eines Start- oder Bankspielers", () => {
    expect(swapPlayers(lineup, "a", "x")).toEqual({ starters: ["x", "b", "c"], bench: ["d", "e"] });
    expect(swapPlayers(lineup, "x", "d")).toEqual({ starters: ["a", "b", "c"], bench: ["x", "e"] });
  });

  it("zwei Reservespieler oder derselbe Spieler: keine Änderung, Original unverändert", () => {
    expect(swapPlayers(lineup, "x", "y")).toEqual(lineup);
    expect(swapPlayers(lineup, "a", "a")).toEqual(lineup);
    expect(lineup).toEqual({ starters: ["a", "b", "c"], bench: ["d", "e"] });
  });
});
```

`tests/ui/halftimeDraft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { LiveSide } from "../../src/engine/match/simulate";
import { addSub, currentBench, currentPitch, emptyDraft, remainingSubs, removeSub, toCommand } from "../../src/ui/logic/halftimeDraft";

function side(subsUsed = 0): LiveSide {
  return {
    club: "c1",
    tactics: { formation: "4-4-2", style: "normal", hardness: "normal" },
    pitch: [
      { id: "gk", slot: "GK" },
      { id: "d1", slot: "DF" },
      { id: "m1", slot: "MF" },
    ],
    bench: ["b1", "b2"],
    subsUsed,
    fitness: {},
    booked: [],
    sentOff: [],
    injured: [],
    played: ["gk", "d1", "m1"],
    goals: 0,
    bonus: 1,
  };
}

describe("halftimeDraft", () => {
  it("plant einen Wechsel und zeigt Platz und Bank danach", () => {
    const d = addSub(side(), emptyDraft(), "d1", "b2");
    if (typeof d === "string") throw new Error(d);
    expect(currentPitch(side(), d)).toEqual([{ id: "gk", slot: "GK" }, { id: "b2", slot: "DF" }, { id: "m1", slot: "MF" }]);
    expect(currentBench(side(), d)).toEqual(["b1"]);
    expect(remainingSubs(side(), d)).toBe(4);
  });

  it("lehnt Spieler ab, die nicht auf dem Platz bzw. nicht auf der Bank sind", () => {
    expect(addSub(side(), emptyDraft(), "b1", "b2")).toBe("Der Spieler steht nicht auf dem Platz.");
    expect(addSub(side(), emptyDraft(), "d1", "m1")).toBe("Der Spieler sitzt nicht auf der Bank.");
    const d = addSub(side(), emptyDraft(), "d1", "b2") as ReturnType<typeof emptyDraft>;
    expect(addSub(side(), d, "d1", "b1")).toBe("Der Spieler steht nicht auf dem Platz.");
    expect(addSub(side(), d, "m1", "b2")).toBe("Der Spieler sitzt nicht auf der Bank.");
  });

  it("ohne freie Wechsel gibt es eine Meldung", () => {
    expect(remainingSubs(side(5), emptyDraft())).toBe(0);
    expect(addSub(side(5), emptyDraft(), "d1", "b1")).toBe("Keine Wechsel mehr übrig.");
  });

  it("entfernt einen geplanten Wechsel", () => {
    const d = addSub(side(), emptyDraft(), "d1", "b2") as ReturnType<typeof emptyDraft>;
    expect(removeSub(d, 0).subs).toEqual([]);
    expect(d.subs).toHaveLength(1);
  });

  it("baut den Befehl – oder null, wenn nichts geändert wurde", () => {
    expect(toCommand("mgr1", emptyDraft())).toBeNull();
    const d = addSub(side(), emptyDraft(), "d1", "b2") as ReturnType<typeof emptyDraft>;
    expect(toCommand("mgr1", { ...d, tactics: { style: "offensive" } })).toEqual({
      type: "halftimeChanges",
      managerId: "mgr1",
      substitutions: [{ out: "d1", in: "b2" }],
      tactics: { style: "offensive" },
    });
    expect(toCommand("mgr1", { subs: [], tactics: { formation: "4-3-3" } })).toEqual({
      type: "halftimeChanges",
      managerId: "mgr1",
      substitutions: [],
      tactics: { formation: "4-3-3" },
    });
    expect(toCommand("mgr1", d)?.tactics).toBeNull();
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie müssen fehlschlagen**

Run: `npx vitest run tests/ui/lineupEdit.test.ts tests/ui/halftimeDraft.test.ts`
Expected: FAIL, weil die Module nicht gefunden werden.

- [ ] **Step 3: Implementieren**

`src/ui/logic/lineupEdit.ts`:

```ts
import { slotPositions, type ClubId, type GameState, type Lineup, type Player, type PlayerId, type Position } from "../../engine/model";

export type LineupArea = "starter" | "bench" | "reserve";

export interface SquadRow {
  player: Player;
  area: LineupArea;
  slot: Position | null;
}

const POSITION_ORDER: Position[] = ["GK", "DF", "MF", "FW"];

export function squadRows(state: GameState, clubId: ClubId): SquadRow[] {
  const club = state.clubs[clubId];
  const slots = slotPositions(club.tactics.formation);
  const starters = club.lineup.starters.map((id, i) => ({ player: state.players[id], area: "starter" as const, slot: slots[i] ?? null }));
  const bench = club.lineup.bench.map((id) => ({ player: state.players[id], area: "bench" as const, slot: null }));
  const used = new Set([...club.lineup.starters, ...club.lineup.bench]);
  const reserve = club.squad
    .filter((id) => !used.has(id))
    .map((id) => state.players[id])
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.strength - a.strength)
    .map((player) => ({ player, area: "reserve" as const, slot: null }));
  return [...starters, ...bench, ...reserve];
}

/** Tauscht a und b zwischen Startelf, Bank und Reserve (Reserve = nicht in der Aufstellung). */
export function swapPlayers(lineup: Lineup, a: PlayerId, b: PlayerId): Lineup {
  const starters = [...lineup.starters];
  const bench = [...lineup.bench];
  if (a === b) return { starters, bench };
  const locate = (id: PlayerId): { list: PlayerId[]; index: number } | null => {
    const s = starters.indexOf(id);
    if (s >= 0) return { list: starters, index: s };
    const p = bench.indexOf(id);
    if (p >= 0) return { list: bench, index: p };
    return null;
  };
  const la = locate(a);
  const lb = locate(b);
  if (la) la.list[la.index] = b;
  if (lb) lb.list[lb.index] = a;
  return { starters, bench };
}
```

`src/ui/logic/halftimeDraft.ts`:

```ts
import type { HalftimeCommand } from "../../engine/commands";
import type { LiveSide } from "../../engine/match/simulate";
import type { PitchPlayer } from "../../engine/match/strength";
import { MAX_SUBS, type ManagerId, type PlayerId, type Tactics } from "../../engine/model";

export interface HalftimeDraft {
  subs: { out: PlayerId; in: PlayerId }[];
  tactics: Partial<Tactics>;
}

export function emptyDraft(): HalftimeDraft {
  return { subs: [], tactics: {} };
}

export function remainingSubs(side: LiveSide, draft: HalftimeDraft): number {
  return Math.max(0, MAX_SUBS - side.subsUsed - draft.subs.length);
}

export function currentPitch(side: LiveSide, draft: HalftimeDraft): PitchPlayer[] {
  let pitch = side.pitch.map((pp) => ({ ...pp }));
  for (const s of draft.subs) pitch = pitch.map((pp) => (pp.id === s.out ? { id: s.in, slot: pp.slot } : pp));
  return pitch;
}

export function currentBench(side: LiveSide, draft: HalftimeDraft): PlayerId[] {
  const used = new Set(draft.subs.map((s) => s.in));
  return side.bench.filter((id) => !used.has(id));
}

export function addSub(side: LiveSide, draft: HalftimeDraft, out: PlayerId, inId: PlayerId): HalftimeDraft | string {
  if (remainingSubs(side, draft) <= 0) return "Keine Wechsel mehr übrig.";
  if (!currentPitch(side, draft).some((pp) => pp.id === out)) return "Der Spieler steht nicht auf dem Platz.";
  if (!currentBench(side, draft).includes(inId)) return "Der Spieler sitzt nicht auf der Bank.";
  return { ...draft, subs: [...draft.subs, { out, in: inId }] };
}

export function removeSub(draft: HalftimeDraft, index: number): HalftimeDraft {
  return { ...draft, subs: draft.subs.filter((_, i) => i !== index) };
}

export function toCommand(managerId: ManagerId, draft: HalftimeDraft): HalftimeCommand | null {
  const hasTactics = Object.keys(draft.tactics).length > 0;
  if (draft.subs.length === 0 && !hasTactics) return null;
  return {
    type: "halftimeChanges",
    managerId,
    substitutions: draft.subs.map((s) => ({ ...s })),
    tactics: hasTactics ? { ...draft.tactics } : null,
  };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/lineupEdit.test.ts tests/ui/halftimeDraft.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/logic/lineupEdit.ts src/ui/logic/halftimeDraft.ts tests/ui/lineupEdit.test.ts tests/ui/halftimeDraft.test.ts
git commit -m "feat(ui): Aufstellung tauschen und Halbzeit-Entwurf"
```

---

### Task 6: GameController

**Files:**
- Create: `src/ui/controller.svelte.ts`
- Test: `tests/ui/controller.test.ts`

**Interfaces:**
- Consumes:
  - `startNewGame` (engine/season)
  - `Session`, `Snapshot`, `SessionCommand` (session)
  - `LocalTransport` (transport)
  - `newTestGame`-Muster (Task 3) bzw. `generateWorld` im Test
- Produces:
  - Typen:
    - `type TurnScreen = "turnStart" | "menu" | "squad" | "tables"`
    - `type View` =
      - `{ kind: "newGame" }`
      - `{ kind: TurnScreen; managerId }`
      - `{ kind: "conference"; half: 1 | 2 }`
      - `{ kind: "halftime"; managerId }`
      - `{ kind: "results" }`
      - `{ kind: "resultsTables" }`
      - `{ kind: "seasonEnd" }`
  - `class GameController`:
    - Zustand:
      - `snapshot: Snapshot | null` (`$state.raw`)
      - `screen: TurnScreen`
      - `showResultsTables: boolean`
      - `message: string | null`
    - `view: View` (`$derived`)
    - Methoden:
      - `startGame(world, managers): string | null`
      - `open(screen: TurnScreen): void`
      - `send(cmd): Promise<boolean>` – `true`, wenn der Befehl angenommen wurde; sonst steht die Meldung in `message`
      - `endTurn(managerId): Promise<boolean>`
      - `advance(): void`
      - `setResultsTables(show: boolean): void`
      - `managerName(managerId): string`

**Regel:** Sobald sich die Phase, der wartende Manager, der Spieltag oder die Saison ändert, setzt der Controller `screen` auf `"turnStart"` zurück, schließt die Tabelle in der Auswertung und löscht `message`. So beginnt jeder Manager im Hot-Seat-Modus bei „… ist dran“ (Review Focus 1).

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/controller.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

function started(names = ["Anna", "Ben"]) {
  const c = new GameController();
  const world = generateWorld(7);
  const ids = Object.keys(world.clubs);
  const error = c.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  if (error) throw new Error(error);
  return c;
}

describe("GameController", () => {
  it("zeigt ohne Spiel den Bildschirm „Neues Spiel“", () => {
    expect(new GameController().view).toEqual({ kind: "newGame" });
  });

  it("meldet Fehler beim Start und bleibt bei „Neues Spiel“", () => {
    const c = new GameController();
    const world = generateWorld(7);
    const id = Object.keys(world.clubs)[0];
    expect(c.startGame(world, [{ name: "A", clubId: id }, { name: "B", clubId: id }])).toMatch(/denselben Verein/);
    expect(c.view.kind).toBe("newGame");
  });

  it("beginnt mit „ist dran“ für den ersten Manager und wechselt in Untermenüs", () => {
    const c = started();
    const [anna] = c.snapshot!.state.managers;
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
    expect(c.managerName(anna.id)).toBe("Anna");
    c.open("squad");
    expect(c.view).toEqual({ kind: "squad", managerId: anna.id });
  });

  it("Hot-Seat-Übergabe: der nächste Manager beginnt wieder bei „ist dran“", async () => {
    const c = started();
    const [anna, ben] = c.snapshot!.state.managers;
    c.open("tables");
    expect(await c.endTurn(anna.id)).toBe(true);
    expect(c.view).toEqual({ kind: "turnStart", managerId: ben.id });
  });

  it("speichert Fehlermeldungen von Befehlen und löscht sie beim Menüwechsel", async () => {
    const c = started();
    const [, ben] = c.snapshot!.state.managers;
    expect(await c.send({ type: "autoLineup", managerId: ben.id })).toBe(false);
    expect(c.message).toBe("Du bist gerade nicht dran.");
    c.open("menu");
    expect(c.message).toBeNull();
  });

  it("führt durch Konferenz, Halbzeit, Auswertung und zurück zu den Manager-Runden", async () => {
    const c = started();
    const [anna, ben] = c.snapshot!.state.managers;
    await c.endTurn(anna.id);
    await c.endTurn(ben.id);
    expect(c.view).toEqual({ kind: "conference", half: 1 });
    c.advance();
    expect(c.view).toEqual({ kind: "halftime", managerId: anna.id });
    await c.endTurn(anna.id);
    expect(c.view).toEqual({ kind: "halftime", managerId: ben.id });
    await c.endTurn(ben.id);
    expect(c.view).toEqual({ kind: "conference", half: 2 });
    c.advance();
    expect(c.view).toEqual({ kind: "results" });
    c.setResultsTables(true);
    expect(c.view).toEqual({ kind: "resultsTables" });
    c.setResultsTables(false);
    c.advance();
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
    expect(c.snapshot!.state.calendarIndex).toBe(1);
  });

  it("ohne gestartetes Spiel tun send und advance nichts", async () => {
    const c = new GameController();
    expect(await c.send({ type: "endTurn", managerId: "x" })).toBe(false);
    c.advance();
    expect(c.view.kind).toBe("newGame");
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/controller.test.ts`
Expected: FAIL, weil das Modul `controller.svelte` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/ui/controller.svelte.ts`:

```ts
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
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run tests/ui/controller.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/ui/controller.svelte.ts tests/ui/controller.test.ts
git commit -m "feat(ui): GameController verbindet Oberfläche und Session"
```

---

### Task 7: App-Gerüst und Bildschirm „Neues Spiel“

**Files:**
- Modify: `src/App.svelte` (komplett ersetzen), `src/main.ts` (App mit Controller mounten)
- Create: `src/ui/screens/NewGame.svelte`
- Test: `tests/ui/newgame.test.ts`

**Interfaces:**
- Consumes: `GameController` (Task 6), `generateWorld` (engine), `clubRating` (Task 3), `Panel`, `Crest`, `Screen` (Tasks 1 und 2), `COMP`, `LEAGUE_SIZE`
- Produces:
  - `App.svelte` mit der Prop `{ controller: GameController }`. Die App wählt den Bildschirm über `controller.view.kind`. Für noch nicht gebaute Bildschirme zeigt sie einen Platzhalter. Spätere Tasks fügen ihren Zweig **vor** der Zeile `{:else}` ein.
  - `NewGame.svelte` mit der Prop `{ controller: GameController }`:
    - **Eingaben:** Anzahl der Manager (1–4), Namen, Seed mit der Taste „Neue Welt“ und je Manager eine Vereinsauswahl. Die Auswahl ist in die Gruppen 1. und 2. Liga gegliedert und zeigt zu jedem Verein die Stärke.
    - **Start:** Die Taste „Anpfiff!“ ruft `controller.startGame` auf. Fehler erscheinen als `.msg`.

**Layout „Neues Spiel“** (640×400):
- Oben die Holztafel „NEUES SPIEL“ mit Seed-Feld und der Taste „Neue Welt“.
- Darunter 1–4 Zeilen, je eine pro Manager: Nummer, Namensfeld, Vereinsauswahl und das Wappen des gewählten Vereins.
- Unten die Auswahl der Manager-Anzahl (1 2 3 4) und die Taste „Anpfiff!“.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/newgame.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { GameController } from "../../src/ui/controller.svelte";

describe("Neues Spiel", () => {
  it("startet ein Spiel mit einem Manager und zeigt danach „ist dran“", async () => {
    const controller = new GameController();
    render(App, { controller });
    expect(screen.getByRole("heading", { name: "NEUES SPIEL" })).toBeTruthy();
    const name = screen.getByLabelText("Name Manager 1") as HTMLInputElement;
    await fireEvent.input(name, { target: { value: "Markus" } });
    const select = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    const firstClub = select.querySelectorAll("option")[1].value;
    await fireEvent.change(select, { target: { value: firstClub } });
    await fireEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    expect(controller.view.kind).toBe("turnStart");
    expect(controller.snapshot!.state.managers[0].name).toBe("Markus");
    expect(controller.snapshot!.state.managers[0].clubId).toBe(firstClub);
  });

  it("bietet 36 Vereine in zwei Ligagruppen an", () => {
    render(App, { controller: new GameController() });
    const select = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    const groups = select.querySelectorAll("optgroup");
    expect([...groups].map((g) => g.label)).toEqual(["1. Liga", "2. Liga"]);
    expect(groups[0].querySelectorAll("option")).toHaveLength(18);
    expect(groups[1].querySelectorAll("option")).toHaveLength(18);
  });

  it("zeigt Felder für die gewählte Manager-Anzahl", async () => {
    render(App, { controller: new GameController() });
    await fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByLabelText("Name Manager 3")).toBeTruthy();
    expect(screen.queryByLabelText("Name Manager 4")).toBeNull();
  });

  it("meldet einen fehlenden Verein und zwei Manager mit demselben Verein", async () => {
    const controller = new GameController();
    render(App, { controller });
    await fireEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    expect(screen.getByText("Bitte wähle für jeden Manager einen Verein.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "2" }));
    const s1 = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    const s2 = screen.getByLabelText("Verein Manager 2") as HTMLSelectElement;
    const club = s1.querySelectorAll("option")[1].value;
    await fireEvent.change(s1, { target: { value: club } });
    await fireEvent.change(s2, { target: { value: club } });
    await fireEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    expect(screen.getByText("Zwei Manager können nicht denselben Verein übernehmen.")).toBeTruthy();
    expect(controller.view.kind).toBe("newGame");
  });

  it("„Neue Welt“ erzeugt eine andere Welt aus dem eingegebenen Seed", async () => {
    render(App, { controller: new GameController() });
    const seed = screen.getByLabelText("Seed") as HTMLInputElement;
    await fireEvent.input(seed, { target: { value: "1" } });
    await fireEvent.click(screen.getByRole("button", { name: "Neue Welt" }));
    const a = (screen.getByLabelText("Verein Manager 1") as HTMLSelectElement).querySelectorAll("option")[1].textContent;
    await fireEvent.input(seed, { target: { value: "2" } });
    await fireEvent.click(screen.getByRole("button", { name: "Neue Welt" }));
    const b = (screen.getByLabelText("Verein Manager 1") as HTMLSelectElement).querySelectorAll("option")[1].textContent;
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/newgame.test.ts`
Expected: FAIL, weil `NewGame.svelte` fehlt und `App.svelte` keine `controller`-Prop hat.

- [ ] **Step 3: Implementieren**

`src/ui/screens/NewGame.svelte`:

```svelte
<script lang="ts">
  import { generateWorld } from "../../engine/generator";
  import { LEAGUE_SIZE, type ClubId, type GameState } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { clubRating } from "../logic/tables";
  import Crest from "../theme/Crest.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();

  const initialSeed = Math.floor(Math.random() * 1_000_000);
  let seedText = $state(String(initialSeed));
  let world: GameState = $state.raw(generateWorld(initialSeed));
  let count = $state(1);
  let names = $state(["Manager 1", "Manager 2", "Manager 3", "Manager 4"]);
  let picks = $state<(ClubId | "")[]>(["", "", "", ""]);
  let error = $state<string | null>(null);

  const ranked = $derived(Object.values(world.clubs).sort((a, b) => b.reputation - a.reputation || (a.id < b.id ? -1 : 1)));
  const first = $derived(ranked.slice(0, LEAGUE_SIZE));
  const second = $derived(ranked.slice(LEAGUE_SIZE));

  function newWorld(): void {
    const seed = Number.parseInt(seedText, 10);
    world = generateWorld(Number.isFinite(seed) ? seed : 0);
    picks = ["", "", "", ""];
    error = null;
  }

  function start(): void {
    const chosen = picks.slice(0, count);
    if (chosen.some((p) => p === "")) {
      error = "Bitte wähle für jeden Manager einen Verein.";
      return;
    }
    error = controller.startGame(
      world,
      chosen.map((clubId, i) => ({ name: names[i], clubId: clubId as ClubId })),
    );
  }
</script>

<div class="newgame">
  <Panel>
    <div class="head">
      <h1>NEUES SPIEL</h1>
      <label class="seed">Seed <input aria-label="Seed" bind:value={seedText} inputmode="numeric" size="8" /></label>
      <button class="btn" onclick={newWorld}>Neue Welt</button>
    </div>
  </Panel>

  <Panel title="MANAGER">
    {#each Array.from({ length: count }, (_, i) => i) as i (i)}
      <div class="row">
        <span class="no">{i + 1}</span>
        <input aria-label="Name Manager {i + 1}" bind:value={names[i]} maxlength="16" />
        <select aria-label="Verein Manager {i + 1}" bind:value={picks[i]}>
          <option value="">– Verein wählen –</option>
          <optgroup label="1. Liga">
            {#each first as club (club.id)}<option value={club.id}>{club.name} ({clubRating(world, club.id)})</option>{/each}
          </optgroup>
          <optgroup label="2. Liga">
            {#each second as club (club.id)}<option value={club.id}>{club.name} ({clubRating(world, club.id)})</option>{/each}
          </optgroup>
        </select>
        {#if picks[i]}
          {@const club = world.clubs[picks[i]]}
          <Crest colors={club.colors} pattern={club.crest} size={16} />
        {/if}
      </div>
    {/each}
  </Panel>

  <div class="foot">
    <span>Manager:</span>
    {#each [1, 2, 3, 4] as n (n)}
      <button class="btn" class:selected={count === n} onclick={() => (count = n)}>{n}</button>
    {/each}
    <span class="spacer"></span>
    {#if error}<span class="msg">{error}</span>{/if}
    <button class="btn primary" onclick={start}>Anpfiff!</button>
  </div>
</div>

<style>
  .newgame {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    height: 100%;
    box-sizing: border-box;
  }
  .head { display: flex; align-items: center; gap: 12px; }
  .seed { margin-left: auto; color: var(--leaf); }
  .row { display: flex; align-items: center; gap: 8px; }
  .no { font-family: var(--font-display); font-size: 8px; color: var(--gold); width: 12px; }
  input,
  select {
    font-family: var(--font-body);
    font-size: 16px;
    color: var(--cream);
    background: var(--wood-dark);
    border: 2px solid var(--wood-edge);
    padding: 1px 4px;
  }
  select { flex: 1; min-width: 0; }
  .foot { display: flex; align-items: center; gap: 6px; margin-top: auto; }
  .spacer { flex: 1; }
</style>
```

`src/App.svelte` komplett ersetzen:

```svelte
<script lang="ts">
  import type { GameController } from "./ui/controller.svelte";
  import NewGame from "./ui/screens/NewGame.svelte";
  import Screen from "./ui/theme/Screen.svelte";

  let { controller }: { controller: GameController } = $props();
  const view = $derived(controller.view);
</script>

<Screen>
  {#if view.kind === "newGame"}
    <NewGame {controller} />
  {:else}
    <p class="placeholder">Bildschirm „{view.kind}“ folgt.</p>
  {/if}
</Screen>

<style>
  .placeholder { padding: 16px; }
</style>
```

`src/main.ts` komplett ersetzen:

```ts
import "@fontsource/vt323";
import "@fontsource/press-start-2p";
import "./ui/theme/theme.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { GameController } from "./ui/controller.svelte";

mount(App, { target: document.getElementById("app")!, props: { controller: new GameController() } });
```

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run tests/ui/newgame.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/main.ts src/ui/screens/NewGame.svelte tests/ui/newgame.test.ts
git commit -m "feat(ui): App-Gerüst und Bildschirm „Neues Spiel“"
```

---

### Task 8: „… ist dran“ und Hauptmenü

**Files:**
- Create: `src/ui/screens/ClubHeader.svelte`, `src/ui/screens/TurnStart.svelte`, `src/ui/screens/MainMenu.svelte`
- Modify: `src/App.svelte` (Zweige einfügen)
- Test: `tests/ui/menu.test.ts`

**Interfaces:**
- Consumes: `GameController`, `View` (Task 6), `clubPlace`, `clubRating` (Task 3), `matchdayLabel` (Task 3), `Crest`, `Panel`, `Tile` (Task 2), `clubOf` (engine/model)
- Produces:
  - `ClubHeader.svelte` mit den Props `{ controller; managerId }`. Es zeigt eine Kopfzeile mit Wappen, Vereinsname, „Saison N · X. Spieltag“, Tabellenplatz und Liga sowie dem Managernamen.
  - `TurnStart.svelte` mit den Props `{ controller; managerId }`. Es zeigt „{Name} IST DRAN“ und die Taste „Los geht's“; Enter wirkt ebenso. Beides führt zu `controller.open("menu")`.
  - `MainMenu.svelte` mit den Props `{ controller; managerId }`. Es zeigt 8 Kacheln im Raster 4×2:
    - **1 Mannschaft** öffnet die Mannschaft (`controller.open("squad")`).
    - **2 Training, 3 Verträge, 4 Transfers, 5 Finanzen und 7 Nachrichten** sind gesperrt.
    - **6 Tabelle** öffnet Tabelle und Spielplan (`controller.open("tables")`).
    - **8 Weiter** beendet die Runde (`controller.endTurn(managerId)`).
    - **Tasten:** 1–8 wählen eine Kachel, Enter entspricht „Weiter“.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/menu.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

function game(names = ["Anna"]) {
  const controller = new GameController();
  const world = generateWorld(11);
  const ids = Object.keys(world.clubs);
  controller.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  render(App, { controller });
  return controller;
}

describe("„ist dran“", () => {
  it("zeigt Manager, Verein und Spieltag; Enter öffnet das Hauptmenü", async () => {
    const c = game();
    const club = c.snapshot!.state.clubs[c.snapshot!.state.managers[0].clubId!];
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
    expect(screen.getAllByText(club.name).length).toBeGreaterThan(0);
    expect(screen.getByText(/Saison 1 · 1\. Spieltag/)).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Enter" });
    expect(c.view.kind).toBe("menu");
  });
});

describe("Hauptmenü", () => {
  it("hat 8 Kacheln, fünf davon gesperrt", async () => {
    const c = game();
    c.open("menu");
    await tick();
    const tiles = screen.getAllByRole("button").filter((b) => b.classList.contains("tile"));
    expect(tiles).toHaveLength(8);
    expect(tiles.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(5);
  });

  it("Taste 1 öffnet die Mannschaft, Taste 6 die Tabelle", async () => {
    const c = game();
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "1" });
    expect(c.view.kind).toBe("squad");
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "6" });
    expect(c.view.kind).toBe("tables");
  });

  it("gesperrte Kacheln reagieren nicht auf ihre Taste", async () => {
    const c = game();
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "2" });
    expect(c.view.kind).toBe("menu");
  });

  it("„Weiter“ übergibt an den nächsten Manager", async () => {
    const c = game(["Anna", "Ben"]);
    c.open("menu");
    await tick();
    await fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(c.view).toEqual({ kind: "turnStart", managerId: c.snapshot!.state.managers[1].id });
    expect(await screen.findByText("BEN IST DRAN")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/menu.test.ts`
Expected: FAIL, weil „ANNA IST DRAN“ nicht gefunden wird (die App zeigt noch den Platzhalter).

- [ ] **Step 3: Implementieren**

`src/ui/screens/ClubHeader.svelte`:

```svelte
<script lang="ts">
  import { clubOf, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { matchdayLabel } from "../logic/format";
  import { clubPlace } from "../logic/tables";
  import Crest from "../theme/Crest.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();
  const state = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(state, managerId));
  const place = $derived(club ? clubPlace(state, club.id) : null);
</script>

{#if club}
  <header class="clubhead">
    <Crest colors={club.colors} pattern={club.crest} size={20} />
    <strong>{club.name}</strong>
    <span>Saison {state.season} · {matchdayLabel(state)}</span>
    {#if place}<span class="place">{place.rank}. Platz · {state.competitions[place.competitionId].name}</span>{/if}
    <span class="mgr">{controller.managerName(managerId)}</span>
  </header>
{/if}

<style>
  .clubhead {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    background: var(--wood);
    border-bottom: 3px solid var(--wood-edge);
  }
  strong { font-family: var(--font-display); font-weight: normal; font-size: 8px; color: var(--gold); }
  .place { color: var(--leaf); }
  .mgr { margin-left: auto; }
</style>
```

`src/ui/screens/TurnStart.svelte`:

```svelte
<script lang="ts">
  import { clubOf, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import Crest from "../theme/Crest.svelte";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();
  const club = $derived(clubOf(controller.snapshot!.state, managerId));

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="turn">
  <ClubHeader {controller} {managerId} />
  <div class="center">
    <Panel>
      <div class="card">
        {#if club}<Crest colors={club.colors} pattern={club.crest} size={48} />{/if}
        <h1>{controller.managerName(managerId).toUpperCase()} IST DRAN</h1>
        {#if club}<p>{club.name}</p>{/if}
        <button class="btn primary" onclick={() => controller.open("menu")}>Los geht's (Enter)</button>
      </div>
    </Panel>
  </div>
</div>

<style>
  .turn { display: flex; flex-direction: column; height: 100%; }
  .center { flex: 1; display: grid; place-items: center; }
  .card { display: grid; justify-items: center; gap: 10px; padding: 12px 28px; }
  p { margin: 0; font-size: 20px; }
</style>
```

`src/ui/screens/MainMenu.svelte`:

```svelte
<script lang="ts">
  import type { ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import Tile from "../theme/Tile.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const tiles: { key: string; icon: string; label: string; action: (() => void) | null }[] = [
    { key: "1", icon: "11", label: "Mannschaft", action: () => controller.open("squad") },
    { key: "2", icon: "++", label: "Training", action: null },
    { key: "3", icon: "§", label: "Verträge", action: null },
    { key: "4", icon: "<>", label: "Transfers", action: null },
    { key: "5", icon: "$", label: "Finanzen", action: null },
    { key: "6", icon: "#", label: "Tabelle", action: () => controller.open("tables") },
    { key: "7", icon: "@", label: "Nachrichten", action: null },
    { key: "8", icon: ">>", label: "Weiter", action: () => void controller.endTurn(managerId) },
  ];

  function onKey(e: KeyboardEvent): void {
    const key = e.key === "Enter" ? "8" : e.key;
    const tile = tiles.find((t) => t.key === key);
    if (tile?.action) {
      e.preventDefault();
      tile.action();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="menu">
  <ClubHeader {controller} {managerId} />
  <div class="grid">
    {#each tiles as t (t.key)}
      <Tile shortcut={t.key} icon={t.icon} label={t.label} disabled={t.action === null} onclick={() => t.action?.()} />
    {/each}
  </div>
  {#if controller.message}<p class="msg">{controller.message}</p>{/if}
</div>

<style>
  .menu { display: flex; flex-direction: column; height: 100%; }
  .grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 10px;
    padding: 12px;
  }
  .msg { margin: 0 12px 8px; }
</style>
```

In `src/App.svelte` die Imports ergänzen:

```ts
  import MainMenu from "./ui/screens/MainMenu.svelte";
  import TurnStart from "./ui/screens/TurnStart.svelte";
```

Dann vor der Zeile `{:else}` einfügen:

```svelte
  {:else if view.kind === "turnStart"}
    {#key view.managerId}<TurnStart {controller} managerId={view.managerId} />{/key}
  {:else if view.kind === "menu"}
    <MainMenu {controller} managerId={view.managerId} />
```

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run tests/ui/menu.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/ui/screens/ClubHeader.svelte src/ui/screens/TurnStart.svelte src/ui/screens/MainMenu.svelte tests/ui/menu.test.ts
git commit -m "feat(ui): Manager-Wechsel und Hauptmenü"
```

---

### Task 9: Mannschaft (Aufstellung und Taktik)

**Files:**
- Create: `src/ui/screens/Squad.svelte`
- Modify: `src/App.svelte` (Zweig einfügen)
- Test: `tests/ui/squad.test.ts`

**Interfaces:**
- Consumes: `GameController` (Task 6), `squadRows`, `swapPlayers` (Task 5), Texte aus `format.ts` (Task 3), `ClubHeader` (Task 8), `Panel`, `FORMATION_LIST`, `clubOf`
- Produces: `Squad.svelte` mit den Props `{ controller; managerId }`
  - **Tausch:** Ein Klick auf einen Spielernamen markiert den Spieler, ein Klick auf einen zweiten tauscht beide. Danach geht `setLineup` an die Engine. Ein erneuter Klick auf denselben Namen hebt die Markierung auf.
  - **Taktik:** Tasten für Formation (6), Spielweise (3) und Härte (3) schicken `setTactics`, die Taste „Automatisch“ schickt `autoLineup`.
  - **Fehler** aus der Engine (z. B. „Krämer ist verletzt.“) erscheinen als `.msg`.
  - **Zurück:** Esc oder die Taste „Zurück“ führt zu `controller.open("menu")`.

**Layout** (640×400): Links die Holztafel „KADER“ mit scrollbarer Tabelle (etwa 430 px breit). Ihre Spalten sind Platz, Name, Pos, Alter, St, Form, Kond und Status. Rechts eine Spalte mit „FORMATION“, „SPIELWEISE“, „HÄRTE“ sowie den Tasten „Automatisch“ und „Zurück“.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/squad.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function squadScreen(prepare?: (world: ReturnType<typeof generateWorld>, clubId: string) => void) {
  const controller = new GameController();
  const world = generateWorld(21);
  const clubId = Object.keys(world.clubs)[3];
  prepare?.(world, clubId);
  controller.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller });
  controller.open("squad");
  await tick();
  const club = () => controller.snapshot!.state.clubs[clubId];
  const player = (id: string) => controller.snapshot!.state.players[id];
  const nameButton = (id: string) => screen.getByRole("button", { name: playerName(player(id)) + " " + id });
  return { controller, club, player, nameButton };
}

describe("Mannschaft", () => {
  it("zeigt den ganzen Kader", async () => {
    const { club } = await squadScreen();
    expect(screen.getAllByRole("row").length).toBe(club().squad.length + 1);
  });

  it("tauscht zwei Startspieler per Klick", async () => {
    const { club, nameButton } = await squadScreen();
    const [a, b] = [club().lineup.starters[1], club().lineup.starters[2]];
    await fireEvent.click(nameButton(a));
    await fireEvent.click(nameButton(b));
    expect(club().lineup.starters[1]).toBe(b);
    expect(club().lineup.starters[2]).toBe(a);
  });

  it("verletzten Spieler einwechseln: Meldung, Aufstellung bleibt", async () => {
    let injured = "";
    const { club, player, nameButton } = await squadScreen((world, clubId) => {
      const c = world.clubs[clubId];
      injured = c.squad.find((id) => !c.lineup.starters.includes(id) && !c.lineup.bench.includes(id))!;
      world.players[injured].injury = { matchesLeft: 3 };
    });
    const before = [...club().lineup.starters];
    await fireEvent.click(nameButton(before[5]));
    await fireEvent.click(nameButton(injured));
    expect(await screen.findByText(`${player(injured).lastName} ist verletzt.`)).toBeTruthy();
    expect(club().lineup.starters).toEqual(before);
  });

  it("ändert Formation, Spielweise und Härte", async () => {
    const { club } = await squadScreen();
    await fireEvent.click(screen.getByRole("button", { name: "4-3-3" }));
    await fireEvent.click(screen.getByRole("button", { name: "offensiv" }));
    await fireEvent.click(screen.getByRole("button", { name: "hart" }));
    expect(club().tactics).toEqual({ formation: "4-3-3", style: "offensive", hardness: "hard" });
  });

  it("„Automatisch“ stellt eine gültige Elf auf, Esc führt zurück ins Menü", async () => {
    const { controller, club } = await squadScreen();
    await fireEvent.click(screen.getByRole("button", { name: "Automatisch" }));
    expect(club().lineup.starters).toHaveLength(11);
    expect(controller.message).toBeNull();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(controller.view.kind).toBe("menu");
  });
});
```

Anmerkung: Damit gleichnamige Spieler eindeutig bleiben, trägt jeder Namens-Button `aria-label="{Name} {Spieler-ID}"`, z. B. „M. Krämer p17“.

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/squad.test.ts`
Expected: FAIL, weil keine Zeilen und Buttons gefunden werden (Platzhalter).

- [ ] **Step 3: Implementieren**

`src/ui/screens/Squad.svelte`:

```svelte
<script lang="ts">
  import { FORMATION_LIST, clubOf, type Hardness, type ManagerId, type PlayerId, type Style, type Tactics } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { HARDNESS_LABEL, POSITION_LABEL, STYLE_LABEL, fitnessText, formText, playerName, statusText } from "../logic/format";
  import { squadRows, swapPlayers, type SquadRow } from "../logic/lineupEdit";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const STYLES: Style[] = ["defensive", "normal", "offensive"];
  const HARDNESSES: Hardness[] = ["fair", "normal", "hard"];

  const club = $derived(clubOf(controller.snapshot!.state, managerId)!);
  const rows = $derived(squadRows(controller.snapshot!.state, club.id));
  let picked = $state<PlayerId | null>(null);

  function place(r: SquadRow): string {
    if (r.area === "starter") return r.slot ? POSITION_LABEL[r.slot] : "";
    return r.area === "bench" ? "Bank" : "";
  }

  async function pick(id: PlayerId): Promise<void> {
    if (picked === null) {
      picked = id;
      return;
    }
    const first = picked;
    picked = null;
    if (first === id) return;
    await controller.send({ type: "setLineup", managerId, lineup: swapPlayers(club.lineup, first, id) });
  }

  function setTactics(patch: Partial<Tactics>): void {
    void controller.send({ type: "setTactics", managerId, tactics: { ...club.tactics, ...patch } });
  }

  function auto(): void {
    picked = null;
    void controller.send({ type: "autoLineup", managerId });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="squad">
  <ClubHeader {controller} {managerId} />
  <div class="body">
    <Panel title="KADER" class="list">
      <div class="scroll">
        <table class="board-table">
          <thead>
            <tr><th>Platz</th><th>Name</th><th>Pos</th><th class="num">Alter</th><th class="num">St</th><th class="num">Form</th><th class="num">Kond</th><th>Status</th></tr>
          </thead>
          <tbody>
            {#each rows as r (r.player.id)}
              <tr class:picked={picked === r.player.id} class:bench={r.area === "bench"} class:reserve={r.area === "reserve"}>
                <td>{place(r)}</td>
                <td>
                  <button class="name" aria-label="{playerName(r.player)} {r.player.id}" onclick={() => pick(r.player.id)}>
                    {playerName(r.player)}
                  </button>
                </td>
                <td>{POSITION_LABEL[r.player.position]}</td>
                <td class="num">{r.player.age}</td>
                <td class="num">{Math.round(r.player.strength)}</td>
                <td class="num">{formText(r.player.form)}</td>
                <td class="num">{fitnessText(r.player.fitness)}</td>
                <td class="status">{statusText(r.player)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Panel>
    <div class="side">
      <Panel title="FORMATION">
        <div class="opts">
          {#each FORMATION_LIST as f (f)}
            <button class="btn" class:selected={club.tactics.formation === f} onclick={() => setTactics({ formation: f })}>{f}</button>
          {/each}
        </div>
      </Panel>
      <Panel title="SPIELWEISE">
        <div class="opts">
          {#each STYLES as s (s)}
            <button class="btn" class:selected={club.tactics.style === s} onclick={() => setTactics({ style: s })}>{STYLE_LABEL[s]}</button>
          {/each}
        </div>
      </Panel>
      <Panel title="HÄRTE">
        <div class="opts">
          {#each HARDNESSES as h (h)}
            <button class="btn" class:selected={club.tactics.hardness === h} onclick={() => setTactics({ hardness: h })}>{HARDNESS_LABEL[h]}</button>
          {/each}
        </div>
      </Panel>
      <button class="btn" onclick={auto}>Automatisch</button>
      <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
    </div>
  </div>
  {#if controller.message}<p class="msg">{controller.message}</p>{/if}
</div>

<style>
  .squad { display: flex; flex-direction: column; height: 100%; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 168px; gap: 8px; padding: 8px; }
  .body :global(.list) { min-height: 0; }
  .scroll { overflow-y: auto; min-height: 0; flex: 1; }
  .side { display: flex; flex-direction: column; gap: 6px; }
  .opts { display: flex; flex-wrap: wrap; gap: 4px; }
  .opts .btn { padding: 1px 5px; }
  .name {
    all: unset;
    cursor: pointer;
    color: inherit;
  }
  .name:focus-visible { outline: 1px solid var(--gold); }
  tr.bench td { color: var(--leaf); }
  tr.reserve td { opacity: 0.8; }
  tr.picked td { background: var(--rust); color: var(--cream); opacity: 1; }
  .status { color: var(--rust); }
  tr.picked .status { color: var(--cream); }
  .msg { margin: 0 8px 6px; }
</style>
```

In `src/App.svelte` den Import ergänzen:

```ts
  import Squad from "./ui/screens/Squad.svelte";
```

Dann vor der Zeile `{:else}` einfügen:

```svelte
  {:else if view.kind === "squad"}
    <Squad {controller} managerId={view.managerId} />
```

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run tests/ui/squad.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/ui/screens/Squad.svelte tests/ui/squad.test.ts
git commit -m "feat(ui): Mannschaft mit Aufstellung und Taktik"
```

---

### Task 10: Tabelle und Spielplan

**Files:**
- Create: `src/ui/screens/Tables.svelte`
- Modify: `src/App.svelte` (Zweige einfügen)
- Test: `tests/ui/tablesScreen.test.ts`

**Interfaces:**
- Consumes: `GameController`, `tableView`, `fixturesView`, `lastPlayedRound` (Task 3), `leagueOf` (engine/season), `Panel`, `COMP`
- Produces: `Tables.svelte` mit den Props `{ controller; managerId: ManagerId | null; onBack: () => void }`
  - **Ligawahl:** Reiter „1. Liga“ und „2. Liga“. Zu Beginn ist die Liga des Managers gewählt, ohne Manager die 1. Liga.
  - **Tabelle:** Die Spalten sind Pl, Verein, Sp, S, U, N, Tore und Pkt. Zonen werden farbig markiert, Vereine menschlicher Manager hervorgehoben.
  - **Spielplan:** Spieltag-Navigation mit „◄“ und „►“ (aria-labels „Vorheriger Spieltag“ und „Nächster Spieltag“). Der Start ist `lastPlayedRound`.
  - **Zurück:** Esc oder die Taste „Zurück“ ruft `onBack` auf.
- App-Zweige:
  - `tables` zeigt `Tables` mit `onBack = () => controller.open("menu")`.
  - `resultsTables` zeigt `Tables` mit `managerId = null` und `onBack = () => controller.setResultsTables(false)`.

**Layout:** Links die Tabelle (etwa 390 px), rechts der Spielplan (etwa 220 px), darüber die Reiter.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/tablesScreen.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import Tables from "../../src/ui/screens/Tables.svelte";

function setup(clubIndex = 25) {
  const controller = new GameController();
  const world = generateWorld(5);
  const clubId = Object.keys(world.clubs)[clubIndex];
  controller.startGame(world, [{ name: "Anna", clubId }]);
  const managerId = controller.snapshot!.state.managers[0].id;
  const onBack = vi.fn();
  render(Tables, { controller, managerId, onBack });
  return { controller, clubId, onBack };
}

describe("Tabelle und Spielplan", () => {
  it("beginnt mit der Liga des Managers und hebt seinen Verein hervor", () => {
    const { controller, clubId } = setup(25);
    const state = controller.snapshot!.state;
    const leagueName = state.competitions["L2"].clubs.includes(clubId) ? "2. Liga" : "1. Liga";
    expect(screen.getByRole("button", { name: leagueName }).classList.contains("selected")).toBe(true);
    const table = screen.getByRole("table", { name: "Tabelle" });
    expect(within(table).getAllByRole("row")).toHaveLength(19);
    const mine = table.querySelector("tr.mine")!;
    expect(mine.textContent).toContain(state.clubs[clubId].name);
  });

  it("wechselt die Liga", async () => {
    setup(0);
    await fireEvent.click(screen.getByRole("button", { name: "2. Liga" }));
    expect(screen.getByRole("button", { name: "2. Liga" }).classList.contains("selected")).toBe(true);
    expect(within(screen.getByRole("table", { name: "Tabelle" })).getAllByRole("row")).toHaveLength(19);
  });

  it("blättert im Spielplan und bleibt zwischen 1 und 34", async () => {
    setup(0);
    expect(screen.getByText("1. Spieltag")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Vorheriger Spieltag" }));
    expect(screen.getByText("1. Spieltag")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Nächster Spieltag" }));
    expect(screen.getByText("2. Spieltag")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Spielplan" })).getAllByRole("listitem")).toHaveLength(9);
  });

  it("Esc und „Zurück“ rufen onBack", async () => {
    const { onBack } = setup(0);
    await fireEvent.keyDown(window, { key: "Escape" });
    await fireEvent.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/tablesScreen.test.ts`
Expected: FAIL, weil das Modul `Tables.svelte` nicht gefunden wird.

- [ ] **Step 3: Implementieren**

`src/ui/screens/Tables.svelte`:

```svelte
<script lang="ts">
  import { COMP, type CompetitionId, type ManagerId } from "../../engine/model";
  import { leagueOf } from "../../engine/season";
  import type { GameController } from "../controller.svelte";
  import { fixturesView, lastPlayedRound, tableView } from "../logic/tables";
  import Panel from "../theme/Panel.svelte";

  let { controller, managerId, onBack }: { controller: GameController; managerId: ManagerId | null; onBack: () => void } = $props();

  const state = $derived(controller.snapshot!.state);
  const ownClub = $derived(managerId ? (state.managers.find((m) => m.id === managerId)?.clubId ?? null) : null);
  const LEAGUES: { id: CompetitionId; label: string }[] = [
    { id: COMP.first, label: "1. Liga" },
    { id: COMP.second, label: "2. Liga" },
  ];

  /** Startwerte beim Öffnen: eigene Liga (sonst 1. Liga) und zuletzt gespielter Spieltag. */
  function initial(): { league: CompetitionId; round: number } {
    const s = controller.snapshot!.state;
    const clubId = managerId ? (s.managers.find((m) => m.id === managerId)?.clubId ?? null) : null;
    const start = (clubId && leagueOf(s, clubId)) || COMP.first;
    return { league: start, round: lastPlayedRound(s, start) };
  }
  const start = initial();
  let league = $state<CompetitionId>(start.league);
  let round = $state(start.round);

  const rows = $derived(tableView(state, league));
  const rounds = $derived(state.competitions[league]?.rounds ?? 34);
  const fixtures = $derived(fixturesView(state, league, round));

  function selectLeague(id: CompetitionId): void {
    league = id;
    round = lastPlayedRound(state, id);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      onBack();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="tables">
  <div class="tabs">
    {#each LEAGUES as l (l.id)}
      <button class="btn" class:selected={league === l.id} onclick={() => selectLeague(l.id)}>{l.label}</button>
    {/each}
    <span class="spacer"></span>
    <button class="btn" onclick={onBack}>Zurück (Esc)</button>
  </div>
  <div class="body">
    <Panel title="TABELLE">
      <table class="board-table" aria-label="Tabelle">
        <thead>
          <tr><th class="num">Pl</th><th>Verein</th><th class="num">Sp</th><th class="num">S</th><th class="num">U</th><th class="num">N</th><th class="num">Tore</th><th class="num">Pkt</th></tr>
        </thead>
        <tbody>
          {#each rows as r (r.club)}
            <tr class:mine={r.manager !== null} class="zone-{r.zone ?? 'none'}">
              <td class="num">{r.rank}</td>
              <td>{r.name}{r.manager ? ` (${r.manager})` : ""}</td>
              <td class="num">{r.played}</td>
              <td class="num">{r.won}</td>
              <td class="num">{r.drawn}</td>
              <td class="num">{r.lost}</td>
              <td class="num">{r.goalsFor}:{r.goalsAgainst}</td>
              <td class="num">{r.points}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Panel>
    <Panel title="SPIELPLAN">
      <div class="nav">
        <button class="btn" aria-label="Vorheriger Spieltag" disabled={round <= 1} onclick={() => (round = Math.max(1, round - 1))}>◄</button>
        <span>{round}. Spieltag</span>
        <button class="btn" aria-label="Nächster Spieltag" disabled={round >= rounds} onclick={() => (round = Math.min(rounds, round + 1))}>►</button>
      </div>
      <ul aria-label="Spielplan">
        {#each fixtures as f (f.id)}
          <li class:mine={f.homeClub === ownClub || f.awayClub === ownClub}>
            <span class="team">{state.clubs[f.homeClub].shortName}</span>
            <span class="res">{f.result ?? "–:–"}</span>
            <span class="team">{state.clubs[f.awayClub].shortName}</span>
          </li>
        {/each}
      </ul>
    </Panel>
  </div>
</div>

<style>
  .tables { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
  .tabs { display: flex; gap: 6px; }
  .spacer { flex: 1; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 226px; gap: 8px; }
  .board-table { font-size: 15px; line-height: 1; }
  tr.zone-champion td:first-child { box-shadow: inset 3px 0 var(--gold); }
  tr.zone-promotion td:first-child { box-shadow: inset 3px 0 var(--leaf); }
  tr.zone-playoff td:first-child { box-shadow: inset 3px 0 var(--cream); }
  tr.zone-relegation td:first-child { box-shadow: inset 3px 0 var(--rust); }
  .nav { display: flex; align-items: center; justify-content: space-between; }
  .nav .btn { padding: 0 6px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }
  li { display: grid; grid-template-columns: 1fr 52px 1fr; gap: 4px; font-size: 15px; }
  li .team { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li .team:first-child { text-align: right; }
  li .res { text-align: center; color: var(--gold); font-variant-numeric: tabular-nums; }
  li.mine .team { color: var(--gold); }
</style>
```

Anmerkung: Startliga und Startspieltag werden einmal beim Öffnen in `initial()` berechnet. Danach bestimmt der Nutzer Liga und Spieltag. Weil Props und Zustand nur innerhalb der Funktion gelesen werden, meldet `svelte-check` keine Warnung `state_referenced_locally`.

In `src/App.svelte` den Import ergänzen:

```ts
  import Tables from "./ui/screens/Tables.svelte";
```

Dann vor der Zeile `{:else}` einfügen:

```svelte
  {:else if view.kind === "tables"}
    <Tables {controller} managerId={view.managerId} onBack={() => controller.open("menu")} />
  {:else if view.kind === "resultsTables"}
    <Tables {controller} managerId={null} onBack={() => controller.setResultsTables(false)} />
```

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run tests/ui/tablesScreen.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/ui/screens/Tables.svelte tests/ui/tablesScreen.test.ts
git commit -m "feat(ui): Tabelle und Spielplan"
```

---

### Task 11: Konferenz

**Files:**
- Create: `src/ui/screens/Conference.svelte`
- Modify: `src/App.svelte` (Zweig einfügen)
- Test: `tests/ui/conference.test.ts`

**Interfaces:**
- Consumes: `GameController` (Task 6), `tickerRows`, `competitionsOf`, `competitionName`, `halfBounds`, `TEMPOS`, `DEFAULT_TEMPO` (Task 4), `Panel`
- Produces: `Conference.svelte` mit den Props `{ controller; half: 1 | 2 }`
  - **Ablauf:** Die Minute läuft von `from` bis `to`, je Minute ein `setTimeout` mit `TEMPOS[tempo]`. Am Ende steht „HALBZEIT“ bzw. „ABPFIFF“ da, und die Taste „Weiter“ erscheint.
  - **Tasten:**
    - TAB wechselt die Liga.
    - `+` macht schneller, `-` langsamer.
    - Die Leertaste springt ans Ende.
    - Enter ruft `controller.advance()` auf, aber nur am Ende und nur einmal.
  - **Darstellung:** Jedes Spiel ist eine Zeile aus Heim, Stand, Gast und letztem Ereignis. Eine Zeile mit einem Tor in der aktuellen Minute blinkt (`goalNow`), Spiele menschlicher Manager sind hervorgehoben.
- App-Zweig: `{#key view.half}<Conference {controller} half={view.half} />{/key}`. Das Neu-Mounten pro Halbzeit setzt den Zustand zurück.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/conference.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

async function atConference() {
  const controller = new GameController();
  const world = generateWorld(3);
  controller.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  await controller.endTurn(controller.snapshot!.state.managers[0].id);
  render(App, { controller });
  await tick();
  return controller;
}

function advanceMinutes(n: number, ms = 500): void {
  for (let i = 0; i < n; i++) {
    vi.advanceTimersByTime(ms);
    flushSync();
  }
}

describe("Konferenz", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("läuft im Normaltempo bis zur Halbzeit und bietet dann „Weiter“ an", async () => {
    const c = await atConference();
    expect(screen.getByText("0'")).toBeTruthy();
    expect(screen.getByText(/KONFERENZ · 1\. Liga/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Weiter/ })).toBeNull();
    advanceMinutes(10);
    expect(screen.getByText("10'")).toBeTruthy();
    advanceMinutes(35);
    expect(screen.getByText("45'")).toBeTruthy();
    expect(screen.getByText("HALBZEIT")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(c.view.kind).toBe("halftime");
  });

  it("zeigt am Ende genau die Halbzeitstände der Engine", async () => {
    const c = await atConference();
    await fireEvent.keyDown(window, { key: " " });
    const lives = c.snapshot!.lives.filter((l) => l.competitionId === "L1");
    const shown = [...document.querySelectorAll(".score")].map((e) => e.textContent);
    expect(shown).toEqual(lives.map((l) => `${l.home.goals}:${l.away.goals}`));
  });

  it("Enter vor dem Ende tut nichts; doppeltes Enter am Ende schaltet genau einmal weiter", async () => {
    const c = await atConference();
    await fireEvent.keyDown(window, { key: "Enter" });
    expect(c.view.kind).toBe("conference");
    await fireEvent.keyDown(window, { key: " " });
    // zwei Enter direkt hintereinander, bevor Svelte neu rendert
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(c.view.kind).toBe("halftime");
    expect(c.message).toBeNull();
    await tick();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("TAB wechselt zur 2. Liga, + beschleunigt", async () => {
    await atConference();
    await fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByText(/KONFERENZ · 2\. Liga/)).toBeTruthy();
    await fireEvent.keyDown(window, { key: "+" });
    advanceMinutes(3, 200);
    expect(screen.getByText("3'")).toBeTruthy();
  });

  it("die 2. Halbzeit beginnt bei 45' mit dem Halbzeitstand", async () => {
    const c = await atConference();
    await fireEvent.keyDown(window, { key: " " });
    await fireEvent.keyDown(window, { key: "Enter" });
    await c.endTurn(c.snapshot!.state.managers[0].id);
    await tick();
    expect(c.view).toEqual({ kind: "conference", half: 2 });
    expect(screen.getByText("45'")).toBeTruthy();
    await fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("90'")).toBeTruthy();
    expect(screen.getByText("ABPFIFF")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/conference.test.ts`
Expected: FAIL, weil „0'“ nicht gefunden wird (Platzhalter).

- [ ] **Step 3: Implementieren**

`src/ui/screens/Conference.svelte`:

```svelte
<script lang="ts">
  import type { GameController } from "../controller.svelte";
  import { DEFAULT_TEMPO, TEMPOS, competitionName, competitionsOf, halfBounds, tickerRows } from "../logic/ticker";
  import Panel from "../theme/Panel.svelte";

  let { controller, half }: { controller: GameController; half: 1 | 2 } = $props();

  function startMinute(): number {
    return halfBounds(half).from;
  }

  const bounds = $derived(halfBounds(half));
  let minute = $state(startMinute());
  let tempo = $state(DEFAULT_TEMPO);
  let compIndex = $state(0);
  let advanced = false;

  const state = $derived(controller.snapshot!.state);
  const lives = $derived(controller.snapshot!.lives);
  const comps = $derived(competitionsOf(lives));
  const comp = $derived(comps[compIndex % Math.max(1, comps.length)]);
  const rows = $derived(tickerRows(state, lives, minute).filter((r) => r.competitionId === comp));
  const finished = $derived(minute >= bounds.to);

  $effect(() => {
    if (minute >= bounds.to) return;
    const timer = setTimeout(() => {
      minute = Math.min(bounds.to, minute + 1);
    }, TEMPOS[tempo]);
    return () => clearTimeout(timer);
  });

  function skip(): void {
    minute = bounds.to;
  }

  function next(): void {
    if (!finished || advanced) return;
    advanced = true;
    controller.advance();
  }

  function onKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "Tab":
        e.preventDefault();
        compIndex = (compIndex + 1) % Math.max(1, comps.length);
        break;
      case "+":
        tempo = Math.min(TEMPOS.length - 1, tempo + 1);
        break;
      case "-":
        tempo = Math.max(0, tempo - 1);
        break;
      case " ":
        e.preventDefault();
        skip();
        break;
      case "Enter":
        e.preventDefault();
        next();
        break;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="conference">
  <div class="bar">
    <span>KONFERENZ · {competitionName(state, comp)}</span>
    <span class="clock">{minute}'</span>
    <span>{half}. Halbzeit</span>
  </div>
  <Panel class="board">
    {#each rows as r (r.matchId)}
      <div class="row" class:goal={r.goalNow} class:managed={r.managed}>
        <span class="home">{r.home}</span>
        <span class="score">{r.homeGoals}:{r.awayGoals}</span>
        <span class="away">{r.away}</span>
        <span class="last">{r.last ?? ""}</span>
      </div>
    {/each}
  </Panel>
  <div class="foot">
    <button class="btn" onclick={() => (compIndex = (compIndex + 1) % Math.max(1, comps.length))}>Liga (TAB)</button>
    <button class="btn" onclick={() => (tempo = Math.max(0, tempo - 1))}>−</button>
    <span class="tempo">Tempo {tempo + 1}/3</span>
    <button class="btn" onclick={() => (tempo = Math.min(TEMPOS.length - 1, tempo + 1))}>+</button>
    <button class="btn" onclick={skip} disabled={finished}>Überspringen (Leertaste)</button>
    <span class="spacer"></span>
    {#if finished}
      <strong class="end">{half === 1 ? "HALBZEIT" : "ABPFIFF"}</strong>
      <button class="btn primary" onclick={next}>Weiter (Enter)</button>
    {/if}
  </div>
</div>

<style>
  .conference { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
  .bar {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-display);
    font-size: 8px;
    color: var(--gold);
    background: var(--wood);
    border: 3px solid var(--wood-edge);
    padding: 6px 8px;
  }
  .clock { color: var(--cream); }
  .conference :global(.board) { flex: 1; justify-content: space-around; }
  .row { display: grid; grid-template-columns: 1fr 44px 1fr 150px; gap: 8px; font-size: 17px; padding: 0 4px; }
  .home { text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .away { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { text-align: center; color: var(--gold); font-variant-numeric: tabular-nums; }
  .last { color: var(--leaf); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row.managed .home,
  .row.managed .away { color: var(--gold); }
  .row.goal { background: var(--rust); }
  @media (prefers-reduced-motion: no-preference) {
    .row.goal { animation: blink 0.5s steps(1) 2; }
    @keyframes blink { 50% { background: transparent; } }
  }
  .foot { display: flex; align-items: center; gap: 6px; }
  .foot .btn { padding: 1px 6px; }
  .tempo { color: var(--leaf); }
  .spacer { flex: 1; }
  .end { font-family: var(--font-display); font-weight: normal; font-size: 8px; color: var(--gold); }
</style>
```

In `src/App.svelte` den Import ergänzen:

```ts
  import Conference from "./ui/screens/Conference.svelte";
```

Dann vor der Zeile `{:else}` einfügen:

```svelte
  {:else if view.kind === "conference"}
    {#key view.half}<Conference {controller} half={view.half} />{/key}
```

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run tests/ui/conference.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/ui/screens/Conference.svelte tests/ui/conference.test.ts
git commit -m "feat(ui): Konferenz mit Tempo, Ligawechsel und Überspringen"
```

---

### Task 12: Halbzeit

**Files:**
- Create: `src/ui/screens/Halftime.svelte`
- Modify: `src/App.svelte` (Zweig einfügen)
- Test: `tests/ui/halftime.test.ts`

**Interfaces:**
- Consumes: `GameController` (Task 6), `findLiveFor` (engine/commands), Halbzeit-Entwurf (Task 5), Texte (Task 3), `FORMATION_LIST`, `Panel`
- Produces: `Halftime.svelte` mit den Props `{ controller; managerId }`
  - **Kopf:** „HALBZEIT · {Manager}“ und der Spielstand „Heim h:a Gast“.
  - **Platz:** Liste mit Platz-Kürzel, Name (Button), Kondition und „G“ für vorbelastete Spieler.
  - **Bank:** Liste mit Namens-Buttons.
  - **Wechsel planen:** Erst ein Spieler auf dem Platz, dann einer auf der Bank. Geplante Wechsel werden aufgelistet und lassen sich mit „✕“ entfernen (aria-label „Wechsel entfernen“). Dazu die Anzeige „Wechsel übrig: N“.
  - **Taktik:** Formation und Spielweise. Ausgewählt ist der Entwurfswert, sonst der aktuelle.
  - **Fertig:** „Fertig (Enter)“ schickt zuerst `toCommand(...)`, falls es nicht `null` ist, danach `endTurn`. Lehnt die Engine ab, bleibt der Bildschirm offen und zeigt die Meldung.
  - **Meldungen** aus dem Entwurf (z. B. „Keine Wechsel mehr übrig.“) erscheinen als `.msg`.
- App-Zweig: `{#key view.managerId}<Halftime … />{/key}`. So beginnt jeder Manager mit leerem Entwurf.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/halftime.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { findLiveFor } from "../../src/engine/commands";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function atHalftime(names = ["Anna"]) {
  const controller = new GameController();
  const world = generateWorld(9);
  const ids = Object.keys(world.clubs);
  controller.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  for (const m of controller.snapshot!.state.managers) await controller.endTurn(m.id);
  controller.advance();
  render(App, { controller });
  await tick();
  const managerId = controller.snapshot!.state.managers[0].id;
  const side = () => {
    const s = controller.snapshot!;
    const loc = findLiveFor(s.state, s.lives, managerId)!;
    return s.lives[loc.index][loc.side];
  };
  const btn = (id: string) => screen.getByRole("button", { name: `${playerName(controller.snapshot!.state.players[id])} ${id}` });
  return { controller, managerId, side, btn };
}

describe("Halbzeit", () => {
  it("zeigt Manager und Spielstand", async () => {
    const { side } = await atHalftime();
    expect(screen.getByText("HALBZEIT · Anna")).toBeTruthy();
    expect(screen.getByText(new RegExp(`${side().goals}:`))).toBeTruthy();
  });

  it("plant einen Wechsel, führt ihn bei „Fertig“ aus und geht zur 2. Halbzeit", async () => {
    const { controller, side, btn } = await atHalftime();
    const out = side().pitch[6].id;
    const inId = side().bench[2];
    await fireEvent.click(btn(out));
    await fireEvent.click(btn(inId));
    expect(screen.getByText("Wechsel übrig: 4")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Fertig (Enter)" }));
    await tick();
    expect(controller.view).toEqual({ kind: "conference", half: 2 });
    expect(side().played).toContain(inId);
  });

  it("geplante Wechsel lassen sich wieder entfernen", async () => {
    const { side, btn } = await atHalftime();
    await fireEvent.click(btn(side().pitch[3].id));
    await fireEvent.click(btn(side().bench[1]));
    await fireEvent.click(screen.getByRole("button", { name: "Wechsel entfernen" }));
    expect(screen.getByText("Wechsel übrig: 5")).toBeTruthy();
  });

  it("ändert die Spielweise", async () => {
    const { side } = await atHalftime();
    await fireEvent.click(screen.getByRole("button", { name: "offensiv" }));
    await fireEvent.keyDown(window, { key: "Enter" });
    await tick();
    expect(side().tactics.style).toBe("offensive");
  });

  it("ohne freie Wechsel: Meldung, „Fertig“ geht trotzdem", async () => {
    const { controller, side, btn } = await atHalftime();
    side().subsUsed = 5; // Testaufbau: alle Wechsel schon durch Verletzungen verbraucht
    await fireEvent.click(btn(side().pitch[4].id));
    await fireEvent.click(btn(side().bench[0]));
    expect(screen.getByText("Keine Wechsel mehr übrig.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Fertig (Enter)" }));
    await tick();
    expect(controller.view.kind).toBe("conference");
  });

  it("im Hot-Seat kommt danach der zweite Manager mit leerem Entwurf", async () => {
    const { controller, side, btn } = await atHalftime(["Anna", "Ben"]);
    await fireEvent.click(btn(side().pitch[2].id));
    await fireEvent.click(btn(side().bench[1]));
    await fireEvent.click(screen.getByRole("button", { name: "Fertig (Enter)" }));
    await tick();
    expect(controller.view).toEqual({ kind: "halftime", managerId: controller.snapshot!.state.managers[1].id });
    expect(screen.getByText("HALBZEIT · Ben")).toBeTruthy();
    expect(screen.getByText("Wechsel übrig: 5")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/halftime.test.ts`
Expected: FAIL, weil „HALBZEIT · Anna“ nicht gefunden wird (Platzhalter).

- [ ] **Step 3: Implementieren**

`src/ui/screens/Halftime.svelte`:

```svelte
<script lang="ts">
  import { findLiveFor } from "../../engine/commands";
  import { FORMATION_LIST, type ManagerId, type PlayerId, type Style, type Tactics } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { POSITION_LABEL, STYLE_LABEL, fitnessText, playerName } from "../logic/format";
  import { addSub, currentBench, currentPitch, emptyDraft, remainingSubs, removeSub, toCommand, type HalftimeDraft } from "../logic/halftimeDraft";
  import Panel from "../theme/Panel.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const STYLES: Style[] = ["defensive", "normal", "offensive"];
  const state = $derived(controller.snapshot!.state);
  const lives = $derived(controller.snapshot!.lives);
  const loc = $derived(findLiveFor(state, lives, managerId));
  const live = $derived(loc ? lives[loc.index] : null);
  const side = $derived(live && loc ? live[loc.side] : null);

  let draft = $state<HalftimeDraft>(emptyDraft());
  let pickedOut = $state<PlayerId | null>(null);
  let note = $state<string | null>(null);
  let busy = false;

  const pitch = $derived(side ? currentPitch(side, draft) : []);
  const bench = $derived(side ? currentBench(side, draft) : []);
  const tactics = $derived<Tactics | null>(side ? { ...side.tactics, ...draft.tactics } : null);
  const name = (id: PlayerId) => playerName(state.players[id]);

  function pickPitch(id: PlayerId): void {
    pickedOut = pickedOut === id ? null : id;
    note = null;
  }

  function pickBench(id: PlayerId): void {
    if (!side) return;
    if (!pickedOut) {
      note = "Erst einen Spieler auf dem Platz wählen.";
      return;
    }
    const r = addSub(side, draft, pickedOut, id);
    pickedOut = null;
    if (typeof r === "string") note = r;
    else {
      draft = r;
      note = null;
    }
  }

  function setTactics(patch: Partial<Tactics>): void {
    draft = { ...draft, tactics: { ...draft.tactics, ...patch } };
  }

  async function done(): Promise<void> {
    if (busy) return;
    busy = true;
    const cmd = toCommand(managerId, draft);
    if (cmd && !(await controller.send(cmd))) {
      busy = false;
      return;
    }
    await controller.endTurn(managerId);
    busy = false;
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      void done();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="halftime">
  <div class="bar">
    <span>HALBZEIT · {controller.managerName(managerId)}</span>
    {#if live}
      <span>{state.clubs[live.home.club].shortName} {live.home.goals}:{live.away.goals} {state.clubs[live.away.club].shortName}</span>
    {/if}
  </div>
  {#if side && tactics}
    <div class="body">
      <Panel title="AUF DEM PLATZ">
        <ul>
          {#each pitch as pp (pp.id)}
            <li class:picked={pickedOut === pp.id}>
              <span class="slot">{POSITION_LABEL[pp.slot]}</span>
              <button class="name" aria-label="{name(pp.id)} {pp.id}" onclick={() => pickPitch(pp.id)}>{name(pp.id)}</button>
              <span class="fit">{fitnessText(side.fitness[pp.id] ?? state.players[pp.id].fitness)}</span>
              <span class="card">{side.booked.includes(pp.id) ? "G" : ""}</span>
            </li>
          {/each}
        </ul>
      </Panel>
      <Panel title="BANK">
        <ul>
          {#each bench as id (id)}
            <li>
              <span class="slot">{POSITION_LABEL[state.players[id].position]}</span>
              <button class="name" aria-label="{name(id)} {id}" onclick={() => pickBench(id)}>{name(id)}</button>
            </li>
          {/each}
        </ul>
      </Panel>
      <div class="side">
        <Panel title="WECHSEL">
          <span>Wechsel übrig: {remainingSubs(side, draft)}</span>
          {#each draft.subs as s, i (s.out + s.in)}
            <div class="sub">
              <span>{name(s.in)} für {name(s.out)}</span>
              <button class="btn x" aria-label="Wechsel entfernen" onclick={() => (draft = removeSub(draft, i))}>✕</button>
            </div>
          {/each}
        </Panel>
        <Panel title="TAKTIK">
          <div class="opts">
            {#each FORMATION_LIST as f (f)}
              <button class="btn" class:selected={tactics.formation === f} onclick={() => setTactics({ formation: f })}>{f}</button>
            {/each}
          </div>
          <div class="opts">
            {#each STYLES as st (st)}
              <button class="btn" class:selected={tactics.style === st} onclick={() => setTactics({ style: st })}>{STYLE_LABEL[st]}</button>
            {/each}
          </div>
        </Panel>
      </div>
    </div>
  {:else}
    <p class="none">Dein Verein spielt heute nicht.</p>
  {/if}
  <div class="foot">
    {#if note}<span class="msg">{note}</span>{/if}
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn primary" onclick={() => void done()}>Fertig (Enter)</button>
  </div>
</div>

<style>
  .halftime { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
  .bar {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-display);
    font-size: 8px;
    color: var(--gold);
    background: var(--wood);
    border: 3px solid var(--wood-edge);
    padding: 6px 8px;
  }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 150px 190px; gap: 6px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; overflow-y: auto; }
  li { display: grid; grid-template-columns: 30px 1fr 36px 12px; gap: 4px; }
  li.picked { background: var(--rust); }
  .slot { color: var(--leaf); }
  .fit { text-align: right; font-variant-numeric: tabular-nums; }
  .card { color: var(--gold); }
  .name { all: unset; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name:focus-visible { outline: 1px solid var(--gold); }
  .side { display: flex; flex-direction: column; gap: 6px; }
  .sub { display: flex; justify-content: space-between; align-items: center; gap: 4px; }
  .x { padding: 0 4px; }
  .opts { display: flex; flex-wrap: wrap; gap: 3px; }
  .opts .btn { padding: 0 4px; }
  .foot { display: flex; align-items: center; gap: 6px; }
  .spacer { flex: 1; }
  .none { flex: 1; }
</style>
```

In `src/App.svelte` den Import ergänzen:

```ts
  import Halftime from "./ui/screens/Halftime.svelte";
```

Dann vor der Zeile `{:else}` einfügen:

```svelte
  {:else if view.kind === "halftime"}
    {#key view.managerId}<Halftime {controller} managerId={view.managerId} />{/key}
```

- [ ] **Step 4: Tests und Typprüfung laufen lassen**

Run: `npx vitest run tests/ui/halftime.test.ts && npm run check`
Expected: alle Tests PASS, `svelte-check` meldet 0 Fehler und 0 Warnungen

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/ui/screens/Halftime.svelte tests/ui/halftime.test.ts
git commit -m "feat(ui): Halbzeit mit Wechseln und Taktik"
```

---

### Task 13: Auswertung, Saisonende und kompletter Ablauf

**Files:**
- Create: `src/ui/screens/Results.svelte`, `src/ui/screens/SeasonEnd.svelte`
- Modify: `src/App.svelte` (komplett ersetzen, ohne Platzhalter)
- Test: `tests/ui/flow.test.ts`

**Interfaces:**
- Consumes: `GameController` (Task 6), `tickerRows`, `competitionsOf`, `competitionName` (Task 4), `leagueOf` (engine/season), `Panel`, alle Bildschirme aus den Tasks 7–12
- Produces:
  - `Results.svelte` mit der Prop `{ controller }`:
    - **Titel:** „ERGEBNISSE · {Spieltag}“.
    - **Ergebnisse:** je Wettbewerb eine Holztafel mit den Endständen (Kurznamen). Bei der Relegation steht ein Elfmeterschießen in Klammern dahinter.
    - **Hinweise** (`snapshot.notices`): als Liste „Manager: Text“.
    - **Tasten:** „Tabelle“ ruft `controller.setResultsTables(true)` auf, „Weiter (Enter)“ ruft einmalig `controller.advance()` auf.
  - `SeasonEnd.svelte` mit der Prop `{ controller }`:
    - **Inhalt:** „SAISON N BEENDET“, die Meister beider Ligen, Aufsteiger, Absteiger, beide Torschützenkönige und für jeden Manager seinen Verein mit der Liga der neuen Saison.
    - **Taste:** „Neue Saison (Enter)“ ruft einmalig `controller.advance()` auf.
  - `App.svelte`: alle Zweige, ohne Platzhalter.

- [ ] **Step 1: Failing Test schreiben**

`tests/ui/flow.test.ts`:

```ts
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

/** Taste drücken und warten, bis asynchrone Befehle (endTurn) und das Neuzeichnen durch sind. */
const key = async (k: string) => {
  await fireEvent.keyDown(window, { key: k });
  await new Promise((r) => setTimeout(r, 0));
  await tick();
};

describe("kompletter Ablauf über die Oberfläche", () => {
  it("zwei Manager spielen einen Spieltag von „Neues Spiel“ bis zum nächsten „ist dran“", async () => {
    const controller = new GameController();
    render(App, { controller });
    await fireEvent.click(screen.getByRole("button", { name: "2" }));
    await fireEvent.input(screen.getByLabelText("Name Manager 1"), { target: { value: "Anna" } });
    await fireEvent.input(screen.getByLabelText("Name Manager 2"), { target: { value: "Ben" } });
    const s1 = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    const s2 = screen.getByLabelText("Verein Manager 2") as HTMLSelectElement;
    await fireEvent.change(s1, { target: { value: s1.querySelectorAll("option")[1].value } });
    await fireEvent.change(s2, { target: { value: s2.querySelectorAll("option")[25].value } });
    await fireEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    await tick();

    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
    await key("Enter"); // → Hauptmenü
    await key("Enter"); // Weiter
    expect(screen.getByText("BEN IST DRAN")).toBeTruthy();
    await key("Enter");
    await key("Enter");

    expect(controller.view).toEqual({ kind: "conference", half: 1 });
    await key(" ");
    await key("Enter");
    expect(screen.getByText("HALBZEIT · Anna")).toBeTruthy();
    await key("Enter");
    expect(screen.getByText("HALBZEIT · Ben")).toBeTruthy();
    await key("Enter");

    expect(controller.view).toEqual({ kind: "conference", half: 2 });
    await key(" ");
    await key("Enter");

    expect(screen.getByText("ERGEBNISSE · 1. Spieltag")).toBeTruthy();
    expect(document.querySelectorAll(".result")).toHaveLength(18);
    await fireEvent.click(screen.getByRole("button", { name: "Tabelle" }));
    await tick();
    expect(screen.getByRole("table", { name: "Tabelle" })).toBeTruthy();
    await key("Escape");
    expect(screen.getByText("ERGEBNISSE · 1. Spieltag")).toBeTruthy();
    await key("Enter");

    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
    expect(screen.getByText(/Saison 1 · 2\. Spieltag/)).toBeTruthy();
  });

  it("nach 36 Spieltagen erscheint das Saisonende, danach beginnt Saison 2", { timeout: 120_000 }, async () => {
    const controller = new GameController();
    const world = generateWorld(13);
    controller.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
    const anna = controller.snapshot!.state.managers[0].id;
    for (let i = 0; i < 36; i++) {
      await controller.endTurn(anna);
      controller.advance();
      if (controller.view.kind === "halftime") await controller.endTurn(anna);
      controller.advance();
      controller.advance();
    }
    expect(controller.view.kind).toBe("seasonEnd");
    render(App, { controller });
    await tick();
    expect(screen.getByText("SAISON 1 BEENDET")).toBeTruthy();
    expect(screen.getByText(/Meister 1\. Liga/)).toBeTruthy();
    expect(screen.getByText(/Aufsteiger/)).toBeTruthy();
    expect(screen.getByText(/Absteiger/)).toBeTruthy();
    await key("Enter");
    expect(controller.view.kind).toBe("turnStart");
    expect(screen.getByText(/Saison 2 · 1\. Spieltag/)).toBeTruthy();
  });

  it("Hinweise aus der Spieltagsvorbereitung erscheinen in der Auswertung", async () => {
    const controller = new GameController();
    const world = generateWorld(17);
    const clubId = Object.keys(world.clubs)[0];
    const victim = world.clubs[clubId].lineup.starters[3];
    world.players[victim].injury = { matchesLeft: 2 };
    controller.startGame(world, [{ name: "Anna", clubId }]);
    await controller.endTurn(controller.snapshot!.state.managers[0].id);
    controller.advance();
    await controller.endTurn(controller.snapshot!.state.managers[0].id);
    controller.advance();
    render(App, { controller });
    await tick();
    expect(screen.getByText(new RegExp(`Anna: Aufstellung ergänzt: ${world.players[victim].lastName}`))).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `npx vitest run tests/ui/flow.test.ts`
Expected: FAIL, weil „ERGEBNISSE · 1. Spieltag“ bzw. „SAISON 1 BEENDET“ nicht gefunden werden.

- [ ] **Step 3: Implementieren**

`src/ui/screens/Results.svelte`:

```svelte
<script lang="ts">
  import { COMP } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { competitionName, competitionsOf, tickerRows } from "../logic/ticker";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();
  let advanced = false;

  const snap = $derived(controller.snapshot!);
  const state = $derived(snap.state);
  const rows = $derived(tickerRows(state, snap.lives, 90));
  const comps = $derived(competitionsOf(snap.lives));

  const title = $derived.by(() => {
    const l = snap.lives[0];
    if (!l) return "";
    if (l.competitionId === COMP.relegation) return "Relegation";
    const m = state.competitions[l.competitionId].matches.find((x) => x.id === l.matchId);
    return `${m?.round ?? "?"}. Spieltag`;
  });

  function penalties(matchId: string, competitionId: string): string {
    const m = state.competitions[competitionId]?.matches.find((x) => x.id === matchId);
    return m?.penalties ? ` (i.E. ${m.penalties.home}:${m.penalties.away})` : "";
  }

  function next(): void {
    if (advanced) return;
    advanced = true;
    controller.advance();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      next();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="results">
  <h1>ERGEBNISSE · {title}</h1>
  <div class="cols">
    {#each comps as c (c)}
      <Panel title={competitionName(state, c).toUpperCase()}>
        {#each rows.filter((r) => r.competitionId === c) as r (r.matchId)}
          <div class="result" class:managed={r.managed}>
            <span class="home">{state.clubs[r.homeClub].shortName}</span>
            <span class="score">{r.homeGoals}:{r.awayGoals}{penalties(r.matchId, c)}</span>
            <span class="away">{state.clubs[r.awayClub].shortName}</span>
          </div>
        {/each}
      </Panel>
    {/each}
  </div>
  {#if snap.notices.length > 0}
    <Panel title="HINWEISE">
      {#each snap.notices as n, i (i)}
        <p class="notice">{controller.managerName(n.managerId)}: {n.text}</p>
      {/each}
    </Panel>
  {/if}
  <div class="foot">
    <button class="btn" onclick={() => controller.setResultsTables(true)}>Tabelle</button>
    <span class="spacer"></span>
    <button class="btn primary" onclick={next}>Weiter (Enter)</button>
  </div>
</div>

<style>
  .results { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
  h1 { font-size: 8px; }
  .cols { flex: 1; min-height: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; }
  .result { display: grid; grid-template-columns: 1fr 70px 1fr; gap: 4px; font-size: 17px; }
  .home { text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .away { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { text-align: center; color: var(--gold); font-variant-numeric: tabular-nums; }
  .result.managed .home,
  .result.managed .away { color: var(--gold); }
  .notice { margin: 0; }
  .foot { display: flex; gap: 6px; }
  .spacer { flex: 1; }
</style>
```

`src/ui/screens/SeasonEnd.svelte`:

```svelte
<script lang="ts">
  import { COMP, type ClubId } from "../../engine/model";
  import { leagueOf } from "../../engine/season";
  import type { GameController } from "../controller.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();
  let advanced = false;

  const snap = $derived(controller.snapshot!);
  const state = $derived(snap.state);
  const record = $derived(snap.phase.kind === "seasonEnd" ? snap.phase.record : null);
  const names = (ids: ClubId[]) => ids.map((id) => state.clubs[id].name).join(", ");

  function scorer(competitionId: string): string {
    const s = record?.topScorers[competitionId];
    if (!s) return "–";
    const p = state.players[s.player];
    return `${p ? `${p.firstName} ${p.lastName}` : "?"} (${s.goals} Tore)`;
  }

  function next(): void {
    if (advanced) return;
    advanced = true;
    controller.advance();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      next();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if record}
  <div class="seasonend">
    <h1>SAISON {record.season} BEENDET</h1>
    <div class="cols">
      <Panel title="CHRONIK">
        <p>Meister 1. Liga: <b>{state.clubs[record.champions[COMP.first]].name}</b></p>
        <p>Meister 2. Liga: <b>{state.clubs[record.champions[COMP.second]].name}</b></p>
        <p>Aufsteiger: {names(record.promoted)}</p>
        <p>Absteiger: {names(record.relegated)}</p>
        <p>Torschützenkönig 1. Liga: {scorer(COMP.first)}</p>
        <p>Torschützenkönig 2. Liga: {scorer(COMP.second)}</p>
      </Panel>
      <Panel title="MANAGER">
        {#each state.managers as m (m.id)}
          {@const league = m.clubId ? leagueOf(state, m.clubId) : null}
          <p>{m.name}: {m.clubId ? state.clubs[m.clubId].name : "ohne Verein"}{league ? ` – nächste Saison ${state.competitions[league].name}` : ""}</p>
        {/each}
      </Panel>
    </div>
    <div class="foot">
      <span class="spacer"></span>
      <button class="btn primary" onclick={next}>Neue Saison (Enter)</button>
    </div>
  </div>
{/if}

<style>
  .seasonend { display: flex; flex-direction: column; height: 100%; padding: 12px; box-sizing: border-box; gap: 8px; }
  .cols { flex: 1; display: grid; grid-template-columns: 3fr 2fr; gap: 8px; min-height: 0; }
  p { margin: 0; font-size: 17px; }
  b { color: var(--gold); font-weight: normal; }
  .foot { display: flex; }
  .spacer { flex: 1; }
</style>
```

`src/App.svelte` komplett ersetzen:

```svelte
<script lang="ts">
  import type { GameController } from "./ui/controller.svelte";
  import Conference from "./ui/screens/Conference.svelte";
  import Halftime from "./ui/screens/Halftime.svelte";
  import MainMenu from "./ui/screens/MainMenu.svelte";
  import NewGame from "./ui/screens/NewGame.svelte";
  import Results from "./ui/screens/Results.svelte";
  import SeasonEnd from "./ui/screens/SeasonEnd.svelte";
  import Squad from "./ui/screens/Squad.svelte";
  import Tables from "./ui/screens/Tables.svelte";
  import TurnStart from "./ui/screens/TurnStart.svelte";
  import Screen from "./ui/theme/Screen.svelte";

  let { controller }: { controller: GameController } = $props();
  const view = $derived(controller.view);
</script>

<Screen>
  {#if view.kind === "newGame"}
    <NewGame {controller} />
  {:else if view.kind === "turnStart"}
    {#key view.managerId}<TurnStart {controller} managerId={view.managerId} />{/key}
  {:else if view.kind === "menu"}
    <MainMenu {controller} managerId={view.managerId} />
  {:else if view.kind === "squad"}
    <Squad {controller} managerId={view.managerId} />
  {:else if view.kind === "tables"}
    <Tables {controller} managerId={view.managerId} onBack={() => controller.open("menu")} />
  {:else if view.kind === "conference"}
    {#key view.half}<Conference {controller} half={view.half} />{/key}
  {:else if view.kind === "halftime"}
    {#key view.managerId}<Halftime {controller} managerId={view.managerId} />{/key}
  {:else if view.kind === "results"}
    <Results {controller} />
  {:else if view.kind === "resultsTables"}
    <Tables {controller} managerId={null} onBack={() => controller.setResultsTables(false)} />
  {:else if view.kind === "seasonEnd"}
    <SeasonEnd {controller} />
  {/if}
</Screen>
```

- [ ] **Step 4: Ablauftest laufen lassen**

Run: `npx vitest run tests/ui/flow.test.ts`
Expected: alle Tests PASS

- [ ] **Step 5: Gesamtprüfung**

Run: `npx vitest run && npm run check && npm run build`
Expected:
- alle Tests PASS (Engine und UI)
- `svelte-check` meldet 0 Fehler und 0 Warnungen
- der Build ist erfolgreich

- [ ] **Step 6: Prüfen, dass Engine, Session und Transport unverändert sind**

Run: `git diff --stat main -- src/engine src/session src/transport`
Expected: keine Ausgabe

- [ ] **Step 7: Commit**

```bash
git add src/App.svelte src/ui/screens/Results.svelte src/ui/screens/SeasonEnd.svelte tests/ui/flow.test.ts
git commit -m "feat(ui): Auswertung, Saisonende und kompletter Spielablauf"
```

---

## Manuell ausprobieren

```bash
npm run dev
```

Dann im Browser die angezeigte Adresse öffnen und dieser Spur folgen:
1. Neues Spiel mit 2 Managern anlegen.
2. Je eine Runde im Menü drehen. In der Mannschaft zwei Spieler tauschen und die Formation wechseln.
3. Die Konferenz anschauen: TAB wechselt die Liga, + und − ändern das Tempo, die Leertaste überspringt.
4. In der Halbzeit wechseln.
5. Auswertung und Tabelle ansehen.
6. Das Fenster kleiner und größer ziehen: Die Fläche skaliert und es erscheint nie ein Scrollbalken.

## Nach diesem Plan

- **Plan 3:** Wirtschaft (Training, Finanzen, Verträge mit Verhandlung, Transfermarkt, Vorstand mit Entlassung und Jobangeboten, Nachrichten). Die gesperrten Kacheln werden freigeschaltet. Offene Punkte aus Plan 1:
  - Die Torquote im Ligabetrieb nachbalancieren.
  - Entlassene Manager in die Manager-Runden aufnehmen.
- **Plan 4:** Speichern und Laden (IndexedDB, Autosave, Export/Import), Optionen (Scanlines, Tempo, Ton), Playwright-Tests.

