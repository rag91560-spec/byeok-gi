"use client"

import { FileIcon, FolderIcon, MoreHorizontalIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDropTarget, type DragPayload, type MediaDragType } from "@/hooks/use-media-dnd"
import { useLocale } from "@/hooks/use-locale"
import { ExplorerTileIcon } from "./ExplorerTileIcon"

interface FolderCardProps {
  id: number
  name: string
  previewAspect?: "square" | "video" | "panel"
  itemCount?: number
  childFolderCount?: number
  onOpen: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDropItem?: (itemId: number) => void
  onDropItems?: (payload: DragPayload) => void
  acceptType?: MediaDragType
}

export function FolderCard({
  id,
  name,
  previewAspect = "square",
  itemCount,
  childFolderCount,
  onOpen,
  onContextMenu,
  onDropItem,
  onDropItems,
  acceptType,
}: FolderCardProps) {
  const { t } = useLocale()
  const isPanel = previewAspect === "panel"
  const hasChildFolders = childFolderCount !== undefined && childFolderCount > 0
  const hasItems = itemCount !== undefined && itemCount > 0
  const hasCounts = hasChildFolders || hasItems
  const drop = useDropTarget((payload) => {
    if (onDropItems) {
      onDropItems(payload)
      return
    }
    onDropItem?.(payload.primaryId)
  }, { acceptType })

  return (
    <div
      data-testid={`folder-card-${id}`}
      className={cn(
        "group relative flex flex-col rounded-md transition-colors duration-150 ease-out cursor-pointer select-none",
        drop.isOver
          ? "animate-pulse"
          : "",
      )}
      onDoubleClick={onOpen}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onDragOver={onDropItem || onDropItems ? drop.onDragOver : undefined}
      onDragLeave={onDropItem || onDropItems ? drop.onDragLeave : undefined}
      onDrop={onDropItem || onDropItems ? drop.onDrop : undefined}
    >
      <div
        className={cn(
          "card-hover-frame flex w-full flex-col items-center rounded-md px-2 py-2.5 text-center",
          isPanel ? "aspect-[3/4]" : "min-h-[120px]",
        )}
        data-hover-active={drop.isOver ? "true" : undefined}
      >
        {onContextMenu && (
          <button
            type="button"
            className="absolute right-1.5 top-1.5 z-20 rounded-full bg-black/70 p-1.5 text-white opacity-0 shadow-sm transition-all hover:bg-overlay-3 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 group-hover:opacity-100"
            title={t("folderActions")}
            aria-label={t("folderActions")}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onContextMenu(event)
            }}
          >
            <MoreHorizontalIcon className="size-3.5" />
          </button>
        )}
        <div className={cn("flex w-full items-center justify-center", isPanel ? "min-h-0 flex-1" : "h-16")}>
          <ExplorerTileIcon kind="folder" />
        </div>
        <div className="mt-2 w-full min-w-0">
          <div className="truncate text-[13px] font-medium leading-5 text-text-primary" title={name}>
            {name}
          </div>
          <div className="mt-0.5 flex h-4 items-center justify-center gap-2 truncate text-[11px] leading-4 text-text-tertiary">
            {hasCounts ? (
              <>
                {hasChildFolders && (
                  <span className="inline-flex items-center gap-1">
                    <FolderIcon className="size-3" />
                    {childFolderCount}
                  </span>
                )}
                {hasItems && (
                  <span className="inline-flex items-center gap-1">
                    <FileIcon className="size-3" />
                    {itemCount}
                  </span>
                )}
              </>
            ) : (
              <span className="truncate">{t("empty")}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
