import type { Caller } from '../auth/firebase-token'
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import { fieldSegment } from '../firestore/values'
import {
  as,
  type MemberDoc,
  type OrgDoc,
  paths,
  type SeasonDoc,
  toDoc,
  type UserOrgDoc,
} from '../repositories/documents'
import { randomId } from './ids'
import { checkSlug, dateIn, isDate, type OrgSettings, parseSettings } from './rules'

export interface CreateOrg {
  name: string
  slug: string
  settings?: Partial<OrgSettings>
  season?: { endsOn?: string; prize?: string }
}

function cleanName(value: unknown): string {
  const name = String(value ?? '').trim()
  if (name.length < 2 || name.length > 60) throw new ApiError('invalid_request', { field: 'name' })
  return name
}

function cleanPrize(value: unknown): string {
  const prize = String(value ?? '').trim()
  if (prize.length > 200) throw new ApiError('invalid_request', { field: 'prize' })
  return prize
}

/** The season's last day: the one sent, or 31 December of this year (or the next, from December on). */
export function seasonEnd(value: unknown, today: string): string {
  if (value !== undefined && value !== null && value !== '') {
    if (!isDate(value) || value < today) throw new ApiError('invalid_request', { field: 'endsOn' })
    return value
  }
  const year = Number(today.slice(0, 4))
  return today.slice(5) >= '12-01' ? `${year + 1}-12-31` : `${year}-12-31`
}

export function newMember(caller: Caller, role: MemberDoc['role'], seasonId: string, now: Date): MemberDoc {
  return {
    uid: caller.uid,
    name: caller.name,
    picture: caller.picture,
    role,
    joinedAt: now,
    seasonId,
    balance: 0,
    given: { date: '', amount: 0 },
    received: { date: '', amount: 0 },
  }
}

export async function createOrg(store: Firestore, caller: Caller, input: CreateOrg): Promise<{ orgId: string; slug: string }> {
  const name = cleanName(input.name)
  const slug = String(input.slug ?? '').trim().toLowerCase()
  checkSlug(slug)
  const settings = parseSettings(input.settings)
  const now = new Date()
  const today = dateIn(settings.timezone, now)
  const endsOn = seasonEnd(input.season?.endsOn, today)
  const prize = cleanPrize(input.season?.prize)
  const orgId = randomId()
  const seasonId = randomId()

  return store.transaction(async (tx) => {
    const [taken] = await tx.getAll([paths.slug(slug)])
    if (taken) throw new ApiError('slug_taken')
    const org: OrgDoc = {
      name,
      slug,
      settings,
      seasonId,
      ownerUid: caller.uid,
      inviteHash: null,
      memberCount: 1,
      createdAt: now,
    }
    const season: SeasonDoc = {
      number: 1,
      startedAt: now,
      endsOn,
      prize,
      status: 'open',
      board: { [caller.uid]: { name: caller.name, picture: caller.picture, balance: 0 } },
    }
    const index: UserOrgDoc = { name, slug, role: 'owner' }
    const writes: Write[] = [
      { path: paths.slug(slug), fields: { orgId }, exists: false },
      { path: paths.org(orgId), fields: toDoc(org), exists: false },
      { path: paths.member(orgId, caller.uid), fields: toDoc(newMember(caller, 'owner', seasonId, now)), exists: false },
      { path: paths.season(orgId, seasonId), fields: toDoc(season), exists: false },
      { path: paths.userOrg(caller.uid, orgId), fields: toDoc(index) },
    ]
    return { writes, result: { orgId, slug } }
  })
}

/** The organization a slug names, only for its members (docs/decisions/organizations.md). */
export async function resolveSlug(store: Firestore, caller: Caller, slug: string): Promise<{ orgId: string }> {
  const pointer = await store.get(paths.slug(slug.toLowerCase()))
  const orgId = typeof pointer?.orgId === 'string' ? pointer.orgId : undefined
  if (!orgId) throw new ApiError('not_found')
  const member = await store.get(paths.member(orgId, caller.uid))
  if (!member) throw new ApiError('not_found')
  return { orgId }
}

export interface UpdateOrg {
  name?: string
  settings?: Partial<OrgSettings>
  season?: { endsOn?: string; prize?: string }
}

export async function updateOrg(store: Firestore, orgId: string, input: UpdateOrg): Promise<void> {
  await store.transaction(async (tx) => {
    const [orgDoc] = await tx.getAll([paths.org(orgId)])
    const org = as<OrgDoc>(orgDoc)
    if (!org) throw new ApiError('not_found')
    const writes: Write[] = []
    const fields: Partial<OrgDoc> = {}
    const mask: string[] = []
    if (input.name !== undefined) {
      fields.name = cleanName(input.name)
      mask.push('name')
    }
    if (input.settings !== undefined) {
      fields.settings = parseSettings(input.settings, org.settings)
      mask.push('settings')
    }
    if (mask.length) writes.push({ path: paths.org(orgId), fields: toDoc(fields), mask, exists: true })
    if (input.season !== undefined) {
      const today = dateIn((fields.settings ?? org.settings).timezone, new Date())
      const season: Partial<SeasonDoc> = {}
      const seasonMask: string[] = []
      if (input.season.endsOn !== undefined) {
        season.endsOn = seasonEnd(input.season.endsOn, today)
        seasonMask.push('endsOn')
      }
      if (input.season.prize !== undefined) {
        season.prize = cleanPrize(input.season.prize)
        seasonMask.push('prize')
      }
      if (seasonMask.length) {
        writes.push({ path: paths.season(orgId, org.seasonId), fields: toDoc(season), mask: seasonMask, exists: true })
      }
    }
    // A renamed organization renames its entry in each member's list.
    if (fields.name) {
      for (const { id } of await store.list(`orgs/${orgId}/members`)) {
        writes.push({ path: paths.userOrg(id, orgId), fields: { name: fields.name }, mask: ['name'] })
      }
    }
    return { writes, result: undefined }
  })
}

export function boardField(uid: string): string {
  return `board.${fieldSegment(uid)}`
}
