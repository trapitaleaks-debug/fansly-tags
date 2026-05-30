import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"

export default async function FastestRising() {
  let data = null
  let error = null
  try {
    data = await getTags()
  } catch {
    error = "Could not load hashtag data — Fansly API may be temporarily unavailable. Try refreshing."
  }

  return (
    <PageShell
      title="Fastest Rising"
      description="Hashtags with the highest views-per-post ratio — proxy for tags currently blowing up. Use for Flash Momentum."
      fetchedAt={data?.fetchedAt ?? null}
      error={error}
    >
      <HashtagTable rows={data?.fastestRising ?? []} />
    </PageShell>
  )
}
