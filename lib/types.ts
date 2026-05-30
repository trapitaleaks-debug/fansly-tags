export interface HashtagRow {
  rank: number
  tag: string
  viewCount: number
  postCount: number
  saturationScore: number  // postCount / viewCount — lower = less crowded
  impactScore: number      // views * log(fypFreq+1) / postCount^0.4
  fypFrequency: number     // how many recent FYP posts used this tag
}

export type Category = "most-viewed" | "fastest-rising" | "lowest-saturation" | "highest-impact"

export interface TagsResponse {
  mostViewed: HashtagRow[]
  fastestRising: HashtagRow[]
  lowestSaturation: HashtagRow[]
  highestImpact: HashtagRow[]
  fetchedAt: number
  tagCount: number
}
