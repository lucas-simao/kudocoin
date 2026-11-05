// Where each document lives and what it holds: docs/decisions/organizations.md and ledger.md.
import type { Doc } from '../firestore/client'
import type { DayCount, OrgSettings } from '../services/rules'

export type Role = 'owner' | 'admin' | 'member'

export interface OrgDoc {
  name: string
  slug: string
  settings: OrgSettings
  seasonId: string
  ownerUid: string
  inviteHash: string | null
  memberCount: number
  createdAt: Date
}

export interface MemberDoc {
  uid: string
  name: string
  picture: string | null
  role: Role
  joinedAt: Date
  /** The season `balance` belongs to. Another season's balance counts as zero. */
  seasonId: string
  balance: number
  given: DayCount
  received: DayCount
}

export interface BoardRow {
  name: string
  picture: string | null
  balance: number
}

export interface SeasonDoc {
  number: number
  startedAt: Date
  /** The season's last day, YYYY-MM-DD, in the organization's time zone. */
  endsOn: string
  prize: string
  status: 'open' | 'closed'
  board: Record<string, BoardRow>
  closedAt?: Date
  standings?: (BoardRow & { uid: string; place: number })[]
}

export type EntryKind = 'give' | 'award' | 'correction'

export interface LedgerDoc {
  kind: EntryKind
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
  reason: string
  seasonId: string
  /** The date in the organization's time zone, YYYY-MM-DD. */
  day: string
  createdAt: Date
}

export interface UserDoc {
  name: string
  picture: string | null
  github: string | null
  lang: 'pt-BR' | 'en' | 'es'
  createdAt: Date
}

export interface UserOrgDoc {
  name: string
  slug: string
  role: Role
}

export interface InviteDoc {
  orgId: string
  createdBy: string
  createdAt: Date
}

export const paths = {
  user: (uid: string) => `users/${uid}`,
  userOrg: (uid: string, orgId: string) => `users/${uid}/orgs/${orgId}`,
  slug: (slug: string) => `slugs/${slug}`,
  org: (orgId: string) => `orgs/${orgId}`,
  member: (orgId: string, uid: string) => `orgs/${orgId}/members/${uid}`,
  season: (orgId: string, seasonId: string) => `orgs/${orgId}/seasons/${seasonId}`,
  entry: (orgId: string, entryId: string) => `orgs/${orgId}/ledger/${entryId}`,
  adminInvite: (orgId: string) => `orgs/${orgId}/admin/invite`,
  invite: (hash: string) => `invites/${hash}`,
}

/** Firestore hands back plain objects; these name what each path holds. */
export function as<T>(doc: Doc | undefined): T | undefined {
  return doc as T | undefined
}

export function toDoc<T extends object>(value: T): Doc {
  return value as unknown as Doc
}

export function balanceIn(member: MemberDoc, seasonId: string): number {
  return member.seasonId === seasonId ? member.balance : 0
}
