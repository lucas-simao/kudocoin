// The person's own profile and deleting it: docs/decisions/sign-in.md.
import type { Caller } from '../auth/firebase-token'
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import { as, type OrgDoc, paths, toDoc, type UserDoc, type UserOrgDoc } from '../repositories/documents'
import { removalWrites } from './members'

const LANGS = ['pt-BR', 'en'] as const

export interface Profile {
  lang?: string
  github?: string
}

/** Called after each sign-in: keeps the name and picture the provider sends, and the language chosen. */
export async function syncProfile(store: Firestore, caller: Caller, input: Profile): Promise<UserDoc> {
  const existing = as<UserDoc>(await store.get(paths.user(caller.uid)))
  const lang = LANGS.find((code) => code === input.lang) ?? existing?.lang ?? 'en'
  const github =
    caller.provider === 'github.com' && typeof input.github === 'string' && /^[A-Za-z0-9-]{1,39}$/.test(input.github)
      ? input.github
      : (existing?.github ?? null)
  const user: UserDoc = {
    name: caller.name,
    picture: caller.picture,
    github,
    lang,
    createdAt: existing?.createdAt ?? new Date(),
  }
  await store.commit([{ path: paths.user(caller.uid), fields: toDoc(user) }])
  return user
}

/**
 * Leaves every organization and deletes the profile. An owner hands the organization over first, unless
 * they are its only member, in which case it closes with them. The web app then deletes the Firebase user.
 */
export async function deleteAccount(store: Firestore, caller: Caller): Promise<void> {
  const memberships = await store.list(`users/${caller.uid}/orgs`)
  for (const { id: orgId, doc } of memberships) {
    if ((doc as unknown as UserOrgDoc).role !== 'owner') continue
    const org = as<OrgDoc>(await store.get(paths.org(orgId)))
    if (org && org.memberCount > 1) throw new ApiError('last_owner', { slug: org.slug })
  }
  for (const { id: orgId } of memberships) {
    const org = as<OrgDoc>(await store.get(paths.org(orgId)))
    if (!org) {
      await store.commit([{ path: paths.userOrg(caller.uid, orgId), delete: true }])
      continue
    }
    const writes: Write[] =
      org.ownerUid === caller.uid
        ? // The only member: the organization closes. Its address is free again; its ledger stays unreadable.
          [
            { path: paths.member(orgId, caller.uid), delete: true },
            { path: paths.userOrg(caller.uid, orgId), delete: true },
            { path: paths.slug(org.slug), delete: true },
            { path: paths.adminInvite(orgId), delete: true },
            ...(org.inviteHash ? [{ path: paths.invite(org.inviteHash), delete: true }] : []),
            { path: paths.org(orgId), delete: true },
          ]
        : removalWrites(orgId, org, caller.uid)
    await store.commit(writes)
    if (org.ownerUid !== caller.uid) await renameInLedger(store, orgId, caller.uid)
  }
  await store.commit([{ path: paths.user(caller.uid), delete: true }])
}

/** Past entries keep their amounts but no longer carry the person's name; the app shows an empty name as "former member". */
async function renameInLedger(store: Firestore, orgId: string, uid: string): Promise<void> {
  const parent = `orgs/${orgId}`
  for (const [field, nameField] of [['from', 'fromName'], ['to', 'toName']] as const) {
    const rows = await store.where(parent, 'ledger', field, uid, 500)
    for (let start = 0; start < rows.length; start += 400) {
      await store.commit(
        rows.slice(start, start + 400).map(({ id }) => ({
          path: paths.entry(orgId, id),
          fields: { [nameField]: '' },
          mask: [nameField],
          exists: true,
        })),
      )
    }
  }
}
