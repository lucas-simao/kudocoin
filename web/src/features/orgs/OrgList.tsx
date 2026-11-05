import { useSession } from '@/auth/session'
import { Button, Card, Heading, Notice, Spinner } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useMyOrgs } from '@/lib/data'
import { Link, navigate } from '@/lib/router'

export function OrgList() {
  const { user } = useSession()
  const { t } = useI18n()
  const orgs = useMyOrgs(user?.uid)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading as="h1">{t('orgs.title')}</Heading>
        <Button onClick={() => navigate({ name: 'new' })}>{t('orgs.create')}</Button>
      </div>
      {orgs.status === 'loading' ? <Spinner label={t('common.loading')} /> : null}
      {orgs.status === 'error' ? <Notice tone="error">{t('errors.generic')}</Notice> : null}
      {orgs.status === 'ready' && orgs.value.length === 0 ? (
        <Card>
          <p className="max-w-lg text-muted">{t('orgs.empty')}</p>
        </Card>
      ) : null}
      {orgs.status === 'ready' && orgs.value.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {orgs.value.map((org) => (
            <li key={org.id}>
              <Link
                to={{ name: 'org', slug: org.slug }}
                className="flex items-center justify-between gap-3 rounded-card border border-line-subtle bg-surface p-5 shadow-card hover:bg-hover"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{org.name}</span>
                  <span className="text-sm text-subtle">/o/{org.slug}</span>
                </span>
                <span className="rounded-pill bg-hover px-2.5 py-1 text-xs text-muted">{t(`orgs.roles.${org.role}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
