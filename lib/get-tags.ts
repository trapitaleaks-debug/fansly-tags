import { unstable_cache } from "next/cache"
import { discoverTagsFromFYP, fetchTagStatsBatch } from "./fansly-api"
import { toRow } from "./compute"
import type { TagsResponse } from "./types"

const MIN_VIEWS = 5000
const MAX_ROWS = 100

async function _fetchAllTags(): Promise<TagsResponse> {
  const tagNames = await discoverTagsFromFYP(4)
  const rawTags = await fetchTagStatsBatch(tagNames, 20)
  const filtered = rawTags.filter((t) => t.viewCount >= MIN_VIEWS)

  if (filtered.length === 0) {
    return { mostViewed: [], fastestRising: [], lowestSaturation: [], highestImpact: [], fetchedAt: Date.now() }
  }

  const allRows = filtered.map((t, i) => toRow(t.tag, t.viewCount, t.postCount, i + 1))

  const mostViewed = [...allRows]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  const fastestRising = [...allRows]
    .filter((r) => r.postCount >= 5)
    .sort((a, b) => b.viewCount / b.postCount - a.viewCount / a.postCount)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  const lowestSaturation = [...allRows]
    .filter((r) => r.postCount >= 10)
    .sort((a, b) => a.saturationScore - b.saturationScore)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  const highestImpact = [...allRows]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  return { mostViewed, fastestRising, lowestSaturation, highestImpact, fetchedAt: Date.now() }
}

// Cached version — refreshes every 3 hours, shared across all pages/routes
export const getTags = unstable_cache(_fetchAllTags, ["fansly-tags"], { revalidate: 10800 })
