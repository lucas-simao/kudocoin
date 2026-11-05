// One active invite link per organization: docs/decisions/invites.md.
import type { Caller } from '../auth/firebase-token'
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import {
  as,
  type InviteDoc,
  type MemberDoc,
  type OrgDoc,
  paths,
  type SeasonDoc,
  toDoc,
  type UserOrgDoc,
} from '../repositories/documents'
import { randomToken, sha256 } from './ids'
import { boardField, newMember } from './orgs'

export const MAX_MEMBERS = 200

/** A new link, turning the old one off. */
export async function newInvite(store: Firestore, orgId: string, caller: Caller): Promise<{ token: string }> {
  const token = randomToken()
  const hash = await sha256(token)
  return store.transaction(async (tx) => {
    const [orgDoc] = await tx.getAll([paths.org(orgId)])
    const org = as<OrgDoc>(orgDoc)
    if (!org) throw new ApiError('not_found')
    const invite: InviteDoc = { orgId, createdBy: caller.uid, createdAt: new Date() }
    const writes: Write[] = [
      { path: paths.invite(hash), fields: toDoc(invite), exists: false },
      { path: paths.adminInvite(orgId), fields: { token, createdAt: new Date() } },
      { path: paths.org(orgId), fields: { inviteHash: hash }, mask: ['inviteHash'], exists: true },
    ]
    if (org.inviteHash) writes.push({ path: paths.invite(org.inviteHash), delete: true })
    return { writes, result: { token } }
  })
}

export async function turnOffInvite(store: Firestore, orgId: string): Promise<void> {
  await store.transaction(async (tx) => {
    const [orgDoc] = await tx.getAll([paths.org(orgId)])
    const org = as<OrgDoc>(orgDoc)
    if (!org) throw new ApiError('not_found')
    const writes: Write[] = [
      { path: paths.adminInvite(orgId), delete: true },
      { path: paths.org(orgId), fields: { inviteHash: null }, mask: ['inviteHash'], exists: true },
    ]
    if (org.inviteHash) writes.push({ path: paths.invite(org.inviteHash), delete: true })
    return { writes, result: undefined }
  })
}

async function inviteFor(store: Firestore, token: string): Promise<{ hash: string; invite: InviteDoc }> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new ApiError('invite_invalid')
  const hash = await sha256(token)
  const invite = as<InviteDoc>(await store.get(paths.invite(hash)))
  if (!invite) throw new ApiError('invite_invalid')
  return { hash, invite }
}

/** What the join screen shows before the click. */
export async function previewInvite(store: Firestore, caller: Caller, token: string) {
  const { invite } = await inviteFor(store, token)
  const [orgDoc, memberDoc] = await store.getAll([paths.org(invite.orgId), paths.member(invite.orgId, caller.uid)])
  const org = as<OrgDoc>(orgDoc)
  if (!org) throw new ApiError('invite_invalid')
  return { name: org.name, slug: org.slug, coinName: org.settings.coinName, memberCount: org.memberCount, isMember: Boolean(memberDoc) }
}

export async function join(store: Firestore, caller: Caller, token: string): Promise<{ orgId: string; slug: string }> {
  const { hash, invite } = await inviteFor(store, token)
  const orgId = invite.orgId
  return store.transaction(async (tx) => {
    const [orgDoc, memberDoc] = await tx.getAll([paths.org(orgId), paths.member(orgId, caller.uid)])
    const org = as<OrgDoc>(orgDoc)
    // A link turned off between the preview and the click.
    if (!org || org.inviteHash !== hash) throw new ApiError('invite_invalid')
    if (memberDoc) return { writes: [], result: { orgId, slug: org.slug } }
    if (org.memberCount >= MAX_MEMBERS) throw new ApiError('forbidden', { max: MAX_MEMBERS })
    const [seasonDoc] = await tx.getAll([paths.season(orgId, org.seasonId)])
    if (!as<SeasonDoc>(seasonDoc)) throw new ApiError('internal')
    const member: MemberDoc = newMember(caller, 'member', org.seasonId, new Date())
    const index: UserOrgDoc = { name: org.name, slug: org.slug, role: 'member' }
    const writes: Write[] = [
      { path: paths.member(orgId, caller.uid), fields: toDoc(member), exists: false },
      {
        path: paths.season(orgId, org.seasonId),
        fields: { board: { [caller.uid]: { name: caller.name, picture: caller.picture, balance: 0 } } },
        mask: [boardField(caller.uid)],
        exists: true,
      },
      { path: paths.userOrg(caller.uid, orgId), fields: toDoc(index) },
      { path: paths.org(orgId), fields: { memberCount: org.memberCount + 1 }, mask: ['memberCount'], exists: true },
    ]
    return { writes, result: { orgId, slug: org.slug } }
  })
}
