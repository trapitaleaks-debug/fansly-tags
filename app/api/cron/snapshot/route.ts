import { NextRequest, NextResponse } from "next/server"
import { kv } from "@vercel/kv"
import { fetchAllTagsFromFToolbox } from "@/lib/fansly-api"
import { dateKey, hasTodaySnapshot, saveSnapshot } from "@/lib/kv"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // ?check=<daysAgo> is read-only: the nightly proven-running check asks whether that day's snapshot exists
    const check = req.nextUrl.searchParams.get("check")
    if (check !== null) {
      const key = dateKey(Math.max(0, Math.min(100, Number(check) || 0)))
      return NextResponse.json({ key, exists: (await kv.exists(key)) > 0 })
    }
    if (await hasTodaySnapshot()) {
      return NextResponse.json({ ok: true, key: dateKey(0), saved: false, tagCount: 0 })
    }

    const tags = await fetchAllTagsFromFToolbox(5000)
    if (tags.length < 3000) {
      throw new Error(`Insufficient tags from FToolbox: ${tags.length}`)
    }

    const result = await saveSnapshot(tags)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/snapshot] failed:", err)
    return NextResponse.json({ error: "Snapshot failed" }, { status: 500 })
  }
}
