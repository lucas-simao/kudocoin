// The API: a route checks who is calling and, under /orgs/{orgId}, their membership, then calls a service.
import { type Caller, verifyIdToken } from './auth/firebase-token'
import type { Env } from './env'
import { ApiError } from './errors'
import { Firestore } from './firestore/client'
import { requireMember, requireRole } from './middleware/membership'
import { allow } from './middleware/rate-limit'
import { deleteAccount, syncProfile } from './services/account'
import { move, type Movement } from './services/give'
import { join, newInvite, previewInvite, turnOffInvite } from './services/invites'
import { removeMember, setRole } from './services/members'
import { createOrg, resolveSlug, updateOrg } from './services/orgs'
import { closeSeason } from './services/seasons'
import { cancelBounty, offerBounty, payBounty } from './services/bounties'
import { closeDueSeasons } from './scheduled'
import { slashCommand } from './slack/command'
import { disconnect, installUrl, link, linkPreview, myLinks, oauthCallback, setAnnounce, slackOn, unlink } from './slack/service'

type Handler = (ctx: Context) => Promise<unknown>

interface Context {
  request: Request
  env: Env
  store: Firestore
  caller: Caller
  params: Record<string, string>
  body: Record<string, unknown>
}

const routes: [method: string, pattern: string, handler: Handler][] = [
  ['POST', '/api/me', ({ store, caller, body }) => syncProfile(store, caller, body)],
  ['DELETE', '/api/me', ({ store, caller }) => deleteAccount(store, caller)],

  ['POST', '/api/orgs', ({ store, caller, body }) => createOrg(store, caller, body as never)],
  ['GET', '/api/slugs/:slug', ({ store, caller, params }) => resolveSlug(store, caller, params.slug)],
  ['PATCH', '/api/orgs/:orgId', async ({ store, caller, params, body }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    await updateOrg(store, params.orgId, body)
    return { ok: true }
  }],

  ['POST', '/api/orgs/:orgId/give', async ({ store, caller, params, body }) => {
    await requireMember(store, params.orgId, caller)
    if (!allow(`give:${caller.uid}`, 30)) throw new ApiError('too_many_requests')
    return move(store, params.orgId, caller, movement(body, 'give'))
  }],
  ['POST', '/api/orgs/:orgId/award', async ({ store, caller, params, body }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    return move(store, params.orgId, caller, movement(body, 'award'))
  }],
  ['POST', '/api/orgs/:orgId/correction', async ({ store, caller, params, body }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    return move(store, params.orgId, caller, movement(body, 'correction'))
  }],

  ['POST', '/api/orgs/:orgId/invite', async ({ store, caller, params }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    return newInvite(store, params.orgId, caller)
  }],
  ['DELETE', '/api/orgs/:orgId/invite', async ({ store, caller, params }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    await turnOffInvite(store, params.orgId)
    return { ok: true }
  }],
  ['GET', '/api/join/:token', ({ store, caller, params }) => previewInvite(store, caller, params.token)],
  ['POST', '/api/join/:token', ({ store, caller, params }) => join(store, caller, params.token)],

  ['PUT', '/api/orgs/:orgId/members/:uid/role', async ({ store, caller, params, body }) => {
    await requireMember(store, params.orgId, caller)
    await setRole(store, params.orgId, caller, params.uid, body.role as never)
    return { ok: true }
  }],
  ['DELETE', '/api/orgs/:orgId/members/:uid', async ({ store, caller, params }) => {
    await requireMember(store, params.orgId, caller)
    await removeMember(store, params.orgId, caller, params.uid)
    return { ok: true }
  }],

  // Slack: docs/decisions/slack.md.
  ['POST', '/api/orgs/:orgId/slack/install', async ({ request, env, store, caller, params }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    return installUrl(env, params.orgId, caller, new URL(request.url).origin)
  }],
  ['PATCH', '/api/orgs/:orgId/slack', async ({ store, caller, params, body }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    await setAnnounce(store, params.orgId, body)
    return { ok: true }
  }],
  ['DELETE', '/api/orgs/:orgId/slack', async ({ env, store, caller, params }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    await disconnect(env, store, params.orgId)
    return { ok: true }
  }],
  ['POST', '/api/slack/link/preview', ({ env, store, caller, body }) => linkPreview(env, store, caller, body.token)],
  ['POST', '/api/slack/link', ({ env, store, caller, body }) => link(env, store, caller, body.token)],
  ['GET', '/api/me/slack', ({ store, caller }) => myLinks(store, caller)],
  ['DELETE', '/api/me/slack/:id', async ({ store, caller, params }) => {
    await unlink(store, caller, params.id)
    return { ok: true }
  }],

  // Bounties: docs/decisions/bounties.md.
  ['POST', '/api/orgs/:orgId/bounties', ({ store, caller, params, body }) => offerBounty(store, params.orgId, caller, body as never)],
  ['POST', '/api/orgs/:orgId/bounties/:bountyId/pay', ({ store, caller, params, body }) =>
    payBounty(store, params.orgId, caller, params.bountyId, body.to)],
  ['POST', '/api/orgs/:orgId/bounties/:bountyId/cancel', ({ store, caller, params }) => cancelBounty(store, params.orgId, caller, params.bountyId)],

  ['POST', '/api/orgs/:orgId/seasons/close', async ({ store, caller, params, body }) => {
    await requireRole(store, params.orgId, caller, 'admin')
    return closeSeason(store, params.orgId, body as never)
  }],
]

function movement(body: Record<string, unknown>, kind: Movement['kind']): Movement {
  return { kind, to: String(body.to ?? ''), amount: Number(body.amount), reason: String(body.reason ?? ''), key: String(body.key ?? '') }
}

function match(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/')
  const got = path.split('/')
  if (want.length !== got.length) return null
  const params: Record<string, string> = {}
  for (let index = 0; index < want.length; index += 1) {
    if (want[index].startsWith(':')) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(got[index])) return null
      params[want[index].slice(1)] = got[index]
    } else if (want[index] !== got[index]) return null
  }
  return params
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((item) => item.trim())
  return allowed.includes(origin)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-max-age': '86400',
        vary: 'origin',
      }
    : {}
}

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const url = new URL(request.url)
    if (url.pathname === '/api/health') return json(200, { ok: true, slack: slackOn(env) }, cors)
    try {
      // Slack's own requests carry its signature, not a Firebase token.
      if (url.pathname === '/slack/commands' && request.method === 'POST') return await slashCommand(request, env, ctx)
      if (url.pathname === '/slack/oauth' && request.method === 'GET') return await oauthCallback(env, new Firestore(env), url)
      for (const [method, pattern, handler] of routes) {
        if (method !== request.method) continue
        const params = match(pattern, url.pathname)
        if (!params) continue
        const caller = await verifyIdToken(request.headers.get('authorization'), env)
        if (!allow(`any:${caller.uid}`, 120)) throw new ApiError('too_many_requests')
        let body: Record<string, unknown> = {}
        if (request.method !== 'GET' && request.method !== 'DELETE') {
          const text = await request.text()
          if (text.length > 10_000) throw new ApiError('invalid_request')
          try {
            body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
          } catch {
            throw new ApiError('invalid_request')
          }
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('invalid_request')
        }
        const result = await handler({ request, env, store: new Firestore(env), caller, params, body })
        return json(200, result ?? { ok: true }, cors)
      }
      throw new ApiError('not_found')
    } catch (error) {
      if (error instanceof ApiError) return json(error.status, { error: error.code, ...error.details }, cors)
      console.error('unexpected', error instanceof Error ? error.message : 'unknown')
      return json(500, { error: 'internal' }, cors)
    }
  },

  /** The hourly Cron Trigger (wrangler.toml): seasons that close by themselves. */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const { closed, failed } = await closeDueSeasons(new Firestore(env))
    if (closed || failed) console.log('seasons closed', closed, 'failed', failed)
  },
}
