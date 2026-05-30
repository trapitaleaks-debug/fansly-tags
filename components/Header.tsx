"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { HashtagRow } from "@/lib/types"
import { formatNumber } from "@/lib/compute"

interface Props {
  fetchedAt: number | null
  tagCount?: number
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor(diff / 60000)
  if (hours >= 1) return `${hours}h ago`
  if (minutes >= 1) return `${minutes}m ago`
  return "just now"
}

interface SearchResult extends HashtagRow {
  source: "cache" | "live"
}

export default function Header({ fetchedAt, tagCount }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    setSearching(true)
    setShowResults(true)

    try {
      // Search our cached dataset first
      const res = await fetch("/api/tags")
      let cacheResults: SearchResult[] = []

      if (res.ok) {
        const data = await res.json()
        const all: HashtagRow[] = [
          ...( data.mostViewed ?? []),
          ...( data.fastestRising ?? []),
          ...( data.lowestSaturation ?? []),
          ...( data.highestImpact ?? []),
        ]
        const seen = new Set<string>()
        for (const row of all) {
          if (!seen.has(row.tag) && row.tag.toLowerCase().includes(q.toLowerCase())) {
            seen.add(row.tag)
            cacheResults.push({ ...row, source: "cache" })
          }
        }
      }

      // If the exact tag wasn't found in cache, query Fansly API directly
      const exactMatch = cacheResults.find(
        (r) => r.tag.toLowerCase() === q.toLowerCase().replace(/^#/, "")
      )

      if (!exactMatch && q.trim().length >= 2) {
        const cleanTag = q.trim().replace(/^#/, "")
        const liveRes = await fetch(`/api/tag-lookup?tag=${encodeURIComponent(cleanTag)}`)
        if (liveRes.ok) {
          const liveData = await liveRes.json()
          if (liveData.tag && !cacheResults.find((r) => r.tag === liveData.tag)) {
            cacheResults = [{ ...liveData, source: "live" }, ...cacheResults]
          }
        }
      }

      setResults(cacheResults.slice(0, 10))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleInput = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(q), 300)
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
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[#dc2626] font-bold text-xl tracking-tight">FanslyTags</span>
        {tagCount ? (
          <span className="text-[#444] text-xs">{tagCount} tags</span>
        ) : null}
      </div>

      <div className="relative flex-1 max-w-md">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder="Search any hashtag (e.g. indian, teen, feet...)"
          className="w-full bg-[#141414] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#f5f5f5] placeholder-[#444] focus:outline-none focus:border-[#dc2626] transition-colors"
        />
        {searching && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#dc2626] border-t-transparent rounded-full animate-spin" />
        )}

        {showResults && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-[#141414] border border-[#333] rounded-md overflow-hidden shadow-2xl z-50 max-h-80 overflow-y-auto"
          >
            {results.length === 0 && !searching ? (
              <div className="px-3 py-3 text-sm text-[#555]">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              results.map((r) => (
                <button
                  key={r.tag}
                  onClick={() => copyTag(r.tag)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[#1f1f1f] transition-colors border-b border-[#1a1a1a] last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#dc2626] font-medium">#{r.tag}</span>
                    {r.source === "live" && (
                      <span className="text-[10px] text-[#555] bg-[#1a1a1a] px-1.5 py-0.5 rounded">live</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[#555] text-xs">
                    <span>{formatNumber(r.viewCount)} views</span>
                    <span>{formatNumber(r.postCount)} posts</span>
                    {copied === r.tag ? (
                      <span className="text-[#22c55e] font-medium">Copied!</span>
                    ) : (
                      <span className="text-[#333]">copy</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-[#444] shrink-0">
        {fetchedAt ? (
          <span title={new Date(fetchedAt).toLocaleTimeString()}>Updated {timeAgo(fetchedAt)}</span>
        ) : (
          <span>Loading...</span>
        )}
      </div>
    </header>
  )
}
