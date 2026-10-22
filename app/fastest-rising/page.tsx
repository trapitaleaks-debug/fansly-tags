import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"

const DAY_LABEL_MAX_AGE_MS = 48 * 3600_000 // daily snapshots: "the last day" covers a 20-48 h old one
const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

export default async function FastestRising() {
  let data = null
  let error = null
  try { data = await getTags("24h") } catch {
    error = "Could not load hashtag data. Try refreshing."
  }

  const rows = data?.fastestRising ?? []
  const since = data?.risingSince ?? null
  const lastDay = since !== null && data !== null && data.fetchedAt - since <= DAY_LABEL_MAX_AGE_MS

  return (
    <PageShell
      title="Fastest Rising"
      description={rows.length === 0 || since === null
        ? "Building 24h history…"
        : lastDay
          ? "Hashtags with the highest % view growth over the last day."
          : `Hashtags with the highest % view growth since ${day(since)}.`}
      fetchedAt={data?.fetchedAt ?? null}
      tagCount={data?.tagCount}
      hasSnapshotData={rows.length > 0}
      lockedFilter
      lockedLabel={since !== null && !lastDay ? `since ${day(since)}` : undefined}
      error={error}
    >
      <HashtagTable rows={rows} showChange={rows.length > 0} />
    </PageShell>
  )
}
