import type { LiveMatch } from "../match/simulate";
import { COMP, newId, type ClubId, type CompetitionId, type GameState, type Sponsor } from "../model";
import type { Rng } from "../rng";
import { postToClub } from "./messages";
import { book, isOverLimit, wageBill } from "./money";
import { STADIUM, attendance, optimalPrice } from "./stadium";
import { clubLeague, formatEuro, isLeagueMatchday, roundTo } from "./util";

export const TV_PER_MATCHDAY: Record<string, number> = { [COMP.first]: 100_000, [COMP.second]: 30_000 };
export const INTEREST_RATE = 0.01;
export const PRIZE_POOL: Record<string, number> = { [COMP.first]: 3_000_000, [COMP.second]: 1_000_000 };

const SPONSOR_NAMES = [
  "Brauerei Hopfenkrone", "Autohaus Kolbenring", "Stadtwerke Lichtblick", "Bäckerei Goldkorn",
  "Versicherung Treuhand", "Elektro Blitz", "Möbel Eichenstolz", "Molkerei Weidenglück",
  "Baumarkt Schraubwerk", "Reisebüro Fernweh", "Sparkasse Taler", "Druckerei Letter",
];

export function sponsorOffers(state: GameState, clubId: ClubId, rng: Rng): Sponsor[] {
  const club = state.clubs[clubId];
  const factor = clubLeague(state, clubId) === COMP.second ? 0.6 : 1;
  return rng.shuffle(SPONSOR_NAMES).slice(0, 3).map((name) => {
    const perMatchday = roundTo(club.reputation * 1000 * factor * (0.85 + rng.next() * 0.3), 1000);
    return { id: newId(state, "sp"), name, perMatchday, bonus: roundTo(perMatchday * 8 * (0.5 + rng.next()), 10_000) };
  });
}

export function chooseSponsor(state: GameState, clubId: ClubId, offerId: string): string | null {
  const f = state.clubs[clubId].finance;
  if (f.sponsor) return "Der Sponsorvertrag für diese Saison steht schon.";
  const offer = f.sponsorOffers.find((o) => o.id === offerId);
  if (!offer) return "Dieses Angebot gibt es nicht.";
  f.sponsor = offer;
  return null;
}

export function processFinances(state: GameState, lives: LiveMatch[]): void {
  for (const l of lives) {
    const home = state.clubs[l.home.club];
    const att = attendance(state, home.id, l.away.club);
    home.finance.lastAttendance = att;
    if (att > 0) book(state, home.id, "tickets", att * home.finance.ticketPrice);
  }
  if (!isLeagueMatchday(state.calendarIndex)) return;
  for (const club of Object.values(state.clubs)) {
    const league = clubLeague(state, club.id);
    if (!league) continue;
    const f = club.finance;
    if (!f.sponsor && f.sponsorOffers.length > 0) {
      f.sponsor =
        club.managerId === null
          ? f.sponsorOffers.reduce((best, o) => (o.perMatchday > best.perMatchday ? o : best))
          : f.sponsorOffers[0];
      postToClub(state, club.id, `Kein Sponsor gewählt – ${f.sponsor.name} wurde automatisch genommen.`);
    }
    book(state, club.id, "tv", TV_PER_MATCHDAY[league]);
    if (f.sponsor) book(state, club.id, "sponsor", f.sponsor.perMatchday);
    const wages = wageBill(state, club.id);
    if (wages > 0) book(state, club.id, "salaries", -wages);
    book(state, club.id, "upkeep", -STADIUM[f.stadiumStage].upkeep);
    if (f.balance < 0) book(state, club.id, "interest", Math.round(f.balance * INTEREST_RATE));
    if (f.building) {
      const left = f.building.matchdaysLeft - 1;
      if (left <= 0) {
        f.stadiumStage = f.building.stage;
        f.building = null;
        postToClub(state, club.id, `Der Stadionausbau ist fertig: jetzt ${STADIUM[f.stadiumStage].capacity} Plätze.`);
      } else f.building = { ...f.building, matchdaysLeft: left };
    }
    f.overdraftStreak = isOverLimit(club) ? f.overdraftStreak + 1 : 0;
    if (f.overdraftStreak === 1) {
      postToClub(state, club.id, "Achtung: Das Konto liegt über dem Dispo-Limit. Transfers sind gesperrt.");
    }
  }
}

export function seasonEndFinances(state: GameState, tables: Record<CompetitionId, ClubId[]>, met: (clubId: ClubId) => boolean): void {
  for (const league of [COMP.first, COMP.second]) {
    (tables[league] ?? []).forEach((clubId, i) => {
      book(state, clubId, "prizes", roundTo((PRIZE_POOL[league] * (18 - i)) / 18, 10_000));
    });
  }
  for (const club of Object.values(state.clubs)) {
    const sponsor = club.finance.sponsor;
    if (sponsor && met(club.id)) {
      book(state, club.id, "bonus", sponsor.bonus);
      postToClub(state, club.id, `Saisonziel erreicht: ${sponsor.name} zahlt ${formatEuro(sponsor.bonus)} Prämie.`);
    }
  }
}

export function startSeasonFinances(state: GameState, rng: Rng): void {
  for (const club of Object.values(state.clubs)) {
    const f = club.finance;
    f.ledger = [];
    f.sponsor = null;
    f.sponsorOffers = sponsorOffers(state, club.id, rng);
    if (club.managerId === null) f.ticketPrice = optimalPrice(club.reputation);
    else postToClub(state, club.id, "Neue Sponsorangebote liegen vor.", { type: "sponsor", id: f.sponsorOffers[0].id });
  }
}
