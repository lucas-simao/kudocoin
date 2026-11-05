// The whole flow against the real Worker (wrangler dev) and the Firebase emulators: sign-in, an
// organization, an invite, gives and their limits, awards, closing a season, removal, account deletion.
import { beforeAll, describe, expect, it } from 'vitest'

const API = 'http://127.0.0.1:18611'
const AUTH = 'http://127.0.0.1:18612/identitytoolkit.googleapis.com/v1'
const FIRESTORE = 'http://127.0.0.1:18613/v1/projects/demo-kudocoin/databases/(default)/documents'

interface Person {
  uid: string
  token: string
}

async function person(name: string): Promise<Person> {
  const email = `${name.toLowerCase()}-${Date.now()}@kudocoin.test`
  const up = await fetch(`${AUTH}/accounts:signUp?key=emulator`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret-123', returnSecureToken: true }),
  }).then((response) => response.json() as Promise<{ idToken: string; localId: string }>)
  await fetch(`${AUTH}/accounts:update?key=emulator`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: up.idToken, displayName: name }),
  })
  // A fresh token carries the display name.
  const signedIn = await fetch(`${AUTH}/accounts:signInWithPassword?key=emulator`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'secret-123', returnSecureToken: true }),
  }).then((response) => response.json() as Promise<{ idToken: string }>)
  return { uid: up.localId, token: signedIn.idToken }
}

async function call(who: Person | null, method: string, path: string, body?: unknown) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(who ? { authorization: `Bearer ${who.token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as Record<string, any> }
}

/** Reads a document straight from the emulator, past the rules. */
async function read(path: string): Promise<Record<string, any> | undefined> {
  const response = await fetch(`${FIRESTORE}/${path}`, { headers: { authorization: 'Bearer owner' } })
  if (response.status === 404) return undefined
  const doc = (await response.json()) as { fields: Record<string, any> }
  return doc.fields
}

const int = (field: { integerValue?: string } | undefined) => Number(field?.integerValue ?? NaN)

let ana: Person
let bruno: Person
let carla: Person
let orgId: string
const slug = `team-${Date.now().toString(36)}`

beforeAll(async () => {
  ana = await person('Ana')
  bruno = await person('Bruno')
  carla = await person('Carla')
})

describe('the whole flow', () => {
  it('refuses a request without a valid token', async () => {
    expect((await call(null, 'POST', '/api/orgs', {})).status).toBe(401)
    expect((await call({ uid: 'x', token: 'nonsense' }, 'POST', '/api/orgs', {})).status).toBe(401)
  })

  it('syncs the profile', async () => {
    const { status, body } = await call(ana, 'POST', '/api/me', { lang: 'pt-BR' })
    expect(status).toBe(200)
    expect(body.name).toBe('Ana')
    expect(body.lang).toBe('pt-BR')
  })

  it('creates an organization and keeps its address unique', async () => {
    const created = await call(ana, 'POST', '/api/orgs', {
      name: 'Team A',
      slug,
      settings: { dailyAllowance: 5, maxPerGive: 5, maxReceivedPerDay: 20, timezone: 'America/Sao_Paulo' },
      season: { prize: 'Pizza' },
    })
    expect(created.status).toBe(200)
    orgId = created.body.orgId
    expect((await call(ana, 'POST', '/api/orgs', { name: 'Again', slug })).body.error).toBe('slug_taken')
    expect((await call(ana, 'POST', '/api/orgs', { name: 'Bad', slug: 'join' })).body.error).toBe('slug_invalid')
  })

  it('hides the organization from people outside it', async () => {
    expect((await call(ana, 'GET', `/api/slugs/${slug}`)).body.orgId).toBe(orgId)
    expect((await call(bruno, 'GET', `/api/slugs/${slug}`)).status).toBe(404)
    expect((await call(bruno, 'POST', `/api/orgs/${orgId}/give`, { to: ana.uid, amount: 1, reason: 'x', key: 'k'.repeat(20) })).status).toBe(404)
  })

  it('lets people in through the invite link, once', async () => {
    expect((await call(bruno, 'POST', `/api/orgs/${orgId}/invite`)).status).toBe(404)
    const { body } = await call(ana, 'POST', `/api/orgs/${orgId}/invite`)
    const token = body.token as string
    const preview = await call(bruno, 'GET', `/api/join/${token}`)
    expect(preview.body).toMatchObject({ name: 'Team A', isMember: false, memberCount: 1 })
    expect((await call(bruno, 'POST', `/api/join/${token}`)).status).toBe(200)
    expect((await call(bruno, 'POST', `/api/join/${token}`)).status).toBe(200)
    expect(int((await read(`orgs/${orgId}`))?.memberCount)).toBe(2)
    // A new link turns the old one off.
    const second = (await call(ana, 'POST', `/api/orgs/${orgId}/invite`)).body.token as string
    expect((await call(carla, 'GET', `/api/join/${token}`)).body.error).toBe('invite_invalid')
    expect((await call(carla, 'POST', `/api/join/${second}`)).status).toBe(200)
  })

  it('gives coins once per key and keeps the leaderboard in step', async () => {
    const give = { to: bruno.uid, amount: 3, reason: 'Reviewed my PR', key: 'first-give-key-0001' }
    const first = await call(ana, 'POST', `/api/orgs/${orgId}/give`, give)
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ balance: 3, allowanceLeft: 2 })
    const again = await call(ana, 'POST', `/api/orgs/${orgId}/give`, give)
    expect(again.body).toMatchObject({ balance: 3, allowanceLeft: 2 })
    expect(int((await read(`orgs/${orgId}/members/${bruno.uid}`))?.balance)).toBe(3)
    const org = await read(`orgs/${orgId}`)
    const season = await read(`orgs/${orgId}/seasons/${org!.seasonId.stringValue}`)
    expect(int(season!.board.mapValue.fields[bruno.uid].mapValue.fields.balance)).toBe(3)
  })

  it('enforces the rules', async () => {
    const give = (who: Person, to: string, amount: number, reason = 'thanks', key = `k-${Math.random().toString(36).slice(2)}-0000`) =>
      call(who, 'POST', `/api/orgs/${orgId}/give`, { to, amount, reason, key })
    expect((await give(ana, bruno.uid, 3)).body).toMatchObject({ error: 'allowance_exceeded', left: 2 })
    expect((await give(ana, ana.uid, 1)).body.error).toBe('self_give')
    expect((await give(ana, 'nobody', 1)).body.error).toBe('not_a_member')
    expect((await give(bruno, ana.uid, 6)).body.error).toBe('amount_invalid')
    expect((await give(bruno, ana.uid, 1, '')).body.error).toBe('reason_required')
    expect((await call(bruno, 'POST', `/api/orgs/${orgId}/award`, { to: ana.uid, amount: 1, reason: 'x', key: 'award-by-member-01' })).status).toBe(403)
  })

  it('lets an admin award coins outside the allowance', async () => {
    const award = await call(ana, 'POST', `/api/orgs/${orgId}/award`, { to: bruno.uid, amount: 10, reason: 'Gave a talk', key: 'award-key-000000001' })
    expect(award.body).toMatchObject({ balance: 13 })
  })

  it('changes settings and closes the season on its last day', async () => {
    expect((await call(bruno, 'PATCH', `/api/orgs/${orgId}`, { name: 'Hacked' })).status).toBe(403)
    expect((await call(ana, 'POST', `/api/orgs/${orgId}/seasons/close`, {})).body.error).toBe('season_not_ended')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    expect((await call(ana, 'PATCH', `/api/orgs/${orgId}`, { season: { endsOn: today } })).status).toBe(200)
    const before = (await read(`orgs/${orgId}`))!.seasonId.stringValue
    const closed = await call(ana, 'POST', `/api/orgs/${orgId}/seasons/close`, { prize: 'Tacos' })
    expect(closed.status).toBe(200)
    const old = await read(`orgs/${orgId}/seasons/${before}`)
    expect(old!.status.stringValue).toBe('closed')
    const first = old!.standings.arrayValue.values[0].mapValue.fields
    expect(first.uid.stringValue).toBe(bruno.uid)
    expect(int(first.place)).toBe(1)
    const fresh = await read(`orgs/${orgId}/seasons/${closed.body.seasonId}`)
    expect(int(fresh!.board.mapValue.fields[bruno.uid].mapValue.fields.balance)).toBe(0)
    // The first give of the new season starts from zero.
    const give = await call(carla, 'POST', `/api/orgs/${orgId}/give`, { to: bruno.uid, amount: 1, reason: 'New season', key: 'new-season-give-0001' })
    expect(give.body).toMatchObject({ balance: 1 })
  })

  it('hands over ownership, removes a member, and lets someone leave', async () => {
    expect((await call(ana, 'PUT', `/api/orgs/${orgId}/members/${bruno.uid}/role`, { role: 'admin' })).status).toBe(200)
    expect((await call(bruno, 'DELETE', `/api/orgs/${orgId}/members/${ana.uid}`)).body.error).toBe('last_owner')
    expect((await call(bruno, 'DELETE', `/api/orgs/${orgId}/members/${carla.uid}`)).status).toBe(200)
    expect(await read(`orgs/${orgId}/members/${carla.uid}`)).toBe(undefined)
    expect(await read(`users/${carla.uid}/orgs/${orgId}`)).toBe(undefined)
    expect((await call(ana, 'PUT', `/api/orgs/${orgId}/members/${bruno.uid}/role`, { role: 'owner' })).status).toBe(200)
    expect((await read(`orgs/${orgId}`))!.ownerUid.stringValue).toBe(bruno.uid)
    expect((await call(ana, 'DELETE', `/api/orgs/${orgId}/members/${ana.uid}`)).status).toBe(200)
  })

  it('deletes an account and clears the name from the ledger', async () => {
    expect((await call(bruno, 'DELETE', '/api/me')).status).toBe(200)
    expect(await read(`users/${bruno.uid}`)).toBe(undefined)
    expect(await read(`orgs/${orgId}`)).toBe(undefined)
  })
})
