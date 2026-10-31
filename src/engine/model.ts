import type { RngState } from "./rng";

export type ClubId = string;
export type PlayerId = string;
export type ManagerId = string;
export type CompetitionId = string;
export type MatchId = string;

export type Position = "GK" | "DF" | "MF" | "FW";

export type Formation = "4-4-2" | "4-3-3" | "3-5-2" | "5-3-2" | "4-5-1" | "4-2-4";
export const FORMATIONS: Record<Formation, { DF: number; MF: number; FW: number }> = {
  "4-4-2": { DF: 4, MF: 4, FW: 2 },
  "4-3-3": { DF: 4, MF: 3, FW: 3 },
  "3-5-2": { DF: 3, MF: 5, FW: 2 },
  "5-3-2": { DF: 5, MF: 3, FW: 2 },
  "4-5-1": { DF: 4, MF: 5, FW: 1 },
  "4-2-4": { DF: 4, MF: 2, FW: 4 },
};
export const FORMATION_LIST = Object.keys(FORMATIONS) as Formation[];

/** Positionen der 11 Startplätze: Index 0 = Torwart, dann Abwehr, Mittelfeld, Sturm. */
export function slotPositions(f: Formation): Position[] {
  const c = FORMATIONS[f];
  return [
    "GK",
    ...Array<Position>(c.DF).fill("DF"),
    ...Array<Position>(c.MF).fill("MF"),
    ...Array<Position>(c.FW).fill("FW"),
  ];
}

export type Style = "defensive" | "normal" | "offensive";
export type Hardness = "fair" | "normal" | "hard";
export interface Tactics {
  formation: Formation;
  style: Style;
  hardness: Hardness;
}

/** starters[i] spielt auf slotPositions(formation)[i]. */
export interface Lineup {
  starters: PlayerId[];
  bench: PlayerId[];
}
export const STARTERS = 11;
export const BENCH_SIZE = 9;
export const MAX_SUBS = 5;
export const YELLOW_LIMIT = 5;

export interface Contract {
  /** Gehalt pro Spieltag in € */
  salary: number;
  /** letzte Saison, für die der Vertrag gilt */
  endsSeason: number;
}

export type Intensity = "light" | "normal" | "hard";
export type TrainingFocus = "fitness" | "tactics" | "technique";
export interface TrainingPlan {
  intensity: Intensity;
  focus: TrainingFocus;
  /** bis zu 3 Spieler mit Extratraining */
  individual: PlayerId[];
}

export type Expectation = "title" | "upper" | "mid" | "survival";
export interface Board {
  expectation: Expectation;
  /** 0–100 */
  confidence: number;
  warned: boolean;
}

export interface Sponsor {
  id: string;
  name: string;
  perMatchday: number;
  /** wird am Saisonende gezahlt, wenn das Saisonziel erreicht ist */
  bonus: number;
}

export type LedgerCategory =
  | "tickets"
  | "tv"
  | "sponsor"
  | "salaries"
  | "upkeep"
  | "interest"
  | "transfers"
  | "prizes"
  | "stadium"
  | "severance"
  | "bonus";

export interface LedgerEntry {
  calendarIndex: number;
  category: LedgerCategory;
  amount: number;
}

export interface Finance {
  balance: number;
  ticketPrice: number;
  /** 0–4, siehe STADIUM in economy/stadium.ts */
  stadiumStage: number;
  building: { stage: number; matchdaysLeft: number } | null;
  sponsor: Sponsor | null;
  sponsorOffers: Sponsor[];
  /** Buchungen der laufenden Saison */
  ledger: LedgerEntry[];
  /** Spieltage in Folge über dem Dispo-Limit */
  overdraftStreak: number;
  lastAttendance: number;
}

export interface Negotiation {
  id: string;
  managerId: ManagerId;
  playerId: PlayerId;
  /** fee = Ablöse mit dem Verein, salary = Gehalt mit dem Spieler */
  stage: "fee" | "salary";
  /** vereinbarte Ablöse (nur bei Transfers, sobald die Ablöse steht) */
  fee: number | null;
  /** aktuelle Forderung der Gegenseite */
  ask: number;
  /** 1–3 */
  round: number;
  desiredYears: number;
  status: "open" | "accepted" | "aborted";
  /** letzte Rückmeldung der Gegenseite, für die Anzeige */
  note: string;
  season: number;
  createdAt: number;
}

export interface TransferOffer {
  id: string;
  managerId: ManagerId;
  fromClub: ClubId;
  playerId: PlayerId;
  fee: number;
  /** verdeckt: so viel würde der KI-Verein höchstens zahlen */
  maxFee: number;
  round: number;
  status: "open" | "accepted" | "rejected" | "withdrawn";
  season: number;
  /** letzter Kalenderindex, an dem das Angebot gilt */
  expiresAfter: number;
}

export interface Message {
  id: string;
  managerId: ManagerId;
  season: number;
  calendarIndex: number;
  text: string;
  ref: { type: "transferOffer" | "jobOffer" | "sponsor" | "negotiation"; id: string } | null;
}

export const MAX_SQUAD = 32;
export const LEAGUE_MATCHDAYS = 34;

export interface Player {
  id: PlayerId;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  /** 1–99, intern Gleitkomma; angezeigt wird Math.round. */
  strength: number;
  potential: number;
  /** −3 … +3 */
  form: number;
  /** 0–100 */
  fitness: number;
  injury: { matchesLeft: number } | null;
  suspension: { matchesLeft: number } | null;
  yellowCards: number;
  clubId: ClubId | null;
  /** Statistik der laufenden Saison */
  stats: { apps: number; goals: number };
  /** null = vereinslos */
  contract: Contract | null;
  /** 0–100 */
  morale: number;
  transferListed: { askingPrice: number | null } | null;
  /** Spieltage, bis wieder verhandelt werden kann */
  talkCooldown: number;
  retired: boolean;
}

export type CrestPattern = "plain" | "stripes" | "sash" | "split" | "hoops";

export interface Club {
  id: ClubId;
  name: string;
  shortName: string;
  colors: [string, string];
  crest: CrestPattern;
  /** 1–100 */
  reputation: number;
  managerId: ManagerId | null;
  squad: PlayerId[];
  lineup: Lineup;
  tactics: Tactics;
  finance: Finance;
  board: Board;
  training: TrainingPlan;
  /** Multiplikator fürs nächste Spiel (Taktiktraining) */
  tacticsBonus: number;
}

export interface Manager {
  id: ManagerId;
  name: string;
  clubId: ClubId | null;
  jobOffers: ClubId[];
  /** Spieltage ohne Verein */
  unemployedFor: number;
}

export interface Score {
  home: number;
  away: number;
}

export type MatchEvent =
  | { minute: number; type: "goal"; club: ClubId; player: PlayerId }
  | { minute: number; type: "yellow"; club: ClubId; player: PlayerId }
  | { minute: number; type: "red"; club: ClubId; player: PlayerId; secondYellow: boolean }
  | { minute: number; type: "injury"; club: ClubId; player: PlayerId }
  | { minute: number; type: "sub"; club: ClubId; out: PlayerId; in: PlayerId };

export interface Match {
  id: MatchId;
  competitionId: CompetitionId;
  /** Runde innerhalb des Wettbewerbs (Liga: Spieltag 1–34; Relegation: 1 = Hin-, 2 = Rückspiel). */
  round: number;
  home: ClubId;
  away: ClubId;
  result: Score | null;
  events: MatchEvent[];
  /** Nur gesetzt, wenn nach diesem Spiel ein Elfmeterschießen nötig war. */
  penalties: Score | null;
}

export interface Competition {
  id: CompetitionId;
  name: string;
  format: "league" | "knockout";
  clubs: ClubId[];
  rounds: number;
  matches: Match[];
}

export interface CalendarEntry {
  fixtures: { competitionId: CompetitionId; round: number }[];
}

export interface SeasonRecord {
  season: number;
  champions: Record<CompetitionId, ClubId>;
  promoted: ClubId[];
  relegated: ClubId[];
  topScorers: Record<CompetitionId, { player: PlayerId; goals: number } | null>;
}

export interface GameState {
  version: 1;
  rngState: RngState;
  season: number;
  calendar: CalendarEntry[];
  /** Index des nächsten zu spielenden Kalendereintrags. */
  calendarIndex: number;
  managers: Manager[];
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
  competitions: Record<CompetitionId, Competition>;
  history: SeasonRecord[];
  negotiations: Negotiation[];
  transferOffers: TransferOffer[];
  messages: Message[];
  nextId: number;
}

export const LEAGUE_SIZE = 18;
export const COMP = { first: "L1", second: "L2", relegation: "REL" } as const;

export function newId(state: GameState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

export function isAvailable(p: Player): boolean {
  return p.injury === null && p.suspension === null;
}

export function displayStrength(p: Player): number {
  return Math.round(p.strength);
}

export function clubOf(state: GameState, managerId: ManagerId): Club | null {
  const m = state.managers.find((x) => x.id === managerId);
  return m && m.clubId ? state.clubs[m.clubId] : null;
}
