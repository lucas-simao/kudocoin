// Requests (docs/decisions/claims-and-requests.md): a member asks another for coins with a reason. The one
// asked pays (an ordinary give, under every rule) or declines; nothing is ever paid by itself.
import type { Caller } from '../auth/firebase-token'
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import { fieldSegment } from '../firestore/values'
import { as, type MemberDoc, type OrgDoc, paths, type RequestDoc, toDoc } from '../repositories/documents'
import { addDays } from './cadence'
import { move } from './give'
import { isEntryKey, sha256 } from './ids'
import { dateIn, MAX_REASON } from './rules'

export const MAX_OPEN_REQUESTS = 3
export const REQUEST_DAYS = 7

export interface Ask {
  to: string
  amount: number
  reason: string
  /** The client's idempotency key, which becomes the request's id. */
  key: string
}

function openField(uid: string): string {
  return `openRequestsTo.${fieldSegment(uid)}`
}

export async function askCoins(store: Firestore, orgId: string, caller: Caller, input: Ask): Promise<{ requestId: string; number: number }> {
  if (!isEntryKey(input.key)) throw new ApiError('invalid_request', { field: 'key' })
  if (typeof input.to !== 'string' || !input.to) throw new ApiError('invalid_request', { field: 'to' })
  const amount = Number(input.amount)
  const reason = String(input.reason ?? '').trim()

  return store.transaction(async (tx) => {
    const [orgDoc, meDoc, themDoc, existingDoc] = await tx.getAll([
      paths.org(orgId),
      paths.member(orgId, caller.uid),
      paths.member(orgId, input.to),
      paths.request(orgId, input.key),
    ])
    const org = as<OrgDoc>(orgDoc)
    const me = as<MemberDoc>(meDoc)
    if (!org || !me) throw new ApiError('not_found')
    const existing = as<RequestDoc>(existingDoc)
    if (existing) {
      if (existing.from !== caller.uid) throw new ApiError('conflict')
      return { writes: [], result: { requestId: input.key, number: existing.number } }
    }
    if (input.to === caller.uid) throw new ApiError('self_give')
    const them = as<MemberDoc>(themDoc)
    if (!them) throw new ApiError('not_a_member')
    const most = org.settings.maxPerGive
    if (!Number.isInteger(amount) || amount < 1 || amount > most) throw new ApiError('amount_invalid', { max: most })
    if (!reason) throw new ApiError('reason_required')
    if (reason.length > MAX_REASON) throw new ApiError('reason_too_long', { max: MAX_REASON })

    // Open requests hold a slot; answered or expired ones give it back here.
    const today = dateIn(org.settings.timezone, new Date())
    const held = Object.entries(me.openRequestsTo ?? {})
    const heldDocs = held.length ? await tx.getAll(held.map(([, id]) => paths.request(orgId, id))) : []
    const stillOpen: string[] = []
    const freed: string[] = []
    held.forEach(([uid], index) => {
      const request = as<RequestDoc>(heldDocs[index])
      if (request && request.status === 'open' && today <= request.expiresOn) stillOpen.push(uid)
      else freed.push(uid)
    })
    if (stillOpen.includes(input.to)) {
      const id = me.openRequestsTo![input.to]
      const open = as<RequestDoc>(heldDocs[held.findIndex(([uid]) => uid === input.to)])
      throw new ApiError('request_open', { number: open?.number ?? 0, id })
    }
    if (stillOpen.length >= MAX_OPEN_REQUESTS) throw new ApiError('requests_limit', { max: MAX_OPEN_REQUESTS })

    const number = (org.requestCount ?? 0) + 1
    const request: RequestDoc = {
      number,
      from: caller.uid,
      fromName: me.name,
      to: input.to,
      toName: them.name,
      amount,
      reason,
      status: 'open',
      day: today,
      expiresOn: addDays(today, REQUEST_DAYS),
      createdAt: new Date(),
    }
    const writes: Write[] = [
      { path: paths.request(orgId, input.key), fields: toDoc(request), exists: false },
      { path: paths.org(orgId), fields: { requestCount: number }, mask: ['requestCount'], exists: true },
      // One write to the member: the new slot, and the freed ones removed (in the mask, not in the fields).
      {
        path: paths.member(orgId, caller.uid),
        fields: { openRequestsTo: { [input.to]: input.key } },
        mask: [...freed.map(openField), openField(input.to)],
        exists: true,
      },
    ]
    return { writes, result: { requestId: input.key, number } }
  })
}

/** Closes a request and gives the asker's slot back. */
async function close(
  store: Firestore,
  orgId: string,
  requestId: string,
  check: (request: RequestDoc) => void,
  fields: Record<string, unknown>,
): Promise<RequestDoc> {
  return store.transaction(async (tx) => {
    const [requestDoc] = await tx.getAll([paths.request(orgId, requestId)])
    const request = as<RequestDoc>(requestDoc)
    if (!request) throw new ApiError('not_found')
    check(request)
    const [askerDoc] = await tx.getAll([paths.member(orgId, request.from)])
    const writes: Write[] = [
      { path: paths.request(orgId, requestId), fields: { ...fields, answeredAt: new Date() }, mask: [...Object.keys(fields), 'answeredAt'], exists: true },
    ]
    if (askerDoc && (askerDoc as unknown as MemberDoc).openRequestsTo?.[request.to] === requestId) {
      writes.push({ path: paths.member(orgId, request.from), fields: {}, mask: [openField(request.to)], exists: true })
    }
    return { writes, result: request }
  })
}

function mustBeOpen(request: RequestDoc, today?: string): void {
  if (request.status !== 'open') throw new ApiError('request_closed', { status: request.status })
  if (today && today > request.expiresOn) throw new ApiError('request_expired', { expiresOn: request.expiresOn })
}

/** The one asked pays: a give from them to the asker, with the request's reason. */
export async function payRequest(store: Firestore, orgId: string, caller: Caller, requestId: string): Promise<{ entryId: string; allowanceLeft: number | null }> {
  const [orgDoc, requestDoc] = await store.getAll([paths.org(orgId), paths.request(orgId, requestId)])
  const org = as<OrgDoc>(orgDoc)
  const request = as<RequestDoc>(requestDoc)
  if (!org || !request) throw new ApiError('not_found')
  if (request.to !== caller.uid) throw new ApiError('not_yours')
  // The give's key comes from the request, so a retry after a failure in between pays once.
  const key = `rq-${(await sha256(`${orgId}:${requestId}`)).slice(0, 40)}`
  if (!(request.status === 'paid' && request.entryId === key)) mustBeOpen(request, dateIn(org.settings.timezone, new Date()))
  const given = await move(store, orgId, caller, { kind: 'give', to: request.from, amount: request.amount, reason: request.reason, key })
  // The coins moved: the request says so, even if it was answered another way in the meantime.
  await close(store, orgId, requestId, () => {}, { status: 'paid', entryId: given.entryId })
  return { entryId: given.entryId, allowanceLeft: given.allowanceLeft }
}

export async function declineRequest(store: Firestore, orgId: string, caller: Caller, requestId: string): Promise<RequestDoc> {
  return close(store, orgId, requestId, (request) => {
    if (request.to !== caller.uid) throw new ApiError('not_yours')
    mustBeOpen(request)
  }, { status: 'declined' })
}

export async function cancelRequest(store: Firestore, orgId: string, caller: Caller, requestId: string): Promise<RequestDoc> {
  return close(store, orgId, requestId, (request) => {
    if (request.from !== caller.uid) throw new ApiError('not_yours')
    mustBeOpen(request)
  }, { status: 'cancelled' })
}

/** The request an organization calls #number, for Slack. */
export async function requestByNumber(store: Firestore, orgId: string, number: number): Promise<{ id: string; request: RequestDoc } | null> {
  const [row] = await store.where(paths.org(orgId), 'requests', 'number', number, 1)
  return row ? { id: row.id, request: row.doc as unknown as RequestDoc } : null
}

/** Open requests to and from someone, for Slack. */
export async function openRequests(store: Firestore, orgId: string, uid: string): Promise<{ toMe: RequestDoc[]; mine: RequestDoc[] }> {
  const [toMe, mine] = await Promise.all([
    store.where(paths.org(orgId), 'requests', 'to', uid, 50),
    store.where(paths.org(orgId), 'requests', 'from', uid, 50),
  ])
  const open = (rows: { doc: unknown }[]) =>
    rows.map((row) => row.doc as RequestDoc).filter((request) => request.status === 'open').sort((a, b) => a.number - b.number)
  return { toMe: open(toMe), mine: open(mine) }
}
