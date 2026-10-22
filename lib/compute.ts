import type { HashtagRow } from "./types"
import type { SnapshotData } from "./kv"

export function saturationScore(postCount: number, viewCount: number): number {
  if (viewCount === 0) return 999
  return postCount / viewCount
}

export function impactScore(viewCount: number, postCount: number): number {
  return viewCount / Math.pow(postCount + 1, 0.4)
}

export function toRow(
  tag: string,
  viewCount: number,
  postCount: number,
  rank: number,
  snapshot?: SnapshotData | null
): HashtagRow {
  const sat = saturationScore(postCount, viewCount)
  const snap = snapshot?.[tag.toLowerCase()]
  const changePct =
    snap && snap.v > 0
      ? Math.round(((viewCount - snap.v) / snap.v) * 1000) / 10
      : null
  const deltaViews = snap ? viewCount - snap.v : null

  return {
    rank,
    tag,
    viewCount,
    postCount,
    saturationScore: sat,
    impactScore: impactScore(viewCount, postCount),
    changePct,
    deltaViews,
  }
}

// Fastest Rising: at least MIN_RISING rows (Vito, 22 Oct). Rank by % view growth; the views-gained
// floor starts strict and relaxes only until the list reaches MIN_RISING rows.
export const MIN_RISING = 50
const RISING_FLOORS = [500, 200, 100, 50, 1]
const MAX_RISING = 1000

export function risingRows(
  tags: Array<{ tag: string; viewCount: number; postCount: number }>,
  snapshot: SnapshotData
): HashtagRow[] {
  const risers = tags.flatMap((t) => {
    const snap = snapshot[t.tag.toLowerCase()]
    if (!snap || snap.v <= 0 || t.viewCount <= snap.v) return []
    const delta = t.viewCount - snap.v
    return [{ t, delta, pct: delta / snap.v }]
  })
  const floor = RISING_FLOORS.find((f) => risers.filter((x) => x.delta >= f).length >= MIN_RISING) ?? 1
  return risers
    .filter((x) => x.delta >= floor)
    .sort((a, b) => b.pct - a.pct || b.delta - a.delta)
    .slice(0, MAX_RISING)
    .map((x, i) => toRow(x.t.tag, x.t.viewCount, x.t.postCount, i + 1, snapshot))
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatChangePct(pct: number | null): string {
  if (pct === null) return "—"
  const rounded = Math.round(pct * 10) / 10
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${rounded.toFixed(1)}%`
}
