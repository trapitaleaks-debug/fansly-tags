export type TimeFilter = "24h" | "7d" | "30d" | "90d"

export interface HashtagRow {
  rank: number
  tag: string
  viewCount: number
  postCount: number
  saturationScore: number
  impactScore: number
  fypFrequency: number
  changePct: number | null  // % change vs snapshot for selected time period (null = no data yet)
  deltaViews: number | null // absolute view count change
}

export type Category = "most-viewed" | "fastest-rising" | "lowest-saturation" | "highest-impact"

export interface TagsResponse {
  mostViewed: HashtagRow[]
  fastestRising: HashtagRow[]
  lowestSaturation: HashtagRow[]
  highestImpact: HashtagRow[]
  fetchedAt: number
  tagCount: number
  timeFilter: TimeFilter
  hasSnapshotData: boolean // false on first run before any snapshots saved
}
