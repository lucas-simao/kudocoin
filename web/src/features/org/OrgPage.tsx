import { type ReactNode, useEffect } from 'react'
import { useSession } from '@/auth/session'
import { Avatar, Button, Card, Coins, Heading, Notice, Spinner } from '@/components/ui'
import { LinkedText } from '@/components/LinkedText'
import { useI18n } from '@/i18n'
import {
  type Entry,
  type Org,
  type Season,
  givenToday,
  rank,
  todayIn,
  useLedger,
  useMembers,
  useOrg,
  useOrgId,
  usePastSeasons,
  useSeason,
} from '@/lib/data'
import { Link } from '@/lib/router'
import { startTour, tourSeen } from '../tour/tour'
import { Bounties } from './Bounties'
import { GiveForm } from './GiveForm'
import { Requests } from './Requests'

/** Loads an organization by its address and hands it to `children`, for every screen under /o/<slug>. */
export function WithOrg({ slug, children }: { slug: string; children: (org: Org) => ReactNode }) {
  const { t, error } = useI18n()
  const orgId = useOrgId(slug)
  const org = useOrg(orgId.status === 'ready' ? orgId.value : undefined)
  if (orgId.status === 'error') return <Notice tone="error">{orgId.code === 'not_found' ? t('errors.notFound') : error(orgId.code)}</Notice>
  if (!org) return <Spinner label={t('common.loading')} />
  return <>{children(org)}</>
}

export function OrgPage({ slug }: { slug: string }) {
  return <WithOrg slug={slug}>{(org) => <OrgBoard org={org} />}</WithOrg>
}

function OrgBoard({ org }: { org: Org }) {
  const { user } = useSession()
  const { t, number, date } = useI18n()
  const season = useSeason(org.id, org.seasonId)
  const members = useMembers(org.id)
  const recent = useLedger(org.id)
  const past = usePastSeasons(org.id)
  const me = members?.find((member) => member.uid === user?.uid)
  const today = todayIn(org.settings.timezone)
  const left = Math.max(0, org.settings.dailyAllowance - givenToday(me, org.settings.timezone))
  const ready = Boolean(season && members && me && recent)
  const tour = () =>
    startTour({
      t,
      coinName: org.settings.coinName,
      dailyAllowance: org.settings.dailyAllowance,
      maxPerGive: org.settings.maxPerGive,
      isAdmin: me?.role !== 'member',
      slackTeam: org.slack?.teamName ?? null,
    })

  // The first time someone opens an organization, once everything it points at is on the screen.
  useEffect(() => {
    if (!ready || tourSeen()) return
    const timer = window.setTimeout(tour, 400)
    return () => window.clearTimeout(timer)
    // Only `ready` matters: the tour reads the rest when it starts.
  }, [ready])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading as="h1">{org.name}</Heading>
          <p className="text-sm text-subtle">
            {season && org.sprintWeeks ? (
              <>
                {t('org.sprintNumber', { n: season.number })}
                {' · '}
                {season.startsOn ? t('org.sprintDates', { start: date(season.startsOn), end: date(season.endsOn) }) : t('org.endsOn', { date: date(season.endsOn) })}
              </>
            ) : season ? (
              <>
                {t('org.seasonNumber', { n: season.number })}
                {' · '}
                {t('org.endsOn', { date: date(season.endsOn) })}
              </>
            ) : null}
            {' · '}
            {t('org.members', { n: number(org.memberCount) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ready ? (
            <Button variant="quiet" onClick={tour}>
              {t('tour.start')}
            </Button>
          ) : null}
          {/* Members find "leave" there; admins find everything else too. */}
          {me ? (
            <Link
              to={{ name: 'settings', slug: org.slug }}
              data-tour="settings"
              className="min-h-11 rounded-control border border-line px-4 py-2.5 text-[0.9375rem] hover:bg-hover"
            >
              {t('org.settings')}
            </Link>
          ) : null}
        </div>
      </div>

      {season && today > season.endsOn ? <Notice>{t(org.sprintWeeks ? 'org.endedSprint' : 'org.ended')}</Notice> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="flex flex-col gap-4" tour="board">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Heading>{t('org.leaderboard')}</Heading>
            <p className="text-sm text-coin-text">{season?.prize ? t('org.prize', { prize: season.prize }) : t('org.noPrize')}</p>
          </div>
          {season ? <Board season={season} org={org} myUid={user?.uid} /> : <Spinner label={t('common.loading')} />}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4" tour="give">
            <Heading>{t('give.title')}</Heading>
            {members && user ? <GiveForm org={org} members={members} myUid={user.uid} left={left} /> : <Spinner label={t('common.loading')} />}
          </Card>
          {members && me ? <Bounties org={org} members={members} me={me} left={left} /> : null}
          {members && me ? <Requests org={org} members={members} me={me} /> : null}
        </div>
      </div>

      <Card className="flex flex-col gap-4" tour="recent">
        <Heading>{t('org.recent')}</Heading>
        {recent === undefined ? <Spinner label={t('common.loading')} /> : <EntryList entries={recent} org={org} />}
      </Card>

      {past && past.length > 0 ? (
        <Card className="flex flex-col gap-4">
          <Heading>{t('org.pastSeasons')}</Heading>
          <ul className="flex flex-col gap-4">
            {past.map((closed) => (
              <li key={closed.id} className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  {closed.startsOn && org.sprintWeeks
                    ? `${t('org.sprintNumber', { n: closed.number })} · ${t('org.sprintDates', { start: date(closed.startsOn), end: date(closed.endsOn) })}`
                    : `${t('org.seasonNumber', { n: closed.number })} · ${date(closed.endsOn)}`}
                  {closed.prize ? ` · ${closed.prize}` : ''}
                </p>
                <ol className="flex flex-wrap gap-2 text-sm">
                  {(closed.standings ?? []).slice(0, 3).map((row) => (
                    <li key={row.uid} className="rounded-pill bg-hover px-3 py-1">
                      {t('org.place', { n: row.place })} {row.name || t('common.formerMember')} · <span className="tabular">{number(row.balance)}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

function Board({ season, org, myUid }: { season: Season; org: Org; myUid: string | undefined }) {
  const { t, number } = useI18n()
  const rows = rank(season.board)
  return (
    <ol className="flex flex-col">
      {rows.map((row) => (
        <li key={row.uid}>
          <Link
            to={{ name: 'member', slug: org.slug, uid: row.uid }}
            className={`flex items-center gap-3 rounded-control px-2 py-2.5 hover:bg-hover ${row.uid === myUid ? 'bg-coin-soft/60' : ''}`}
          >
            <span className={`w-9 text-sm tabular ${row.place <= 3 ? 'font-semibold text-coin-text' : 'text-subtle'}`}>{t('org.place', { n: row.place })}</span>
            <Avatar name={row.name} picture={row.picture} />
            <span className="flex-1 truncate">
              {row.name}
              {row.uid === myUid ? <span className="text-subtle"> ({t('common.you')})</span> : null}
            </span>
            <Coins amount={number(row.balance)} name={org.settings.coinName} strong />
          </Link>
        </li>
      ))}
    </ol>
  )
}

export function EntryList({ entries, org }: { entries: Entry[]; org: Org }) {
  const { t, number, date } = useI18n()
  if (entries.length === 0) return <p className="text-sm text-subtle">{t('org.noActivity')}</p>
  return (
    <ul className="flex flex-col divide-y divide-line-subtle">
      {entries.map((entry) => {
        const vars = {
          from: entry.fromName || t('common.formerMember'),
          to: entry.toName || t('common.formerMember'),
          amount: `${number(entry.amount)} ${org.settings.coinName}`,
        }
        const line =
          entry.kind === 'give'
            ? t('org.gave', vars)
            : entry.kind === 'award'
              ? t('org.awarded', vars)
              : entry.kind === 'bounty'
                ? t('org.paidBounty', vars)
                : t('org.corrected', vars)
        return (
          <li key={entry.id} className="flex flex-col gap-1 py-3">
            <p className="text-[0.9375rem]">{line}</p>
            {entry.reason ? (
              <p className="text-sm text-muted">
                “<LinkedText text={entry.reason} />”
              </p>
            ) : null}
            <p className="text-xs text-subtle">{date(entry.day)}</p>
          </li>
        )
      })}
    </ul>
  )
}
