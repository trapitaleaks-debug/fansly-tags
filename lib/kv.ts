import { kv } from "@vercel/kv"
import type { TimeFilter } from "./types"

// Snapshot format: { tagName: { v: viewCount, p: postCount } }
export interface SnapshotData {
  [tag: string]: { v: number; p: number }
}

const TTL_SECONDS = 100 * 24 * 3600 // 100 days
const LOOKBACK_FALLBACK_DAYS = 3

const DAYS_AGO: Record<TimeFilter, number> = {
  "24h": 1,
  "7d":  7,
  "30d": 30,
  "90d": 90,
}

export function dateKey(daysAgo = 0, now = Date.now()): string {
  const d = new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10)
  return `snapshot:${d}`
}

export async function hasTodaySnapshot(): Promise<boolean> {
  return (await kv.exists(dateKey(0))) > 0
}

export async function saveSnapshot(
  tags: Array<{ tag: string; viewCount: number; postCount: number }>
): Promise<{ key: string; saved: boolean; tagCount: number }> {
  const key = dateKey(0)
  if (await hasTodaySnapshot()) {
    return { key, saved: false, tagCount: 0 }
  }

  const data: SnapshotData = {}
  for (const t of tags) {
    data[t.tag.toLowerCase()] = { v: t.viewCount, p: t.postCount }
  }

  const res = await kv.set(key, data, { ex: TTL_SECONDS, nx: true })
  return { key, saved: res === "OK", tagCount: Object.keys(data).length }
}

export async function getSnapshot(period: TimeFilter): Promise<SnapshotData | null> {
  const baseDays = DAYS_AGO[period]
  const candidateKeys = [
    ...Array.from({ length: LOOKBACK_FALLBACK_DAYS + 1 }, (_, i) => dateKey(baseDays + i)),
    `snapshot:${period}`,
  ]

  try {
    for (const key of candidateKeys) {
      const data = await kv.get<SnapshotData>(key)
      if (data && Object.keys(data).length > 0) return data
    }
    return null
  } catch {
    return null
  }
}
