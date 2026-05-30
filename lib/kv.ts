import { kv } from "@vercel/kv"

// Snapshot format: { tagName: { v: viewCount, p: postCount } }
// Compressed keys to keep payload small (~130KB per snapshot)
export interface SnapshotData {
  [tag: string]: { v: number; p: number }
}

type SnapshotKey = "24h" | "7d" | "30d" | "90d"

const KEY = {
  snapshot: (period: SnapshotKey) => `snapshot:${period}`,
  saved: (period: SnapshotKey) => `snapshot:${period}:savedAt`,
}

// How old a snapshot must be before we rotate it to the next period
const ROTATE_AFTER_MS: Record<SnapshotKey, number> = {
  "24h": 22 * 60 * 60 * 1000,  // rotate after 22h (save new 24h snapshot)
  "7d":  6 * 24 * 60 * 60 * 1000,
  "30d": 23 * 24 * 60 * 60 * 1000,
  "90d": 60 * 24 * 60 * 60 * 1000,
}

export async function saveSnapshot(tags: Array<{ tag: string; viewCount: number; postCount: number }>) {
  const data: SnapshotData = {}
  for (const t of tags) {
    data[t.tag.toLowerCase()] = { v: t.viewCount, p: t.postCount }
  }

  const now = Date.now()

  try {
    // Check if each period snapshot needs rotating
    // Logic: 90d <- 30d <- 7d <- 24h <- current (cascade when old enough)
    const periods: SnapshotKey[] = ["24h", "7d", "30d", "90d"]

    for (const period of periods) {
      const savedAtRaw = await kv.get<number>(KEY.saved(period))
      const savedAt = savedAtRaw ?? 0
      const age = now - savedAt

      if (!savedAt || age >= ROTATE_AFTER_MS[period]) {
        // Time to rotate: copy this period's snapshot to the next period (if it's not 90d)
        if (period !== "90d") {
          const nextPeriod = periods[periods.indexOf(period) + 1]
          const current = await kv.get<SnapshotData>(KEY.snapshot(period))
          if (current) {
            const nextSavedAt = await kv.get<number>(KEY.saved(nextPeriod))
            // Only overwrite next period if it's also due for rotation
            const nextAge = now - (nextSavedAt ?? 0)
            if (!nextSavedAt || nextAge >= ROTATE_AFTER_MS[nextPeriod]) {
              await kv.set(KEY.snapshot(nextPeriod), current, { ex: 100 * 24 * 3600 })
              await kv.set(KEY.saved(nextPeriod), savedAt)
            }
          }
        }

        // Save current data to this period
        await kv.set(KEY.snapshot(period), data, { ex: 100 * 24 * 3600 })
        await kv.set(KEY.saved(period), now)
        break // Only rotate the earliest period that needs it
      }
    }
  } catch (err) {
    // KV failures are non-critical — log and continue
    console.error("[kv] saveSnapshot failed:", err)
  }
}

export async function getSnapshot(period: SnapshotKey): Promise<SnapshotData | null> {
  try {
    return await kv.get<SnapshotData>(KEY.snapshot(period))
  } catch {
    return null
  }
}

export function computeChangePct(current: number, snapshot: number): number | null {
  if (!snapshot || snapshot === 0) return null
  return Math.round(((current - snapshot) / snapshot) * 100)
}
