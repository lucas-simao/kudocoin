// The hourly job (docs/decisions/sprints.md): closes every season whose last day has ended in its
// organization's time zone, with the same closeSeason() as the button.
import type { Firestore } from './firestore/client'
import { closeSeason } from './services/seasons'

/** How many organizations one run looks at; the next run takes the rest. */
const BATCH = 50

export async function closeDueSeasons(store: Firestore, now = new Date()): Promise<{ closed: number; failed: number }> {
  const due = await store.where('', 'orgs', 'closesAt', now, BATCH, 'LESS_THAN_OR_EQUAL')
  let closed = 0
  let failed = 0
  for (const { id } of due) {
    try {
      if (await closeSeason(store, id, {}, { auto: true })) closed += 1
    } catch (error) {
      // One organization's trouble does not stop the others; it is tried again next hour.
      failed += 1
      console.error('closing a season', id, error instanceof Error ? error.message : 'unknown')
    }
  }
  return { closed, failed }
}
