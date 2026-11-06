// Every write goes to the Worker with the Firebase ID token. The Worker answers codes; screens turn them into
// words with useI18n().error (docs/decisions/languages.md).
import { auth } from '@/auth/firebase'

const BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:18611').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, string | number> = {},
  ) {
    super(code)
  }
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new ApiError(401, 'unauthenticated')
  const token = await user.getIdToken()
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'offline')
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const { error, ...details } = data
    throw new ApiError(response.status, typeof error === 'string' ? error : 'internal', details as Record<string, string | number>)
  }
  return data as T
}

/** A fresh idempotency key for one give: a double tap or a retry writes one entry, not two. */
export function entryKey(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export type Role = 'owner' | 'admin' | 'member'

export interface Settings {
  coinName: string
  dailyAllowance: number
  maxPerGive: number
  maxReceivedPerDay: number
  reasonRequired: boolean
  timezone: string
}

export interface SlackLinkPreview {
  teamName: string
  slackName: string
  orgName: string
  slug: string
  isMember: boolean
}

export const api = {
  /** Whether the API answers, and whether Slack is set up on it. Needs no sign-in. */
  health: () =>
    fetch(`${BASE}/api/health`)
      .then((response) => response.json() as Promise<{ ok: boolean; slack?: boolean }>)
      .catch(() => ({ ok: false, slack: false })),
  syncProfile: (lang: string, github?: string) => request<unknown>('POST', '/api/me', { lang, github }),
  deleteAccount: () => request<unknown>('DELETE', '/api/me'),
  createOrg: (input: { name: string; slug: string; settings: Settings; season: { endsOn: string; prize: string } }) =>
    request<{ orgId: string; slug: string }>('POST', '/api/orgs', input),
  resolveSlug: (slug: string) => request<{ orgId: string }>('GET', `/api/slugs/${encodeURIComponent(slug)}`),
  updateOrg: (
    orgId: string,
    input: { name?: string; settings?: Partial<Settings>; season?: { endsOn?: string; prize?: string }; sprintWeeks?: number | null },
  ) =>
    request<unknown>('PATCH', `/api/orgs/${orgId}`, input),
  give: (orgId: string, input: { to: string; amount: number; reason: string; key: string }) =>
    request<{ balance: number; allowanceLeft: number | null }>('POST', `/api/orgs/${orgId}/give`, input),
  award: (orgId: string, input: { to: string; amount: number; reason: string; key: string }) =>
    request<{ balance: number }>('POST', `/api/orgs/${orgId}/award`, input),
  newInvite: (orgId: string) => request<{ token: string }>('POST', `/api/orgs/${orgId}/invite`),
  turnOffInvite: (orgId: string) => request<unknown>('DELETE', `/api/orgs/${orgId}/invite`),
  previewInvite: (token: string) =>
    request<{ name: string; slug: string; coinName: string; memberCount: number; isMember: boolean }>('GET', `/api/join/${token}`),
  join: (token: string) => request<{ orgId: string; slug: string }>('POST', `/api/join/${token}`),
  setRole: (orgId: string, uid: string, role: Role) => request<unknown>('PUT', `/api/orgs/${orgId}/members/${uid}/role`, { role }),
  removeMember: (orgId: string, uid: string) => request<unknown>('DELETE', `/api/orgs/${orgId}/members/${uid}`),
  closeSeason: (orgId: string, next: { endsOn?: string; prize: string }) =>
    request<{ seasonId: string }>('POST', `/api/orgs/${orgId}/seasons/close`, next),
  offerBounty: (orgId: string, input: { amount: number; task: string; key: string }) =>
    request<{ bountyId: string; number: number; allowanceLeft: number }>('POST', `/api/orgs/${orgId}/bounties`, input),
  payBounty: (orgId: string, bountyId: string, to: string) => request<{ balance: number }>('POST', `/api/orgs/${orgId}/bounties/${bountyId}/pay`, { to }),
  cancelBounty: (orgId: string, bountyId: string) => request<{ refunded: boolean }>('POST', `/api/orgs/${orgId}/bounties/${bountyId}/cancel`),
  claimBounty: (orgId: string, bountyId: string) => request<unknown>('POST', `/api/orgs/${orgId}/bounties/${bountyId}/claim`),
  rejectClaim: (orgId: string, bountyId: string, uid: string) => request<unknown>('POST', `/api/orgs/${orgId}/bounties/${bountyId}/reject`, { uid }),
  askCoins: (orgId: string, input: { to: string; amount: number; reason: string; key: string }) =>
    request<{ requestId: string; number: number }>('POST', `/api/orgs/${orgId}/requests`, input),
  answerRequest: (orgId: string, requestId: string, answer: 'pay' | 'decline' | 'cancel') =>
    request<unknown>('POST', `/api/orgs/${orgId}/requests/${requestId}/${answer}`),
  slackInstall: (orgId: string) => request<{ url: string }>('POST', `/api/orgs/${orgId}/slack/install`),
  slackAnnounce: (orgId: string, announce: boolean) => request<unknown>('PATCH', `/api/orgs/${orgId}/slack`, { announce }),
  slackDisconnect: (orgId: string) => request<unknown>('DELETE', `/api/orgs/${orgId}/slack`),
  slackLinkPreview: (token: string) => request<SlackLinkPreview>('POST', '/api/slack/link/preview', { token }),
  slackLink: (token: string) => request<{ slug: string; orgName: string; teamName: string }>('POST', '/api/slack/link', { token }),
  mySlackLinks: () => request<{ links: { id: string; teamName: string; slackName: string }[] }>('GET', '/api/me/slack'),
  unlinkSlack: (id: string) => request<unknown>('DELETE', `/api/me/slack/${id}`),
}
