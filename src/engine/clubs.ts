import type { CrestPattern } from "./model";

export type StartLeague = "L1" | "L2" | "L3";

export interface ClubSeed {
  name: string;
  /** für enge Anzeigen (Live, Tabellen) */
  shortName: string;
  colors: [string, string];
  crest: CrestPattern;
  /** Ruf 1–100: Tradition, Fans, Geld – bestimmt alles Wirtschaftliche und die Erwartung des Vorstands */
  reputation: number;
  /** Kaderstärke 1–100 auf der Skala von baseStrengthFor – nur für die Spielererzeugung beim Spielstart */
  strength: number;
  /** Liga zum Spielstart (Saison 2026/27) */
  league: StartLeague;
}

const W = "#ffffff";
const B = "#1a1a1a";
const RED = "#e30613";
const BLUE = "#005ca9";

const c = (
  name: string,
  shortName: string,
  colors: [string, string],
  crest: CrestPattern,
  reputation: number,
  strength: number,
  league: StartLeague,
): ClubSeed => ({ name, shortName, colors, crest, reputation, strength, league });

/** Teilnehmer 2026/27 laut Wikipedia (Stand 8. November 2026); 3. Liga ohne die Zweitvertretungen von Hoffenheim und Stuttgart. */
export const CLUBS: readonly ClubSeed[] = [
  // Bundesliga
  c("FC Bayern München", "Bayern", ["#dc052d", W], "plain", 98, 96, "L1"),
  c("Borussia Dortmund", "Dortmund", ["#fde100", B], "plain", 92, 88, "L1"),
  c("SC Freiburg", "Freiburg", [RED, B], "split", 76, 80, "L1"),
  c("RB Leipzig", "Leipzig", ["#dd0741", W], "sash", 84, 86, "L1"),
  c("Bayer 04 Leverkusen", "Leverkusen", [RED, B], "hoops", 86, 87, "L1"),
  c("Werder Bremen", "Bremen", ["#1d9053", W], "plain", 84, 76, "L1"),
  c("SV Elversberg", "Elversberg", [B, W], "stripes", 40, 68, "L1"),
  c("VfB Stuttgart", "Stuttgart", [W, RED], "hoops", 82, 82, "L1"),
  c("TSG 1899 Hoffenheim", "Hoffenheim", ["#1c63b7", W], "split", 74, 79, "L1"),
  c("Eintracht Frankfurt", "Frankfurt", [RED, B], "stripes", 84, 81, "L1"),
  c("Hamburger SV", "HSV", ["#0a3f86", W], "sash", 88, 73, "L1"),
  c("1. FSV Mainz 05", "Mainz", ["#c3141e", W], "plain", 68, 74, "L1"),
  c("SC Paderborn 07", "Paderborn", [BLUE, B], "stripes", 52, 66, "L1"),
  c("FC Augsburg", "Augsburg", ["#ba3733", "#46714d"], "stripes", 64, 71, "L1"),
  c("1. FC Köln", "Köln", [RED, W], "split", 84, 71, "L1"),
  c("1. FC Union Berlin", "Union", ["#eb1923", "#ffd700"], "plain", 70, 72, "L1"),
  c("FC Schalke 04", "Schalke", ["#004d9d", W], "hoops", 90, 70, "L1"),
  c("Borussia Mönchengladbach", "Gladbach", [B, "#00a650"], "sash", 84, 72, "L1"),
  // 2. Bundesliga
  c("Hertha BSC", "Hertha", [BLUE, W], "stripes", 86, 58, "L2"),
  c("1. FC Nürnberg", "Nürnberg", ["#a6192e", B], "split", 80, 52, "L2"),
  c("1. FC Kaiserslautern", "Lautern", [RED, W], "plain", 80, 55, "L2"),
  c("1. FC Magdeburg", "Magdeburg", [BLUE, W], "hoops", 62, 50, "L2"),
  c("VfL Wolfsburg", "Wolfsburg", ["#65b32e", W], "plain", 76, 60, "L2"),
  c("Arminia Bielefeld", "Bielefeld", [BLUE, B], "hoops", 66, 48, "L2"),
  c("1. FC Heidenheim", "Heidenheim", [RED, "#003b79"], "sash", 48, 56, "L2"),
  c("VfL Bochum", "Bochum", [BLUE, W], "split", 70, 54, "L2"),
  c("FC St. Pauli", "St. Pauli", ["#6b3f2a", W], "plain", 76, 57, "L2"),
  c("SpVgg Greuther Fürth", "Fürth", ["#009a44", W], "stripes", 52, 46, "L2"),
  c("Hannover 96", "Hannover", ["#c8102e", B], "sash", 76, 51, "L2"),
  c("Energie Cottbus", "Cottbus", [RED, W], "hoops", 54, 44, "L2"),
  c("Eintracht Braunschweig", "Braunschweig", ["#f4d313", "#0055a4"], "split", 66, 45, "L2"),
  c("VfL Osnabrück", "Osnabrück", ["#6b2d8b", W], "plain", 50, 42, "L2"),
  c("Dynamo Dresden", "Dresden", ["#fdd708", B], "plain", 72, 47, "L2"),
  c("Karlsruher SC", "Karlsruhe", [BLUE, W], "sash", 66, 49, "L2"),
  c("SV Darmstadt 98", "Darmstadt", [BLUE, W], "stripes", 54, 53, "L2"),
  c("Holstein Kiel", "Kiel", [BLUE, RED], "hoops", 54, 50, "L2"),
  // 3. Liga
  c("Viktoria Köln", "Viktoria", [RED, W], "hoops", 36, 34, "L3"),
  c("MSV Duisburg", "Duisburg", [BLUE, W], "hoops", 70, 33, "L3"),
  c("Rot-Weiss Essen", "Essen", [RED, W], "sash", 66, 32, "L3"),
  c("SV Wehen Wiesbaden", "Wiesbaden", [RED, B], "plain", 42, 31, "L3"),
  c("FC Ingolstadt 04", "Ingolstadt", [RED, B], "split", 50, 31, "L3"),
  c("1. FC Saarbrücken", "Saarbrücken", [BLUE, B], "plain", 56, 30, "L3"),
  c("Alemannia Aachen", "Aachen", ["#f9e200", B], "stripes", 64, 29, "L3"),
  c("SV Waldhof Mannheim", "Mannheim", [BLUE, B], "stripes", 56, 28, "L3"),
  c("Hansa Rostock", "Rostock", [BLUE, W], "split", 70, 30, "L3"),
  c("SV Meppen", "Meppen", [BLUE, W], "plain", 38, 24, "L3"),
  c("Fortuna Düsseldorf", "Düsseldorf", [RED, W], "plain", 78, 38, "L3"),
  c("Preußen Münster", "Münster", ["#00843d", B], "hoops", 52, 27, "L3"),
  c("Würzburger Kickers", "Würzburg", [RED, W], "stripes", 40, 26, "L3"),
  c("SSV Jahn Regensburg", "Regensburg", [RED, W], "split", 46, 28, "L3"),
  c("SC Verl", "Verl", [B, W], "sash", 28, 30, "L3"),
  c("SG Sonnenhof Großaspach", "Großaspach", [RED, B], "hoops", 24, 20, "L3"),
  c("SC Fortuna Köln", "Fortuna Köln", [RED, W], "sash", 32, 22, "L3"),
  c("TSV Havelse", "Havelse", [BLUE, W], "stripes", 20, 18, "L3"),
];
