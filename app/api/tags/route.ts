import { NextRequest, NextResponse } from "next/server"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const rawLimit = Number(req.nextUrl.searchParams.get("limit"))
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(1000, Math.floor(rawLimit))
      : 100

  try {
    const data = await getTags("90d", limit)
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=3600" },
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch hashtag data" }, { status: 500 })
  }
}
