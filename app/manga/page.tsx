"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  PlusIcon,
  SearchIcon,
  BookOpenIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { useMangaLibrary } from "@/hooks/use-manga"
import { MangaCard } from "@/components/manga/MangaCard"
import { ScrapeModal } from "@/components/manga/ScrapeModal"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function MangaLibraryPage() {
  const { t } = useLocale()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState("")
  const [scrapeOpen, setScrapeOpen] = useState(false)
  const { items, loading, refresh } = useMangaLibrary(search)
  const [thumbnailTargetId, setThumbnailTargetId] = useState<number | null>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  const filtered = sourceFilter
    ? items.filter((m) => m.source_type === sourceFilter)
    : items

  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm(t("mangaConfirmDelete"))) return
      try {
        await api.manga.delete(id)
        refresh()
      } catch {
        // ignore
      }
    },
    [refresh, t]
  )

  const handleChangeThumbnail = (id: number) => {
    setThumbnailTargetId(id)
    thumbnailInputRef.current?.click()
  }

  const handleThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || thumbnailTargetId === null) return
    try {
      await api.manga.uploadThumbnail(thumbnailTargetId, file)
      refresh()
    } catch {}
    e.target.value = ""
    setThumbnailTargetId(null)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <BookOpenIcon className="size-5 text-accent" />
              {t("manga")}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {items.length}{t("mangaWorks")}
            </p>
          </div>
          <Button onClick={() => setScrapeOpen(true)}>
            <PlusIcon className="size-4" />
            {t("mangaScrape")}
          </Button>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("mangaSearchPlaceholder")}
              className={cn(
                "w-full pl-10 pr-8 py-2 rounded-lg text-sm",
                "bg-surface-elevated border border-border-subtle",
                "text-text-primary placeholder:text-text-tertiary",
                "focus:outline-none focus:border-accent/50"
              )}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>

          {/* Source filter */}
          <div className="flex gap-1">
            {["", "hitomi", "arca"].map((src) => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  sourceFilter === src
                    ? "bg-accent text-white"
                    : "bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle"
                )}
              >
                {src === "" ? t("mangaAll") : src}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2Icon className="size-6 animate-spin text-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <BookOpenIcon className="size-12 mb-3 opacity-30" />
            <p className="text-sm">
              {search ? t("mangaNoResults") : t("mangaEmpty")}
            </p>
            {!search && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => setScrapeOpen(true)}>
                <PlusIcon className="size-4" />
                {t("mangaScrapeFirst")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((manga) => (
              <MangaCard
                key={manga.id}
                manga={manga}
                onClick={() => router.push(`/manga/${manga.id}`)}
                onDelete={handleDelete}
                onChangeThumbnail={handleChangeThumbnail}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input for thumbnail change */}
      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleThumbnailFileChange}
      />

      {/* Scrape Modal */}
      <ScrapeModal
        open={scrapeOpen}
        onClose={() => setScrapeOpen(false)}
        onComplete={refresh}
      />
    </div>
  )
}
