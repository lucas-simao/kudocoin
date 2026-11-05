// A short guided tour of an organization's page, with driver.js. It starts by itself on someone's first
// visit and again from "How it works". driver.js loads only when the tour runs, so the page does not wait on it.
import type { Key } from '@/i18n'

export interface TourContext {
  t: (key: Key, vars?: Record<string, string | number>) => string
  coinName: string
  dailyAllowance: number
  maxPerGive: number
  isAdmin: boolean
  slackTeam: string | null
}

const SEEN = 'kudocoin.tour.seen'

export function tourSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN) === '1'
  } catch {
    // Without storage the tour would start on every visit; better not to start it by itself at all.
    return true
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN, '1')
  } catch {
    // Nothing to keep then.
  }
}

export async function startTour({ t, coinName, dailyAllowance, maxPerGive, isAdmin, slackTeam }: TourContext): Promise<void> {
  const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')])
  const steps = [
    { element: '[data-tour="board"]', popover: { title: t('tour.boardTitle'), description: t('tour.boardBody') } },
    {
      element: '[data-tour="give"]',
      popover: { title: t('tour.giveTitle'), description: t('tour.giveBody', { n: dailyAllowance, coin: coinName, max: maxPerGive }) },
    },
    { element: '[data-tour="recent"]', popover: { title: t('tour.recentTitle'), description: t('tour.recentBody') } },
    {
      element: '[data-tour="settings"]',
      popover: { title: t('tour.settingsTitle'), description: isAdmin ? t('tour.settingsAdminBody') : t('tour.settingsMemberBody') },
    },
    ...(slackTeam ? [{ popover: { title: t('tour.slackTitle'), description: t('tour.slackBody', { team: slackTeam }) } }] : []),
  ].filter((step) => !('element' in step) || document.querySelector(step.element as string))

  driver({
    steps,
    showProgress: true,
    progressText: t('tour.progress'),
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.prev'),
    doneBtnText: t('tour.done'),
    popoverClass: 'kudocoin-tour',
    smoothScroll: true,
    onDestroyed: markSeen,
  }).drive()
}
