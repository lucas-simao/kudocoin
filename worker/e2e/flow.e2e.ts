// The whole flow against the real Worker (wrangler dev) and the Firebase emulators: sign-in, an
// organization, an invite, gives and their limits, awards, Slack, closing a season, removal, account deletion.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type FakeSlack, kudos, startFakeSlack, TEAM } from './fake-slack'

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

/** Changes fields straight in the emulator: how the tests move a sprint's end into the past. */
async function write(path: string, fields: Record<string, unknown>): Promise<void> {
  const mask = Object.keys(fields).map((name) => `updateMask.fieldPaths=${name}`).join('&')
  const response = await fetch(`${FIRESTORE}/${path}?${mask}`, {
    method: 'PATCH',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) throw new Error(`write ${path}: ${response.status}`)
}

/** Runs the hourly job now (wrangler dev --test-scheduled). */
async function hourly(): Promise<void> {
  const response = await fetch(`${API}/__scheduled?cron=7+*+*+*+*`)
  if (!response.ok) throw new Error(`scheduled: ${response.status}`)
}

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

const int = (field: { integerValue?: string } | undefined) => Number(field?.integerValue ?? NaN)

let ana: Person
let bruno: Person
let carla: Person
let dave: Person
let slack: FakeSlack
let orgId: string
const slug = `team-${Date.now().toString(36)}`

beforeAll(async () => {
  ana = await person('Ana')
  bruno = await person('Bruno')
  carla = await person('Carla')
  dave = await person('Dave')
  slack = await startFakeSlack()
})

afterAll(async () => {
  await slack?.close()
})

const ANA_SLACK = { id: 'U0ANA', name: 'ana' }
const BRUNO_SLACK = { id: 'U0BRUNO', name: 'bruno' }
const linkToken = (reply: Record<string, any> | undefined) => new URL(reply!.blocks[0].accessory.url).searchParams.get('t')!

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

  it('connects a Slack workspace, admins only', async () => {
    expect(((await fetch(`${API}/api/health`).then((response) => response.json())) as { slack: boolean }).slack).toBe(true)
    expect((await call(bruno, 'POST', `/api/orgs/${orgId}/slack/install`)).status).toBe(403)
    const install = await call(ana, 'POST', `/api/orgs/${orgId}/slack/install`)
    const state = new URL(install.body.url).searchParams.get('state')!
    const oauth = (query: string) => fetch(`${API}/slack/oauth?${query}`, { redirect: 'manual' })
    expect((await oauth(`code=bad-code&state=${encodeURIComponent(state)}`)).headers.get('location')).toContain('slack=error')
    expect((await oauth('code=good-code&state=forged.state')).headers.get('location')).toBe('http://localhost:18610/orgs?slack=error')
    const connected = await oauth(`code=good-code&state=${encodeURIComponent(state)}`)
    expect(connected.status).toBe(302)
    expect(connected.headers.get('location')).toBe(`http://localhost:18610/o/${slug}/settings?slack=connected`)
    expect((await read(`orgs/${orgId}`))!.slack.mapValue.fields.teamName.stringValue).toBe(TEAM.name)
    const team = await read(`slackTeams/${TEAM.id}`)
    expect(team!.orgId.stringValue).toBe(orgId)
    // The workspace's token is kept sealed.
    expect(team!.token.stringValue).not.toContain('xoxb')
  })

  it('links each Slack person once, through a link only they see', async () => {
    expect((await kudos(API, slack, BRUNO_SLACK, '<@U0ANA|ana> 1 hi', { secret: 'wrong' })).status).toBe(401)
    const first = await kudos(API, slack, BRUNO_SLACK, '<@U0ANA|ana> 1 thanks')
    expect(first.reply!.response_type).toBe('ephemeral')
    const token = linkToken(first.reply)
    expect((await call(bruno, 'POST', '/api/slack/link/preview', { token })).body).toMatchObject({
      teamName: TEAM.name,
      slackName: 'bruno',
      orgName: 'Team A',
      isMember: true,
    })
    expect((await call(bruno, 'POST', '/api/slack/link', { token: 'forged.token' })).body.error).toBe('slack_link_invalid')
    expect((await call(dave, 'POST', '/api/slack/link', { token })).body.error).toBe('slack_not_member')
    expect((await call(bruno, 'POST', '/api/slack/link', { token })).status).toBe(200)
    expect((await read(`slackUsers/${TEAM.id}_U0BRUNO`))!.uid.stringValue).toBe(bruno.uid)

    // Ana has not linked yet: Bruno is told, and nothing is spent.
    const notYet = await kudos(API, slack, BRUNO_SLACK, '<@U0ANA|ana> 1 thanks')
    expect(notYet.reply!.text).toContain('<@U0ANA>')
    expect(int((await read(`orgs/${orgId}/members/${bruno.uid}`))?.given?.mapValue?.fields?.amount ?? { integerValue: '0' })).toBe(0)
    // Before linking, help comes with the link to connect.
    const hers = await kudos(API, slack, ANA_SLACK, '')
    expect(hers.reply!.text).toContain('/kudos summary')
    const herToken = new URL(hers.reply!.blocks.at(-1).accessory.url).searchParams.get('t')!
    expect((await call(ana, 'POST', '/api/slack/link', { token: herToken })).status).toBe(200)
  })

  it('gives from /kudos under the same rules, once per command', async () => {
    // Messages follow the giver's language, or the connecting admin's when the giver has none (Ana: pt-BR).
    const help = (await kudos(API, slack, BRUNO_SLACK, 'help')).reply!
    expect(help.response_type).toBe('ephemeral')
    expect(help.text).toContain('/kudos summary')
    expect(help.text).toContain(`<http://localhost:18610/o/${slug}|`)
    expect((await kudos(API, slack, BRUNO_SLACK, 'please')).reply!.text).toContain('Não entendi')
    expect((await kudos(API, slack, BRUNO_SLACK, '<@U0ANA|ana> 9 too many')).reply!.text).toBe('Escolha de 1 a 5.')
    expect((await kudos(API, slack, BRUNO_SLACK, '<@U0BRUNO|bruno> 1 me')).reply!.text).toBe('Você não pode dar moedas para si mesmo.')

    const before = int((await read(`orgs/${orgId}/members/${ana.uid}`))?.balance)
    const text = '<@U0ANA|ana> 2 fixed the <!channel> deploy &amp; docs'
    const gave = await kudos(API, slack, BRUNO_SLACK, text, { triggerId: 'same-trigger' })
    expect(gave.reply!.response_type).toBe('in_channel')
    expect(gave.reply!.text).toContain('<@U0BRUNO> deu 2 Kudocoin para <@U0ANA>: fixed the @channel deploy &amp; docs')
    expect(gave.reply!.text).not.toContain('<!channel>')
    expect(int((await read(`orgs/${orgId}/members/${ana.uid}`))?.balance)).toBe(before + 2)
    await kudos(API, slack, BRUNO_SLACK, text, { triggerId: 'same-trigger' })
    expect(int((await read(`orgs/${orgId}/members/${ana.uid}`))?.balance)).toBe(before + 2)

    // The summary: the leaderboard, and for the one who asked, their place and what is left today.
    const mine = (await kudos(API, slack, BRUNO_SLACK, 'summary')).reply!
    expect(mine.response_type).toBe('ephemeral')
    expect(mine.text).toContain('*Team A* · Temporada 1')
    expect(mine.text).toMatch(/🥇 Bruno: \d+ Kudocoin/)
    expect(mine.text).toContain('Hoje ainda pode dar 3.')
    const shared = (await kudos(API, slack, BRUNO_SLACK, 'summary share')).reply!
    expect(shared.response_type).toBe('in_channel')
    expect(shared.text).not.toContain('Hoje ainda pode dar')

    // With the announcement off, only the giver sees it.
    expect((await call(bruno, 'PATCH', `/api/orgs/${orgId}/slack`, { announce: false })).status).toBe(403)
    expect((await call(ana, 'PATCH', `/api/orgs/${orgId}/slack`, { announce: false })).status).toBe(200)
    const quiet = await kudos(API, slack, BRUNO_SLACK, '<@U0ANA|ana> 1 quiet thanks')
    expect(quiet.reply).toMatchObject({ response_type: 'ephemeral', text: 'Você deu 1 Kudocoin para <@U0ANA>. Hoje ainda pode dar 2.' })
  })

  it('lets a person unlink, and an admin disconnect the workspace', async () => {
    const mine = await call(ana, 'GET', '/api/me/slack')
    expect(mine.body.links).toEqual([{ id: `${TEAM.id}_U0ANA`, teamName: TEAM.name, slackName: 'ana' }])
    expect((await call(bruno, 'DELETE', `/api/me/slack/${TEAM.id}_U0ANA`)).status).toBe(404)
    expect((await call(ana, 'DELETE', `/api/me/slack/${TEAM.id}_U0ANA`)).status).toBe(200)
    expect((await call(ana, 'GET', '/api/me/slack')).body.links).toEqual([])

    expect((await call(ana, 'DELETE', `/api/orgs/${orgId}/slack`)).status).toBe(200)
    expect('nullValue' in (await read(`orgs/${orgId}`))!.slack).toBe(true)
    expect(await read(`slackTeams/${TEAM.id}`)).toBe(undefined)
    expect(slack.revoked).toContain('Bearer xoxb-fake-token')
    expect((await kudos(API, slack, BRUNO_SLACK, '<@U0ANA|ana> 1 hi')).reply!.text).toContain('Settings')
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

  it('closes a sprint by itself once its last day ends, and starts the next without a gap', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    expect((await call(ana, 'PATCH', `/api/orgs/${orgId}`, { sprintWeeks: 5 })).body.error).toBe('invalid_request')
    expect((await call(bruno, 'PATCH', `/api/orgs/${orgId}`, { sprintWeeks: 2 })).status).toBe(403)
    expect((await call(ana, 'PATCH', `/api/orgs/${orgId}`, { sprintWeeks: 2, season: { endsOn: today } })).status).toBe(200)
    let org = (await read(`orgs/${orgId}`))!
    expect(int(org.sprintWeeks)).toBe(2)
    // The season closes as its last day ends in São Paulo (UTC−3).
    expect(Date.parse(org.closesAt.timestampValue)).toBe(Date.parse(`${addDays(today, 1)}T03:00:00Z`))

    // Not due yet: the job leaves it alone.
    const sprintId = org.seasonId.stringValue
    await hourly()
    expect((await read(`orgs/${orgId}`))!.seasonId.stringValue).toBe(sprintId)

    // As if the clock had moved past its last day.
    const yesterday = addDays(today, -1)
    await write(`orgs/${orgId}/seasons/${sprintId}`, { endsOn: { stringValue: yesterday } })
    await write(`orgs/${orgId}`, { closesAt: { timestampValue: new Date(Date.now() - 60_000).toISOString() } })
    const number = int((await read(`orgs/${orgId}/seasons/${sprintId}`))!.number)
    await hourly()
    await hourly() // a second run finds nothing due
    org = (await read(`orgs/${orgId}`))!
    expect(org.seasonId.stringValue).not.toBe(sprintId)
    expect((await read(`orgs/${orgId}/seasons/${sprintId}`))!.status.stringValue).toBe('closed')
    const sprint = (await read(`orgs/${orgId}/seasons/${org.seasonId.stringValue}`))!
    expect(int(sprint.number)).toBe(number + 1)
    expect(sprint.startsOn.stringValue).toBe(today)
    expect(sprint.endsOn.stringValue).toBe(addDays(yesterday, 14))
    expect(sprint.prize.stringValue).toBe('Tacos')
    expect(Date.parse(org.closesAt.timestampValue)).toBe(Date.parse(`${addDays(yesterday, 15)}T03:00:00Z`))

    // Back to closing by hand: nothing is scheduled.
    expect((await call(ana, 'PATCH', `/api/orgs/${orgId}`, { sprintWeeks: null })).status).toBe(200)
    expect('nullValue' in (await read(`orgs/${orgId}`))!.closesAt).toBe(true)
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
    expect(await read(`slackUsers/${TEAM.id}_U0BRUNO`)).toBe(undefined)
    expect(await read(`orgs/${orgId}`)).toBe(undefined)
  })
})
