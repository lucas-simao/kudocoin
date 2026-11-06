// Bounties from Slack (docs/decisions/bounties.md): offer, list, pay and cancel, with the same services as
// the web app.
import { ApiError } from '../errors'
import type { Firestore } from '../firestore/client'
import { as, type OrgDoc, paths, type SlackUserDoc } from '../repositories/documents'
import { bountyByNumber, cancelBounty, offerBounty, openBounties, payBounty } from '../services/bounties'
import { sha256 } from '../services/ids'
import { dateIn } from '../services/rules'
import type { Command, Reply } from './command'
import { fill, isSlackError, type SlackMessages } from './messages'
import type { Request } from './parse'
import { escape, plainText } from './parse'

type BountyRequest = Extract<Request, { kind: 'bounties' | 'bountyOffer' | 'bountyPay' | 'bountyCancel' }>

const ephemeral = (text: string): Reply => ({ response_type: 'ephemeral', text })

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export async function bountyCommand(
  store: Firestore,
  orgId: string,
  org: OrgDoc,
  uid: string,
  command: Command,
  request: BountyRequest,
  words: SlackMessages,
): Promise<Reply> {
  const caller = { uid, name: '', picture: null, provider: null }
  const coin = escape(org.settings.coinName)
  const me = `<@${command.userId}>`
  try {
    if (request.kind === 'bounties') {
      const open = await openBounties(store, orgId)
      if (open.length === 0) return ephemeral(words.bountiesNone)
      const today = dateIn(org.settings.timezone, new Date())
      const rows = open.map(({ bounty }) => {
        const days = daysBetween(today, bounty.expiresOn)
        const when = days < 0 ? words.bountyExpired : days === 0 ? words.bountyLastDay : fill(words.bountyDaysLeft, { days })
        return fill(words.bountyRow, {
          number: bounty.number,
          n: bounty.amount,
          coin,
          task: escape(bounty.task),
          by: escape(bounty.byName || words.formerMember),
          when,
        })
      })
      return ephemeral([words.bountiesTitle, ...rows].join('\n'))
    }

    if (request.kind === 'bountyOffer') {
      const task = plainText(request.task)
      const key = `slack-${(await sha256(`${command.teamId}:${command.triggerId || crypto.randomUUID()}`)).slice(0, 40)}`
      const offered = await offerBounty(store, orgId, caller, { amount: request.amount, task, key })
      const vars = { by: me, n: request.amount, coin, task: escape(task), number: offered.number, left: offered.allowanceLeft }
      return org.slack?.announce
        ? { response_type: 'in_channel', text: fill(words.bountyOffered, vars) }
        : ephemeral(fill(words.bountyOfferedQuiet, vars))
    }

    const found = await bountyByNumber(store, orgId, request.number)
    if (!found) return ephemeral(fill(words.bountyNotFound, { number: request.number }))

    if (request.kind === 'bountyCancel') {
      const { refunded } = await cancelBounty(store, orgId, caller, found.id)
      return ephemeral(fill(refunded ? words.bountyCancelledRefunded : words.bountyCancelled, { number: request.number, n: found.bounty.amount }))
    }

    // Paying: the one who did the task has to be linked, as for a give.
    const receiver = `<@${request.slackUserId}>`
    const link = as<SlackUserDoc>(await store.get(paths.slackUser(`${command.teamId}_${request.slackUserId}`)))
    if (!link) return ephemeral(fill(words.receiverNotLinked, { receiver }))
    await payBounty(store, orgId, caller, found.id, link.uid)
    const text = fill(words.bountyPaid, { payer: me, number: request.number, n: found.bounty.amount, coin, receiver, task: escape(found.bounty.task) })
    return org.slack?.announce ? { response_type: 'in_channel', text } : ephemeral(text)
  } catch (error) {
    if (error instanceof ApiError && isSlackError(error.code)) return ephemeral(fill(words.errors[error.code], error.details))
    throw error
  }
}
