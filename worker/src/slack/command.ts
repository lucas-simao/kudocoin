// `/kudos @person [amount] reason` (docs/decisions/slack.md). Slack wants an answer within three seconds, so
// the Worker answers at once with nothing and posts the real answer to the command's response_url when the
// give is done. The give is the same move() as the web app's, under the same rules.
import type { Env } from '../env'
import { ApiError } from '../errors'
import { Firestore } from '../firestore/client'
import { allow } from '../middleware/rate-limit'
import { as, type OrgDoc, paths, type SlackTeamDoc, type SlackUserDoc, type UserDoc } from '../repositories/documents'
import { move } from '../services/give'
import { randomId, sha256 } from '../services/ids'
import { fromSlack, signToken } from './crypto'
import { fill, isSlackError, SLACK_MESSAGES, slackLang } from './messages'
import { escape, parseKudos, plainText } from './parse'
import { slackOn, webOrigin } from './service'

export interface Command {
  teamId: string
  userId: string
  userName: string
  text: string
  responseUrl: string
  triggerId: string
}

export interface Reply {
  response_type: 'ephemeral' | 'in_channel'
  text: string
  blocks?: unknown[]
}

const ephemeral = (text: string): Reply => ({ response_type: 'ephemeral', text })

export async function slashCommand(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!slackOn(env)) return new Response('Slack is off', { status: 404 })
  const body = await request.text()
  if (body.length > 10_000 || !(await fromSlack(env.SLACK_SIGNING_SECRET!, request.headers, body))) {
    return new Response('invalid signature', { status: 401 })
  }
  const form = new URLSearchParams(body)
  if (form.get('ssl_check')) return new Response('')
  const command: Command = {
    teamId: form.get('team_id') ?? '',
    userId: form.get('user_id') ?? '',
    userName: (form.get('user_name') ?? '').slice(0, 80),
    text: (form.get('text') ?? '').slice(0, 2000),
    responseUrl: form.get('response_url') ?? '',
    triggerId: form.get('trigger_id') ?? '',
  }
  if (!/^T[A-Z0-9]+$/.test(command.teamId) || !/^[UW][A-Z0-9]+$/.test(command.userId)) return new Response('bad request', { status: 400 })
  if (!command.responseUrl.startsWith(env.SLACK_HOOKS_URL ?? 'https://hooks.slack.com/')) return new Response('bad request', { status: 400 })
  if (!allow(`slack:${command.teamId}:${command.userId}`, 30)) return Response.json(ephemeral(SLACK_MESSAGES.en.errors.too_many_requests))

  ctx.waitUntil(
    answer(env, new Firestore(env), command)
      .catch((error: unknown) => {
        console.error('slack command', error instanceof Error ? error.message : 'unknown')
        return ephemeral(SLACK_MESSAGES.en.failed)
      })
      .then((reply) => post(command.responseUrl, reply)),
  )
  return new Response('', { status: 200 })
}

async function post(responseUrl: string, reply: Reply): Promise<void> {
  try {
    await fetch(responseUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reply) })
  } catch (error) {
    console.error('slack reply', error instanceof Error ? error.message : 'unknown')
  }
}

export async function answer(env: Env, store: Firestore, command: Command): Promise<Reply> {
  const team = as<SlackTeamDoc>(await store.get(paths.slackTeam(command.teamId)))
  if (!team) return ephemeral(SLACK_MESSAGES.en.notConnected)
  const giverLink = as<SlackUserDoc>(await store.get(paths.slackUser(`${command.teamId}_${command.userId}`)))

  // Someone Slack has not seen: a link only they can see, to connect their account once.
  if (!giverLink) {
    const words = SLACK_MESSAGES[slackLang(team.lang)]
    const token = await signToken(env.SLACK_KEY!, 'link', { t: command.teamId, u: command.userId, n: command.userName }, 900)
    const url = `${webOrigin(env)}/slack/link?t=${token}`
    return {
      response_type: 'ephemeral',
      text: `${words.connect} ${url}`,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: words.connect },
          accessory: { type: 'button', text: { type: 'plain_text', text: words.connectButton }, url, style: 'primary', action_id: 'connect' },
        },
      ],
    }
  }

  const kudos = parseKudos(command.text)
  const [userDoc, orgDoc, receiverDoc] = await store.getAll([
    paths.user(giverLink.uid),
    paths.org(team.orgId),
    ...(kudos ? [paths.slackUser(`${command.teamId}_${kudos.slackUserId}`)] : []),
  ])
  const words = SLACK_MESSAGES[slackLang(as<UserDoc>(userDoc)?.lang ?? team.lang)]
  const org = as<OrgDoc>(orgDoc)
  if (!org || org.slack?.teamId !== command.teamId) return ephemeral(words.notConnected)
  if (!kudos) return ephemeral(words.usage)
  if (kudos.slackUserId === command.userId) return ephemeral(words.errors.self_give)
  const giver = `<@${command.userId}>`
  const receiver = `<@${kudos.slackUserId}>`
  const receiverLink = as<SlackUserDoc>(receiverDoc)
  if (!receiverLink) return ephemeral(fill(words.receiverNotLinked, { receiver }))

  // Slack can send the same command twice; its trigger_id makes the entry's key, so the second is a no-op.
  const key = command.triggerId ? `slack-${(await sha256(`${command.teamId}:${command.triggerId}`)).slice(0, 40)}` : `slack-${randomId(32)}`
  const reason = plainText(kudos.reason)
  let result
  try {
    result = await move(store, team.orgId, { uid: giverLink.uid, name: '', picture: null, provider: null }, {
      kind: 'give',
      to: receiverLink.uid,
      amount: kudos.amount,
      reason,
      key,
    })
  } catch (error) {
    if (error instanceof ApiError && isSlackError(error.code)) return ephemeral(fill(words.errors[error.code], error.details))
    throw error
  }

  const vars = { giver, receiver, n: kudos.amount, coin: escape(org.settings.coinName), reason: escape(reason), balance: result.balance, left: result.allowanceLeft ?? 0 }
  if (!org.slack.announce) return ephemeral(fill(words.youGave, vars))
  return {
    response_type: 'in_channel',
    text: `🪙 ${fill(reason ? words.gaveReason : words.gave, vars)}\n${fill(words.balance, vars)}`,
  }
}
