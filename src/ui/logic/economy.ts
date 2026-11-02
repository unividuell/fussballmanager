import { salaryDemand } from "../../engine/economy/contracts";
import { marketValue } from "../../engine/economy/money";
import { askingFee } from "../../engine/economy/transfers";
import type {
  Club,
  ClubId,
  GameState,
  LedgerCategory,
  ManagerId,
  Negotiation,
  Player,
  PlayerId,
  Position,
  TransferOffer,
} from "../../engine/model";

export const LEDGER_LABEL: Record<LedgerCategory, string> = {
  tickets: "Zuschauer",
  tv: "TV-Geld",
  sponsor: "Sponsor",
  salaries: "Gehälter",
  upkeep: "Stadionunterhalt",
  interest: "Zinsen",
  transfers: "Transfers",
  prizes: "Prämien",
  stadium: "Stadionausbau",
  severance: "Abfindungen",
  bonus: "Sponsorprämie",
};

export interface LedgerLine {
  category: LedgerCategory;
  label: string;
  lastMatchday: number;
  season: number;
}

const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Liest einen deutsch formatierten Betrag („1.500.000 €“, „12.000,50“); null bei leerem oder ungültigem Text. */
export function parseEuro(text: string): number | null {
  const t = text.replace(/[\s€]/g, "").replace(/,\d*$/, "").replace(/\./g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export const INVALID_AMOUNT = "Bitte einen gültigen Betrag eingeben.";

export function ledgerSummary(club: Club, calendarIndex: number): { lines: LedgerLine[]; lastTotal: number; seasonTotal: number; lastIndex: number | null } {
  const ledger = club.finance.ledger;
  const lastIndex = calendarIndex > 0 ? calendarIndex - 1 : null;
  const lines = (Object.keys(LEDGER_LABEL) as LedgerCategory[])
    .map((category) => ({
      category,
      label: LEDGER_LABEL[category],
      season: total(ledger.filter((e) => e.category === category).map((e) => e.amount)),
      lastMatchday: total(ledger.filter((e) => e.category === category && e.calendarIndex === lastIndex).map((e) => e.amount)),
    }))
    .filter((l) => l.season !== 0 || l.lastMatchday !== 0);
  return { lines, lastTotal: total(lines.map((l) => l.lastMatchday)), seasonTotal: total(lines.map((l) => l.season)), lastIndex };
}

export interface ContractRow {
  player: Player;
  salary: number;
  endsSeason: number | null;
  expiring: boolean;
  demand: number;
  value: number;
}

export function contractRows(state: GameState, clubId: ClubId): ContractRow[] {
  return state.clubs[clubId].squad
    .map((id) => state.players[id])
    .map((p) => ({
      player: p,
      salary: p.contract?.salary ?? 0,
      endsSeason: p.contract?.endsSeason ?? null,
      expiring: (p.contract?.endsSeason ?? state.season) <= state.season,
      demand: salaryDemand(state, p, clubId),
      value: marketValue(p, state.season),
    }))
    .sort((a, b) => (a.endsSeason ?? 0) - (b.endsSeason ?? 0) || b.player.strength - a.player.strength);
}

export interface MarketFilter {
  position: Position | "all";
  freeOnly: boolean;
  listedOnly: boolean;
  maxFee: number | null;
}

export const DEFAULT_FILTER: MarketFilter = { position: "all", freeOnly: false, listedOnly: false, maxFee: null };

export interface MarketRow {
  player: Player;
  clubName: string;
  fee: number;
  wage: number;
  value: number;
  free: boolean;
  listed: boolean;
}

export function marketRows(state: GameState, buyerClubId: ClubId, f: MarketFilter): MarketRow[] {
  return Object.values(state.players)
    .filter((p) => !p.retired && p.clubId !== buyerClubId && (p.clubId === null || state.clubs[p.clubId].managerId === null))
    .filter((p) => f.position === "all" || p.position === f.position)
    .filter((p) => !f.freeOnly || p.clubId === null)
    .filter((p) => !f.listedOnly || p.transferListed !== null)
    .map((p) => ({
      player: p,
      clubName: p.clubId ? state.clubs[p.clubId].shortName : "vereinslos",
      fee: askingFee(state, p),
      wage: salaryDemand(state, p, buyerClubId),
      value: marketValue(p, state.season),
      free: p.clubId === null,
      listed: p.transferListed !== null,
    }))
    .filter((r) => f.maxFee === null || r.fee <= f.maxFee)
    .sort((a, b) => b.player.strength - a.player.strength);
}

export interface OfferRow {
  offer: TransferOffer;
  playerName: string;
  buyerName: string;
}

export function openOffers(state: GameState, managerId: ManagerId): OfferRow[] {
  return state.transferOffers
    .filter((o) => o.managerId === managerId && o.status === "open")
    .map((o) => {
      const p = state.players[o.playerId];
      return { offer: o, playerName: `${p.firstName} ${p.lastName}`, buyerName: state.clubs[o.fromClub].name };
    });
}

export function latestNegotiation(state: GameState, managerId: ManagerId, playerId: PlayerId): Negotiation | null {
  for (let i = state.negotiations.length - 1; i >= 0; i--) {
    const n = state.negotiations[i];
    if (n.managerId === managerId && n.playerId === playerId) return n;
  }
  return null;
}

export function messageLabel(season: number, calendarIndex: number): string {
  return calendarIndex >= 34 ? `S${season} · Relegation` : `S${season} · ${calendarIndex + 1}. Sp.`;
}

export function potentialStars(p: Player): string {
  const n = p.potential <= 55 ? 1 : p.potential <= 65 ? 2 : p.potential <= 75 ? 3 : p.potential <= 85 ? 4 : 5;
  return "★".repeat(n);
}
