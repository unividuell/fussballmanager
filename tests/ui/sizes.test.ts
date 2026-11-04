import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Dateien, die schon auf 1280×800 umgerechnet sind (Pfade relativ zum Projektordner).
// Spätere Aufgaben erweitern diese Liste.
const CONVERTED: string[] = [
  "src/ui/theme/theme.css",
  "src/ui/theme/Panel.svelte",
  "src/ui/theme/Dialog.svelte",
  "src/ui/theme/Tile.svelte",
  "src/ui/theme/Crest.svelte",
  "src/ui/theme/Screen.svelte",
];

const root = resolve(__dirname, "../..");

type Rule = { selector: string; declarations: string };

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function cssOf(path: string, text: string): string {
  if (path.endsWith(".css")) return text;
  return [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
}

function rulesOf(css: string): Rule[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), declarations: m[2] }));
}

function isDisplay(rule: Rule): boolean {
  return rule.declarations.includes("--font-display") || /(^|[^\w-])h[123]($|[^\w-])/.test(rule.selector);
}

function fontSizes(rule: Rule): number[] {
  return [...rule.declarations.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
}

function otherPx(rule: Rule): { prop: string; value: number }[] {
  const found: { prop: string; value: number }[] = [];
  for (const decl of rule.declarations.split(";")) {
    const prop = decl.split(":")[0].trim();
    if (prop === "font-size") continue;
    for (const m of decl.matchAll(/(\d+(?:\.\d+)?)px/g)) found.push({ prop, value: Number(m[1]) });
  }
  return found;
}

describe("Maße für 1280×800", () => {
  for (const path of CONVERTED) {
    describe(path, () => {
      const text = read(path);
      const rules = rulesOf(cssOf(path, text));

      it("Überschriftenschrift mindestens 16 px und gerade", () => {
        const bad: string[] = [];
        for (const rule of rules.filter(isDisplay)) {
          for (const n of fontSizes(rule)) {
            if (!(n >= 16 && n % 2 === 0)) bad.push(`${path}: ${rule.selector} font-size ${n}`);
          }
        }
        expect(bad).toEqual([]);
      });

      it("Fließtext mindestens 20 px", () => {
        const bad: string[] = [];
        for (const rule of rules.filter((r) => !isDisplay(r))) {
          for (const n of fontSizes(rule)) {
            if (!(n >= 20)) bad.push(`${path}: ${rule.selector} font-size ${n}`);
          }
        }
        expect(bad).toEqual([]);
      });

      it("übrige Maße gerade", () => {
        const bad: string[] = [];
        for (const rule of rules) {
          for (const { prop, value } of otherPx(rule)) {
            if (value !== 0 && value % 2 !== 0) bad.push(`${path}: ${rule.selector} ${prop} ${value}px`);
          }
        }
        expect(bad).toEqual([]);
      });

      it("Wappen mindestens 32 px", () => {
        const bad: string[] = [];
        for (const tag of text.matchAll(/<Crest\b((?:[^>{]|\{[^}]*\})*)/g)) {
          const size = tag[1].match(/\bsize=\{\s*(\d+)\s*\}/);
          if (size && !(Number(size[1]) >= 32 && Number(size[1]) % 2 === 0)) bad.push(`${path}: Crest size ${size[1]}`);
        }
        if (path.endsWith("/Crest.svelte")) {
          if (!/\bsize\s*=\s*32\b/.test(text)) bad.push(`${path}: Default size ist nicht 32`);
        }
        expect(bad).toEqual([]);
      });
    });
  }
});
