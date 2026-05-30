import { NextRequest, NextResponse } from "next/server"
import { fetchTagStats } from "@/lib/fansly-api"
import { toRow } from "@/lib/compute"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag")?.toLowerCase().replace(/^#/, "")
  if (!tag || tag.length < 2) {
    return NextResponse.json({ error: "tag param required" }, { status: 400 })
  }

  const stats = await fetchTagStats(tag)
  if (!stats) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const row = toRow(stats.tag, stats.viewCount, stats.postCount, 0, 0)
  return NextResponse.json(row)
}
