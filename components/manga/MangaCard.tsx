"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { MangaItem, MediaCategory } from "@/lib/types"
import { CheckIcon, Trash2Icon } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { useDragItem, useMergeTarget, type DragPayload } from "@/hooks/use-media-dnd"
import { ExplorerTileIcon } from "@/components/media-grid/ExplorerTileIcon"
import { api } from "@/lib/api"

interface MangaCardProps {
  manga: MangaItem
  onClick: () => void
  onDelete?: (id: number) => void
  onChangeThumbnail?: (id: number) => void
  selectable?: boolean
  selected?: boolean
  onSelect?: (checked: boolean) => void
  onSelectionClick?: (event: React.MouseEvent) => boolean
  getDragIds?: (primaryId: number) => number[]
  sourceSurface?: string
  categories?: MediaCategory[]
  onMoveToCategory?: (categoryId: number | null) => void
  onMergeDrop?: (payload: DragPayload) => void
}

export function MangaCard({
  manga,
  onClick,
  onDelete,
  selectable,
  selected,
  onSelect,
  onSelectionClick,
  getDragIds,
  sourceSurface,
  categories,
  onMoveToCategory,
  onMergeDrop,
}: MangaCardProps) {
  const { t } = useLocale()
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  // DnD: drag source
  const drag = useDragItem("manga", manga.id, { getIds: getDragIds, sourceSurface })

  // DnD: merge target
  const mergeHandler = useCallback(
    (payload: DragPayload) => {
      if (payload.ids.includes(manga.id)) return
      onMergeDrop?.(payload)
    },
    [manga.id, onMergeDrop],
  )
  const merge = useMergeTarget(mergeHandler, 500, { acceptType: "manga" })
  const mergeProps = onMergeDrop
    ? { onDragOver: merge.onDragOver, onDragLeave: merge.onDragLeave, onDrop: merge.onDrop }
    : {}

  // Translation progress
  const translatedPages = manga.translated_pages ?? 0
  const totalPages = manga.page_count
  const progressPct = totalPages > 0 ? Math.min((translatedPages / totalPages) * 100, 100) : 0
  const roundedProgressPct = Math.round(progressPct)
  const metaText = [
    totalPages > 0 ? `${totalPages}p` : null,
    translatedPages > 0 ? `${roundedProgressPct}%` : null,
  ].filter(Boolean).join(" · ")
  const thumbnailUrl = manga.thumbnail_path ? api.manga.thumbnailUrl(manga.id) : undefined
  const hasThumbnail = Boolean(thumbnailUrl)

  // Close context menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onMoveToCategory || !categories) return
    e.preventDefault()
    e.stopPropagation()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }

  return (
    <>
      <div
        data-testid={`media-card-manga-${manga.id}`}
        className={cn(
          "group relative cursor-pointer rounded-md transition-colors duration-150 ease-out",
          merge.showMerge
            ? "animate-pulse"
            : selected
              ? ""
              : "",
        )}
        onClick={(event) => {
          if (onSelectionClick?.(event)) return
          onClick()
        }}
        onContextMenu={handleContextMenu}
        draggable={drag.draggable}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
        {...mergeProps}
      >
        <div
          className={cn(
            "card-hover-frame flex aspect-[3/4] w-full flex-col rounded-md px-2.5 py-2.5",
            hasThumbnail
              ? "justify-end bg-cover bg-center text-left"
              : "items-center text-center",
          )}
          style={hasThumbnail ? { backgroundImage: `url("${thumbnailUrl}")` } : undefined}
          data-hover-active={merge.showMerge || selected ? "true" : undefined}
        >
          {hasThumbnail && (
            <div className="tile-cover-shade pointer-events-none absolute inset-0 z-0" />
          )}

          {/* Selection checkbox */}
          {selectable && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect?.(!selected) }}
              className={cn(
                "absolute left-1.5 top-1.5 z-20 flex size-5 items-center justify-center rounded border-2 transition-all",
                selected
                  ? "bg-accent border-accent text-white"
                  : "border-text-tertiary/70 bg-background/80 opacity-0 hover:border-text-secondary group-hover:opacity-100"
              )}
              aria-label={selected ? t("deselectAll") : t("selectItem")}
            >
              {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
            </button>
          )}

          {!selected && onDelete && (
            <div className="absolute right-1.5 top-1.5 z-20 flex flex-col gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(manga.id)
                }}
                className="rounded-full bg-black/70 p-1.5 text-white opacity-0 shadow-sm transition-all hover:bg-error/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50 group-hover:opacity-100"
                title={t("removeFromLibrary")}
                aria-label={t("removeFromLibrary")}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          )}

          {selected && (
            <div className="absolute inset-0 z-[5] bg-accent/10 pointer-events-none" />
          )}

          {merge.showMerge && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-accent/20 pointer-events-none">
              <span className="bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                {t("createGroup")}
              </span>
            </div>
          )}

          {!hasThumbnail && (
            <div className="flex min-h-0 flex-1 w-full items-center justify-center">
              <ExplorerTileIcon kind="manga" />
            </div>
          )}

          <div className="relative z-10 w-full min-w-0">
            <h3
              className={cn(
                "truncate text-[13px] font-medium leading-5",
                hasThumbnail ? "tile-cover-text" : "text-text-primary",
              )}
              title={manga.title}
            >
              {manga.title}
            </h3>
            {metaText && (
              <p
                className={cn(
                  "mt-0.5 h-4 truncate text-[11px] leading-4",
                  hasThumbnail ? "tile-cover-text tile-cover-meta" : "text-text-tertiary",
                )}
                title={metaText}
              >
                {metaText}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Context menu for moving to category */}
      {showMenu && onMoveToCategory && categories && (
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[160px] rounded-lg border border-border-subtle bg-surface shadow-xl py-1"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
            {t("moveToCategory") || "Move to"}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMoveToCategory(null)
              setShowMenu(false)
            }}
            className={cn(
              "w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-overlay-4",
              !manga.category_id ? "text-accent font-medium" : "text-text-secondary"
            )}
          >
            {t("uncategorized")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={(e) => {
                e.stopPropagation()
                onMoveToCategory(cat.id)
                setShowMenu(false)
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-overlay-4",
                manga.category_id === cat.id ? "text-accent font-medium" : "text-text-secondary"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
