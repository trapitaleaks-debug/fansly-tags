import { unstable_cache } from "next/cache"
import { fetchAllTagsFromFToolbox } from "./fansly-api"
import { toRow, risingRows, MIN_RISING } from "./compute"
import { getSnapshot } from "./kv"
import type { TagsResponse, TimeFilter, HashtagRow } from "./types"

const MIN_VIEWS = 5000
const MIN_TAGS = 3000
const MAX_ROWS = 1000
const DEFAULT_LIMIT = 100

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
  // Compared with the 24h snapshot. FToolbox re-checks each tag about once a day, so a fresh snapshot
  // shows few risers: then use the next older snapshot until there are MIN_RISING rows, and say so.
  let fastestRising: HashtagRow[] = []
  let risingWindow: TimeFilter | null = null
  let risingSince: number | null = null
  for (const period of ["24h", "7d", "30d", "90d"] as const) {
    const snap = period === timeFilter ? filterSnapshot : await getSnapshot(period)
    if (!snap) continue
    const rows = risingRows(ftoolboxTags, snap.data)
    if (rows.length > fastestRising.length) {
      fastestRising = rows
      risingWindow = period
      risingSince = snap.savedAt
    }
    if (rows.length >= MIN_RISING) break
  }

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
    fastestRising,
    lowestSaturation,
    highestImpact,
    fetchedAt: Date.now(),
    tagCount: allRows.length,
    timeFilter,
    hasSnapshotData,
    risingWindow,
    risingSince,
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
