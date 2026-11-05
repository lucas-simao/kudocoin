// Closing a season: docs/decisions/seasons.md. Members keep their old balance on their document; it counts
// as zero once the organization points at the new season, so closing writes no member document.
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import { as, type BoardRow, type OrgDoc, paths, type SeasonDoc, toDoc } from '../repositories/documents'
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
): Promise<{ seasonId: string }> {
  return store.transaction(async (tx) => {
    const [orgDoc] = await tx.getAll([paths.org(orgId)])
    const org = as<OrgDoc>(orgDoc)
    if (!org) throw new ApiError('not_found')
    const [seasonDoc] = await tx.getAll([paths.season(orgId, org.seasonId)])
    const season = as<SeasonDoc>(seasonDoc)
    if (!season) throw new ApiError('internal')
    const now = new Date()
    const today = dateIn(org.settings.timezone, now)
    // Offered from the last day on, so the group can close it on the day it meets.
    if (today < season.endsOn) throw new ApiError('season_not_ended', { endsOn: season.endsOn })
    const prize = String(next.prize ?? season.prize).trim().slice(0, 200)
    const seasonId = randomId()
    const fresh: SeasonDoc = {
      number: season.number + 1,
      startedAt: now,
      endsOn: seasonEnd(next.endsOn, today),
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
      { path: paths.org(orgId), fields: { seasonId }, mask: ['seasonId'], exists: true },
    ]
    return { writes, result: { seasonId } }
  })
}
