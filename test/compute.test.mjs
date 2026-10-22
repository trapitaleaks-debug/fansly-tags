import { test } from "node:test"
import assert from "node:assert/strict"
import { toRow, formatChangePct, impactScore } from "../lib/compute.ts"

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
