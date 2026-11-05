import type { ReactNode } from 'react'
import { useSession } from '@/auth/session'
import { LANGS, useI18n } from '@/i18n'
import { Link } from '@/lib/router'
import { Avatar } from './ui'

export const REPO = 'https://github.com/lucas-simao/kudocoin'

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div role="group" aria-label={t('common.language')} className="flex rounded-pill border border-line p-0.5 text-[0.8125rem]">
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`min-h-8 rounded-pill px-2.5 ${lang === code ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'}`}
        >
          {code === 'pt-BR' ? 'PT' : code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession()
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh flex-col">
      {/* A solid, sticky bar: phones blur the top of a page that has none. */}
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-canvas">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to={user ? { name: 'orgs' } : { name: 'home' }} className="flex items-center gap-2 font-display text-lg font-semibold">
            <img src="/favicon.svg" alt="" width={30} height={30} />
            Kudocoin
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            {user ? (
              <>
                <Link to={{ name: 'account' }} aria-label={t('header.account')} className="rounded-full">
                  <Avatar name={user.displayName ?? ''} picture={user.photoURL} size={32} />
                </Link>
                <button type="button" onClick={() => signOut()} className="min-h-9 rounded-control px-2 text-sm text-muted hover:text-ink">
                  {t('header.signOut')}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-5 gap-y-2 px-4 pt-2 pb-8 text-sm text-subtle">
        <Link to={{ name: 'privacy' }} className="hover:text-ink hover:underline">
          {t('footer.privacy')}
        </Link>
        <a href={`${REPO}/issues`} className="hover:text-ink hover:underline">
          {t('footer.support')}
        </a>
        <a href={REPO} className="hover:text-ink hover:underline">
          {t('footer.source')}
        </a>
      </footer>
    </div>
  )
}
