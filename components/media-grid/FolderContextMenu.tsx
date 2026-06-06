"use client"

import { useEffect, useRef } from "react"
import { Edit3Icon, Trash2Icon } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

export type FolderContextMenuTarget = {
  id: number
  name: string
  x: number
  y: number
  itemCount: number
  childFolderCount: number
}

export function FolderContextMenu({
  target,
  onClose,
  onRename,
  onRemove,
}: {
  target: FolderContextMenuTarget
  onClose: () => void
  onRename: (target: FolderContextMenuTarget) => void
  onRemove: (target: FolderContextMenuTarget) => void
}) {
  const { t } = useLocale()
  const menuRef = useRef<HTMLDivElement>(null)
  const left = typeof window === "undefined" ? target.x : Math.max(8, Math.min(target.x, window.innerWidth - 240))
  const top = typeof window === "undefined" ? target.y : Math.max(8, Math.min(target.y, window.innerHeight - 188))

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      onClose()
    }
    const keyClose = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", keyClose)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", keyClose)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-[232px] overflow-hidden rounded-lg border border-border-subtle bg-surface py-1 shadow-xl"
      style={{ left, top }}
      role="menu"
      aria-label={t("folderActions")}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="border-b border-border-subtle px-3 py-2">
        <div className="truncate text-sm font-medium text-text-primary" title={target.name}>
          {target.name}
        </div>
        <div className="mt-0.5 truncate text-[11px] leading-4 text-text-tertiary">
          {t("folderContentsSummary")
            .replace("{items}", String(target.itemCount))
            .replace("{folders}", String(target.childFolderCount))}
        </div>
      </div>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-overlay-4 hover:text-text-primary"
        onClick={(event) => {
          event.stopPropagation()
          onRename(target)
        }}
      >
        <Edit3Icon className="size-4" />
        {t("renameFolder")}
      </button>
      <button
        type="button"
        role="menuitem"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-error/10",
          "text-error",
        )}
        onClick={(event) => {
          event.stopPropagation()
          onRemove(target)
        }}
      >
        <Trash2Icon className="size-4" />
        {t("removeFolder")}
      </button>
    </div>
  )
}
