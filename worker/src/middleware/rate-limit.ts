// A per-minute cap per person, kept in the Worker's memory (docs/decisions/allowance-and-limits.md).
// Each Cloudflare location runs its own copy, so this slows a script down rather than counting exactly.
const windows = new Map<string, { minute: number; count: number }>()

export function allow(key: string, perMinute: number, now = Date.now()): boolean {
  const minute = Math.floor(now / 60_000)
  const current = windows.get(key)
  if (!current || current.minute !== minute) {
    if (windows.size > 10_000) windows.clear()
    windows.set(key, { minute, count: 1 })
    return true
  }
  current.count += 1
  return current.count <= perMinute
}
