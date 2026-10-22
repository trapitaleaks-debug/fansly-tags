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

const DATED = /^snapshot:(\d{4}-\d{2}-\d{2})$/
const savedAtOf = async (key: string) => {
  const day = key.match(DATED)?.[1]
  return day ? Date.parse(`${day}T04:00:00Z`) : await kv.get<number>(`${key}:savedAt`)
}

// Every saved snapshot, newest first: dated keys from the daily cron and the legacy rotation keys.
export async function listSnapshots(): Promise<Array<{ key: string; savedAt: number }>> {
  try {
    const keys = (await kv.keys("snapshot:*")).filter((k) => !k.endsWith(":savedAt"))
    const found = await Promise.all(keys.map(async (key) => ({ key, savedAt: await savedAtOf(key) })))
    return found
      .filter((s): s is { key: string; savedAt: number } => typeof s.savedAt === "number")
      .sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

export async function loadSnapshot(key: string): Promise<SnapshotData | null> {
  try {
    const data = await kv.get<SnapshotData>(key)
    return data && Object.keys(data).length > 0 ? data : null
  } catch {
    return null
  }
}

export interface Snapshot {
  data: SnapshotData
  savedAt: number | null // ms; dated keys count from the 04:00Z cron
}

export async function getSnapshot(period: TimeFilter): Promise<Snapshot | null> {
  const baseDays = DAYS_AGO[period]
  const candidateKeys = [
    ...Array.from({ length: LOOKBACK_FALLBACK_DAYS + 1 }, (_, i) => dateKey(baseDays + i)),
    `snapshot:${period}`,
  ]

  try {
    for (const key of candidateKeys) {
      const data = await kv.get<SnapshotData>(key)
      if (!data || Object.keys(data).length === 0) continue
      return { data, savedAt: (await savedAtOf(key)) ?? null }
    }
    return null
  } catch {
    return null
  }
}
