import { unstable_cache } from "next/cache"
import { discoverTagsFromFYP, fetchTagStatsBatch } from "./fansly-api"
import { toRow } from "./compute"
import { SEED_TAGS_UNIQUE } from "./seed-tags"
import type { TagsResponse } from "./types"

const MIN_VIEWS = 5000
const MAX_ROWS = 100

async function _fetchAllTags(): Promise<TagsResponse> {
  // Step 1: Discover active tags from Fansly FYP + track frequency
  const { tagNames: fypTags, frequency } = await discoverTagsFromFYP(8)

  // Step 2: Merge FYP-discovered tags with the seed list (deduplicated)
  const allTagNames = [...new Set([...fypTags, ...SEED_TAGS_UNIQUE])]

  // Step 3: Fetch stats for all tags in parallel batches
  const rawTags = await fetchTagStatsBatch(allTagNames, 25)

  // Step 4: Filter: must have enough views to be meaningful
  const filtered = rawTags.filter((t) => t.viewCount >= MIN_VIEWS)

  if (filtered.length === 0) {
    return { mostViewed: [], fastestRising: [], lowestSaturation: [], highestImpact: [], fetchedAt: Date.now(), tagCount: 0 }
  }

  // Step 5: Build rows with FYP frequency and computed scores
  const allRows = filtered.map((t, i) =>
    toRow(t.tag, t.viewCount, t.postCount, frequency.get(t.tag.toLowerCase()) ?? 0, i + 1)
  )

  // ── MOST VIEWED ──────────────────────────────────────────────────────
  // Pure reach: highest total view count. The evergreen big players.
  const mostViewed = [...allRows]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── FASTEST RISING ───────────────────────────────────────────────────
  // Most frequently used in CURRENT FYP posts = what's trending right now.
  // Tiebreak by viewCount. Only include tags that actually appeared in FYP.
  const fastestRising = [...allRows]
    .filter((r) => r.fypFrequency > 0)
    .sort((a, b) => b.fypFrequency - a.fypFrequency || b.viewCount - a.viewCount)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── LOWEST SATURATION ────────────────────────────────────────────────
  // Easiest to rank: fewest posts per view = less competition for reach.
  // Min 10 posts to exclude brand-new tags with 1–2 posts gaming the metric.
  const lowestSaturation = [...allRows]
    .filter((r) => r.postCount >= 10)
    .sort((a, b) => a.saturationScore - b.saturationScore)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── HIGHEST IMPACT ───────────────────────────────────────────────────
  // Best ROI: high views + currently active in FYP + not over-saturated.
  // Formula: views * log(fypFrequency+2) / postCount^0.4
  // This is genuinely different from the other three:
  //   - Unlike Most Viewed: penalizes high post count, rewards FYP presence
  //   - Unlike Fastest Rising: requires high total views (not just FYP frequency)
  //   - Unlike Lowest Saturation: doesn't only reward tiny niche tags
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
  }
}

export const getTags = unstable_cache(_fetchAllTags, ["fansly-tags-v2"], { revalidate: 10800 })
