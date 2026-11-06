// Reading `/kudos` text. Slack escapes it (should_escape in slack/manifest.json): a person arrives as
// `<@U123|ana>`, a channel as `<#C123|general>`, a link as `<https://…|text>`, and & < > as entities.

export interface Kudos {
  slackUserId: string
  amount: number
  /** The reason as Slack sent it, still escaped. */
  reason: string
}

const COMMAND = /^\s*<@([UW][A-Z0-9]{2,20})(?:\|[^>]*)?>\s*(?:(\d{1,6})(?=\s|$))?\s*([\s\S]*)$/

/** `<@U123|ana> 3 reviewed my PR`. The amount is optional and defaults to 1. Null when no person comes first. */
export function parseKudos(text: string): Kudos | null {
  const found = COMMAND.exec(text)
  if (!found) return null
  return { slackUserId: found[1], amount: found[2] === undefined ? 1 : Number(found[2]), reason: found[3].trim() }
}

export type Request =
  | { kind: 'help' }
  | { kind: 'summary'; share: boolean }
  | { kind: 'give'; kudos: Kudos }
  | { kind: 'bounties' }
  | { kind: 'bountyOffer'; amount: number; task: string }
  | { kind: 'bountyPay'; number: number; slackUserId: string }
  | { kind: 'bountyCancel'; number: number }
  | { kind: 'unknown' }

// The words are English in the docs and the help, and also understood in Portuguese and Spanish.
const HELP = ['help', 'ajuda', 'ayuda', '?']
const SUMMARY = ['summary', 'resumo', 'resumen', 'placar', 'marcador', 'leaderboard']
const SHARE = ['share', 'compartilhar', 'compartir']
const BOUNTIES = ['bounties', 'recompensas']
const BOUNTY_PAY = /^\s*(?:bounty|recompensa)\s+(?:pay|pagar)\s+#?(\d{1,6})\s+<@([UW][A-Z0-9]{2,20})(?:\|[^>]*)?>\s*$/i
const BOUNTY_CANCEL = /^\s*(?:bounty|recompensa)\s+(?:cancel|cancelar)\s+#?(\d{1,6})\s*$/i
const BOUNTY_OFFER = /^\s*(?:bounty|recompensa)\s+(\d{1,6})\s+([\s\S]+)$/i

/** What `/kudos` was asked: nothing or help, the summary (only for you, or shared), or a give. */
export function parseRequest(text: string): Request {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0 || (words.length === 1 && HELP.includes(words[0]))) return { kind: 'help' }
  if (SUMMARY.includes(words[0]) && (words.length === 1 || (words.length === 2 && SHARE.includes(words[1])))) {
    return { kind: 'summary', share: words.length === 2 }
  }
  // Bounties (docs/decisions/bounties.md): `bounties`, `bounty pay #7 @bruno`, `bounty cancel #7`, `bounty 3 task`.
  if (words.length === 1 && BOUNTIES.includes(words[0])) return { kind: 'bounties' }
  const pay = BOUNTY_PAY.exec(text)
  if (pay) return { kind: 'bountyPay', number: Number(pay[1]), slackUserId: pay[2] }
  const cancel = BOUNTY_CANCEL.exec(text)
  if (cancel) return { kind: 'bountyCancel', number: Number(cancel[1]) }
  const offer = BOUNTY_OFFER.exec(text)
  if (offer) return { kind: 'bountyOffer', amount: Number(offer[1]), task: offer[2].trim() }
  const kudos = parseKudos(text)
  return kudos ? { kind: 'give', kudos } : { kind: 'unknown' }
}

/** Slack's markup as plain words, for the ledger, where the web app shows it as text. */
export function plainText(slack: string): string {
  return slack
    .replace(/<@[UW][A-Z0-9]+\|([^>]+)>/g, '@$1')
    .replace(/<@([UW][A-Z0-9]+)>/g, '@$1')
    .replace(/<#C[A-Z0-9]+\|([^>]*)>/g, '#$1')
    .replace(/<!subteam\^[A-Z0-9]+\|([^>]+)>/g, '$1')
    .replace(/<!([a-z]+)(?:\|[^>]*)?>/g, '@$1')
    .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<([^>]+)>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

/** Plain words made safe to post: nothing in them becomes a mention or a link. */
export function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
