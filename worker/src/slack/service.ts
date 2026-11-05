// Connecting a Slack workspace to an organization and a Slack person to a Kudocoin account
// (docs/decisions/slack.md). The command itself is in command.ts.
import type { Caller } from '../auth/firebase-token'
import type { Env } from '../env'
import { ApiError } from '../errors'
import type { Firestore, Write } from '../firestore/client'
import { requireRole } from '../middleware/membership'
import {
  as,
  type MemberDoc,
  type OrgDoc,
  paths,
  type SlackTeamDoc,
  type SlackUserDoc,
  toDoc,
  type UserDoc,
} from '../repositories/documents'
import { readToken, signToken, unseal, seal } from './crypto'

/** Slack is on once the app's four settings are in the Worker. */
export function slackOn(env: Env): boolean {
  return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.SLACK_SIGNING_SECRET && env.SLACK_KEY)
}

function requireSlack(env: Env): string {
  if (!slackOn(env)) throw new ApiError('slack_unavailable')
  return env.SLACK_KEY!
}

/** The web app's address: the first allowed origin. */
export function webOrigin(env: Env): string {
  return env.ALLOWED_ORIGINS.split(',')[0].trim()
}

export async function slackApi(env: Env, method: string, form: Record<string, string>, token?: string): Promise<Record<string, any>> {
  const response = await fetch(`${env.SLACK_API_URL ?? 'https://slack.com/api'}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: new URLSearchParams(form),
  })
  return (await response.json().catch(() => ({ ok: false }))) as Record<string, any>
}

const SCOPES = 'commands'

/** Where *Add to Slack* goes. The state names the organization and the admin, for ten minutes. */
export async function installUrl(env: Env, orgId: string, caller: Caller, workerOrigin: string): Promise<{ url: string }> {
  const key = requireSlack(env)
  const state = await signToken(key, 'install', { o: orgId, a: caller.uid }, 600)
  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', env.SLACK_CLIENT_ID!)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('redirect_uri', `${workerOrigin}/slack/oauth`)
  url.searchParams.set('state', state)
  return { url: url.toString() }
}

/** Slack sends the admin back here. Every outcome goes back to the settings page, which says what happened. */
export async function oauthCallback(env: Env, store: Firestore, url: URL): Promise<Response> {
  const web = webOrigin(env)
  const back = (path: string, outcome: string) => Response.redirect(`${web}${path}?slack=${outcome}`, 302)
  if (!slackOn(env)) return back('/orgs', 'error')
  const state = await readToken(env.SLACK_KEY!, 'install', url.searchParams.get('state'))
  if (!state) return back('/orgs', 'error')
  const org = as<OrgDoc>(await store.get(paths.org(state.o)))
  if (!org) return back('/orgs', 'error')
  const settings = `/o/${org.slug}/settings`
  const code = url.searchParams.get('code')
  if (url.searchParams.get('error') || !code) return back(settings, 'cancelled')
  try {
    await requireRole(store, state.o, { uid: state.a } as Caller, 'admin')
  } catch {
    return back(settings, 'error')
  }

  const answer = await slackApi(env, 'oauth.v2.access', {
    client_id: env.SLACK_CLIENT_ID!,
    client_secret: env.SLACK_CLIENT_SECRET!,
    code,
    redirect_uri: `${url.origin}/slack/oauth`,
  })
  const teamId = answer.team?.id
  if (!answer.ok || typeof answer.access_token !== 'string' || typeof teamId !== 'string' || !/^T[A-Z0-9]+$/.test(teamId)) {
    return back(settings, 'error')
  }
  const teamName = String(answer.team.name ?? teamId).slice(0, 80)

  const previousId = org.slack && org.slack.teamId !== teamId ? org.slack.teamId : null
  const [existingDoc, installerDoc, previousDoc] = await store.getAll([
    paths.slackTeam(teamId),
    paths.user(state.a),
    ...(previousId ? [paths.slackTeam(previousId)] : []),
  ])
  const existing = as<SlackTeamDoc>(existingDoc)
  if (existing && existing.orgId !== state.o) return back(settings, 'taken')
  const previous = as<SlackTeamDoc>(previousDoc)

  const team: SlackTeamDoc = {
    orgId: state.o,
    teamName,
    token: await seal(env.SLACK_KEY!, answer.access_token),
    lang: as<UserDoc>(installerDoc)?.lang ?? 'en',
    installedBy: state.a,
    installedAt: new Date(),
  }
  const writes: Write[] = [
    // A workspace plays in one organization: a second one connecting at the same moment fails here.
    { path: paths.slackTeam(teamId), fields: toDoc(team), ...(existing ? {} : { exists: false }) },
    { path: paths.org(state.o), fields: { slack: { teamId, teamName, announce: org.slack?.announce ?? true } }, mask: ['slack'], exists: true },
  ]
  // Connecting another workspace replaces the one before.
  if (previous && previous.orgId === state.o) writes.push({ path: paths.slackTeam(org.slack!.teamId), delete: true })
  try {
    await store.commit(writes)
  } catch {
    return back(settings, 'taken')
  }
  if (previous && previous.orgId === state.o) await revoke(env, previous.token)
  return back(settings, 'connected')
}

async function revoke(env: Env, sealed: string): Promise<void> {
  try {
    const token = await unseal(env.SLACK_KEY!, sealed)
    if (token) await slackApi(env, 'auth.revoke', {}, token)
  } catch {
    // Revoking is a courtesy; the workspace is disconnected on our side either way.
  }
}

export async function disconnect(env: Env, store: Firestore, orgId: string): Promise<void> {
  const org = as<OrgDoc>(await store.get(paths.org(orgId)))
  if (!org) throw new ApiError('not_found')
  if (!org.slack) return
  const team = as<SlackTeamDoc>(await store.get(paths.slackTeam(org.slack.teamId)))
  const writes: Write[] = [{ path: paths.org(orgId), fields: { slack: null }, mask: ['slack'], exists: true }]
  if (team && team.orgId === orgId) writes.push({ path: paths.slackTeam(org.slack.teamId), delete: true })
  await store.commit(writes)
  if (team && team.orgId === orgId && env.SLACK_KEY) await revoke(env, team.token)
}

export async function setAnnounce(store: Firestore, orgId: string, body: Record<string, unknown>): Promise<void> {
  if (typeof body.announce !== 'boolean') throw new ApiError('invalid_request', { field: 'announce' })
  const org = as<OrgDoc>(await store.get(paths.org(orgId)))
  if (!org) throw new ApiError('not_found')
  if (!org.slack) throw new ApiError('slack_not_connected')
  await store.commit([{ path: paths.org(orgId), fields: { slack: { announce: body.announce } }, mask: ['slack.announce'], exists: true }])
}

export interface LinkPreview {
  teamName: string
  slackName: string
  orgName: string
  slug: string
  isMember: boolean
}

async function openLink(env: Env, store: Firestore, caller: Caller, token: unknown) {
  const key = requireSlack(env)
  const data = await readToken(key, 'link', token)
  if (!data || !/^T[A-Z0-9]+$/.test(data.t ?? '') || !/^[UW][A-Z0-9]+$/.test(data.u ?? '')) throw new ApiError('slack_link_invalid')
  const team = as<SlackTeamDoc>(await store.get(paths.slackTeam(data.t)))
  if (!team) throw new ApiError('slack_not_connected')
  const [orgDoc, memberDoc] = await store.getAll([paths.org(team.orgId), paths.member(team.orgId, caller.uid)])
  const org = as<OrgDoc>(orgDoc)
  if (!org) throw new ApiError('slack_not_connected')
  return { data, team, org, member: as<MemberDoc>(memberDoc) }
}

/** What the link page shows before the person confirms: which Slack person, which workspace, which organization. */
export async function linkPreview(env: Env, store: Firestore, caller: Caller, token: unknown): Promise<LinkPreview> {
  const { data, team, org, member } = await openLink(env, store, caller, token)
  return { teamName: team.teamName, slackName: data.n ?? '', orgName: org.name, slug: org.slug, isMember: Boolean(member) }
}

export async function link(env: Env, store: Firestore, caller: Caller, token: unknown): Promise<{ slug: string; orgName: string; teamName: string }> {
  const { data, team, org, member } = await openLink(env, store, caller, token)
  if (!member) throw new ApiError('slack_not_member', { name: org.name })
  const row: SlackUserDoc = {
    uid: caller.uid,
    teamId: data.t,
    slackUserId: data.u,
    slackName: (data.n ?? '').slice(0, 80),
    teamName: team.teamName,
    linkedAt: new Date(),
  }
  // Linking again replaces the account this Slack person gives from.
  await store.commit([{ path: paths.slackUser(`${data.t}_${data.u}`), fields: toDoc(row) }])
  return { slug: org.slug, orgName: org.name, teamName: team.teamName }
}

export async function myLinks(store: Firestore, caller: Caller): Promise<{ links: { id: string; teamName: string; slackName: string }[] }> {
  const rows = await store.where('', 'slackUsers', 'uid', caller.uid, 50)
  return {
    links: rows.map(({ id, doc }) => {
      const row = doc as unknown as SlackUserDoc
      return { id, teamName: row.teamName, slackName: row.slackName }
    }),
  }
}

export async function unlink(store: Firestore, caller: Caller, id: string): Promise<void> {
  const row = as<SlackUserDoc>(await store.get(paths.slackUser(id)))
  if (!row || row.uid !== caller.uid) throw new ApiError('not_found')
  await store.commit([{ path: paths.slackUser(id), delete: true }])
}

/** Every Slack link of a person, for deleting their account. */
export async function unlinkAll(store: Firestore, uid: string): Promise<void> {
  const rows = await store.where('', 'slackUsers', 'uid', uid, 200)
  if (rows.length) await store.commit(rows.map(({ id }) => ({ path: paths.slackUser(id), delete: true })))
}
