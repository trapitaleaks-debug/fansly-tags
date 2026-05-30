const FANSLY_BASE = "https://apiv3.fansly.com/api/v1"
const FTOOLBOX_BASE = "https://ftoolbox-api.zergo0.dev/api"
const HEADERS = { "User-Agent": "FanslyTags/1.0" }

export interface FanslyTag {
  id: string
  tag: string
  viewCount: number
  postCount: number
  ratio: number  // viewCount / postCount — pre-computed by FToolbox
  flags?: number
  createdAt?: number
}

// ── FToolbox data source ──────────────────────────────────────────────
// ftoolbox-api.zergo0.dev maintains 8,785 tags updated continuously from Fansly's API.
// We fetch tags with 5k+ views (pages 1-45, ~4,350 tags) using their public API.
// Results are cached 3h so this 14-second fetch only runs once per cache window.

interface FToolboxTag {
  id: string
  tag: string
  viewCount: number
  postCount: number
  ratio: number
  rank: number
  isDeleted: boolean
}

interface FToolboxResponse {
  pagination: { totalPages: number; totalCount: number }
  tags: FToolboxTag[]
}

async function fetchFToolboxPage(page: number): Promise<FToolboxTag[]> {
  try {
    const url = `${FTOOLBOX_BASE}/tags?limit=100&page=${page}&sort=viewCount&order=desc`
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    const data: FToolboxResponse = await res.json()
    return data.tags ?? []
  } catch {
    return []
  }
}

export async function fetchAllTagsFromFToolbox(minViews = 5000): Promise<FanslyTag[]> {
  // FToolbox sorts by viewCount DESC. Tags with 5k+ views end around page 45.
  // Fetch all pages in batches, filter at the end — simpler and more reliable.
  const PAGES = 45
  const BATCH = 8
  const seen = new Set<string>()
  const allTags: FanslyTag[] = []

  for (let page = 1; page <= PAGES; page += BATCH) {
    const batch = Array.from(
      { length: Math.min(BATCH, PAGES - page + 1) },
      (_, i) => page + i
    )
    const results = await Promise.all(batch.map(fetchFToolboxPage))

    for (const tags of results) {
      for (const t of tags) {
        if (t.isDeleted || t.viewCount < minViews) continue
        if (seen.has(t.tag.toLowerCase())) continue
        seen.add(t.tag.toLowerCase())
        allTags.push({ id: t.id, tag: t.tag, viewCount: t.viewCount, postCount: t.postCount, ratio: t.ratio })
      }
    }

    if (page + BATCH <= PAGES) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return allTags
}

// ── Fansly FYP — for freshness/frequency signals ─────────────────────
// The FYP shows which tags are being actively used in NEW posts right now.
// We use this to power the "Fastest Rising" category.

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
  response: { mediaOfferSuggestions: FanslyMediaSuggestion[] }
}

export interface FYPFrequencyMap {
  [tagName: string]: number
}

export async function getFYPFrequency(pages = 8): Promise<FYPFrequencyMap> {
  const freq: FYPFrequencyMap = {}

  const fetches = Array.from({ length: pages }, (_, i) =>
    fetch(
      `${FANSLY_BASE}/contentdiscovery/media/suggestionsnew?before=&after=&tagIds=&limit=50&offset=${i * 50}&ngsw-bypass=true`,
      { headers: HEADERS, signal: AbortSignal.timeout(10000) }
    ).then((r) => r.ok ? r.json() as Promise<FanslySuggestionsResponse> : null).catch(() => null)
  )

  const results = await Promise.all(fetches)
  for (const data of results) {
    if (!data) continue
    for (const s of data.response?.mediaOfferSuggestions ?? []) {
      for (const t of s.postTags ?? []) {
        if (t.tag) freq[t.tag.toLowerCase()] = (freq[t.tag.toLowerCase()] ?? 0) + 1
      }
    }
  }

  return freq
}

// Fallback: look up a single specific tag (used by /api/tag-lookup)
export async function fetchTagStats(tagName: string): Promise<FanslyTag | null> {
  // Try FToolbox first (has more complete data)
  try {
    const res = await fetch(
      `${FTOOLBOX_BASE}/tags?limit=1&tag=${encodeURIComponent(tagName)}`,
      { headers: HEADERS, signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data: FToolboxResponse = await res.json()
      const tag = data.tags?.[0]
      if (tag && tag.tag.toLowerCase() === tagName.toLowerCase()) {
        return { id: tag.id, tag: tag.tag, viewCount: tag.viewCount, postCount: tag.postCount, ratio: tag.ratio }
      }
    }
  } catch { /* fall through */ }

  // Fallback to Fansly API directly
  try {
    const res = await fetch(
      `${FANSLY_BASE}/contentdiscovery/media/tag?tag=${encodeURIComponent(tagName)}&ngsw-bypass=true`,
      { headers: HEADERS, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const t = data.response?.mediaOfferSuggestionTag
    if (!t) return null
    return { id: t.id, tag: t.tag, viewCount: t.viewCount, postCount: t.postCount, ratio: t.viewCount / (t.postCount || 1) }
  } catch {
    return null
  }
}
