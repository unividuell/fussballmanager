import type { LiveMatch } from "../match/simulate";
import { COMP, type ClubId, type CompetitionId, type GameState } from "../model";
import type { Rng } from "../rng";
import {
  assignExpectations,
  boardChecks,
  clearStaleJobOffers,
  expectationMet,
  seasonReview,
  unemployedTick,
  updateConfidence,
} from "./board";
import { aiRenewals, expireContracts, expiringNotices, tickCooldowns } from "./contracts";
import { processFinances, seasonEndFinances, startSeasonFinances } from "./finance";
import { aiTransferRound, expireOffers, generateAiOffers } from "./market";
import { postToClub } from "./messages";
import { cleanupNegotiations } from "./negotiations";
import { addFreeAgents, addYouth, aiTrainingPlan, applyTraining, pruneRetired, seasonAging, trimFreeAgents } from "./training";
import { isTransferWindow } from "./transfers";
import { clubLeague, isLeagueMatchday } from "./util";

const WINTER_MARKET_AT = 17;

export function processMatchday(state: GameState, lives: LiveMatch[], rng: Rng): void {
  processFinances(state, lives);
  if (isLeagueMatchday(state.calendarIndex)) {
    const played = new Set(lives.flatMap((l) => [...l.home.played, ...l.away.played]));
    for (const club of Object.values(state.clubs)) {
      if (!clubLeague(state, club.id)) continue;
      if (club.managerId === null) club.training = aiTrainingPlan(state, club.id);
      const injured = applyTraining(state, club.id, played, rng);
      if (injured.length > 0) {
        postToClub(state, club.id, `Trainingsverletzung: ${injured.map((id) => state.players[id].lastName).join(", ")}.`);
      }
    }
  }
  updateConfidence(state, lives);
  boardChecks(state, rng);
  unemployedTick(state, rng);
  if (state.calendarIndex === 0) clearStaleJobOffers(state);
  tickCooldowns(state);
  aiRenewals(state);
  expiringNotices(state);
  cleanupNegotiations(state);
  expireOffers(state);
}

export function afterAdvance(state: GameState, rng: Rng): void {
  if (!isTransferWindow(state)) return;
  if (state.calendarIndex === WINTER_MARKET_AT) aiTransferRound(state, rng);
  generateAiOffers(state, rng);
}

export function seasonEndEconomy(state: GameState, tables: Record<CompetitionId, ClubId[]>, rng: Rng): void {
  const met = (clubId: ClubId) => {
    const league = tables[COMP.first]?.includes(clubId) ? COMP.first : COMP.second;
    return expectationMet(state, clubId, (tables[league] ?? []).indexOf(clubId) + 1);
  };
  seasonEndFinances(state, tables, met);
  seasonReview(state, tables, rng);
  expireContracts(state);
  seasonAging(state, rng);
  addYouth(state, rng);
  addFreeAgents(state, rng);
  trimFreeAgents(state);
  pruneRetired(state);
  state.negotiations = [];
  state.transferOffers = [];
}

export function startSeasonEconomy(state: GameState, rng: Rng): void {
  assignExpectations(state);
  startSeasonFinances(state, rng);
  state.negotiations = [];
  state.transferOffers = [];
}

export function summerMarket(state: GameState, rng: Rng): void {
  aiTransferRound(state, rng);
  generateAiOffers(state, rng);
}
