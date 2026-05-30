import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"
import type { TimeFilter } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function LowestSaturation({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams
  const timeFilter = (["24h","7d","30d","90d"].includes(filter ?? "") ? filter : "90d") as TimeFilter

  let data = null
  let error = null
  try { data = await getTags(timeFilter) } catch {
    error = "Could not load hashtag data. Try refreshing."
  }

  return (
    <PageShell
      title="Lowest Saturation"
      description="Hashtags with fewest posts relative to views — less competition, better chance to rank. Saturation = posts ÷ views (lower is better)."
      fetchedAt={data?.fetchedAt ?? null}
      tagCount={data?.tagCount}
      hasSnapshotData={data?.hasSnapshotData}
      error={error}
    >
      <HashtagTable rows={data?.lowestSaturation ?? []} showChange={data?.hasSnapshotData && timeFilter !== "90d"} />
    </PageShell>
  )
}
