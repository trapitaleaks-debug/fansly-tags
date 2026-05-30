const BASE = "https://apiv3.fansly.com/api/v1"
const HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }

interface FanslyTag {
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

// Discover tag names from the Fansly FYP (no auth needed)
export async function discoverTagsFromFYP(pages = 4): Promise<string[]> {
  const discovered = new Set<string>()
  let after = ""

  for (let i = 0; i < pages; i++) {
    try {
      const url = `${BASE}/contentdiscovery/media/suggestionsnew?before=&after=${after}&tagIds=&limit=50&offset=${i * 50}&ngsw-bypass=true`
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) break

      const data: FanslySuggestionsResponse = await res.json()
      const suggestions = data.response?.mediaOfferSuggestions ?? []

      for (const s of suggestions) {
        for (const t of s.postTags ?? []) {
          if (t.tag) discovered.add(t.tag.toLowerCase())
        }
      }

      if (suggestions.length < 50) break
    } catch {
      break
    }
  }

  return Array.from(discovered)
}

// Fetch stats for a single tag (no auth needed)
export async function fetchTagStats(tagName: string): Promise<FanslyTag | null> {
  try {
    const url = `${BASE}/contentdiscovery/media/tag?tag=${encodeURIComponent(tagName)}&ngsw-bypass=true`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return null

    const data: FanslyTagResponse = await res.json()
    return data.response?.mediaOfferSuggestionTag ?? null
  } catch {
    return null
  }
}

// Fetch stats for multiple tags in parallel batches
export async function fetchTagStatsBatch(
  tagNames: string[],
  batchSize = 20
): Promise<FanslyTag[]> {
  const results: FanslyTag[] = []

  for (let i = 0; i < tagNames.length; i += batchSize) {
    const chunk = tagNames.slice(i, i + batchSize)
    const fetched = await Promise.all(chunk.map(fetchTagStats))
    for (const tag of fetched) {
      if (tag) results.push(tag)
    }
    // Small delay between batches to be respectful
    if (i + batchSize < tagNames.length) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  return results
}
