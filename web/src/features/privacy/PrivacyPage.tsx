// What Kudocoin keeps about a person, in plain words. Every line matches what the code stores
// (worker/src/repositories/documents.ts); change both together.
import { REPO } from '@/components/Shell'
import { Heading } from '@/components/ui'
import { type Key, useI18n } from '@/i18n'

/** The day this page last changed, in the API's date form. */
const UPDATED = '2026-11-05'

const SECTIONS: { title: Key; body: Key[] }[] = [
  { title: 'privacy.keepTitle', body: ['privacy.keepSignIn', 'privacy.keepPlay', 'privacy.keepSlack', 'privacy.keepBrowser'] },
  { title: 'privacy.whoTitle', body: ['privacy.whoBody'] },
  { title: 'privacy.notTitle', body: ['privacy.notBody'] },
  { title: 'privacy.whereTitle', body: ['privacy.whereBody'] },
  { title: 'privacy.deleteTitle', body: ['privacy.deleteBody'] },
]

export function PrivacyPage() {
  const { t, date } = useI18n()
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Heading as="h1">{t('privacy.title')}</Heading>
        <p className="text-sm text-subtle">{t('privacy.updated', { date: date(UPDATED) })}</p>
        <p className="text-lg leading-relaxed text-muted">{t('privacy.intro')}</p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <Heading>{t(section.title)}</Heading>
          {section.body.length > 1 ? (
            <ul className="flex list-disc flex-col gap-2 pl-5 leading-relaxed text-muted">
              {section.body.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          ) : (
            <p className="leading-relaxed text-muted">{t(section.body[0])}</p>
          )}
        </section>
      ))}
      <section className="flex flex-col gap-3">
        <Heading>{t('privacy.contactTitle')}</Heading>
        <p className="leading-relaxed text-muted">{t('privacy.contactBody')}</p>
        <p>
          <a href={`${REPO}/issues/new`} className="font-medium text-coin-text underline-offset-4 hover:underline">
            {t('privacy.contactLink')}
          </a>
        </p>
      </section>
    </article>
  )
}
