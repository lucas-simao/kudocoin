// Live reads from Firestore. The rules let a member read their own organization only, and each screen
// reads as few documents as it can: the leaderboard is one document (docs/decisions/zero-cost-hosting.md).
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
  where,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { api, ApiError, type Role, type Settings } from '@/api/client'
import { db } from '@/auth/firebase'

export interface Org {
  id: string
  name: string
  slug: string
  settings: Settings
  seasonId: string
  ownerUid: string
  memberCount: number
  /** The Slack workspace playing here, if any (docs/decisions/slack.md). */
  slack?: { teamId: string; teamName: string; announce: boolean } | null
}

export interface Member {
  uid: string
  name: string
  picture: string | null
  role: Role
  seasonId: string
  balance: number
  given: { date: string; amount: number }
  received: { date: string; amount: number }
}

export interface BoardRow {
  uid: string
  name: string
  picture: string | null
  balance: number
  place: number
}

export interface Season {
  id: string
  number: number
  endsOn: string
  prize: string
  status: 'open' | 'closed'
  board: Record<string, Omit<BoardRow, 'uid' | 'place'>>
  standings?: BoardRow[]
}

export interface Entry {
  id: string
  kind: 'give' | 'award' | 'correction'
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
  reason: string
  seasonId: string
  day: string
  createdAt: Date
}

export interface MyOrg {
  id: string
  name: string
  slug: string
  role: Role
}

type Loadable<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; code: string }

function entry(id: string, data: Record<string, unknown>): Entry {
  const at = data.createdAt as Timestamp | undefined
  return { id, ...(data as Omit<Entry, 'id' | 'createdAt'>), createdAt: at ? at.toDate() : new Date() }
}

export function useMyOrgs(uid: string | undefined): Loadable<MyOrg[]> {
  const [state, setState] = useState<Loadable<MyOrg[]>>({ status: 'loading' })
  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      collection(db, `users/${uid}/orgs`),
      (snapshot) => {
        const orgs = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<MyOrg, 'id'>) }))
        setState({ status: 'ready', value: orgs.sort((a, b) => a.name.localeCompare(b.name)) })
      },
      () => setState({ status: 'error', code: 'internal' }),
    )
  }, [uid])
  return state
}

/** The organization behind a slug, for its members only: anyone else gets not_found. */
export function useOrgId(slug: string): Loadable<string> {
  const [state, setState] = useState<Loadable<string>>({ status: 'loading' })
  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    api
      .resolveSlug(slug)
      .then(({ orgId }) => live && setState({ status: 'ready', value: orgId }))
      .catch((error: unknown) => live && setState({ status: 'error', code: error instanceof ApiError ? error.code : 'internal' }))
    return () => {
      live = false
    }
  }, [slug])
  return state
}

export function useOrg(orgId: string | undefined): Org | undefined {
  const [org, setOrg] = useState<Org>()
  useEffect(() => {
    if (!orgId) return
    return onSnapshot(doc(db, `orgs/${orgId}`), (snapshot) => {
      if (snapshot.exists()) setOrg({ id: snapshot.id, ...(snapshot.data() as Omit<Org, 'id'>) })
    })
  }, [orgId])
  return org
}

export function useSeason(orgId: string | undefined, seasonId: string | undefined): Season | undefined {
  const [season, setSeason] = useState<Season>()
  useEffect(() => {
    if (!orgId || !seasonId) return
    return onSnapshot(doc(db, `orgs/${orgId}/seasons/${seasonId}`), (snapshot) => {
      if (snapshot.exists()) setSeason({ id: snapshot.id, ...(snapshot.data() as Omit<Season, 'id'>) })
    })
  }, [orgId, seasonId])
  return season
}

export function useMembers(orgId: string | undefined): Member[] | undefined {
  const [members, setMembers] = useState<Member[]>()
  useEffect(() => {
    if (!orgId) return
    return onSnapshot(collection(db, `orgs/${orgId}/members`), (snapshot) => {
      setMembers(snapshot.docs.map((item) => item.data() as Member).sort((a, b) => a.name.localeCompare(b.name)))
    })
  }, [orgId])
  return members
}

/** The newest entries: of the whole organization, or those one member gave or received. */
export function useLedger(orgId: string | undefined, uid?: string, size = 20): Entry[] | undefined {
  const [entries, setEntries] = useState<Entry[]>()
  useEffect(() => {
    if (!orgId) return
    const ledger = collection(db, `orgs/${orgId}/ledger`)
    if (!uid) {
      return onSnapshot(query(ledger, orderBy('createdAt', 'desc'), limit(size)), (snapshot) =>
        setEntries(snapshot.docs.map((item) => entry(item.id, item.data()))),
      )
    }
    // Firestore has no OR across two fields on the free indexes we keep, so two queries, merged.
    const parts: Record<'from' | 'to', Entry[]> = { from: [], to: [] }
    const merge = () =>
      setEntries(
        [...parts.from, ...parts.to]
          .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, size),
      )
    const stops = (['from', 'to'] as const).map((field) =>
      onSnapshot(query(ledger, where(field, '==', uid), orderBy('createdAt', 'desc'), limit(size)), (snapshot) => {
        parts[field] = snapshot.docs.map((item) => entry(item.id, item.data()))
        merge()
      }),
    )
    return () => stops.forEach((stop) => stop())
  }, [orgId, uid, size])
  return entries
}

export function usePastSeasons(orgId: string | undefined): Season[] | undefined {
  const [seasons, setSeasons] = useState<Season[]>()
  useEffect(() => {
    if (!orgId) return
    return onSnapshot(collection(db, `orgs/${orgId}/seasons`), (snapshot) => {
      setSeasons(
        snapshot.docs
          .map((item) => ({ id: item.id, ...(item.data() as Omit<Season, 'id'>) }))
          .filter((season) => season.status === 'closed')
          .sort((a, b) => b.number - a.number),
      )
    })
  }, [orgId])
  return seasons
}

/** The active invite token; only admins can read it (docs/decisions/invites.md). */
export function useInviteToken(orgId: string | undefined, isAdmin: boolean): string | null | undefined {
  const [token, setToken] = useState<string | null>()
  useEffect(() => {
    if (!orgId || !isAdmin) return
    return onSnapshot(
      doc(db, `orgs/${orgId}/admin/invite`),
      (snapshot) => setToken(snapshot.exists() ? String(snapshot.data().token) : null),
      () => setToken(null),
    )
  }, [orgId, isAdmin])
  return token
}

/** The leaderboard, highest first; equal balances share a place. */
export function rank(board: Season['board']): BoardRow[] {
  const rows = Object.entries(board)
    .map(([uid, row]) => ({ uid, ...row }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  let place = 0
  return rows.map((row, index) => {
    if (index === 0 || row.balance !== rows[index - 1].balance) place = index + 1
    return { ...row, place }
  })
}

/** Today in the organization's time zone, YYYY-MM-DD, as the Worker counts it. */
export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function givenToday(member: Member | undefined, timezone: string): number {
  return member && member.given.date === todayIn(timezone) ? member.given.amount : 0
}
