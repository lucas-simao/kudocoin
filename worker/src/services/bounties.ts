// Bounties (docs/decisions/bounties.md): coins offered for a task, from the offerer's allowance, paid to
// whoever did it. Each change is one Firestore transaction, like a give.
import type { Caller } from '../auth/firebase-token'
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import {
  as,
  balanceIn,
  type BountyDoc,
  type LedgerDoc,
  type MemberDoc,
  type OrgDoc,
  paths,
  type SeasonDoc,
  toDoc,
} from '../repositories/documents'
import { addDays } from './cadence'
import { isEntryKey } from './ids'
import { boardField } from './orgs'
import { countOn, dateIn, MAX_REASON } from './rules'

export const MAX_OPEN = 3
export const LIFETIME_DAYS = 30

export interface Offer {
  amount: number
  task: string
  /** The client's idempotency key, which becomes the bounty's id. */
  key: string
}

export async function offerBounty(
  store: Firestore,
  orgId: string,
  caller: Caller,
  input: Offer,
): Promise<{ bountyId: string; number: number; allowanceLeft: number }> {
  if (!isEntryKey(input.key)) throw new ApiError('invalid_request', { field: 'key' })
  const amount = Number(input.amount)
  const task = String(input.task ?? '').trim()

  return store.transaction(async (tx) => {
    const [orgDoc, memberDoc, existing] = await tx.getAll([paths.org(orgId), paths.member(orgId, caller.uid), paths.bounty(orgId, input.key)])
    const org = as<OrgDoc>(orgDoc)
    const member = as<MemberDoc>(memberDoc)
    if (!org || !member) throw new ApiError('not_found')
    const today = dateIn(org.settings.timezone, new Date())
    const left = org.settings.dailyAllowance - countOn(member.given, today)

    // The same key again: the first request already went through.
    if (existing) {
      const bounty = as<BountyDoc>(existing)!
      if (bounty.by !== caller.uid) throw new ApiError('conflict')
      return { writes: [], result: { bountyId: input.key, number: bounty.number, allowanceLeft: left } }
    }

    // The give rules, in their order (docs/decisions/allowance-and-limits.md), then the bounty's own.
    const most = org.settings.maxPerGive
    if (!Number.isInteger(amount) || amount < 1 || amount > most) throw new ApiError('amount_invalid', { max: most })
    if (!task) throw new ApiError('reason_required')
    if (task.length > MAX_REASON) throw new ApiError('reason_too_long', { max: MAX_REASON })
    if (amount > left) throw new ApiError('allowance_exceeded', { left: Math.max(0, left) })
    const open = member.openBounties ?? 0
    if (open >= MAX_OPEN) throw new ApiError('too_many_bounties', { max: MAX_OPEN })

    const number = (org.bountyCount ?? 0) + 1
    const bounty: BountyDoc = {
      number,
      by: caller.uid,
      byName: member.name,
      amount,
      task,
      status: 'open',
      day: today,
      expiresOn: addDays(today, LIFETIME_DAYS),
      createdAt: new Date(),
    }
    const writes: Write[] = [
      { path: paths.bounty(orgId, input.key), fields: toDoc(bounty), exists: false },
      { path: paths.org(orgId), fields: { bountyCount: number }, mask: ['bountyCount'], exists: true },
      {
        path: paths.member(orgId, caller.uid),
        fields: { given: { date: today, amount: countOn(member.given, today) + amount }, openBounties: open + 1 },
        mask: ['given', 'openBounties'],
        exists: true,
      },
    ]
    return { writes, result: { bountyId: input.key, number, allowanceLeft: left - amount } }
  })
}

/** The offerer, or an admin when the offerer is gone or busy, may pay or cancel. */
function mayHandle(bounty: BountyDoc, caller: Caller, callerMember: MemberDoc): boolean {
  return bounty.by === caller.uid || callerMember.role !== 'member'
}

export async function payBounty(
  store: Firestore,
  orgId: string,
  caller: Caller,
  bountyId: string,
  to: unknown,
): Promise<{ entryId: string; balance: number }> {
  if (typeof to !== 'string' || !to) throw new ApiError('invalid_request', { field: 'to' })
  return store.transaction(async (tx) => {
    const [orgDoc, bountyDoc, callerDoc, receiverDoc] = await tx.getAll([
      paths.org(orgId),
      paths.bounty(orgId, bountyId),
      paths.member(orgId, caller.uid),
      paths.member(orgId, to),
    ])
    const org = as<OrgDoc>(orgDoc)
    const bounty = as<BountyDoc>(bountyDoc)
    const callerMember = as<MemberDoc>(callerDoc)
    const receiver = as<MemberDoc>(receiverDoc)
    if (!org || !bounty || !callerMember) throw new ApiError('not_found')
    if (!mayHandle(bounty, caller, callerMember)) throw new ApiError('forbidden')
    if (bounty.status !== 'open') throw new ApiError('bounty_closed', { status: bounty.status })
    const today = dateIn(org.settings.timezone, new Date())
    if (today > bounty.expiresOn) throw new ApiError('bounty_expired', { expiresOn: bounty.expiresOn })
    if (to === bounty.by) throw new ApiError('self_give')
    if (!receiver) throw new ApiError('not_a_member')
    const [seasonDoc, offererDoc] = await tx.getAll([paths.season(orgId, org.seasonId), paths.member(orgId, bounty.by)])
    const season = as<SeasonDoc>(seasonDoc)
    if (!season || season.status !== 'open') throw new ApiError('season_closed')
    const offerer = as<MemberDoc>(offererDoc)

    const now = new Date()
    // One entry per bounty: its id makes paying twice impossible even if two requests race.
    const entryId = `bounty-${bountyId}`
    const balance = balanceIn(receiver, org.seasonId) + bounty.amount
    const entry: LedgerDoc = {
      kind: 'bounty',
      from: bounty.by,
      fromName: offerer?.name ?? bounty.byName,
      to,
      toName: receiver.name,
      amount: bounty.amount,
      reason: bounty.task,
      seasonId: org.seasonId,
      day: today,
      createdAt: now,
    }
    const writes: Write[] = [
      { path: paths.entry(orgId, entryId), fields: toDoc(entry), exists: false },
      {
        path: paths.member(orgId, to),
        fields: { seasonId: org.seasonId, balance },
        mask: ['seasonId', 'balance'],
        exists: true,
      },
      {
        path: paths.season(orgId, org.seasonId),
        fields: { board: { [to]: { name: receiver.name, picture: receiver.picture, balance } } },
        mask: [boardField(to)],
        exists: true,
      },
      {
        path: paths.bounty(orgId, bountyId),
        fields: { status: 'paid', paidTo: to, paidToName: receiver.name, paidAt: now, entryId },
        mask: ['status', 'paidTo', 'paidToName', 'paidAt', 'entryId'],
        exists: true,
      },
    ]
    if (offerer) {
      writes.push({
        path: paths.member(orgId, bounty.by),
        fields: { openBounties: Math.max(0, (offerer.openBounties ?? 1) - 1) },
        mask: ['openBounties'],
        exists: true,
      })
    }
    return { writes, result: { entryId, balance } }
  })
}

export async function cancelBounty(
  store: Firestore,
  orgId: string,
  caller: Caller,
  bountyId: string,
): Promise<{ refunded: boolean }> {
  return store.transaction(async (tx) => {
    const [orgDoc, bountyDoc, callerDoc] = await tx.getAll([paths.org(orgId), paths.bounty(orgId, bountyId), paths.member(orgId, caller.uid)])
    const org = as<OrgDoc>(orgDoc)
    const bounty = as<BountyDoc>(bountyDoc)
    const callerMember = as<MemberDoc>(callerDoc)
    if (!org || !bounty || !callerMember) throw new ApiError('not_found')
    if (!mayHandle(bounty, caller, callerMember)) throw new ApiError('forbidden')
    if (bounty.status !== 'open') throw new ApiError('bounty_closed', { status: bounty.status })
    const [offererDoc] = await tx.getAll([paths.member(orgId, bounty.by)])
    const offerer = as<MemberDoc>(offererDoc)
    const today = dateIn(org.settings.timezone, new Date())
    // The same day, the allowance comes back; a later day's allowance never held these coins.
    const refunded = Boolean(offerer && bounty.day === today && offerer.given?.date === today)
    const writes: Write[] = [
      {
        path: paths.bounty(orgId, bountyId),
        fields: { status: 'cancelled', cancelledAt: new Date() },
        mask: ['status', 'cancelledAt'],
        exists: true,
      },
    ]
    if (offerer) {
      writes.push({
        path: paths.member(orgId, bounty.by),
        fields: {
          openBounties: Math.max(0, (offerer.openBounties ?? 1) - 1),
          ...(refunded ? { given: { date: today, amount: Math.max(0, offerer.given.amount - bounty.amount) } } : {}),
        },
        mask: refunded ? ['openBounties', 'given'] : ['openBounties'],
        exists: true,
      })
    }
    return { writes, result: { refunded } }
  })
}

/** The bounty an organization calls #number, for Slack. */
export async function bountyByNumber(store: Firestore, orgId: string, number: number): Promise<{ id: string; bounty: BountyDoc } | null> {
  const [row] = await store.where(paths.org(orgId), 'bounties', 'number', number, 1)
  return row ? { id: row.id, bounty: row.doc as unknown as BountyDoc } : null
}

/** The open bounties, oldest first, for Slack. */
export async function openBounties(store: Firestore, orgId: string): Promise<{ id: string; bounty: BountyDoc }[]> {
  const rows = await store.where(paths.org(orgId), 'bounties', 'status', 'open', 50)
  return rows.map((row) => ({ id: row.id, bounty: row.doc as unknown as BountyDoc })).sort((a, b) => a.bounty.number - b.bounty.number)
}
