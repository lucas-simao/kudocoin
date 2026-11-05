import { Avatar, Card, Coins, Heading, Spinner } from '@/components/ui'
import { useI18n } from '@/i18n'
import { type Org, useLedger, useSeason } from '@/lib/data'
import { Link } from '@/lib/router'
import { EntryList, WithOrg } from '../org/OrgPage'

export function MemberPage({ slug, uid }: { slug: string; uid: string }) {
  return <WithOrg slug={slug}>{(org) => <Member org={org} uid={uid} />}</WithOrg>
}

function Member({ org, uid }: { org: Org; uid: string }) {
  const { t, number } = useI18n()
  const season = useSeason(org.id, org.seasonId)
  const entries = useLedger(org.id, uid, 50)
  const row = season?.board[uid]
  const name = row?.name ?? entries?.find((entry) => entry.to === uid)?.toName ?? entries?.find((entry) => entry.from === uid)?.fromName ?? ''
  const inSeason = entries?.filter((entry) => entry.seasonId === org.seasonId) ?? []
  const received = inSeason.filter((entry) => entry.to === uid && entry.kind !== 'correction').reduce((sum, entry) => sum + entry.amount, 0)
  const given = inSeason.filter((entry) => entry.from === uid && entry.kind === 'give').reduce((sum, entry) => sum + entry.amount, 0)
  return (
    <div className="flex flex-col gap-6">
      <Link to={{ name: 'org', slug: org.slug }} className="text-sm text-coin-text hover:underline">
        ← {org.name}
      </Link>
      <div className="flex items-center gap-4">
        <Avatar name={name} picture={row?.picture ?? null} size={56} />
        <div className="flex flex-col gap-1">
          <Heading as="h1">{name || t('common.formerMember')}</Heading>
          <p className="text-muted">
            {t('member.balance')}: <Coins amount={number(row?.balance ?? 0)} name={org.settings.coinName} strong />
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card>
          <p className="text-sm text-subtle">{t('member.received')}</p>
          <p className="text-2xl font-semibold tabular">{number(received)}</p>
        </Card>
        <Card>
          <p className="text-sm text-subtle">{t('member.given')}</p>
          <p className="text-2xl font-semibold tabular">{number(given)}</p>
        </Card>
      </div>
      <Card className="flex flex-col gap-4">
        <Heading>{t('member.history')}</Heading>
        {entries === undefined ? <Spinner label={t('common.loading')} /> : entries.length === 0 ? <p className="text-sm text-subtle">{t('member.empty')}</p> : <EntryList entries={entries} org={org} />}
      </Card>
    </div>
  )
}
