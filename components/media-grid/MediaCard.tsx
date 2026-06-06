"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Trash2Icon, CheckIcon } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import type { MediaCategory } from "@/lib/types"
import { useDragItem, useMergeTarget, type DragPayload } from "@/hooks/use-media-dnd"
import { ExplorerTileIcon } from "./ExplorerTileIcon"

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ""
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return ""
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

interface MediaCardProps {
  id?: number
  title: string
  thumbnail?: string
  mediaType: "video" | "audio"
  duration?: number
  size?: number
  categoryId?: number | null
  categories?: MediaCategory[]
  isActive?: boolean
  selectable?: boolean
  selected?: boolean
  onSelect?: (checked: boolean) => void
  onSelectionClick?: (event: React.MouseEvent) => boolean
  getDragIds?: (primaryId: number) => number[]
  sourceSurface?: string
  layout?: "compact" | "panel"
  onClick: () => void
  onDelete?: () => void
  onChangeThumbnail?: () => void
  onMoveToCategory?: (categoryId: number | null) => void
  onMergeDrop?: (payload: DragPayload) => void
}

export function MediaCard({
  id,
  title,
  thumbnail,
  mediaType,
  duration,
  size,
  categoryId,
  categories,
  isActive,
  selectable,
  selected,
  onSelect,
  onSelectionClick,
  getDragIds,
  sourceSurface,
  layout = "compact",
  onClick,
  onDelete,
  onMoveToCategory,
  onMergeDrop,
}: MediaCardProps) {
  const { t } = useLocale()
  const isVideo = mediaType === "video"
  const isPanel = layout === "panel"
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  // DnD: drag source
  const drag = useDragItem(mediaType, id ?? 0, { getIds: getDragIds, sourceSurface })
  const dragProps = id
    ? { draggable: drag.draggable, onDragStart: drag.onDragStart, onDragEnd: drag.onDragEnd }
    : {}

  // DnD: merge target
  const mergeHandler = useCallback(
    (payload: DragPayload) => {
      if (!id || payload.ids.includes(id)) return
      onMergeDrop?.(payload)
    },
    [id, onMergeDrop],
  )
  const merge = useMergeTarget(mergeHandler, 500, { acceptType: mediaType })
  const mergeProps = onMergeDrop && id
    ? { onDragOver: merge.onDragOver, onDragLeave: merge.onDragLeave, onDrop: merge.onDrop }
    : {}

  const currentCatName = categories?.find((c) => c.id === categoryId)?.name
  const thumbnailUrl = thumbnail?.trim()
  const hasThumbnail = Boolean(thumbnailUrl)
  const metaParts = [
    duration && duration > 0 ? formatDuration(duration) : null,
    size && size > 0 ? formatSize(size) : null,
    currentCatName,
  ].filter(Boolean)
  const metaText = metaParts.join(" · ")

  // Close menu on outside click
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

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect?.(!selected)
  }

  return (
    <>
      <div
        data-testid={id ? `media-card-${mediaType}-${id}` : undefined}
        className={cn(
          "group relative cursor-pointer rounded-md transition-colors duration-150 ease-out",
          merge.showMerge
            ? "animate-pulse"
            : selected
              ? ""
              : isActive
                ? ""
                : "",
        )}
        onClick={(event) => {
          if (id && onSelectionClick?.(event)) return
          onClick()
        }}
        onContextMenu={handleContextMenu}
        {...dragProps}
        {...mergeProps}
      >
        <div
          className={cn(
            "card-hover-frame flex w-full flex-col rounded-md px-2 py-2.5",
            isPanel
              ? "aspect-[3/4]"
              : "min-h-[120px]",
            hasThumbnail
              ? "justify-end bg-cover bg-center text-left"
              : "items-center text-center",
          )}
          style={hasThumbnail ? { backgroundImage: `url("${thumbnailUrl}")` } : undefined}
          data-hover-active={merge.showMerge || selected || isActive ? "true" : undefined}
        >
          {hasThumbnail && (
            <div className="tile-cover-shade pointer-events-none absolute inset-0 z-0" />
          )}

          {/* Selection checkbox */}
          {selectable && (
            <button
              data-testid={id ? `media-select-${mediaType}-${id}` : undefined}
              onClick={handleCheckboxClick}
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
                  onDelete()
                }}
                className="rounded-full bg-black/70 p-1.5 text-white opacity-0 shadow-sm transition-all hover:bg-error/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50 group-hover:opacity-100"
                title={t("removeFromLibrary")}
                aria-label={t("removeFromLibrary")}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          )}

          {/* Active indicator */}
          {isActive && !selected && (
            <div className="absolute left-2 top-2 z-10">
              <span className="size-2.5 rounded-full bg-accent animate-pulse inline-block" />
            </div>
          )}

          {/* Selected overlay */}
          {selected && (
            <div className="absolute inset-0 z-[5] bg-accent/10 pointer-events-none" />
          )}

          {/* Merge overlay */}
          {merge.showMerge && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-accent/20 pointer-events-none">
              <span className="bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                {t("createGroup")}
              </span>
            </div>
          )}
          {!hasThumbnail && (
            <div className={cn("flex w-full items-center justify-center", isPanel ? "min-h-0 flex-1" : "h-16")}>
              <ExplorerTileIcon kind={isVideo ? "video" : "audio"} />
            </div>
          )}

          {/* Title + category */}
          <div className={cn("relative z-10 w-full min-w-0", !isPanel && !hasThumbnail ? "mt-2" : "")}>
            <h3
              className={cn(
                "truncate text-[13px] font-medium leading-5",
                hasThumbnail ? "tile-cover-text" : "text-text-primary",
              )}
              title={title}
            >
              {title}
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
              !categoryId ? "text-accent font-medium" : "text-text-secondary"
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
                categoryId === cat.id ? "text-accent font-medium" : "text-text-secondary"
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
