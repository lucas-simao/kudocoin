import { useEffect } from 'react'
import { useSession } from '@/auth/session'
import { Shell } from '@/components/Shell'
import { Notice, Spinner } from '@/components/ui'
import { AccountPage } from '@/features/account/AccountPage'
import { JoinPage } from '@/features/join/JoinPage'
import { Landing } from '@/features/landing/Landing'
import { MemberPage } from '@/features/member/MemberPage'
import { OrgPage } from '@/features/org/OrgPage'
import { CreateOrg } from '@/features/orgs/CreateOrg'
import { OrgList } from '@/features/orgs/OrgList'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SlackLinkPage } from '@/features/slack/SlackLinkPage'
import { useI18n } from '@/i18n'
import { navigate, type Route, useRoute } from '@/lib/router'

const PUBLIC: Route['name'][] = ['home', 'join', 'slackLink', 'missing']

export function App() {
  const route = useRoute()
  const { user, ready } = useSession()
  const { t } = useI18n()

  // Signed in on the public page: go to the organizations. Signed out elsewhere: back to the public page.
  useEffect(() => {
    if (!ready) return
    if (user && route.name === 'home') navigate({ name: 'orgs' }, true)
    if (!user && !PUBLIC.includes(route.name)) navigate({ name: 'home' }, true)
  }, [ready, user, route.name])

  return <Shell>{ready ? <Screen route={route} /> : <Spinner label={t('common.loading')} />}</Shell>
}

function Screen({ route }: { route: Route }) {
  const { t } = useI18n()
  switch (route.name) {
    case 'home':
      return <Landing />
    case 'orgs':
      return <OrgList />
    case 'new':
      return <CreateOrg />
    case 'org':
      return <OrgPage key={route.slug} slug={route.slug} />
    case 'member':
      return <MemberPage key={`${route.slug}/${route.uid}`} slug={route.slug} uid={route.uid} />
    case 'settings':
      return <SettingsPage key={route.slug} slug={route.slug} />
    case 'join':
      return <JoinPage token={route.token} />
    case 'slackLink':
      return <SlackLinkPage />
    case 'account':
      return <AccountPage />
    case 'missing':
      return <Notice>{t('errors.notFound')}</Notice>
  }
}
