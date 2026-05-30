"use client"

import { useState } from "react"
import type { HashtagRow } from "@/lib/types"
import { formatNumber, formatChangePct } from "@/lib/compute"

type SortKey = "rank" | "tag" | "viewCount" | "postCount" | "saturationScore" | "impactScore" | "changePct"
type SortDir = "asc" | "desc"

interface Props {
  rows: HashtagRow[]
  showChange?: boolean // true when snapshot data is available
}

export default function HashtagTable({ rows, showChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [copied, setCopied] = useState<string | null>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir(key === "saturationScore" ? "asc" : "desc")
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const aVal = sortKey === "changePct" ? (a.changePct ?? -999) : a[sortKey as keyof HashtagRow]
    const bVal = sortKey === "changePct" ? (b.changePct ?? -999) : b[sortKey as keyof HashtagRow]
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    const diff = (aVal as number) - (bVal as number)
    return sortDir === "asc" ? diff : -diff
  })

  const copyTag = (tag: string) => {
    navigator.clipboard.writeText(`#${tag}`)
    setCopied(tag)
    setTimeout(() => setCopied(null), 1500)
  }

  const ColHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => {
    const active = sortKey === colKey
    const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : ""
    return (
      <th
        onClick={() => handleSort(colKey)}
        className={[
          "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none whitespace-nowrap",
          "hover:text-[#f5f5f5] transition-colors",
          active ? "text-[#dc2626]" : "text-[#555]",
        ].join(" ")}
      >
        {label}{arrow}
      </th>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <span className="text-[#555] text-sm">No data for this period yet.</span>
        <span className="text-[#444] text-xs">Snapshots are saved every 3 hours — check back soon.</span>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-[#0d0d0d] sticky top-0 z-10">
          <tr className="border-b border-[#222]">
            <ColHeader label="#" colKey="rank" />
            <ColHeader label="Hashtag" colKey="tag" />
            <ColHeader label="Views" colKey="viewCount" />
            <ColHeader label="Posts" colKey="postCount" />
            <ColHeader label="Saturation" colKey="saturationScore" />
            <ColHeader label="Impact" colKey="impactScore" />
            {showChange && <ColHeader label="Change" colKey="changePct" />}
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#555]">Copy</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.tag}
              onClick={() => copyTag(row.tag)}
              className="tag-row border-b border-[#111] group"
              title={`Click to copy #${row.tag}`}
            >
              <td className="px-4 py-2.5 text-[#444] w-10">{row.rank}</td>
              <td className="px-4 py-2.5 font-medium text-[#dc2626]">#{row.tag}</td>
              <td className="px-4 py-2.5 text-[#ccc] tabular-nums">{formatNumber(row.viewCount)}</td>
              <td className="px-4 py-2.5 text-[#888] tabular-nums">{formatNumber(row.postCount)}</td>
              <td className="px-4 py-2.5 tabular-nums">
                <span className={row.saturationScore < 0.01 ? "text-[#22c55e]" : row.saturationScore < 0.05 ? "text-[#f5f5f5]" : "text-[#888]"}>
                  {row.saturationScore.toFixed(4)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[#ccc] tabular-nums">{formatNumber(Math.round(row.impactScore))}</td>
              {showChange && (
                <td className="px-4 py-2.5 tabular-nums font-medium">
                  {row.changePct === null ? (
                    <span className="text-[#444]">—</span>
                  ) : row.changePct > 0 ? (
                    <span className="text-[#22c55e]">{formatChangePct(row.changePct)}</span>
                  ) : row.changePct < 0 ? (
                    <span className="text-[#dc2626]">{formatChangePct(row.changePct)}</span>
                  ) : (
                    <span className="text-[#555]">0%</span>
                  )}
                </td>
              )}
              <td className="px-4 py-2.5 w-16 text-center">
                {copied === row.tag ? (
                  <span className="text-[#22c55e] text-xs font-medium">Copied!</span>
                ) : (
                  <span className="text-[#333] group-hover:text-[#888] transition-colors text-xs">⎘</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
