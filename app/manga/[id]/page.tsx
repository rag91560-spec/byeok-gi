"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"
import { useManga } from "@/hooks/use-manga"
import { MangaViewer } from "@/components/manga/MangaViewer"

export default function MangaViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const mangaId = parseInt(id, 10)
  const { manga, loading, refresh } = useManga(mangaId)

  if (loading || !manga) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <MangaViewer
        mangaId={manga.id}
        pageCount={manga.page_count}
        onBack={() => router.push("/manga")}
        onUpdate={refresh}
      />
    </div>
  )
}
