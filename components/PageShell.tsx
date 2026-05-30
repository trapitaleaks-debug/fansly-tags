import CategoryNav from "./CategoryNav"
import Header from "./Header"

interface Props {
  title: string
  description: string
  fetchedAt: number | null
  children: React.ReactNode
  error?: string | null
}

export default function PageShell({ title, description, fetchedAt, children, error }: Props) {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Header fetchedAt={fetchedAt} />
      <CategoryNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#f5f5f5]">{title}</h1>
          <p className="text-sm text-[#555] mt-1">{description}</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-[#1a0000] border border-[#dc2626]/30 rounded-md text-sm text-[#dc2626]">
            {error}
          </div>
        )}

        <div className="bg-[#0d0d0d] border border-[#222] rounded-lg overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
