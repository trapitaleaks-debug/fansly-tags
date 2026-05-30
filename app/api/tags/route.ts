import { NextResponse } from "next/server"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await getTags()
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=3600" },
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch hashtag data" }, { status: 500 })
  }
}
