// How a Kudocoin member is named in a Slack message: a mention when they linked in this workspace, so Slack
// shows their name and notifies them; otherwise their Kudocoin name, as plain text.
import type { Firestore } from '../firestore/client'
import type { SlackUserDoc } from '../repositories/documents'
import { escape } from './parse'

export async function mention(store: Firestore, teamId: string, uid: string, name: string): Promise<string> {
  const links = await store.where('', 'slackUsers', 'uid', uid, 20)
  const link = links.map((row) => row.doc as unknown as SlackUserDoc).find((row) => row.teamId === teamId)
  return link ? `<@${link.slackUserId}>` : escape(name)
}

/** Days from one calendar date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}
