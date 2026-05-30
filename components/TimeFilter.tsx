"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { TimeFilter } from "@/lib/types"

const OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d",  label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "All time" },
]

interface Props {
  locked?: boolean           // true for Fastest Rising (always 24h, no picker)
  hasSnapshotData?: boolean  // false on first run before snapshots exist
}

export default function TimeFilter({ locked, hasSnapshotData }: Props) {
  const pathname = usePathname()
  const params = useSearchParams()
  const current = (params.get("filter") as TimeFilter) ?? "90d"

  if (locked) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#555]">Period:</span>
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-[#dc2626]/10 text-[#dc2626] border border-[#dc2626]/30">
          24h
        </span>
        <span className="text-xs text-[#444]">locked</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#555]">Period:</span>
      <div className="flex gap-1">
        {OPTIONS.map(({ value, label }) => {
          const active = current === value
          const href = `${pathname}?filter=${value}`
          return (
            <Link
              key={value}
              href={href}
              className={[
                "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
                active
                  ? "bg-[#dc2626] text-white border-[#dc2626]"
                  : "bg-transparent text-[#888] border-[#333] hover:border-[#dc2626] hover:text-[#f5f5f5]",
              ].join(" ")}
            >
              {label}
            </Link>
          )
        })}
      </div>
      {!hasSnapshotData && current !== "90d" && (
        <span className="text-xs text-[#444] ml-1">
          (building history…)
        </span>
      )}
    </div>
  )
}
