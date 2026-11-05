// The first lock: no membership, no organization (docs/decisions/organizations.md).
// An organization the caller is not in answers 404, the same as one that does not exist.
import type { Caller } from '../auth/firebase-token'
import { ApiError } from '../errors'
import type { Firestore } from '../firestore/client'
import { as, type MemberDoc, paths, type Role } from '../repositories/documents'

const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 }

export async function requireMember(store: Firestore, orgId: string, caller: Caller): Promise<MemberDoc> {
  const member = as<MemberDoc>(await store.get(paths.member(orgId, caller.uid)))
  if (!member) throw new ApiError('not_found')
  return member
}

export async function requireRole(store: Firestore, orgId: string, caller: Caller, least: Role): Promise<MemberDoc> {
  const member = await requireMember(store, orgId, caller)
  if (RANK[member.role] < RANK[least]) throw new ApiError('forbidden')
  return member
}
