import type { HashtagRow } from "./types"
import type { SnapshotData } from "./kv"

export function saturationScore(postCount: number, viewCount: number): number {
  if (viewCount === 0) return 999
  return postCount / viewCount
}

export function impactScore(viewCount: number, postCount: number, fypFrequency: number): number {
  return (viewCount * Math.log(fypFrequency + 2)) / (Math.pow(postCount + 1, 0.4))
}

export function toRow(
  tag: string,
  viewCount: number,
  postCount: number,
  fypFrequency: number,
  rank: number,
  snapshot?: SnapshotData | null
): HashtagRow {
  const sat = saturationScore(postCount, viewCount)
  const snap = snapshot?.[tag.toLowerCase()]
  const changePct = snap ? Math.round(((viewCount - snap.v) / snap.v) * 100) : null
  const deltaViews = snap ? viewCount - snap.v : null

  return {
    rank,
    tag,
    viewCount,
    postCount,
    saturationScore: sat,
    impactScore: impactScore(viewCount, postCount, fypFrequency),
    fypFrequency,
    changePct,
    deltaViews,
  }
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatChangePct(pct: number | null): string {
  if (pct === null) return "—"
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct}%`
}
