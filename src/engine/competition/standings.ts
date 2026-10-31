import type { ClubId, Competition } from "../model";

export interface StandingRow {
  club: ClubId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

function emptyRow(club: ClubId): StandingRow {
  return { club, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
}

function addResult(row: StandingRow, scored: number, conceded: number): void {
  row.played++;
  row.goalsFor += scored;
  row.goalsAgainst += conceded;
  row.goalDiff = row.goalsFor - row.goalsAgainst;
  if (scored > conceded) {
    row.won++;
    row.points += 3;
  } else if (scored === conceded) {
    row.drawn++;
    row.points += 1;
  } else row.lost++;
}

/** Negativ, wenn a im direkten Vergleich besser ist. */
function headToHead(c: Competition, a: ClubId, b: ClubId): number {
  const ra = emptyRow(a);
  const rb = emptyRow(b);
  for (const m of c.matches) {
    if (!m.result) continue;
    if (m.home === a && m.away === b) {
      addResult(ra, m.result.home, m.result.away);
      addResult(rb, m.result.away, m.result.home);
    } else if (m.home === b && m.away === a) {
      addResult(rb, m.result.home, m.result.away);
      addResult(ra, m.result.away, m.result.home);
    }
  }
  return rb.points - ra.points || rb.goalDiff - ra.goalDiff;
}

export function computeStandings(c: Competition): StandingRow[] {
  const rows = new Map(c.clubs.map((id) => [id, emptyRow(id)]));
  for (const m of c.matches) {
    if (!m.result) continue;
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    if (!h || !a) continue;
    addResult(h, m.result.home, m.result.away);
    addResult(a, m.result.away, m.result.home);
  }
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.goalDiff - x.goalDiff ||
      y.goalsFor - x.goalsFor ||
      headToHead(c, x.club, y.club) ||
      x.club.localeCompare(y.club),
  );
}
