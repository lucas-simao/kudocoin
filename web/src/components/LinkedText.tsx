// Free text people write (a bounty's task, a reason) with its web links made clickable and short. Long words
// and links break anywhere, so nothing spills out of its card.
const URL = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g

/** A link's short name: `repo#582` for a GitHub pull request or issue, otherwise the host and path, trimmed. */
export function shortLink(href: string): string {
  try {
    const url = new globalThis.URL(href)
    const github = /^\/([^/]+)\/([^/]+)\/(?:pull|issues)\/(\d+)/.exec(url.pathname)
    if (url.hostname === 'github.com' && github) return `${github[2]}#${github[3]}`
    const text = `${url.hostname.replace(/^www\./, '')}${url.pathname === '/' ? '' : url.pathname}`
    return text.length > 40 ? `${text.slice(0, 39)}…` : text
  } catch {
    return href
  }
}

/** Splits text into plain parts and links. */
export function linkParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = []
  let last = 0
  for (const found of text.matchAll(URL)) {
    const start = found.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start) })
    parts.push({ text: shortLink(found[0]), href: found[0] })
    last = start + found[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export function LinkedText({ text }: { text: string }) {
  return (
    <span className="[overflow-wrap:anywhere]">
      {linkParts(text).map((part, index) =>
        part.href ? (
          <a key={index} href={part.href} title={part.href} target="_blank" rel="noopener noreferrer" className="text-coin-text underline underline-offset-4 hover:no-underline">
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  )
}
