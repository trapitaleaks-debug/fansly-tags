"use client"

import { useState, useRef, useEffect } from "react"
import type { HashtagRow, TagsResponse } from "@/lib/types"
import { formatNumber } from "@/lib/compute"

interface Props {
  fetchedAt: number | null
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `${hours}h ago`
  if (minutes >= 1) return `${minutes}m ago`
  return "just now"
}

export default function Header({ fetchedAt }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<HashtagRow[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current !== e.target
      ) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    setSearching(true)
    setShowResults(true)
    try {
      const res = await fetch("/api/tags")
      if (!res.ok) throw new Error()
      const data: TagsResponse = await res.json()
      const all = [...data.mostViewed, ...data.fastestRising, ...data.lowestSaturation, ...data.highestImpact]
      const seen = new Set<string>()
      const unique: HashtagRow[] = []
      for (const row of all) {
        if (!seen.has(row.tag) && row.tag.toLowerCase().includes(q.toLowerCase())) {
          seen.add(row.tag)
          unique.push(row)
        }
      }
      setResults(unique.slice(0, 12))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const copyTag = (tag: string) => {
    navigator.clipboard.writeText(`#${tag}`)
    setCopied(tag)
    setTimeout(() => setCopied(null), 1500)
    setShowResults(false)
    setQuery("")
  }

  return (
    <header className="bg-[#0d0d0d] border-b border-[#222] px-6 py-3 flex items-center justify-between gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[#dc2626] font-bold text-xl tracking-tight">FanslyTags</span>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder="Search any hashtag..."
          className="w-full bg-[#141414] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#dc2626] transition-colors"
        />
        {searching && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#dc2626] border-t-transparent rounded-full animate-spin" />
        )}

        {showResults && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-[#141414] border border-[#333] rounded-md overflow-hidden shadow-xl z-50"
          >
            {results.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#555]">No hashtags found</div>
            ) : (
              results.map((r) => (
                <button
                  key={r.tag}
                  onClick={() => copyTag(r.tag)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#1f1f1f] transition-colors"
                >
                  <span className="text-[#dc2626] font-medium">#{r.tag}</span>
                  <div className="flex items-center gap-3 text-[#555] text-xs">
                    <span>{formatNumber(r.viewCount)} views</span>
                    {copied === r.tag ? (
                      <span className="text-[#22c55e]">Copied!</span>
                    ) : (
                      <span>click to copy</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Last updated */}
      <div className="text-xs text-[#555] shrink-0">
        {fetchedAt ? (
          <span>Updated {timeAgo(fetchedAt)}</span>
        ) : (
          <span>Loading...</span>
        )}
      </div>
    </header>
  )
}
