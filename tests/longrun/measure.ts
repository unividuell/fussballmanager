import { computeStandings } from "../../src/engine/competition/standings";
import { isOverLimit, marketValue } from "../../src/engine/economy/money";
import { STADIUM } from "../../src/engine/economy/stadium";
import { generateWorld } from "../../src/engine/generator";
import { LEAGUES, type ClubId, type GameState } from "../../src/engine/model";
import { aiHalftimeAll, finishMatchday, finishSeason, isSeasonOver, kickOff, playHalf, prepareMatchday, startNewGame } from "../../src/engine/season";

export interface SeasonMetrics {
  season: number;
  aiMedianBalance: number;
  aiMaxBalance: number;
  aiOverLimit: number;
  /** Kassenbuch der Saison ohne Transfers, Stadionbau und Spielerprämien (Platzprämien am Saisonende nicht enthalten) */
  resultBeforeTransfers: Record<ClubId, number>;
  /** Einnahmen der Saison aus Tickets, TV-Geld und Sponsor */
  income: Record<ClubId, number>;
  /** Ø Zuschauer / Kapazität der Heimspiele */
  utilization: Record<ClubId, number>;
  /** Abschlusstabellen der Saison */
  tables: Record<string, ClubId[]>;
  /** absteigend, Top 10 */
  topMarketValues: number[];
  balances: Record<ClubId, number>;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Hilfsschritt pro Spieltag, z. B. um Verträge eines Manager-Vereins zu pflegen. */
export type Hook = (state: GameState) => void;

/** Spielt mehrere Saisons und misst die Wirtschaft. Ohne Manager übernimmt ein Platzhalter einen schwachen Zweitligisten. */
export function runSeasons(
  seed: number,
  seasons: number,
  managers?: { name: string; clubId: ClubId }[],
  hook?: Hook,
): { metrics: SeasonMetrics[]; start: { aiMedianBalance: number }; state: GameState } {
  const world = generateWorld(seed);
  const r = startNewGame(world, managers ?? [{ name: "Test", clubId: Object.keys(world.clubs)[34] }]);
  if (!r.ok) throw new Error(r.error);
  let s = r.state;
  const aiBalances = (st: GameState) => Object.values(st.clubs).filter((c) => c.managerId === null).map((c) => c.finance.balance);
  const start = { aiMedianBalance: median(aiBalances(s)) };
  const metrics: SeasonMetrics[] = [];
  for (let season = 1; season <= seasons; season++) {
    const load: Record<ClubId, number[]> = {};
    while (!isSeasonOver(s)) {
      hook?.(s);
      s = prepareMatchday(s).state;
      let lives = kickOff(s);
      ({ state: s, lives } = playHalf(s, lives, 1));
      lives = aiHalftimeAll(s, lives);
      ({ state: s, lives } = playHalf(s, lives, 2));
      s = finishMatchday(s, lives);
      for (const l of lives) {
        const f = s.clubs[l.home.club].finance;
        (load[l.home.club] ??= []).push(f.lastAttendance / STADIUM[f.stadiumStage].capacity);
      }
    }
    const resultBeforeTransfers: Record<ClubId, number> = {};
    const income: Record<ClubId, number> = {};
    for (const c of Object.values(s.clubs)) {
      income[c.id] = c.finance.ledger.filter((e) => e.category === "tickets" || e.category === "tv" || e.category === "sponsor").reduce((a, e) => a + e.amount, 0);
      resultBeforeTransfers[c.id] = c.finance.ledger.filter((e) => e.category !== "transfers" && e.category !== "stadium" && e.category !== "premiums").reduce((a, e) => a + e.amount, 0);
    }
    const tables: Record<string, ClubId[]> = Object.fromEntries(LEAGUES.map((l) => [l, computeStandings(s.competitions[l]).map((x) => x.club)]));
    const utilization: Record<ClubId, number> = {};
    for (const [id, xs] of Object.entries(load)) utilization[id] = xs.reduce((a, b) => a + b, 0) / xs.length;
    const topMarketValues = Object.values(s.players)
      .filter((p) => p.clubId !== null)
      .map((p) => marketValue(p, s.season))
      .sort((a, b) => b - a)
      .slice(0, 10);
    // KI-Kontostände am Saisonende, vor Saisonabschluss und Sommer-Transfermarkt: Ein Verkauf im Sommer erzeugt sonst
    // eine kurze Spitze, die die Spielerprämien in der Saison wieder abbauen.
    const ai = Object.values(s.clubs).filter((c) => c.managerId === null);
    const aiMedianBalance = median(ai.map((c) => c.finance.balance));
    const aiMaxBalance = Math.max(...ai.map((c) => c.finance.balance));
    const aiOverLimit = ai.filter(isOverLimit).length;
    s = finishSeason(s).state;
    const balances: Record<ClubId, number> = {};
    for (const c of Object.values(s.clubs)) balances[c.id] = c.finance.balance;
    metrics.push({
      season,
      aiMedianBalance,
      aiMaxBalance,
      aiOverLimit,
      resultBeforeTransfers,
      income,
      utilization,
      tables,
      topMarketValues,
      balances,
    });
  }
  return { metrics, start, state: s };
}
