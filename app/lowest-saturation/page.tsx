import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"

export default async function LowestSaturation() {
  let data = null
  let error = null
  try {
    data = await getTags()
  } catch {
    error = "Could not load hashtag data — Fansly API may be temporarily unavailable. Try refreshing."
  }

  return (
    <PageShell
      title="Lowest Saturation"
      description="Hashtags with fewest posts relative to views — less competition, better chance to rank. Saturation = posts ÷ views (lower is better)."
      fetchedAt={data?.fetchedAt ?? null}
      error={error}
    >
      <HashtagTable rows={data?.lowestSaturation ?? []} />
    </PageShell>
  )
}
