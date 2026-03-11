"use client"

import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import type { MangaItem } from "@/lib/types"
import { BookOpenIcon, Trash2Icon, ImageIcon, ImagePlusIcon } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"

interface MangaCardProps {
  manga: MangaItem
  onClick: () => void
  onDelete?: (id: number) => void
  onChangeThumbnail?: (id: number) => void
}

export function MangaCard({ manga, onClick, onDelete, onChangeThumbnail }: MangaCardProps) {
  const { t } = useLocale()
  const tags = (() => {
    try {
      return JSON.parse(manga.tags) as string[]
    } catch {
      return []
    }
  })()

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden cursor-pointer",
        "bg-surface border border-border-subtle",
        "hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5",
        "transition-all duration-200"
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-[3/4] bg-surface-elevated relative overflow-hidden">
        {manga.thumbnail_path ? (
          <img
            src={api.manga.thumbnailUrl(manga.id)}
            alt={manga.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-tertiary">
            <ImageIcon className="size-12 opacity-30" />
          </div>
        )}

        {/* Page count badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
          <BookOpenIcon className="size-3" />
          {manga.page_count}p
        </div>

        {/* Source badge */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {manga.source_type}
        </div>

        {/* Change thumbnail button — center overlay on hover */}
        {onChangeThumbnail && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChangeThumbnail(manga.id)
            }}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
            title={t("changeThumbnail")}
          >
            <div className="bg-black/60 hover:bg-accent/80 text-white p-2.5 rounded-full transition-colors">
              <ImagePlusIcon className="size-5" />
            </div>
          </button>
        )}

        {/* Delete button (shown on hover) */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(manga.id)
            }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 hover:bg-error/80 text-white p-1.5 rounded-lg transition-all"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-text-primary truncate" title={manga.title}>
          {manga.title}
        </h3>
        {manga.artist && (
          <p className="text-[11px] text-text-secondary mt-0.5 truncate">{manga.artist}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] bg-overlay-4 text-text-tertiary px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-text-tertiary">+{tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
