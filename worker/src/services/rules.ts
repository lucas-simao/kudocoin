// The give rules, as pure functions: docs/decisions/allowance-and-limits.md. Each one is unit tested.
import { ApiError } from '../errors'

export interface OrgSettings {
  coinName: string
  dailyAllowance: number
  maxPerGive: number
  maxReceivedPerDay: number
  reasonRequired: boolean
  timezone: string
}

export const DEFAULT_SETTINGS: OrgSettings = {
  coinName: 'Kudocoin',
  dailyAllowance: 5,
  maxPerGive: 5,
  maxReceivedPerDay: 20,
  reasonRequired: true,
  timezone: 'America/Sao_Paulo',
}

export const MAX_REASON = 280

/** What one member gave or received on one day. A different date means zero. */
export interface DayCount {
  date: string
  amount: number
}

export function countOn(day: DayCount | undefined, date: string): number {
  return day && day.date === date ? day.amount : 0
}

/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function dateIn(timezone: string, at: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

export function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export interface GiveCheck {
  kind: 'give' | 'award'
  giverUid: string
  receiverUid: string
  receiverIsMember: boolean
  amount: number
  reason: string
  settings: OrgSettings
  today: string
  giverGiven: DayCount | undefined
  receiverReceived: DayCount | undefined
  seasonOpen: boolean
}

/** Throws the first rule that fails, in the order of the decision. */
export function checkGive(c: GiveCheck): void {
  if (c.giverUid === c.receiverUid) throw new ApiError('self_give')
  if (!c.receiverIsMember) throw new ApiError('not_a_member')
  const most = c.kind === 'award' ? 1000 : c.settings.maxPerGive
  if (!Number.isInteger(c.amount) || c.amount < 1 || c.amount > most) {
    throw new ApiError('amount_invalid', { max: most })
  }
  const reason = c.reason.trim()
  if ((c.settings.reasonRequired || c.kind === 'award') && reason.length === 0) {
    throw new ApiError('reason_required')
  }
  if (reason.length > MAX_REASON) throw new ApiError('reason_too_long', { max: MAX_REASON })
  if (c.kind === 'give') {
    const left = c.settings.dailyAllowance - countOn(c.giverGiven, c.today)
    if (c.amount > left) throw new ApiError('allowance_exceeded', { left: Math.max(0, left) })
    const room = c.settings.maxReceivedPerDay - countOn(c.receiverReceived, c.today)
    if (c.amount > room) throw new ApiError('receiver_limit_exceeded', { left: Math.max(0, room) })
  }
  if (!c.seasonOpen) throw new ApiError('season_closed')
}

/** Validates and fills an organization's settings from a request, keeping what is not sent. */
export function parseSettings(input: unknown, base: OrgSettings = DEFAULT_SETTINGS): OrgSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const whole = (key: keyof OrgSettings, min: number, max: number): number => {
    const value = raw[key] ?? base[key]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw new ApiError('invalid_request', { field: key })
    }
    return value
  }
  const coinName = String(raw.coinName ?? base.coinName).trim()
  if (coinName.length < 1 || coinName.length > 24) throw new ApiError('invalid_request', { field: 'coinName' })
  const timezone = String(raw.timezone ?? base.timezone)
  if (!isTimezone(timezone)) throw new ApiError('invalid_request', { field: 'timezone' })
  const reasonRequired = raw.reasonRequired ?? base.reasonRequired
  if (typeof reasonRequired !== 'boolean') throw new ApiError('invalid_request', { field: 'reasonRequired' })
  const settings: OrgSettings = {
    coinName,
    dailyAllowance: whole('dailyAllowance', 1, 100),
    maxPerGive: whole('maxPerGive', 1, 100),
    maxReceivedPerDay: whole('maxReceivedPerDay', 1, 1000),
    reasonRequired,
    timezone,
  }
  if (settings.maxPerGive > settings.dailyAllowance) throw new ApiError('invalid_request', { field: 'maxPerGive' })
  return settings
}

const RESERVED_SLUGS = new Set([
  'new', 'join', 'admin', 'api', 'app', 'settings', 'kudocoin', 'login', 'logout', 'signin', 'signout',
  'help', 'about', 'terms', 'privacy', 'www', 'orgs', 'o', 'me', 'account', 'static', 'assets',
])

export function checkSlug(slug: string): void {
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(slug) || slug.endsWith('-') || slug.includes('--') || RESERVED_SLUGS.has(slug)) {
    throw new ApiError('slug_invalid')
  }
}

/** A season's last day is a date; it has ended once that date has passed in the organization's time zone. */
export function seasonEnded(endsOn: string, today: string): boolean {
  return today > endsOn
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
