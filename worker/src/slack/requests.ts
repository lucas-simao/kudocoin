// Requests from Slack (docs/decisions/claims-and-requests.md): ask, list and answer, with the same services
// as the web app.
import { ApiError } from '../errors'
import type { Firestore } from '../firestore/client'
import { as, type OrgDoc, paths, type SlackUserDoc } from '../repositories/documents'
import { sha256 } from '../services/ids'
import { askCoins, cancelRequest, declineRequest, openRequests, payRequest, requestByNumber } from '../services/requests'
import { dateIn } from '../services/rules'
import type { Command, Reply } from './command'
import { fill, isSlackError, type SlackMessages } from './messages'
import type { Request } from './parse'
import { escape, plainText } from './parse'
import { daysBetween, mention } from './people'

type RequestRequest = Extract<Request, { kind: 'requests' | 'requestAsk' | 'requestAnswer' }>

const ephemeral = (text: string): Reply => ({ response_type: 'ephemeral', text })

export async function requestCommand(
  store: Firestore,
  orgId: string,
  org: OrgDoc,
  uid: string,
  command: Command,
  request: RequestRequest,
  words: SlackMessages,
): Promise<Reply> {
  const caller = { uid, name: '', picture: null, provider: null }
  const coin = escape(org.settings.coinName)
  const me = `<@${command.userId}>`
  try {
    if (request.kind === 'requests') {
      const { toMe, mine } = await openRequests(store, orgId, uid)
      if (toMe.length === 0 && mine.length === 0) return ephemeral(words.requestsNone)
      const today = dateIn(org.settings.timezone, new Date())
      const when = (expiresOn: string) => {
        const days = daysBetween(today, expiresOn)
        return days < 0 ? words.bountyExpired : days === 0 ? words.bountyLastDay : fill(words.bountyDaysLeft, { days })
      }
      const lines: string[] = []
      if (toMe.length) {
        lines.push(words.requestsToYou)
        for (const row of toMe) {
          const from = escape(row.fromName || words.formerMember)
          lines.push(fill(words.requestRowToYou, { number: row.number, from, n: row.amount, coin, reason: escape(row.reason), when: when(row.expiresOn) }))
        }
      }
      if (mine.length) {
        if (lines.length) lines.push('')
        lines.push(words.requestsYours)
        for (const row of mine) {
          const to = escape(row.toName || words.formerMember)
          lines.push(fill(words.requestRowYours, { number: row.number, to, n: row.amount, coin, reason: escape(row.reason), when: when(row.expiresOn) }))
        }
      }
      return ephemeral(lines.join('\n'))
    }

    if (request.kind === 'requestAsk') {
      const { slackUserId, amount } = request.kudos
      const to = `<@${slackUserId}>`
      if (slackUserId === command.userId) return ephemeral(words.errors.self_give)
      const link = as<SlackUserDoc>(await store.get(paths.slackUser(`${command.teamId}_${slackUserId}`)))
      if (!link) return ephemeral(fill(words.receiverNotLinked, { receiver: to }))
      const reason = plainText(request.kudos.reason)
      const key = `slack-${(await sha256(`${command.teamId}:${command.triggerId || crypto.randomUUID()}`)).slice(0, 40)}`
      const asked = await askCoins(store, orgId, caller, { to: link.uid, amount, reason, key })
      const vars = { from: me, to, n: amount, coin, reason: escape(reason), number: asked.number }
      return org.slack?.announce ? { response_type: 'in_channel', text: fill(words.requestAsked, vars) } : ephemeral(fill(words.requestAskedQuiet, vars))
    }

    const found = await requestByNumber(store, orgId, request.number)
    if (!found) return ephemeral(fill(words.requestNotFound, { number: request.number }))
    if (request.answer === 'decline') {
      await declineRequest(store, orgId, caller, found.id)
      return ephemeral(fill(words.requestDeclined, { number: request.number }))
    }
    if (request.answer === 'cancel') {
      await cancelRequest(store, orgId, caller, found.id)
      return ephemeral(fill(words.requestCancelled, { number: request.number }))
    }
    await payRequest(store, orgId, caller, found.id)
    const from = await mention(store, command.teamId, found.request.from, found.request.fromName || words.formerMember)
    const text = fill(words.requestPaid, { payer: me, number: request.number, from, n: found.request.amount, coin, reason: escape(found.request.reason) })
    return org.slack?.announce ? { response_type: 'in_channel', text } : ephemeral(text)
  } catch (error) {
    if (error instanceof ApiError && isSlackError(error.code)) return ephemeral(fill(words.errors[error.code], error.details))
    throw error
  }
}
