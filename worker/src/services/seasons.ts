// Closing a season: docs/decisions/seasons.md. Members keep their old balance on their document; it counts
// as zero once the organization points at the new season, so closing writes no member document.
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import { as, type BoardRow, type OrgDoc, paths, type SeasonDoc, toDoc } from '../repositories/documents'
import { closesAt, nextSprint } from './cadence'
import { randomId } from './ids'
import { seasonEnd } from './orgs'
import { dateIn } from './rules'

export function standings(board: Record<string, BoardRow>): (BoardRow & { uid: string; place: number })[] {
  const rows = Object.entries(board)
    .map(([uid, row]) => ({ uid, ...row }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  // Equal balances share a place: 1, 2, 2, 4.
  let place = 0
  return rows.map((row, index) => {
    if (index === 0 || row.balance !== rows[index - 1].balance) place = index + 1
    return { ...row, place }
  })
}

export async function closeSeason(
  store: Firestore,
  orgId: string,
  next: { endsOn?: string; prize?: string },
  options: { auto?: boolean } = {},
): Promise<{ seasonId: string } | null> {
  return store.transaction(async (tx) => {
    const [orgDoc] = await tx.getAll([paths.org(orgId)])
    const org = as<OrgDoc>(orgDoc)
    if (!org) throw new ApiError('not_found')
    const [seasonDoc] = await tx.getAll([paths.season(orgId, org.seasonId)])
    const season = as<SeasonDoc>(seasonDoc)
    if (!season) throw new ApiError('internal')
    const now = new Date()
    const today = dateIn(org.settings.timezone, now)
    if (options.auto) {
      // The hourly job: only what is due. A season already closed has moved closesAt on, so a run twice is a no-op.
      if (!org.closesAt || org.closesAt.getTime() > now.getTime()) return { writes: [], result: null }
    } else if (today < season.endsOn) {
      // Offered from the last day on, so the group can close it on the day it meets.
      throw new ApiError('season_not_ended', { endsOn: season.endsOn })
    }
    // Sprints follow each other without gaps (docs/decisions/sprints.md); by hand, the next one starts today.
    const weeks = org.sprintWeeks ?? null
    const dates = weeks ? nextSprint(season.endsOn, weeks, today) : { startsOn: today, endsOn: seasonEnd(next.endsOn, today) }
    const prize = String(next.prize ?? season.prize).trim().slice(0, 200)
    const seasonId = randomId()
    const fresh: SeasonDoc = {
      number: season.number + 1,
      startedAt: now,
      startsOn: dates.startsOn,
      endsOn: dates.endsOn,
      prize,
      status: 'open',
      board: Object.fromEntries(
        Object.entries(season.board).map(([uid, row]) => [uid, { name: row.name, picture: row.picture, balance: 0 }]),
      ),
    }
    const writes: Write[] = [
      {
        path: paths.season(orgId, org.seasonId),
        fields: toDoc({ status: 'closed', closedAt: now, standings: standings(season.board) }),
        mask: ['status', 'closedAt', 'standings'],
        exists: true,
      },
      { path: paths.season(orgId, seasonId), fields: toDoc(fresh), exists: false },
      {
        path: paths.org(orgId),
        fields: { seasonId, closesAt: closesAt(dates.endsOn, org.settings.timezone, weeks) },
        mask: ['seasonId', 'closesAt'],
        exists: true,
      },
    ]
    return { writes, result: { seasonId } }
  })
}
