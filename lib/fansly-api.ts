const FTOOLBOX_BASE = "https://ftoolbox-api.zergo0.dev/api"
const HEADERS = { "User-Agent": "FanslyTags/1.0" }

export interface FanslyTag {
  id: string
  tag: string
  viewCount: number
  postCount: number
  ratio: number
}

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

async function fetchFToolboxPageOnce(page: number): Promise<FToolboxTag[]> {
  const url = `${FTOOLBOX_BASE}/tags?limit=100&page=${page}&sort=viewCount&order=desc`
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`FToolbox page ${page} HTTP ${res.status}`)
  const data: FToolboxResponse = await res.json()
  if (!Array.isArray(data.tags)) throw new Error(`FToolbox page ${page} invalid payload`)
  return data.tags
}

async function fetchFToolboxPage(page: number): Promise<FToolboxTag[]> {
  try {
    return await fetchFToolboxPageOnce(page)
  } catch {
    await new Promise((r) => setTimeout(r, 300))
    return await fetchFToolboxPageOnce(page)
  }
}

export async function fetchAllTagsFromFToolbox(minViews = 5000): Promise<FanslyTag[]> {
  const MAX_PAGES = 80
  const BATCH = 8
  const seen = new Set<string>()
  const allTags: FanslyTag[] = []

  for (let page = 1; page <= MAX_PAGES; page += BATCH) {
    const batch = Array.from(
      { length: Math.min(BATCH, MAX_PAGES - page + 1) },
      (_, i) => page + i
    )
    const results = await Promise.all(batch.map(fetchFToolboxPage))

    let reachedMinViews = false
    for (const tags of results) {
      if (tags.length === 0) {
        reachedMinViews = true
        break
      }
      for (const t of tags) {
        if (t.isDeleted || t.viewCount < minViews) continue
        const key = t.tag.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        allTags.push({
          id: t.id,
          tag: t.tag,
          viewCount: t.viewCount,
          postCount: t.postCount,
          ratio: t.ratio,
        })
      }
      if (tags[tags.length - 1].viewCount < minViews) {
        reachedMinViews = true
        break
      }
    }

    if (reachedMinViews) break
    if (page + BATCH <= MAX_PAGES) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return allTags
}

export async function fetchTagStats(tagName: string): Promise<FanslyTag | null> {
  try {
    const res = await fetch(
      `${FTOOLBOX_BASE}/tags?limit=50&search=${encodeURIComponent(tagName)}`,
      { headers: HEADERS, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data: FToolboxResponse = await res.json()
    // search= is a substring match sorted by views ("cat" → catgirl first), so pick the exact tag
    const tag = data.tags?.find((t) => t.tag.toLowerCase() === tagName.toLowerCase())
    if (!tag || tag.isDeleted) {
      return null
    }
    return {
      id: tag.id,
      tag: tag.tag,
      viewCount: tag.viewCount,
      postCount: tag.postCount,
      ratio: tag.ratio,
    }
  } catch {
    return null
  }
}
