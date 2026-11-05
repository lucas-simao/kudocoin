import { useState } from 'react'
import { signInError, useSession } from '@/auth/session'
import { Button, Notice } from '@/components/ui'
import { type Key, useI18n } from '@/i18n'

export function SignInButtons() {
  const { signIn } = useSession()
  const { t } = useI18n()
  const [problem, setProblem] = useState<Key>()
  const [busy, setBusy] = useState<'github' | 'google'>()
  const go = async (provider: 'github' | 'google') => {
    setProblem(undefined)
    setBusy(provider)
    try {
      await signIn(provider)
    } catch (error) {
      setProblem(signInError(error))
    } finally {
      setBusy(undefined)
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button busy={busy === 'github'} onClick={() => go('github')}>
          <GithubMark />
          {t('landing.signInGithub')}
        </Button>
        <Button variant="quiet" busy={busy === 'google'} onClick={() => go('google')}>
          <GoogleMark />
          {t('landing.signInGoogle')}
        </Button>
      </div>
      {problem ? <Notice tone="error">{t(problem)}</Notice> : null}
    </div>
  )
}

export function Landing() {
  const { t } = useI18n()
  const steps = [1, 2, 3, 4] as const
  return (
    <div className="flex flex-col gap-14">
      <section className="grid items-center gap-10 sm:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          <p className="text-sm font-medium text-coin-text">{t('landing.eyebrow')}</p>
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{t('landing.title')}</h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">{t('landing.lead')}</p>
          <SignInButtons />
        </div>
        <LeaderboardPreview />
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-xl font-semibold">{t('landing.stepsTitle')}</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step} className="flex flex-col gap-2 rounded-card border border-line-subtle bg-surface p-5">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-coin font-semibold text-on-coin">{step}</span>
              <h3 className="font-semibold">{t(`landing.step${step}Title`)}</h3>
              <p className="text-sm leading-relaxed text-muted">{t(`landing.step${step}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-col gap-3 border-t border-line-subtle pt-6 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between">
        <p className="sm:flex-1">{t('landing.noMoney')}</p>
        <a className="shrink-0 font-medium text-coin-text underline-offset-4 hover:underline" href="https://github.com/lucas-simao/kudocoin">
          {t('landing.source')}
        </a>
      </footer>
    </div>
  )
}

/** A made-up leaderboard, so the first screen shows what the game looks like. */
function LeaderboardPreview() {
  const { t, number } = useI18n()
  const rows = [
    { name: 'Ana Lima', balance: 42 },
    { name: 'Bruno Costa', balance: 37 },
    { name: 'Carla Dias', balance: 37 },
    { name: 'Davi Rocha', balance: 21 },
  ]
  return (
    <div aria-hidden className="rounded-card border border-line-subtle bg-surface p-5 shadow-card">
      <p className="mb-3 text-sm font-medium text-subtle">{t('org.leaderboard')}</p>
      <ol className="flex flex-col gap-1">
        {rows.map((row, index) => (
          <li key={row.name} className="flex items-center gap-3 rounded-control px-2 py-2">
            <span className="w-8 text-sm text-subtle tabular">{t('org.place', { n: index === 2 ? 2 : index + 1 })}</span>
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-coin-soft text-xs font-semibold text-coin-text">
              {row.name.split(' ').map((part) => part[0]).join('')}
            </span>
            <span className="flex-1">{row.name}</span>
            <span className="font-semibold tabular">{number(row.balance)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function GithubMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" width="18" height="18">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
