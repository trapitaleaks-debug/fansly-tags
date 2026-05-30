export interface HashtagRow {
  rank: number
  tag: string
  viewCount: number
  postCount: number
  saturationScore: number // postCount / viewCount — lower is less saturated
  impactScore: number // viewCount / (saturationScore + 1) — higher is better
}

export type Category = "most-viewed" | "fastest-rising" | "lowest-saturation" | "highest-impact"

export interface TagsResponse {
  mostViewed: HashtagRow[]
  fastestRising: HashtagRow[]
  lowestSaturation: HashtagRow[]
  highestImpact: HashtagRow[]
  fetchedAt: number // unix ms
}
