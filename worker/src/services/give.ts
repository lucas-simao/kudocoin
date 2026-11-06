// A movement of coins is one Firestore transaction: the ledger entry, both members and the leaderboard
// together (docs/decisions/ledger.md). The rules come from rules.ts.
import type { Caller } from '../auth/firebase-token'
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import {
  as,
  balanceIn,
  type EntryKind,
  type LedgerDoc,
  type MemberDoc,
  type OrgDoc,
  paths,
  type SeasonDoc,
  toDoc,
} from '../repositories/documents'
import { isEntryKey } from './ids'
import { boardField } from './orgs'
import { checkGive, countOn, dateIn, MAX_REASON } from './rules'

export interface Movement {
  /** Bounties are paid by services/bounties.ts. */
  kind: Exclude<EntryKind, 'bounty'>
  to: string
  amount: number
  reason: string
  /** The client's idempotency key, which becomes the entry's id. */
  key: string
}

export interface MovementResult {
  entryId: string
  balance: number
  /** What the giver can still give today; null for awards and corrections. */
  allowanceLeft: number | null
}

export async function move(store: Firestore, orgId: string, caller: Caller, input: Movement): Promise<MovementResult> {
  if (!isEntryKey(input.key)) throw new ApiError('invalid_request', { field: 'key' })
  if (typeof input.to !== 'string' || !input.to) throw new ApiError('invalid_request', { field: 'to' })
  const amount = Number(input.amount)
  const reason = String(input.reason ?? '').trim()

  return store.transaction(async (tx) => {
    const [orgDoc, giverDoc, receiverDoc, existing] = await tx.getAll([
      paths.org(orgId),
      paths.member(orgId, caller.uid),
      paths.member(orgId, input.to),
      paths.entry(orgId, input.key),
    ])
    const org = as<OrgDoc>(orgDoc)
    const giver = as<MemberDoc>(giverDoc)
    const receiver = as<MemberDoc>(receiverDoc)
    if (!org || !giver) throw new ApiError('not_found')
    if (input.kind !== 'give' && giver.role === 'member') throw new ApiError('forbidden')
    const today = dateIn(org.settings.timezone, new Date())

    // The same key again: the first request already went through. Answer as it did.
    if (existing) {
      const entry = as<LedgerDoc>(existing)!
      if (entry.from !== caller.uid) throw new ApiError('conflict')
      return {
        writes: [],
        result: {
          entryId: input.key,
          balance: receiver ? balanceIn(receiver, org.seasonId) : 0,
          allowanceLeft: input.kind === 'give' ? org.settings.dailyAllowance - countOn(giver.given, today) : null,
        },
      }
    }

    const [seasonDoc] = await tx.getAll([paths.season(orgId, org.seasonId)])
    const season = as<SeasonDoc>(seasonDoc)
    if (!season) throw new ApiError('internal')

    if (input.kind === 'correction') {
      // An admin's fix: any whole amount but zero, up or down, always with its reason.
      if (input.to === caller.uid) throw new ApiError('self_give')
      if (!receiver) throw new ApiError('not_a_member')
      if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000) throw new ApiError('amount_invalid', { max: 1000 })
      if (!reason) throw new ApiError('reason_required')
      if (reason.length > MAX_REASON) throw new ApiError('reason_too_long', { max: MAX_REASON })
      if (season.status !== 'open') throw new ApiError('season_closed')
    } else {
      checkGive({
        kind: input.kind,
        giverUid: caller.uid,
        receiverUid: input.to,
        receiverIsMember: Boolean(receiver),
        amount,
        reason,
        settings: org.settings,
        today,
        giverGiven: giver.given,
        receiverReceived: receiver?.received,
        seasonOpen: season.status === 'open',
      })
    }
    const target = receiver!
    const now = new Date()
    const balance = balanceIn(target, org.seasonId) + amount
    const entry: LedgerDoc = {
      kind: input.kind,
      from: caller.uid,
      fromName: giver.name,
      to: input.to,
      toName: target.name,
      amount,
      reason,
      seasonId: org.seasonId,
      day: today,
      createdAt: now,
    }
    const receivedToday = input.kind === 'give' ? countOn(target.received, today) + amount : countOn(target.received, today)
    const writes: Write[] = [
      { path: paths.entry(orgId, input.key), fields: toDoc(entry), exists: false },
      {
        path: paths.member(orgId, input.to),
        fields: { seasonId: org.seasonId, balance, received: { date: today, amount: receivedToday } },
        mask: ['seasonId', 'balance', 'received'],
        exists: true,
      },
      {
        path: paths.season(orgId, org.seasonId),
        fields: { board: { [input.to]: { name: target.name, picture: target.picture, balance } } },
        mask: [boardField(input.to)],
        exists: true,
      },
    ]
    let allowanceLeft: number | null = null
    if (input.kind === 'give') {
      const givenToday = countOn(giver.given, today) + amount
      allowanceLeft = org.settings.dailyAllowance - givenToday
      writes.push({
        path: paths.member(orgId, caller.uid),
        fields: { given: { date: today, amount: givenToday } },
        mask: ['given'],
        exists: true,
      })
    }
    return { writes, result: { entryId: input.key, balance, allowanceLeft } }
  })
}
