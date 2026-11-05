// The rules against the Firestore emulator: two organizations, and a member of one sees nothing of the other.
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kudocoin',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  })
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    for (const [orgId, people] of [
      ['org-a', { ana: 'owner', bruno: 'member' }],
      ['org-b', { carla: 'owner', davi: 'admin' }],
    ] as const) {
      await setDoc(doc(db, `orgs/${orgId}`), { name: orgId, seasonId: 's1' })
      await setDoc(doc(db, `orgs/${orgId}/seasons/s1`), { board: {} })
      await setDoc(doc(db, `orgs/${orgId}/ledger/e1`), { amount: 1 })
      await setDoc(doc(db, `orgs/${orgId}/admin/invite`), { token: 'secret' })
      for (const [uid, role] of Object.entries(people)) {
        await setDoc(doc(db, `orgs/${orgId}/members/${uid}`), { uid, role, balance: 0 })
        await setDoc(doc(db, `users/${uid}`), { name: uid })
        await setDoc(doc(db, `users/${uid}/orgs/${orgId}`), { role })
      }
    }
    await setDoc(doc(db, 'slugs/team-a'), { orgId: 'org-a' })
    await setDoc(doc(db, 'invites/hash-a'), { orgId: 'org-a' })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

const as = (uid: string) => env.authenticatedContext(uid).firestore()

describe('a member', () => {
  it('reads their own organization, its members, seasons and ledger', async () => {
    const db = as('bruno')
    await assertSucceeds(getDoc(doc(db, 'orgs/org-a')))
    await assertSucceeds(getDocs(collection(db, 'orgs/org-a/members')))
    await assertSucceeds(getDoc(doc(db, 'orgs/org-a/seasons/s1')))
    await assertSucceeds(getDocs(query(collection(db, 'orgs/org-a/ledger'), limit(20))))
  })

  it('reads nothing of another organization', async () => {
    const db = as('bruno')
    await assertFails(getDoc(doc(db, 'orgs/org-b')))
    await assertFails(getDocs(collection(db, 'orgs/org-b/members')))
    await assertFails(getDoc(doc(db, 'orgs/org-b/seasons/s1')))
    await assertFails(getDocs(collection(db, 'orgs/org-b/ledger')))
  })

  it('cannot read the invite link unless an admin', async () => {
    await assertFails(getDoc(doc(as('bruno'), 'orgs/org-a/admin/invite')))
    await assertSucceeds(getDoc(doc(as('ana'), 'orgs/org-a/admin/invite')))
    await assertSucceeds(getDoc(doc(as('davi'), 'orgs/org-b/admin/invite')))
    await assertFails(getDoc(doc(as('ana'), 'orgs/org-b/admin/invite')))
  })

  it('reads only their own profile and list of organizations', async () => {
    await assertSucceeds(getDoc(doc(as('bruno'), 'users/bruno')))
    await assertSucceeds(getDocs(collection(as('bruno'), 'users/bruno/orgs')))
    await assertFails(getDoc(doc(as('bruno'), 'users/ana')))
    await assertFails(getDocs(collection(as('bruno'), 'users/ana/orgs')))
  })

  it('never reads slugs or invites', async () => {
    await assertFails(getDoc(doc(as('ana'), 'slugs/team-a')))
    await assertFails(getDoc(doc(as('ana'), 'invites/hash-a')))
  })
})

describe('no client', () => {
  it('writes a balance, a ledger entry, a role or a season', async () => {
    const db = as('ana')
    await assertFails(updateDoc(doc(db, 'orgs/org-a/members/ana'), { balance: 1000 }))
    await assertFails(updateDoc(doc(db, 'orgs/org-a/members/bruno'), { role: 'owner' }))
    await assertFails(setDoc(doc(db, 'orgs/org-a/ledger/e2'), { amount: 1000 }))
    await assertFails(deleteDoc(doc(db, 'orgs/org-a/ledger/e1')))
    await assertFails(updateDoc(doc(db, 'orgs/org-a/seasons/s1'), { board: {} }))
    await assertFails(setDoc(doc(db, 'orgs/org-new'), { name: 'new' }))
    await assertFails(setDoc(doc(db, 'users/ana'), { name: 'x' }))
  })

  it('reads anything without signing in', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'orgs/org-a')))
    await assertFails(getDocs(collection(db, 'orgs/org-a/members')))
  })
})
