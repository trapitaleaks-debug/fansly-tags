import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"

const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

export default async function FastestRising() {
  let data = null
  let error = null
  try { data = await getTags("24h") } catch {
    error = "Could not load hashtag data. Try refreshing."
  }

  const rows = data?.fastestRising ?? []
  const older = data?.risingWindow && data.risingWindow !== "24h"
  const since = older && data?.risingSince ? day(data.risingSince) : null

  return (
    <PageShell
      title="Fastest Rising"
      description={rows.length === 0
        ? "Building 24h history…"
        : older
          ? `Hashtags with the highest % view growth${since ? ` since ${since}` : ""}. 24h history is still building.`
          : "Hashtags with the highest % view growth in the last 24 hours."}
      fetchedAt={data?.fetchedAt ?? null}
      tagCount={data?.tagCount}
      hasSnapshotData={rows.length > 0}
      lockedFilter
      lockedLabel={older ? (since ? `since ${since}` : data?.risingWindow ?? undefined) : undefined}
      error={error}
    >
      <HashtagTable rows={rows} showChange={rows.length > 0} />
    </PageShell>
  )
}
