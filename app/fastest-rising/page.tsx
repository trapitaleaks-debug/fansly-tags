import HashtagTable from "@/components/HashtagTable"
import PageShell from "@/components/PageShell"
import { getTags } from "@/lib/get-tags"

export const dynamic = "force-dynamic"

export default async function FastestRising() {
  let data = null
  let error = null
  try { data = await getTags("24h") } catch {
    error = "Could not load hashtag data. Try refreshing."
  }

  return (
    <PageShell
      title="Fastest Rising"
      description={data?.hasSnapshotData
        ? "Hashtags with the highest % view growth in the last 24 hours."
        : "Hashtags most actively used in current Fansly FYP posts. Building 24h history…"}
      fetchedAt={data?.fetchedAt ?? null}
      tagCount={data?.tagCount}
      hasSnapshotData={data?.hasSnapshotData}
      lockedFilter
      error={error}
    >
      <HashtagTable rows={data?.fastestRising ?? []} showChange={data?.hasSnapshotData} />
    </PageShell>
  )
}
