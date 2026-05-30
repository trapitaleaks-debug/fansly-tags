import { unstable_cache } from "next/cache"
import { fetchAllTagsFromFToolbox, getFYPFrequency } from "./fansly-api"
import { toRow } from "./compute"
import type { TagsResponse, HashtagRow } from "./types"

const MIN_VIEWS = 5000
const MAX_ROWS = 100

async function _fetchAllTags(): Promise<TagsResponse> {
  // Run both in parallel: FToolbox gives us 4,350+ tags with stats,
  // FYP gives us real-time frequency signals (which tags are active RIGHT NOW)
  const [ftoolboxTags, fypFrequency] = await Promise.all([
    fetchAllTagsFromFToolbox(MIN_VIEWS),
    getFYPFrequency(8),
  ])

  if (ftoolboxTags.length === 0) {
    return { mostViewed: [], fastestRising: [], lowestSaturation: [], highestImpact: [], fetchedAt: Date.now(), tagCount: 0 }
  }

  // Build rows with FYP frequency layered on top of FToolbox stats
  const allRows: HashtagRow[] = ftoolboxTags.map((t, i) =>
    toRow(
      t.tag,
      t.viewCount,
      t.postCount,
      fypFrequency[t.tag.toLowerCase()] ?? 0,
      i + 1
    )
  )

  // ── MOST VIEWED ── Raw reach: highest total view count
  const mostViewed = [...allRows]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── FASTEST RISING ── Tags most actively used in CURRENT Fansly FYP posts
  // If FYP is unavailable, fall back to highest views-per-post ratio (velocity proxy)
  const hasFYPData = allRows.some((r) => r.fypFrequency > 0)
  const fastestRising = hasFYPData
    ? [...allRows]
        .filter((r) => r.fypFrequency > 0)
        .sort((a, b) => b.fypFrequency - a.fypFrequency || b.viewCount - a.viewCount)
        .slice(0, MAX_ROWS)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : [...allRows]
        .filter((r) => r.postCount >= 5)
        .sort((a, b) => b.viewCount / b.postCount - a.viewCount / a.postCount)
        .slice(0, MAX_ROWS)
        .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── LOWEST SATURATION ── Easiest to rank: fewest posts per view
  const lowestSaturation = [...allRows]
    .filter((r) => r.postCount >= 10)
    .sort((a, b) => a.saturationScore - b.saturationScore)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── HIGHEST IMPACT ── Best ROI: high reach + FYP active + not oversaturated
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

// Cache key v4 — FToolbox-powered
export const getTags = unstable_cache(_fetchAllTags, ["fansly-tags-v4"], { revalidate: 10800 })
