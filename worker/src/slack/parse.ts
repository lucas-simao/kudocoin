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
