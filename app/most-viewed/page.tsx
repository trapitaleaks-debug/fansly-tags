import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"

export default async function MostViewed() {
  let data = null
  let error = null
  try {
    data = await getTags()
  } catch {
    error = "Could not load hashtag data — Fansly API may be temporarily unavailable. Try refreshing."
  }

  return (
    <PageShell
      title="Most Viewed"
      description="Hashtags ranked by total view count — best for Evergreen tags that bring consistent long-term exposure."
      fetchedAt={data?.fetchedAt ?? null}
      tagCount={data?.tagCount}
      error={error}
    >
      <HashtagTable rows={data?.mostViewed ?? []} />
    </PageShell>
  )
}
