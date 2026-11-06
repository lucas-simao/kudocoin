// `/kudos summary`: the season's leaderboard in Slack. Only the person who asked sees it, with their own place
// and what they can still give today; `/kudos summary share` posts the leaderboard alone in the channel.
import type { Firestore } from '../firestore/client'
import { as, type MemberDoc, type OrgDoc, paths, type SeasonDoc } from '../repositories/documents'
import { countOn, dateIn } from '../services/rules'
import { standings } from '../services/seasons'
import type { Reply } from './command'
import { fill, SLACK_MESSAGES, type SlackLang } from './messages'
import { escape } from './parse'

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const ROWS = 10

export async function summary(
  store: Firestore,
  orgId: string,
  org: OrgDoc,
  uid: string,
  lang: SlackLang,
  share: boolean,
  url: string,
): Promise<Reply> {
  const words = SLACK_MESSAGES[lang]
  const [seasonDoc, memberDoc] = await store.getAll([paths.season(orgId, org.seasonId), paths.member(orgId, uid)])
  const member = as<MemberDoc>(memberDoc)
  // The link outlived the membership: same answer as a give.
  if (!member) return { response_type: 'ephemeral', text: words.errors.not_found }
  const season = as<SeasonDoc>(seasonDoc)
  if (!season) throw new Error('the open season is missing')

  const coin = escape(org.settings.coinName)
  const format = (day: string) =>
    new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
  const sprint = Boolean(org.sprintWeeks)
  const startsOn = season.startsOn ?? dateIn(org.settings.timezone, season.startedAt)
  const rows = standings(season.board ?? {}).filter((row) => row.balance > 0)

  const lines = [
    fill(sprint ? words.summarySprintTitle : words.summaryTitle, { org: escape(org.name), n: season.number }),
    [
      sprint
        ? fill(words.summarySprintDates, { start: format(startsOn), end: format(season.endsOn) })
        : fill(words.summaryEnds, { date: format(season.endsOn) }),
      season.prize ? fill(words.summaryPrize, { prize: escape(season.prize) }) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    '',
  ]
  if (rows.length === 0) lines.push(words.summaryEmpty)
  for (const row of rows.slice(0, ROWS)) {
    lines.push(`${MEDALS[row.place] ?? `${row.place}.`} ${escape(row.name || words.formerMember)}: ${row.balance} ${coin}`)
  }
  if (rows.length > ROWS) lines.push(fill(words.summaryMore, { n: rows.length - ROWS }))

  if (!share) {
    const today = dateIn(org.settings.timezone, new Date())
    const left = Math.max(0, org.settings.dailyAllowance - countOn(member.given, today))
    const mine = rows.find((row) => row.uid === uid)
    lines.push('', mine ? fill(words.summaryYou, { place: mine.place, balance: mine.balance, coin, left }) : fill(words.summaryYouNone, { left }))
  }
  lines.push('', fill(words.summaryLink, { url }))
  return { response_type: share ? 'in_channel' : 'ephemeral', text: lines.join('\n') }
}
