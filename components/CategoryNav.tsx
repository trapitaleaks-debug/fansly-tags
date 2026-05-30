"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const CATEGORIES = [
  { href: "/most-viewed", label: "Most Viewed" },
  { href: "/fastest-rising", label: "Fastest Rising" },
  { href: "/lowest-saturation", label: "Lowest Saturation" },
  { href: "/highest-impact", label: "Highest Impact" },
]

export default function CategoryNav() {
  const pathname = usePathname()

  return (
    <nav className="flex border-b border-[#222]">
      {CATEGORIES.map(({ href, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={[
              "px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              active
                ? "border-[#dc2626] text-[#f5f5f5]"
                : "border-transparent text-[#888] hover:text-[#f5f5f5] hover:border-[#444]",
            ].join(" ")}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
