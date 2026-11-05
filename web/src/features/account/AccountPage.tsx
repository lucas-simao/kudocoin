import { deleteUser } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { api, ApiError } from '@/api/client'
import { auth } from '@/auth/firebase'
import { useSession } from '@/auth/session'
import { Avatar, Button, Card, ConfirmButton, Heading, Notice, Spinner } from '@/components/ui'
import { useI18n } from '@/i18n'
import { navigate } from '@/lib/router'

export function AccountPage() {
  const { user, signOut } = useSession()
  const { t, error } = useI18n()
  const [problem, setProblem] = useState<string>()
  if (!user) return null
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Heading as="h1">{t('account.title')}</Heading>
      <Card className="flex items-center gap-4">
        <Avatar name={user.displayName ?? ''} picture={user.photoURL} size={48} />
        <span className="font-semibold">{user.displayName}</span>
      </Card>
      <SlackLinks />
      <Card className="flex flex-col gap-3">
        <Heading>{t('account.delete')}</Heading>
        <p className="text-sm text-muted">{t('account.deleteHint')}</p>
        {problem ? <Notice tone="error">{problem}</Notice> : null}
        <div>
          <ConfirmButton
            label={t('account.delete')}
            question={t('account.deleteConfirm')}
            confirmLabel={t('account.delete')}
            cancelLabel={t('common.cancel')}
            onConfirm={async () => {
              setProblem(undefined)
              try {
                await api.deleteAccount()
                // Firebase may ask for a recent sign-in to delete the user; the data is gone already, so sign out.
                if (auth.currentUser) await deleteUser(auth.currentUser).catch(() => signOut())
                navigate({ name: 'home' }, true)
              } catch (caught) {
                setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic'))
              }
            }}
          />
        </div>
      </Card>
    </div>
  )
}

type SlackLink = Awaited<ReturnType<typeof api.mySlackLinks>>['links'][number]

/** The Slack accounts that give as this person (docs/decisions/slack.md). Hidden when there are none. */
function SlackLinks() {
  const { t, error } = useI18n()
  const [links, setLinks] = useState<SlackLink[]>()
  const [problem, setProblem] = useState<string>()
  useEffect(() => {
    api
      .mySlackLinks()
      .then((answer) => setLinks(answer.links))
      .catch(() => setLinks([]))
  }, [])
  if (links === undefined) return <Spinner label={t('common.loading')} />
  if (links.length === 0) return null
  return (
    <Card className="flex flex-col gap-3">
      <Heading>{t('slack.title')}</Heading>
      <p className="text-sm text-muted">{t('slack.accountHint')}</p>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <ul className="flex flex-col divide-y divide-line-subtle">
        {links.map((link) => (
          <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>{t('slack.accountItem', { slack: link.slackName, team: link.teamName })}</span>
            <Button
              variant="quiet"
              onClick={async () => {
                setProblem(undefined)
                try {
                  await api.unlinkSlack(link.id)
                  setLinks((current) => current?.filter((item) => item.id !== link.id))
                } catch (caught) {
                  setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic'))
                }
              }}
            >
              {t('slack.unlink')}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
