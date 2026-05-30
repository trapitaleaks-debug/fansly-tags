import { unstable_cache } from "next/cache"
import { fetchAllTagsFromFToolbox, getFYPFrequency } from "./fansly-api"
import { toRow } from "./compute"
import { saveSnapshot, getSnapshot } from "./kv"
import type { TagsResponse, TimeFilter, HashtagRow } from "./types"

const MIN_VIEWS = 5000
const MAX_ROWS = 100

async function _fetchAllTags(timeFilter: TimeFilter): Promise<TagsResponse> {
  const [ftoolboxTags, fypFrequency] = await Promise.all([
    fetchAllTagsFromFToolbox(MIN_VIEWS),
    getFYPFrequency(8),
  ])

  if (ftoolboxTags.length === 0) {
    return {
      mostViewed: [], fastestRising: [], lowestSaturation: [], highestImpact: [],
      fetchedAt: Date.now(), tagCount: 0, timeFilter, hasSnapshotData: false,
    }
  }

  // Save snapshot to KV (non-blocking — runs in background after response)
  // Only save when timeFilter is the default (90d) to avoid duplicate saves
  if (timeFilter === "90d") {
    saveSnapshot(ftoolboxTags).catch(() => { /* non-critical */ })
  }

  // Load snapshot for the selected time period
  const snapshot = timeFilter !== "90d" ? await getSnapshot(timeFilter) : null
  const hasSnapshotData = snapshot !== null && Object.keys(snapshot).length > 0

  const allRows: HashtagRow[] = ftoolboxTags.map((t, i) =>
    toRow(t.tag, t.viewCount, t.postCount, fypFrequency[t.tag.toLowerCase()] ?? 0, i + 1, snapshot)
  )

  // ── MOST VIEWED ──────────────────────────────────────────────────────
  // With snapshot: sort by delta views (absolute growth in period)
  // Without snapshot: sort by total view count
  const mostViewed = [...allRows]
    .sort((a, b) =>
      hasSnapshotData
        ? (b.deltaViews ?? b.viewCount) - (a.deltaViews ?? a.viewCount)
        : b.viewCount - a.viewCount
    )
    .filter((r) => !hasSnapshotData || (r.deltaViews ?? 0) > 0)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── FASTEST RISING ────────────────────────────────────────────────────
  // With snapshot: sort by % change (relative growth rate)
  // Without snapshot: FYP frequency, fallback to views/post ratio
  const hasFYPData = allRows.some((r) => r.fypFrequency > 0)
  const fastestRising = [...allRows]
    .filter((r) => {
      if (hasSnapshotData) return r.changePct !== null && (r.changePct ?? 0) > 0
      return hasFYPData ? r.fypFrequency > 0 : r.postCount >= 5
    })
    .sort((a, b) => {
      if (hasSnapshotData) return (b.changePct ?? 0) - (a.changePct ?? 0)
      if (hasFYPData) return b.fypFrequency - a.fypFrequency || b.viewCount - a.viewCount
      return b.viewCount / b.postCount - a.viewCount / a.postCount
    })
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── LOWEST SATURATION ─────────────────────────────────────────────────
  // Always current saturation score (postCount/viewCount) — time-agnostic
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
    [`fansly-tags-v5-${timeFilter}`],
    { revalidate: 10800 }
  )

const _getters = {
  "24h": makeGetTags("24h"),
  "7d":  makeGetTags("7d"),
  "30d": makeGetTags("30d"),
  "90d": makeGetTags("90d"),
}

export async function getTags(timeFilter: TimeFilter = "90d") {
  return _getters[timeFilter]()
}
