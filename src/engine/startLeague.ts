import { CLUBS } from "./clubs";
import { WAGE_FACTOR, startBalance } from "./economy/money";
import { initialStage, startPrice } from "./economy/stadium";
import { baseStrengthFor, generateSquad } from "./generator";
import { LEAGUES, leagueLevel, type ClubId, type CompetitionId, type GameState } from "./model";
import { RL_WAGE_FACTOR } from "./regionalliga";
import type { Rng } from "./rng";

/** Kennung der Regionalliga in Datensatz und Stufenliste */
const RL = "RL";

/** Woran ein Verein in seiner neuen Liga angepasst wird (Spec 2026-11-16, Abschnitt 4). */
export type Profile = "median" | "lowest" | "highest";

/** Ruf und Kaderstärke aus den echten Vereinen der Liga, getrennt bestimmt. */
export function leagueProfile(league: CompetitionId, profile: Profile): { reputation: number; strength: number } {
  const seeds = CLUBS.filter((c) => c.league === league);
  const pick = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    if (profile === "lowest") return s[0];
    if (profile === "highest") return s[s.length - 1];
    const m = s.length / 2;
    return s.length % 2 === 1 ? s[Math.floor(m)] : Math.round((s[m - 1] + s[m]) / 2);
  };
  return { reputation: pick(seeds.map((c) => c.reputation)), strength: pick(seeds.map((c) => c.strength)) };
}

/** Passt einen Verein vollständig an eine Liga an: Ruf, Geld, Stadion, Preis und ein neu erzeugter Kader. Name und Farben bleiben. */
export function adaptClub(state: GameState, rng: Rng, clubId: ClubId, league: CompetitionId, profile: Profile): void {
  const club = state.clubs[clubId];
  // die Regionalliga rechnet mit Stadion und Preis der 3. Liga und eigenem Gehaltsniveau
  const rl = league === RL;
  const level = rl ? 2 : leagueLevel(league);
  const { reputation, strength } = leagueProfile(league, profile);
  for (const pid of club.squad) delete state.players[pid];
  club.squad = [];
  club.lineup = { starters: [], bench: [] };
  club.training.individual = [];
  club.reputation = reputation;
  club.finance.balance = startBalance(reputation);
  club.finance.stadiumStage = initialStage(reputation, level);
  club.finance.ticketPrice = startPrice(reputation, level);
  generateSquad(state, rng, clubId, baseStrengthFor(strength), rl ? RL_WAGE_FACTOR : WAGE_FACTOR[level]);
}

/**
 * Setzt die gewählten Vereine in ihre Startligen und füllt die Lücken mit Nachrückern (Spec 2026-11-16, Abschnitt 3).
 * Manager-Vereine und schon gewechselte Vereine rücken nie nach; jeder Verein wechselt höchstens einmal.
 */
export function applyStartLeagues(
  state: GameState,
  leagues: Record<CompetitionId, ClubId[]>,
  choices: { clubId: ClubId; league: CompetitionId }[],
  rng: Rng,
): Record<CompetitionId, ClubId[]> {
  // Stufen von oben nach unten; die Regionalliga ist die Stufe unter der 3. Liga (Spec 2026-11-17)
  const TIERS = [...LEAGUES, RL];
  const inLeague = new Set(LEAGUES.flatMap((l) => leagues[l]));
  const out: Record<CompetitionId, ClubId[]> = Object.fromEntries(LEAGUES.map((l) => [l, [...leagues[l]]]));
  out[RL] = Object.keys(state.clubs).filter((id) => !inLeague.has(id));
  const locked = new Set(choices.map((c) => c.clubId));
  const seed = (id: ClubId) => CLUBS.find((c) => c.name === state.clubs[id].name)!;
  const current = (id: ClubId) => TIERS.find((l) => out[l].includes(id))!;
  const move = (id: ClubId, to: CompetitionId) => {
    const from = current(id);
    out[from] = out[from].filter((c) => c !== id);
    out[to].push(id);
  };
  /** stärkster (dir = 1) oder schwächster (dir = -1) freie Verein der Liga nach Datensatz */
  const pick = (league: CompetitionId, dir: 1 | -1) =>
    out[league]
      .filter((id) => !locked.has(id))
      .sort((a, b) => dir * (seed(b).strength - seed(a).strength) || dir * (seed(b).reputation - seed(a).reputation) || (a < b ? -1 : 1))[0];

  for (const choice of choices) {
    const from = TIERS.indexOf(current(choice.clubId));
    const to = TIERS.indexOf(choice.league);
    if (from === to) continue;
    move(choice.clubId, choice.league);
    adaptClub(state, rng, choice.clubId, choice.league, "median");
    if (to > from) {
      // nach unten: aus jeder Liga darunter rückt der stärkste Verein eine Liga hoch
      for (let k = from + 1; k <= to; k++) {
        const id = pick(TIERS[k], 1);
        move(id, TIERS[k - 1]);
        adaptClub(state, rng, id, TIERS[k - 1], "lowest");
        locked.add(id);
      }
    } else {
      // nach oben: aus jeder Liga darüber steigt der schwächste Verein eine Liga ab
      for (let k = to; k < from; k++) {
        const id = pick(TIERS[k], -1);
        move(id, TIERS[k + 1]);
        adaptClub(state, rng, id, TIERS[k + 1], "highest");
        locked.add(id);
      }
    }
  }
  return Object.fromEntries(LEAGUES.map((l) => [l, out[l]]));
}
