// The API answers codes; the web app turns them into words (docs/decisions/languages.md).
export type ErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'forbidden'
  | 'invalid_request'
  | 'slug_taken'
  | 'slug_invalid'
  | 'self_give'
  | 'not_a_member'
  | 'amount_invalid'
  | 'reason_required'
  | 'reason_too_long'
  | 'allowance_exceeded'
  | 'receiver_limit_exceeded'
  | 'season_closed'
  | 'season_not_ended'
  | 'invite_invalid'
  | 'already_member'
  | 'last_owner'
  | 'too_many_requests'
  | 'conflict'
  | 'too_many_bounties'
  | 'bounty_closed'
  | 'bounty_expired'
  | 'too_many_claims'
  | 'requests_limit'
  | 'request_open'
  | 'request_closed'
  | 'request_expired'
  | 'not_yours'
  | 'slack_unavailable'
  | 'slack_link_invalid'
  | 'slack_not_connected'
  | 'slack_not_member'
  | 'internal'

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  not_found: 404,
  forbidden: 403,
  invalid_request: 400,
  slug_taken: 409,
  slug_invalid: 400,
  self_give: 422,
  not_a_member: 422,
  amount_invalid: 422,
  reason_required: 422,
  reason_too_long: 422,
  allowance_exceeded: 422,
  receiver_limit_exceeded: 422,
  season_closed: 422,
  season_not_ended: 422,
  invite_invalid: 404,
  already_member: 409,
  last_owner: 422,
  too_many_requests: 429,
  conflict: 409,
  too_many_bounties: 422,
  bounty_closed: 409,
  bounty_expired: 409,
  too_many_claims: 422,
  requests_limit: 422,
  request_open: 409,
  request_closed: 409,
  request_expired: 409,
  not_yours: 403,
  slack_unavailable: 503,
  slack_link_invalid: 404,
  slack_not_connected: 404,
  slack_not_member: 422,
  internal: 500,
}

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, number | string>,
  ) {
    super(code)
  }

  get status(): number {
    return STATUS[this.code]
  }
}
