import { useEffect, useState } from 'react'
import { api, ApiError } from '@/api/client'
import { useSession } from '@/auth/session'
import { Button, Card, Heading, Notice, Spinner } from '@/components/ui'
import { useI18n } from '@/i18n'
import { navigate } from '@/lib/router'
import { SignInButtons } from '../landing/Landing'

type Preview = Awaited<ReturnType<typeof api.previewInvite>>

export function JoinPage({ token }: { token: string }) {
  const { user, ready } = useSession()
  const { t } = useI18n()
  if (!ready) return <Spinner label={t('common.loading')} />
  if (!user) {
    return (
      <Card className="mx-auto flex max-w-lg flex-col gap-4">
        <p className="text-muted">{t('join.signIn')}</p>
        <SignInButtons />
      </Card>
    )
  }
  return <Accept token={token} />
}

function Accept({ token }: { token: string }) {
  const { t, error, number } = useI18n()
  const [preview, setPreview] = useState<Preview>()
  const [problem, setProblem] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .previewInvite(token)
      .then(setPreview)
      .catch((caught: unknown) => setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic')))
  }, [token, error, t])

  if (problem && !preview) return <Notice tone="error">{problem}</Notice>
  if (!preview) return <Spinner label={t('common.loading')} />
  return (
    <Card className="mx-auto flex max-w-lg flex-col gap-4">
      <Heading as="h1">{t('join.title', { name: preview.name })}</Heading>
      <p className="text-muted">{t('join.members', { n: number(preview.memberCount), coin: preview.coinName })}</p>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {preview.isMember ? (
        <Button onClick={() => navigate({ name: 'org', slug: preview.slug })}>{t('join.already')}</Button>
      ) : (
        <Button
          busy={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const joined = await api.join(token)
              navigate({ name: 'org', slug: joined.slug }, true)
            } catch (caught) {
              setProblem(caught instanceof ApiError ? error(caught.code, caught.details) : t('errors.generic'))
              setBusy(false)
            }
          }}
        >
          {t('join.accept')}
        </Button>
      )}
    </Card>
  )
}
