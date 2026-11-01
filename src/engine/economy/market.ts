import { COMP, MAX_SQUAD, newId, type Club, type ClubId, type GameState, type ManagerId, type Player, type Position } from "../model";
import type { Rng } from "../rng";
import { desiredYears, salaryDemand, signContract } from "./contracts";
import { TV_PER_MATCHDAY } from "./finance";
import { postMessage } from "./messages";
import { canAfford, marketValue, wageBill } from "./money";
import { removeFromClub } from "./roster";
import { STADIUM } from "./stadium";
import { askingFee, executeTransfer, isTransferWindow } from "./transfers";
import { clubLeague, formatEuro, roundTo } from "./util";

const LISTED_CHANCE = 0.6;
const UNLISTED_CHANCE = 0.2;
const NEED: Record<Position, number> = { GK: 2, DF: 6, MF: 6, FW: 4 };
const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];
const MAX_AI_BUYS = 2;
const AI_SQUAD_MIN = 22;
const AI_SQUAD_MAX = 28;
const EMERGENCY_SQUAD = 18;
const SELLER_MIN_SQUAD = 22;
const WAGE_SHARE = 0.8;

export type OfferResponse = "accept" | "reject" | { counter: number };

function playerName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

function makeOffer(state: GameState, rng: Rng, seller: Club, p: Player, fee: number, maxFee: number): void {
  const buyers = Object.values(state.clubs).filter(
    (c) =>
      c.managerId === null &&
      c.id !== seller.id &&
      c.squad.length < MAX_SQUAD &&
      c.reputation >= seller.reputation - 20 &&
      canAfford(c, fee),
  );
  if (buyers.length === 0 || !seller.managerId) return;
  const buyer = rng.pick(buyers);
  const offer = {
    id: newId(state, "off"),
    managerId: seller.managerId,
    fromClub: buyer.id,
    playerId: p.id,
    fee,
    maxFee: Math.max(fee, maxFee),
    round: 1,
    status: "open" as const,
    season: state.season,
    expiresAfter: state.calendarIndex + 1,
  };
  state.transferOffers.push(offer);
  postMessage(state, seller.managerId, `${buyer.name} bietet ${formatEuro(fee)} für ${playerName(p)}.`, { type: "transferOffer", id: offer.id });
}

const hasOpenOffer = (state: GameState, playerId: string) =>
  state.transferOffers.some((o) => o.playerId === playerId && o.status === "open");

export function generateAiOffers(state: GameState, rng: Rng): void {
  for (const club of Object.values(state.clubs)) {
    if (!club.managerId) continue;
    for (const pid of club.squad) {
      const p = state.players[pid];
      if (!p.transferListed || hasOpenOffer(state, pid) || !rng.chance(LISTED_CHANCE)) continue;
      const base = p.transferListed.askingPrice ?? marketValue(p, state.season);
      makeOffer(state, rng, club, p, roundTo(base * (0.75 + rng.next() * 0.25), 10_000), roundTo(base * (1 + rng.next() * 0.2), 10_000));
    }
    if (rng.chance(UNLISTED_CHANCE)) {
      const top = club.squad
        .map((id) => state.players[id])
        .filter((p) => !p.transferListed && !hasOpenOffer(state, p.id))
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 5);
      if (top.length > 0) {
        const p = rng.pick(top);
        const fee = roundTo(marketValue(p, state.season) * (1.1 + rng.next() * 0.3), 10_000);
        makeOffer(state, rng, club, p, fee, roundTo(fee * 1.25, 10_000));
      }
    }
  }
}

export function respondTransferOffer(state: GameState, managerId: ManagerId, offerId: string, response: OfferResponse): string | null {
  const o = state.transferOffers.find((x) => x.id === offerId);
  if (!o || o.managerId !== managerId) return "Dieses Angebot gibt es nicht.";
  if (o.status !== "open") return "Dieses Angebot ist nicht mehr offen.";
  if (!isTransferWindow(state)) return "Das Transferfenster ist geschlossen.";
  const p = state.players[o.playerId];
  const clubId = state.managers.find((m) => m.id === managerId)?.clubId ?? null;
  if (!clubId || p.clubId !== clubId) {
    o.status = "withdrawn";
    return "Der Spieler gehört nicht mehr zu deinem Verein.";
  }
  if (response === "reject") {
    o.status = "rejected";
    return null;
  }
  const buyer = state.clubs[o.fromClub];
  let fee = o.fee;
  if (response !== "accept") {
    const counter = response.counter;
    if (!Number.isInteger(counter) || counter <= 0) return "Der Betrag muss eine positive ganze Zahl sein.";
    if (counter <= o.maxFee) fee = Math.max(counter, o.fee);
    else if (o.round < 3) {
      o.fee = roundTo(o.fee + (o.maxFee - o.fee) * 0.5, 10_000);
      o.round++;
      postMessage(state, managerId, `${buyer.name} erhöht auf ${formatEuro(o.fee)} für ${playerName(p)}.`, { type: "transferOffer", id: o.id });
      return null;
    } else {
      o.status = "withdrawn";
      postMessage(state, managerId, `${buyer.name} zieht das Angebot für ${playerName(p)} zurück.`);
      return null;
    }
  }
  if (buyer.squad.length >= MAX_SQUAD) {
    o.status = "withdrawn";
    postMessage(state, managerId, `${buyer.name} hat keinen Kaderplatz mehr und zieht das Angebot für ${playerName(p)} zurück.`);
    return null;
  }
  if (!canAfford(buyer, fee)) {
    o.status = "withdrawn";
    postMessage(state, managerId, `${buyer.name} kann ${formatEuro(fee)} nicht mehr bezahlen und zieht zurück.`);
    return null;
  }
  o.status = "accepted";
  o.fee = fee;
  executeTransfer(state, buyer.id, p.id, fee);
  signContract(state, p.id, buyer.id, salaryDemand(state, p, buyer.id), desiredYears(p));
  return null;
}

export function expireOffers(state: GameState): void {
  for (const o of state.transferOffers) {
    if (o.status !== "open") continue;
    if (o.season !== state.season || state.calendarIndex > o.expiresAfter) {
      o.status = "rejected";
      const p = state.players[o.playerId];
      postMessage(state, o.managerId, `Das Angebot von ${state.clubs[o.fromClub].name} für ${playerName(p)} ist verfallen.`);
    }
  }
  state.transferOffers = state.transferOffers.filter((o) => o.status === "open");
}

export function expectedIncome(state: GameState, clubId: ClubId): number {
  const club = state.clubs[clubId];
  const league = clubLeague(state, clubId) ?? COMP.second;
  const sponsor = club.finance.sponsor?.perMatchday ?? club.reputation * 1000 * (league === COMP.second ? 0.6 : 1);
  const tickets = (STADIUM[club.finance.stadiumStage].capacity * 0.6 * club.finance.ticketPrice) / 2;
  return TV_PER_MATCHDAY[league] + sponsor + tickets;
}

function wageRoom(state: GameState, clubId: ClubId, extra: number): boolean {
  return wageBill(state, clubId) + extra <= WAGE_SHARE * expectedIncome(state, clubId);
}

function needs(state: GameState, club: Club): Position[] {
  const at = (pos: Position) => club.squad.map((id) => state.players[id]).filter((p) => p.position === pos);
  const avg = (pos: Position) => {
    const ps = at(pos);
    return ps.length === 0 ? 0 : ps.reduce((s, p) => s + p.strength, 0) / ps.length;
  };
  return [...POSITIONS].sort((a, b) => {
    const da = NEED[a] - at(a).length;
    const db = NEED[b] - at(b).length;
    if (da > 0 || db > 0) return db - da;
    return avg(a) - avg(b);
  });
}

function candidates(state: GameState, buyerId: ClubId): Player[] {
  const negotiating = new Set(state.negotiations.filter((n) => n.status === "open").map((n) => n.playerId));
  return Object.values(state.players).filter((p) => {
    if (p.retired || negotiating.has(p.id) || p.clubId === buyerId) return false;
    if (p.clubId === null) return true;
    const club = state.clubs[p.clubId];
    return club.managerId === null && club.squad.length > SELLER_MIN_SQUAD && !club.lineup.starters.includes(p.id);
  });
}

export function aiTransferRound(state: GameState, rng: Rng): void {
  const ai = rng.shuffle(Object.values(state.clubs).filter((c) => c.managerId === null).map((c) => c.id));
  for (const id of ai) {
    const club = state.clubs[id];
    while (club.squad.length > AI_SQUAD_MAX) {
      const worst = club.squad
        .map((pid) => state.players[pid])
        .filter((p) => !club.lineup.starters.includes(p.id))
        .sort((a, b) => a.strength - b.strength || b.age - a.age)[0];
      if (!worst) break;
      removeFromClub(state, worst.id);
    }
    let buys = 0;
    for (const pos of needs(state, club)) {
      if (buys >= MAX_AI_BUYS) break;
      const atPos = club.squad.map((pid) => state.players[pid]).filter((p) => p.position === pos);
      const worstAtPos = atPos.length === 0 ? 0 : Math.min(...atPos.map((p) => p.strength));
      const pick = candidates(state, id)
        .filter((p) => p.position === pos && p.age <= 32 && (atPos.length < NEED[pos] || p.strength > worstAtPos + 2))
        .map((p) => ({ p, fee: askingFee(state, p), wage: salaryDemand(state, p, id) }))
        .filter((x) => club.finance.balance - x.fee >= 0 && wageRoom(state, id, x.wage))
        .sort((a, b) => b.p.strength - a.p.strength)[0];
      if (!pick) continue;
      if (pick.p.clubId) executeTransfer(state, id, pick.p.id, pick.fee);
      signContract(state, pick.p.id, id, pick.wage, desiredYears(pick.p));
      buys++;
    }
    while (club.squad.length < AI_SQUAD_MIN) {
      const needPos = needs(state, club)[0];
      const free = Object.values(state.players)
        .filter((p) => p.clubId === null && !p.retired)
        .map((p) => ({ p, wage: salaryDemand(state, p, id) }))
        .filter((x) => club.squad.length < EMERGENCY_SQUAD || wageRoom(state, id, x.wage))
        .sort((a, b) => Number(b.p.position === needPos) - Number(a.p.position === needPos) || b.p.strength - a.p.strength)[0];
      if (!free) break;
      signContract(state, free.p.id, id, free.wage, desiredYears(free.p));
    }
  }
}
