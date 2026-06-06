"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BookTextIcon, CheckIcon, FileTextIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react"
import { ExplorerTileIcon } from "@/components/media-grid/ExplorerTileIcon"
import { useLocale } from "@/hooks/use-locale"
import { useDragItem, useMergeTarget, type DragPayload } from "@/hooks/use-media-dnd"
import { cn } from "@/lib/utils"
import type { MediaCategory, NovelItem } from "@/lib/types"

interface NovelCardProps {
  novel: NovelItem
  onOpen: () => void
  onRemove?: (id: number) => void
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

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null | undefined, locale: "ko" | "en") {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function extensionLabel(novel: NovelItem) {
  return (novel.extension || novel.file_name.split(".").pop() || "TXT").replace(".", "").toUpperCase()
}

export function NovelCard({
  novel,
  onOpen,
  onRemove,
  selectable,
  selected,
  onSelect,
  onSelectionClick,
  getDragIds,
  sourceSurface,
  categories,
  onMoveToCategory,
  onMergeDrop,
}: NovelCardProps) {
  const { t, locale } = useLocale()
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const drag = useDragItem("novel", novel.id, { getIds: getDragIds, sourceSurface })

  const mergeHandler = useCallback(
    (payload: DragPayload) => {
      if (payload.ids.includes(novel.id)) return
      onMergeDrop?.(payload)
    },
    [novel.id, onMergeDrop],
  )
  const merge = useMergeTarget(mergeHandler, 500, { acceptType: "novel" })
  const progress = Math.max(0, Math.min(100, novel.read_progress || 0))
  const progressLabel = `${Math.round(progress)}%`
  const lastOpened = formatDate(novel.last_opened_at, locale)
  const addedAt = formatDate(novel.created_at, locale)
  const meta = [
    novel.file_name || null,
    formatSize(novel.size),
  ].filter(Boolean).join(" · ")
  const translationKey =
    novel.translation_status === "complete"
      ? "novelTranslationComplete"
      : novel.translation_status === "partial"
        ? "novelTranslationPartial"
        : "novelTranslationOriginal"

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setShowMenu(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showMenu])

  const handleContextMenu = (event: React.MouseEvent) => {
    if (!onMoveToCategory || !categories) return
    event.preventDefault()
    event.stopPropagation()
    setMenuPos({ x: event.clientX, y: event.clientY })
    setShowMenu(true)
  }

  return (
    <>
      <div
        data-testid={`media-card-novel-${novel.id}`}
        className="group relative cursor-pointer rounded-md transition-colors duration-150 ease-out"
        onClick={(event) => {
          if (onSelectionClick?.(event)) return
          onOpen()
        }}
        onContextMenu={handleContextMenu}
        draggable={drag.draggable}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
        onDragOver={onMergeDrop ? merge.onDragOver : undefined}
        onDragLeave={onMergeDrop ? merge.onDragLeave : undefined}
        onDrop={onMergeDrop ? merge.onDrop : undefined}
      >
        <div
          className="card-hover-frame flex aspect-[3/4] w-full flex-col rounded-md bg-surface-elevated px-2.5 py-2.5"
          data-hover-active={merge.showMerge || selected ? "true" : undefined}
        >
          {selectable && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSelect?.(!selected)
              }}
              className={cn(
                "absolute left-1.5 top-1.5 z-20 flex size-5 items-center justify-center rounded border-2 transition-all",
                selected
                  ? "border-accent bg-accent text-white"
                  : "border-text-tertiary/70 bg-background/80 opacity-0 hover:border-text-secondary group-hover:opacity-100",
              )}
              aria-label={selected ? t("deselectAll") : t("selectItem")}
            >
              {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
            </button>
          )}

          {!selected && onRemove && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onRemove(novel.id)
              }}
              className="absolute right-1.5 top-1.5 z-20 rounded-full bg-black/70 p-1.5 text-white opacity-0 shadow-sm transition-all hover:bg-error/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50 group-hover:opacity-100"
              title={t("removeFromLibrary")}
              aria-label={t("removeFromLibrary")}
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}

          {onMoveToCategory && categories && !selected && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setMenuPos({ x: event.clientX, y: event.clientY })
                setShowMenu(true)
              }}
              className="absolute right-1.5 top-9 z-20 rounded-full bg-black/70 p-1.5 text-white opacity-0 shadow-sm transition-all hover:bg-overlay-3 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 group-hover:opacity-100"
              title={t("moveToCategory")}
              aria-label={t("moveToCategory")}
            >
              <MoreHorizontalIcon className="size-3.5" />
            </button>
          )}

          {selected && <div className="pointer-events-none absolute inset-0 z-[5] bg-accent/10" />}

          {merge.showMerge && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-accent/20">
              <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white">
                {t("createGroup")}
              </span>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded bg-overlay-2 px-2 text-center">
            {novel.preview ? (
              <>
                <BookTextIcon className="size-9 shrink-0 text-accent" strokeWidth={1.75} />
                <p className="line-clamp-5 w-full text-[11px] leading-4 text-text-secondary">{novel.preview}</p>
              </>
            ) : novel.metadata_only ? (
              <div className="flex flex-col items-center gap-2 text-[11px] text-text-tertiary">
                <FileTextIcon className="size-9 text-accent/70" strokeWidth={1.6} />
                <span>{t("novelMetadataOnly")}</span>
              </div>
            ) : (
              <ExplorerTileIcon kind="novel" />
            )}
          </div>

          <div className="mt-2 min-w-0">
            <h3 className="truncate text-[13px] font-semibold leading-5 text-text-primary" title={novel.title}>
              {novel.title}
            </h3>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <span className="rounded bg-overlay-4 px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                {extensionLabel(novel)}
              </span>
              <span className="min-w-0 truncate rounded bg-accent/12 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                {t(translationKey)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-overlay-4">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
              <span className="w-8 text-right text-[10px] tabular-nums text-text-tertiary">{progressLabel}</span>
            </div>
            <p className="mt-1 truncate text-[11px] leading-4 text-text-tertiary" title={meta}>
              {lastOpened
                ? t("novelLastOpened").replace("{date}", lastOpened)
                : t("novelAddedAt").replace("{date}", addedAt || "-")}
            </p>
          </div>
        </div>
      </div>

      {showMenu && onMoveToCategory && categories && (
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[180px] rounded-lg border border-border-subtle bg-surface py-1 shadow-xl"
          style={{ left: Math.max(8, Math.min(menuPos.x, window.innerWidth - 220)), top: Math.max(8, Math.min(menuPos.y, window.innerHeight - 260)) }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-text-tertiary">
            {t("moveToCategory")}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onMoveToCategory(null)
              setShowMenu(false)
            }}
            className={cn(
              "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-overlay-4",
              !novel.category_id ? "font-medium text-accent" : "text-text-secondary",
            )}
          >
            {t("uncategorized")}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onMoveToCategory(category.id)
                setShowMenu(false)
              }}
              className={cn(
                "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-overlay-4",
                novel.category_id === category.id ? "font-medium text-accent" : "text-text-secondary",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
