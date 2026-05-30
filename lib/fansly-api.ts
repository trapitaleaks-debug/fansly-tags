const BASE = "https://apiv3.fansly.com/api/v1"
const HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }

export interface FanslyTag {
  id: string
  tag: string
  viewCount: number
  postCount: number
  flags: number
  createdAt: number
}

interface FanslyTagResponse {
  success: boolean
  response: {
    mediaOfferSuggestionTag: FanslyTag | null
  }
}

interface FanslyPostTag {
  id: string
  tag: string
  viewCount: number
  postCount: number
}

interface FanslyMediaSuggestion {
  postTags: FanslyPostTag[]
}

interface FanslySuggestionsResponse {
  success: boolean
  response: {
    mediaOfferSuggestions: FanslyMediaSuggestion[]
  }
}

export interface DiscoveryResult {
  tagNames: string[]           // all unique tag names found
  frequency: Map<string, number> // how many FYP posts used each tag
}

// Discover tags from Fansly FYP and track how frequently each appears
// Frequency = how many active recent posts use this tag = proxy for "trending right now"
export async function discoverTagsFromFYP(pages = 8): Promise<DiscoveryResult> {
  const frequency = new Map<string, number>()

  for (let i = 0; i < pages; i++) {
    try {
      const url = `${BASE}/contentdiscovery/media/suggestionsnew?before=&after=&tagIds=&limit=50&offset=${i * 50}&ngsw-bypass=true`
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
      if (!res.ok) break

      const data: FanslySuggestionsResponse = await res.json()
      const suggestions = data.response?.mediaOfferSuggestions ?? []

      for (const s of suggestions) {
        for (const t of s.postTags ?? []) {
          const tag = t.tag?.toLowerCase()
          if (tag) frequency.set(tag, (frequency.get(tag) ?? 0) + 1)
        }
      }

      if (suggestions.length < 50) break
    } catch {
      break
    }
  }

  return {
    tagNames: Array.from(frequency.keys()),
    frequency,
  }
}

// Fetch stats for a single tag
export async function fetchTagStats(tagName: string): Promise<FanslyTag | null> {
  try {
    const url = `${BASE}/contentdiscovery/media/tag?tag=${encodeURIComponent(tagName)}&ngsw-bypass=true`
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data: FanslyTagResponse = await res.json()
    return data.response?.mediaOfferSuggestionTag ?? null
  } catch {
    return null
  }
}

// Fetch stats for many tags in parallel batches
export async function fetchTagStatsBatch(
  tagNames: string[],
  batchSize = 25
): Promise<FanslyTag[]> {
  const results: FanslyTag[] = []

  for (let i = 0; i < tagNames.length; i += batchSize) {
    const chunk = tagNames.slice(i, i + batchSize)
    const fetched = await Promise.all(chunk.map(fetchTagStats))
    for (const tag of fetched) {
      if (tag) results.push(tag)
    }
    if (i + batchSize < tagNames.length) {
      await new Promise((r) => setTimeout(r, 80))
    }
  }

  return results
}
