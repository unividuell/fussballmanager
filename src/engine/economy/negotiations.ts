import { COMP, MAX_SQUAD, newId, type ClubId, type GameState, type ManagerId, type Negotiation, type Player, type PlayerId } from "../model";
import {
  TALK_COOLDOWN,
  desiredYears,
  evaluateOffer,
  salaryDemand,
  signContract,
  validateYears,
  yearsAdjusted,
} from "./contracts";
import { canAfford, isOverLimit } from "./money";
import { askingFee, executeTransfer, isTransferWindow } from "./transfers";
import { clubLeague, formatEuro, roundTo } from "./util";

export const NEGOTIATION_LIFETIME = 2;
const MIN_SELLER_SQUAD = 18;

export type NegotiationResponse = { amount: number; years?: number } | "accept" | "abort";

function managedClubId(state: GameState, managerId: ManagerId): ClubId | { error: string } {
  const m = state.managers.find((x) => x.id === managerId);
  if (!m) return { error: "Unbekannter Manager." };
  if (!m.clubId) return { error: "Du hast zurzeit keinen Verein." };
  return m.clubId;
}

function validAmount(amount: number): string | null {
  return Number.isInteger(amount) && amount > 0 ? null : "Der Betrag muss eine positive ganze Zahl sein.";
}

export function openNegotiationFor(state: GameState, playerId: PlayerId): Negotiation | undefined {
  return state.negotiations.find((n) => n.playerId === playerId && n.status === "open");
}

function commonChecks(state: GameState, p: Player | undefined): string | null {
  if (!p || p.retired) return "Diesen Spieler gibt es nicht.";
  if (p.talkCooldown > 0) return `${p.lastName} will erst in ${p.talkCooldown} Spieltagen wieder verhandeln.`;
  if (openNegotiationFor(state, p.id)) return "Mit diesem Spieler wird schon verhandelt.";
  return null;
}

function create(state: GameState, managerId: ManagerId, p: Player, stage: Negotiation["stage"], ask: number): Negotiation {
  const n: Negotiation = {
    id: newId(state, "neg"),
    managerId,
    playerId: p.id,
    stage,
    fee: null,
    ask,
    round: 1,
    desiredYears: desiredYears(p),
    status: "open",
    note: "",
    season: state.season,
    createdAt: state.calendarIndex,
  };
  state.negotiations.push(n);
  return n;
}

function buyerOf(state: GameState, n: Negotiation): ClubId | null {
  return state.managers.find((m) => m.id === n.managerId)?.clubId ?? null;
}

function reluctance(state: GameState, buyerId: ClubId, sellerId: ClubId): number {
  const buyer = state.clubs[buyerId];
  const seller = state.clubs[sellerId];
  const downward = clubLeague(state, buyerId) === COMP.second && clubLeague(state, sellerId) === COMP.first;
  return buyer.reputation <= seller.reputation - 15 || downward ? 1.3 : 1;
}

function applySalary(state: GameState, n: Negotiation, salary: number, years: number): void {
  const p = state.players[n.playerId];
  const buyer = buyerOf(state, n);
  if (!buyer) {
    n.status = "aborted";
    n.note = "Du hast zurzeit keinen Verein.";
    return;
  }
  const factor = yearsAdjusted(10_000, years, n.desiredYears) / 10_000;
  const r = evaluateOffer(salary, roundTo(n.ask * factor, 100), n.round);
  if (r.kind === "accepted") {
    if (n.fee !== null && !isTransferWindow(state)) {
      n.status = "aborted";
      n.note = "Das Transferfenster ist geschlossen.";
      return;
    }
    if (n.fee !== null && !canAfford(state.clubs[buyer], n.fee)) {
      n.status = "aborted";
      n.note = "Dafür reicht das Geld nicht.";
      return;
    }
    if (!state.clubs[buyer].squad.includes(p.id) && state.clubs[buyer].squad.length >= MAX_SQUAD) {
      n.status = "aborted";
      n.note = "Der Kader ist voll (höchstens 32 Spieler).";
      return;
    }
    if (n.fee !== null && p.clubId && state.clubs[p.clubId].squad.length <= MIN_SELLER_SQUAD) {
      n.status = "aborted";
      n.note = "Der Verein gibt keine Spieler mehr ab.";
      return;
    }
    n.status = "accepted";
    if (n.fee !== null) executeTransfer(state, buyer, p.id, n.fee);
    signContract(state, p.id, buyer, r.amount, years);
    n.note = `${p.firstName} ${p.lastName} unterschreibt bis Saison ${p.contract!.endsSeason} für ${formatEuro(r.amount)} pro Spieltag.`;
    return;
  }
  if (r.kind === "counter") {
    n.ask = roundTo(r.amount / factor, 100);
    n.round = r.round;
    n.note =
      r.round >= 3
        ? `Letztes Wort von ${p.lastName}: ${formatEuro(r.amount)} pro Spieltag bei ${years} Jahren.`
        : `${p.lastName} fordert ${formatEuro(r.amount)} pro Spieltag bei ${years} Jahren.`;
    return;
  }
  n.status = "aborted";
  p.morale = Math.max(0, p.morale - 10);
  p.talkCooldown = TALK_COOLDOWN;
  n.note = `${p.lastName} bricht die Verhandlung ab.`;
}

function applyFee(state: GameState, n: Negotiation, fee: number): void {
  const p = state.players[n.playerId];
  const sellerId = p.clubId!;
  const seller = state.clubs[sellerId];
  const r = evaluateOffer(fee, n.ask, n.round);
  if (r.kind === "accepted") {
    const buyer = buyerOf(state, n)!;
    n.fee = r.amount;
    n.stage = "salary";
    n.round = 1;
    n.ask = roundTo(salaryDemand(state, p, buyer) * reluctance(state, buyer, sellerId), 100);
    n.note = `${seller.name} akzeptiert ${formatEuro(r.amount)}. Jetzt verhandelst du mit ${p.lastName} über das Gehalt (Forderung: ${formatEuro(n.ask)} pro Spieltag).`;
    return;
  }
  if (r.kind === "counter") {
    n.ask = r.amount;
    n.round = r.round;
    n.note = r.round >= 3 ? `Letztes Wort von ${seller.name}: ${formatEuro(r.amount)}.` : `${seller.name} fordert ${formatEuro(r.amount)}.`;
    return;
  }
  n.status = "aborted";
  p.talkCooldown = TALK_COOLDOWN;
  n.note = `${seller.name} lehnt ab und bricht die Verhandlung ab.`;
}

export function startContractTalk(state: GameState, managerId: ManagerId, playerId: PlayerId, salary: number, years: number): string | null {
  const clubId = managedClubId(state, managerId);
  if (typeof clubId !== "string") return clubId.error;
  const p = state.players[playerId];
  const common = commonChecks(state, p);
  if (common) return common;
  if (p.clubId !== null && p.clubId !== clubId) return "Der Spieler steht bei einem anderen Verein unter Vertrag.";
  if (p.clubId === null && state.clubs[clubId].squad.length >= MAX_SQUAD) return "Der Kader ist voll (höchstens 32 Spieler).";
  const yearsError = validateYears(years);
  if (yearsError) return yearsError;
  const amountError = validAmount(salary);
  if (amountError) return amountError;
  const n = create(state, managerId, p, "salary", salaryDemand(state, p, clubId));
  applySalary(state, n, salary, years);
  return null;
}

export function startTransferTalk(state: GameState, managerId: ManagerId, playerId: PlayerId, fee: number): string | null {
  const clubId = managedClubId(state, managerId);
  if (typeof clubId !== "string") return clubId.error;
  const p = state.players[playerId];
  if (p && !p.retired && p.clubId === null) return "Der Spieler ist vereinslos – biete ihm direkt einen Vertrag an.";
  if (p && p.clubId === clubId) return "Der Spieler gehört schon zu deinem Verein.";
  if (p && p.clubId && state.clubs[p.clubId].managerId !== null) return "Mit Vereinen anderer Manager wird nicht verhandelt.";
  const common = commonChecks(state, p);
  if (common) return common;
  const buyer = state.clubs[clubId];
  if (isOverLimit(buyer) || !canAfford(buyer, fee)) return "Dafür reicht das Geld nicht.";
  if (!isTransferWindow(state)) return "Das Transferfenster ist geschlossen.";
  if (buyer.squad.length >= MAX_SQUAD) return "Der Kader ist voll (höchstens 32 Spieler).";
  if (state.clubs[p.clubId!].squad.length <= MIN_SELLER_SQUAD) return "Der Verein gibt keine Spieler mehr ab.";
  const amountError = validAmount(fee);
  if (amountError) return amountError;
  const n = create(state, managerId, p, "fee", askingFee(state, p));
  applyFee(state, n, fee);
  return null;
}

export function respondNegotiation(state: GameState, managerId: ManagerId, negotiationId: string, response: NegotiationResponse): string | null {
  const n = state.negotiations.find((x) => x.id === negotiationId);
  if (!n || n.managerId !== managerId) return "Diese Verhandlung gibt es nicht.";
  if (n.status !== "open") return "Diese Verhandlung ist schon beendet.";
  if (response === "abort") {
    n.status = "aborted";
    n.note = "Du hast die Verhandlung beendet.";
    return null;
  }
  if (n.stage === "fee") {
    const fee = response === "accept" ? n.ask : response.amount;
    const amountError = validAmount(fee);
    if (amountError) return amountError;
    if (!isTransferWindow(state)) return "Das Transferfenster ist geschlossen.";
    const buyer = buyerOf(state, n);
    if (!buyer || !canAfford(state.clubs[buyer], fee)) return "Dafür reicht das Geld nicht.";
    applyFee(state, n, fee);
    return null;
  }
  const years = response === "accept" ? n.desiredYears : (response.years ?? n.desiredYears);
  const yearsError = validateYears(years);
  if (yearsError) return yearsError;
  const salary = response === "accept" ? n.ask : response.amount;
  const amountError = validAmount(salary);
  if (amountError) return amountError;
  applySalary(state, n, salary, years);
  return null;
}

export function cleanupNegotiations(state: GameState): void {
  state.negotiations = state.negotiations.filter(
    (n) => n.status === "open" && n.season === state.season && state.calendarIndex - n.createdAt < NEGOTIATION_LIFETIME,
  );
}
