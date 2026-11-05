// A stand-in for Slack in the end-to-end tests: its Web API (the OAuth exchange and revoking a token) and the
// response_url where the Worker posts its answers. The Worker reaches it through SLACK_API_URL and
// SLACK_HOOKS_URL in wrangler.toml's dev settings.
import { createHmac } from 'node:crypto'
import { createServer, type Server } from 'node:http'

export const PORT = 18615
export const SIGNING_SECRET = 'dev-signing-secret'
export const TEAM = { id: 'T0TEST', name: 'Test Space' }

export interface FakeSlack {
  replies: Map<string, Record<string, any>[]>
  revoked: string[]
  close: () => Promise<void>
}

export async function startFakeSlack(): Promise<FakeSlack> {
  const replies = new Map<string, Record<string, any>[]>()
  const revoked: string[] = []
  const server: Server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => (body += chunk))
    request.on('end', () => {
      const path = request.url ?? ''
      response.setHeader('content-type', 'application/json')
      if (path === '/api/oauth.v2.access') {
        const form = new URLSearchParams(body)
        const ok = form.get('client_secret') === 'dev-client-secret' && form.get('code') === 'good-code'
        response.end(JSON.stringify(ok ? { ok: true, access_token: 'xoxb-fake-token', team: TEAM } : { ok: false, error: 'invalid_code' }))
      } else if (path === '/api/auth.revoke') {
        revoked.push(request.headers.authorization ?? '')
        response.end(JSON.stringify({ ok: true, revoked: true }))
      } else if (path.startsWith('/hooks/')) {
        const id = path.slice('/hooks/'.length)
        replies.set(id, [...(replies.get(id) ?? []), JSON.parse(body)])
        response.end('{}')
      } else {
        response.statusCode = 404
        response.end('{}')
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve))
  return { replies, revoked, close: () => new Promise((resolve) => server.close(() => resolve())) }
}

let counter = 0

/** Sends `/kudos` as Slack would, signed, and waits for the answer the Worker posts back. */
export async function kudos(
  api: string,
  slack: FakeSlack,
  from: { id: string; name: string },
  text: string,
  options: { triggerId?: string; secret?: string; teamId?: string } = {},
): Promise<{ status: number; reply?: Record<string, any> }> {
  counter += 1
  const hook = `reply-${Date.now()}-${counter}`
  const body = new URLSearchParams({
    team_id: options.teamId ?? TEAM.id,
    user_id: from.id,
    user_name: from.name,
    command: '/kudos',
    text,
    response_url: `http://127.0.0.1:${PORT}/hooks/${hook}`,
    trigger_id: options.triggerId ?? `trigger-${hook}`,
  }).toString()
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', options.secret ?? SIGNING_SECRET).update(`v0:${timestamp}:${body}`).digest('hex')
  const response = await fetch(`${api}/slack/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': String(timestamp),
      'x-slack-signature': `v0=${signature}`,
    },
    body,
  })
  if (response.status !== 200) return { status: response.status }
  for (let tries = 0; tries < 100; tries += 1) {
    const got = slack.replies.get(hook)
    if (got?.length) return { status: 200, reply: got[0] }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('no reply from the Worker')
}
