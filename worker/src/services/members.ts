import type { Caller } from '../auth/firebase-token'
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import { as, type MemberDoc, type OrgDoc, paths, type Role } from '../repositories/documents'
import { boardField } from './orgs'

const ROLES: Role[] = ['owner', 'admin', 'member']

/**
 * Changes a member's role. Only the owner makes another owner, and doing so makes the old owner an admin:
 * an organization always has exactly one owner.
 */
export async function setRole(store: Firestore, orgId: string, caller: Caller, uid: string, role: Role): Promise<void> {
  if (!ROLES.includes(role)) throw new ApiError('invalid_request', { field: 'role' })
  await store.transaction(async (tx) => {
    const [orgDoc, actorDoc, targetDoc] = await tx.getAll([
      paths.org(orgId),
      paths.member(orgId, caller.uid),
      paths.member(orgId, uid),
    ])
    const org = as<OrgDoc>(orgDoc)
    const actor = as<MemberDoc>(actorDoc)
    const target = as<MemberDoc>(targetDoc)
    if (!org || !actor) throw new ApiError('not_found')
    if (!target) throw new ApiError('not_a_member')
    if (actor.role === 'member') throw new ApiError('forbidden')
    if (target.role === 'owner') throw new ApiError('last_owner')
    if (role === 'owner' && actor.role !== 'owner') throw new ApiError('forbidden')
    if (uid === caller.uid) throw new ApiError('forbidden')
    const writes: Write[] = [
      { path: paths.member(orgId, uid), fields: { role }, mask: ['role'], exists: true },
      { path: paths.userOrg(uid, orgId), fields: { role }, mask: ['role'] },
    ]
    if (role === 'owner') {
      writes.push(
        { path: paths.member(orgId, caller.uid), fields: { role: 'admin' }, mask: ['role'], exists: true },
        { path: paths.userOrg(caller.uid, orgId), fields: { role: 'admin' }, mask: ['role'] },
        { path: paths.org(orgId), fields: { ownerUid: uid }, mask: ['ownerUid'], exists: true },
      )
    }
    return { writes, result: undefined }
  })
}

/**
 * Takes a member out: an admin removing someone, or a member leaving. Their ledger entries stay, so the
 * others' balances still add up; they leave the leaderboard.
 */
export async function removeMember(store: Firestore, orgId: string, caller: Caller, uid: string): Promise<void> {
  await store.transaction(async (tx) => {
    const [orgDoc, actorDoc, targetDoc] = await tx.getAll([
      paths.org(orgId),
      paths.member(orgId, caller.uid),
      paths.member(orgId, uid),
    ])
    const org = as<OrgDoc>(orgDoc)
    const actor = as<MemberDoc>(actorDoc)
    const target = as<MemberDoc>(targetDoc)
    if (!org || !actor) throw new ApiError('not_found')
    if (!target) throw new ApiError('not_a_member')
    const leaving = uid === caller.uid
    if (!leaving && actor.role === 'member') throw new ApiError('forbidden')
    if (!leaving && target.role === 'admin' && actor.role !== 'owner') throw new ApiError('forbidden')
    if (target.role === 'owner') throw new ApiError('last_owner')
    return { writes: removalWrites(orgId, org, uid), result: undefined }
  })
}

export function removalWrites(orgId: string, org: OrgDoc, uid: string): Write[] {
  return [
    { path: paths.member(orgId, uid), delete: true },
    { path: paths.userOrg(uid, orgId), delete: true },
    // A masked field with no value is deleted.
    { path: paths.season(orgId, org.seasonId), fields: {}, mask: [boardField(uid)], exists: true },
    { path: paths.org(orgId), fields: { memberCount: Math.max(0, org.memberCount - 1) }, mask: ['memberCount'], exists: true },
  ]
}
