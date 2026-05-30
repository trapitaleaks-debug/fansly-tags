import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "FanslyTags — Trending Hashtag Analytics",
  description: "Real-time trending hashtag analytics for Fansly creators and agencies.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-black text-[#f5f5f5] antialiased">
        {children}
      </body>
    </html>
  )
}
