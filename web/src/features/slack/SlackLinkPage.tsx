// Where a Slack person links their Kudocoin account (docs/decisions/slack.md). The page names the Slack
// account, the workspace and the organization before anything is linked: a link sent on by someone else
// would let them give as you, so the person confirms with what they see.
import { useEffect, useState } from 'react'
import { api, ApiError, type SlackLinkPreview } from '@/api/client'
import { useSession } from '@/auth/session'
import { Button, Card, Heading, Notice, Spinner } from '@/components/ui'
import { useI18n } from '@/i18n'
import { navigate } from '@/lib/router'
import { SignInButtons } from '../landing/Landing'

export function SlackLinkPage() {
  const { user, ready } = useSession()
  const { t } = useI18n()
  const [token] = useState(() => new URLSearchParams(window.location.search).get('t') ?? '')
  if (!ready) return <Spinner label={t('common.loading')} />
  return (
    <Card className="mx-auto flex max-w-lg flex-col gap-4">
      <Heading as="h1">{t('slack.linkTitle')}</Heading>
      {user ? (
        <Confirm token={token} />
      ) : (
        <>
          <p className="text-muted">{t('slack.linkSignIn')}</p>
          <SignInButtons />
        </>
      )}
    </Card>
  )
}

function Confirm({ token }: { token: string }) {
  const { user } = useSession()
  const { t, error } = useI18n()
  const [preview, setPreview] = useState<SlackLinkPreview>()
  const [problem, setProblem] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const explain = (caught: unknown) => (caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic'))

  useEffect(() => {
    api
      .slackLinkPreview(token)
      .then(setPreview)
      .catch((caught: unknown) => setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic')))
  }, [token, error, t])

  if (problem && !preview) return <Notice tone="error">{problem}</Notice>
  if (!preview) return <Spinner label={t('common.loading')} />
  if (!preview.isMember) return <Notice tone="error">{t('slack.linkNotMember', { org: preview.orgName })}</Notice>
  if (done) {
    return (
      <>
        <Notice tone="done">{t('slack.linkDone')}</Notice>
        <div>
          <Button variant="quiet" onClick={() => navigate({ name: 'org', slug: preview.slug })}>
            {t('slack.linkOpen', { org: preview.orgName })}
          </Button>
        </div>
      </>
    )
  }
  return (
    <>
      <p>{t('slack.linkWhat', { slack: preview.slackName, team: preview.teamName, me: user?.displayName ?? '', org: preview.orgName })}</p>
      <p className="text-sm text-muted">{t('slack.linkWarning')}</p>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <div>
        <Button
          busy={busy}
          onClick={async () => {
            setBusy(true)
            setProblem(undefined)
            try {
              await api.slackLink(token)
              setDone(true)
            } catch (caught) {
              setProblem(explain(caught))
            }
            setBusy(false)
          }}
        >
          {t('slack.linkConfirm')}
        </Button>
      </div>
    </>
  )
}
