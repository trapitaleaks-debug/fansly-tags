"use client"

import { useState } from "react"
import type { HashtagRow } from "@/lib/types"
import { formatNumber } from "@/lib/compute"

type SortKey = "rank" | "tag" | "viewCount" | "postCount" | "saturationScore" | "impactScore"
type SortDir = "asc" | "desc"

interface Props {
  rows: HashtagRow[]
}

export default function HashtagTable({ rows }: Props) {
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
    const aVal = a[sortKey]
    const bVal = b[sortKey]
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

  const ColHeader = ({ label, key }: { label: string; key: SortKey }) => {
    const active = sortKey === key
    const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : ""
    return (
      <th
        onClick={() => handleSort(key)}
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
      <div className="flex items-center justify-center h-40 text-[#555] text-sm">
        No hashtags above 5,000 views. Try refreshing later.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-[#0d0d0d] sticky top-0 z-10">
          <tr className="border-b border-[#222]">
            <ColHeader label="#" key="rank" />
            <ColHeader label="Hashtag" key="tag" />
            <ColHeader label="Views" key="viewCount" />
            <ColHeader label="Posts" key="postCount" />
            <ColHeader label="Saturation" key="saturationScore" />
            <ColHeader label="Impact" key="impactScore" />
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#555]">
              Copy
            </th>
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
              <td className="px-4 py-2.5 font-medium text-[#dc2626]">
                #{row.tag}
              </td>
              <td className="px-4 py-2.5 text-[#ccc] tabular-nums">
                {formatNumber(row.viewCount)}
              </td>
              <td className="px-4 py-2.5 text-[#888] tabular-nums">
                {formatNumber(row.postCount)}
              </td>
              <td className="px-4 py-2.5 tabular-nums">
                <span
                  className={
                    row.saturationScore < 0.01
                      ? "text-[#22c55e]"
                      : row.saturationScore < 0.05
                      ? "text-[#f5f5f5]"
                      : "text-[#888]"
                  }
                >
                  {row.saturationScore.toFixed(4)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[#ccc] tabular-nums">
                {formatNumber(Math.round(row.impactScore))}
              </td>
              <td className="px-4 py-2.5 w-16 text-center">
                {copied === row.tag ? (
                  <span className="text-[#22c55e] text-xs font-medium">Copied!</span>
                ) : (
                  <span className="text-[#333] group-hover:text-[#888] transition-colors text-xs">
                    ⎘
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
