import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"

export default async function HighestImpact() {
  let data = null
  let error = null
  try {
    data = await getTags()
  } catch {
    error = "Could not load hashtag data — Fansly API may be temporarily unavailable. Try refreshing."
  }

  return (
    <PageShell
      title="Highest Impact"
      description="Best balance of high views and low saturation — views ÷ (saturation + 1). Use for Core Growth tags."
      fetchedAt={data?.fetchedAt ?? null}
      error={error}
    >
      <HashtagTable rows={data?.highestImpact ?? []} />
    </PageShell>
  )
}
