import { unstable_cache } from "next/cache"
import { fetchAllTagsFromFToolbox } from "./fansly-api"
import { toRow } from "./compute"
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

  const snapshot24h = await getSnapshot("24h")
  const snapshot =
    timeFilter === "90d"
      ? null
      : timeFilter === "24h"
        ? snapshot24h
        : await getSnapshot(timeFilter)

  const hasSnapshotData = snapshot !== null && Object.keys(snapshot).length > 0
  const has24hSnapshot = snapshot24h !== null && Object.keys(snapshot24h).length > 0

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

  // ── FASTEST RISING (always vs 24h snapshot) ──────────────────────────
  const fastestRising: HashtagRow[] = has24hSnapshot
    ? ftoolboxTags
        .map((t) => {
          const snap = snapshot24h[t.tag.toLowerCase()]
          const deltaViews = snap && snap.v > 0 ? t.viewCount - snap.v : 0
          const rawPct = snap && snap.v > 0 ? deltaViews / snap.v : 0
          return { t, deltaViews, rawPct }
        })
        .filter((x) => x.deltaViews >= 500 && x.rawPct > 0)
        .sort((a, b) => b.rawPct - a.rawPct || b.deltaViews - a.deltaViews)
        .slice(0, MAX_ROWS)
        .map((x, i) => toRow(x.t.tag, x.t.viewCount, x.t.postCount, i + 1, snapshot24h))
    : []

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
  }
}

// One cache entry per time filter — all refresh every 3 hours
const makeGetTags = (timeFilter: TimeFilter) =>
  unstable_cache(
    () => _fetchAllTags(timeFilter),
    [`fansly-tags-v7-${timeFilter}`],
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
