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
  Array.from({ length: n }, (_, i) => ({ tag: `${prefix}${i}`, viewCount: views + gain, postCount: 10 }))
const snapOf = (list, gainOf) =>
  Object.fromEntries(list.map((t) => [t.tag, { v: t.viewCount - gainOf(t), p: 10 }]))

test("rising: tags that gained 500+ views lead, even with a lower %", () => {
  const big = tags(3, "big", 500_000, 4_000)   // +0.8%
  const small = tags(3, "small", 5_000, 50)    // +1.0%
  const all = [...small, ...big]
  const rows = risingRows(all, snapOf(all, (t) => (t.tag.startsWith("big") ? 4_000 : 50)))
  assert.deepEqual(rows.map((r) => r.tag.replace(/\d/, "")), ["big", "big", "big", "small", "small", "small"])
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3, 4, 5, 6])
})

test("rising: all 70 small risers are kept so the page can reach 50 rows", () => {
  const all = tags(70, "t", 5_000, 20)
  assert.equal(risingRows(all, snapOf(all, () => 20)).length, 70)
})

test("rising: no tags that shrank, stayed flat or would show as 0.0%", () => {
  const flat = tags(2, "flat", 5_000, 0), down = tags(2, "down", 5_000, 0), tiny = tags(2, "tiny", 1_000_000, 100)
  const all = [...flat, ...down, ...tiny]
  const gain = (t) => (t.tag.startsWith("down") ? -10 : t.tag.startsWith("tiny") ? 100 : 0) // tiny: +0.01%
  assert.equal(risingRows(all, snapOf(all, gain)).length, 0)
})
