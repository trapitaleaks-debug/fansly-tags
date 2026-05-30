import type { HashtagRow } from "./types"

export function saturationScore(postCount: number, viewCount: number): number {
  if (viewCount === 0) return 999
  return postCount / viewCount
}

// views / sqrt(postCount) — balances raw reach with competition level
// Higher than pure views/posts (which is Fastest Rising) but penalizes saturation more than Most Viewed
export function impactScore(viewCount: number, _saturation: number, postCount: number): number {
  return viewCount / (Math.sqrt(postCount) + 1)
}

export function toRow(
  tag: string,
  viewCount: number,
  postCount: number,
  rank: number
): HashtagRow {
  const sat = saturationScore(postCount, viewCount)
  return {
    rank,
    tag,
    viewCount,
    postCount,
    saturationScore: sat,
    impactScore: impactScore(viewCount, sat, postCount),
  }
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
