import type { HashtagRow } from "./types"

export function saturationScore(postCount: number, viewCount: number): number {
  if (viewCount === 0) return 999
  return postCount / viewCount
}

// views * log(fypFreq+1) / postCount^0.4
// Rewards: high reach + active in FYP right now + not too many competing posts
export function impactScore(viewCount: number, postCount: number, fypFrequency: number): number {
  return (viewCount * Math.log(fypFrequency + 2)) / (Math.pow(postCount + 1, 0.4))
}

export function toRow(
  tag: string,
  viewCount: number,
  postCount: number,
  fypFrequency: number,
  rank: number
): HashtagRow {
  const sat = saturationScore(postCount, viewCount)
  return {
    rank,
    tag,
    viewCount,
    postCount,
    saturationScore: sat,
    impactScore: impactScore(viewCount, postCount, fypFrequency),
    fypFrequency,
  }
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
