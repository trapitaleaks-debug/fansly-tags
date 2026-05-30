import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"
import type { TimeFilter } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function MostViewed({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams
  const timeFilter = (["24h","7d","30d","90d"].includes(filter ?? "") ? filter : "90d") as TimeFilter

  let data = null
  let error = null
  try { data = await getTags(timeFilter) } catch {
    error = "Could not load hashtag data. Try refreshing."
  }

  return (
    <PageShell
      title="Most Viewed"
      description={data?.hasSnapshotData
        ? `Hashtags with the most view growth in the last ${timeFilter}.`
        : "Hashtags ranked by total view count — best for Evergreen tags."}
      fetchedAt={data?.fetchedAt ?? null}
      tagCount={data?.tagCount}
      hasSnapshotData={data?.hasSnapshotData}
      error={error}
    >
      <HashtagTable rows={data?.mostViewed ?? []} showChange={data?.hasSnapshotData && timeFilter !== "90d"} />
    </PageShell>
  )
}
