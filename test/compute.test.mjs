import { test } from "node:test"
import assert from "node:assert/strict"
import { toRow, formatChangePct, impactScore, risingRows } from "../lib/compute.ts"

test("change % keeps one decimal instead of rounding 0.4% to 0", () => {
  const row = toRow("x", 100_400, 10, 1, { x: { v: 100_000, p: 10 } })
  assert.equal(row.changePct, 0.4)
  assert.equal(row.deltaViews, 400)
  assert.equal(formatChangePct(row.changePct), "+0.4%")
})

test("no snapshot gives no change", () => {
  const row = toRow("x", 100, 10, 1, null)
  assert.equal(row.changePct, null)
  assert.equal(formatChangePct(null), "—")
})

test("impact no longer depends on FYP", () => {
  assert.equal(impactScore(1000, 0), 1000)
})

const tags = (n, prefix, views, gain) =>
  Array.from({ length: n }, (_, i) => ({ tag: `${prefix}${i}`, viewCount: views + gain + i, postCount: 10 }))
const snapOf = (list, gainOf) =>
  Object.fromEntries(list.map((t) => [t.tag, { v: t.viewCount - gainOf(t), p: 10 }]))

test("rising keeps the strict 500-view floor when it already gives 50 rows", () => {
  const big = tags(60, "big", 100_000, 600), small = tags(10, "small", 5_000, 50)
  const all = [...big, ...small]
  const rows = risingRows(all, snapOf(all, (t) => (t.tag.startsWith("big") ? 600 : 50)))
  assert.equal(rows.length, 60)
  assert.ok(rows.every((r) => r.tag.startsWith("big")))
})

test("rising relaxes the floor until it has 50 rows, ranked by % growth", () => {
  const all = tags(70, "t", 5_000, 0)
  const rows = risingRows(all, snapOf(all, () => 20))
  assert.equal(rows.length, 70)
  assert.equal(rows[0].rank, 1)
  assert.ok(rows[0].changePct >= rows[69].changePct)
})

test("rising never lists tags that did not grow", () => {
  const all = tags(5, "t", 5_000, 0)
  assert.equal(risingRows(all, snapOf(all, () => 0)).length, 0)
})
