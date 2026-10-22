import { unstable_cache } from "next/cache"
import { fetchAllTagsFromFToolbox } from "./fansly-api"
import { toRow, risingRows, MIN_RISING } from "./compute"
import { getSnapshot, listSnapshots, loadSnapshot } from "./kv"
import type { TagsResponse, TimeFilter, HashtagRow } from "./types"

const MIN_VIEWS = 5000
const MIN_TAGS = 3000
const MAX_ROWS = 1000
const DEFAULT_LIMIT = 100
const RISING_MIN_AGE_MS = 20 * 3600_000 // FToolbox re-checks each tag about once a day
const RISING_MAX_LOADS = 10             // snapshots are ~200KB each

// Fastest Rising compares with the newest snapshot that is about a day old; older ones (then younger
// ones) only while the list is short of MIN_RISING rows.
async function pickRising(tags: Array<{ tag: string; viewCount: number; postCount: number }>, now: number) {
  const snaps = await listSnapshots()
  const aged = snaps.filter((s) => now - s.savedAt >= RISING_MIN_AGE_MS)
  const young = snaps.filter((s) => now - s.savedAt < RISING_MIN_AGE_MS)
  let best: { rows: HashtagRow[]; since: number | null } = { rows: [], since: null }
  for (const s of [...aged, ...young].slice(0, RISING_MAX_LOADS)) {
    const data = await loadSnapshot(s.key)
    if (!data) continue
    const rows = risingRows(tags, data)
    if (rows.length > best.rows.length) best = { rows, since: s.savedAt }
    if (rows.length >= MIN_RISING) break
  }
  return best
}

async function _fetchAllTags(timeFilter: TimeFilter): Promise<TagsResponse> {
  const ftoolboxTags = await fetchAllTagsFromFToolbox(MIN_VIEWS)
  if (ftoolboxTags.length < MIN_TAGS) {
    throw new Error(`Insufficient tags from FToolbox: ${ftoolboxTags.length}`)
  }

  const filterSnapshot = timeFilter === "90d" ? null : await getSnapshot(timeFilter)
  const snapshot = filterSnapshot?.data ?? null
  const hasSnapshotData = snapshot !== null

  const allRows: HashtagRow[] = ftoolboxTags.map((t, i) =>
    toRow(t.tag, t.viewCount, t.postCount, i + 1, snapshot)
  )

  // ── MOST VIEWED ──────────────────────────────────────────────────────
  const mostViewed = [...allRows]
    .sort((a, b) =>
      hasSnapshotData
        ? (b.deltaViews ?? b.viewCount) - (a.deltaViews ?? a.viewCount)
        : b.viewCount - a.viewCount
    )
    .filter((r) => !hasSnapshotData || (r.deltaViews ?? 0) > 0)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── FASTEST RISING ─────────────────────────────────────────────────────
  const now = Date.now()
  const rising = await pickRising(ftoolboxTags, now)

  // ── LOWEST SATURATION ─────────────────────────────────────────────────
  const lowestSaturation = [...allRows]
    .filter((r) => r.postCount >= 10)
    .sort((a, b) => a.saturationScore - b.saturationScore)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── HIGHEST IMPACT ────────────────────────────────────────────────────
  const highestImpact = [...allRows]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  return {
    mostViewed,
    fastestRising: rising.rows,
    lowestSaturation,
    highestImpact,
    fetchedAt: now,
    tagCount: allRows.length,
    timeFilter,
    hasSnapshotData,
    risingSince: rising.since,
  }
}

// One cache entry per time filter — all refresh every 3 hours
const makeGetTags = (timeFilter: TimeFilter) =>
  unstable_cache(
    () => _fetchAllTags(timeFilter),
    [`fansly-tags-v8-${timeFilter}`],
    { revalidate: 10800 }
  )

const _getters = {
  "24h": makeGetTags("24h"),
  "7d":  makeGetTags("7d"),
  "30d": makeGetTags("30d"),
  "90d": makeGetTags("90d"),
}

export async function getTags(
  timeFilter: TimeFilter = "90d",
  limit = DEFAULT_LIMIT
): Promise<TagsResponse> {
  const data = await _getters[timeFilter]()
  const n = Math.max(1, Math.min(MAX_ROWS, limit))
  return {
    ...data,
    mostViewed: data.mostViewed.slice(0, n),
    fastestRising: data.fastestRising.slice(0, n),
    lowestSaturation: data.lowestSaturation.slice(0, n),
    highestImpact: data.highestImpact.slice(0, n),
  }
}
