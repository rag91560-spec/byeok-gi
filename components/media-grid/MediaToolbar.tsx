"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { SearchIcon, PlusIcon, XIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { MediaCategory } from "@/lib/types"
import { api } from "@/lib/api"
import { cn, appConfirm } from "@/lib/utils"

interface MediaToolbarProps {
  search: string
  onSearchChange: (val: string) => void
  categories: MediaCategory[]
  selectedCategoryId: number | null
  onCategoryChange: (id: number | null) => void
  onAdd: () => void
  mediaType: "video" | "audio"
  onCategoriesChange?: () => void
  totalCount?: number
  uncategorizedCount?: number
}

export function MediaToolbar({
  search,
  onSearchChange,
  categories,
  selectedCategoryId,
  onCategoryChange,
  onAdd,
  mediaType,
  onCategoriesChange,
  totalCount,
  uncategorizedCount,
}: MediaToolbarProps) {
  const { t } = useLocale()
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [contextMenu, setContextMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Focus rename input
  useEffect(() => {
    if (renamingId !== null) renameRef.current?.focus()
  }, [renamingId])

  // Focus add input
  useEffect(() => {
    if (addingCategory) addRef.current?.focus()
  }, [addingCategory])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [contextMenu])

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    try {
      await api.categories.create({ name, media_type: mediaType })
      setNewCatName("")
      setAddingCategory(false)
      onCategoriesChange?.()
    } catch {}
  }

  const handleRename = useCallback(async (catId: number) => {
    const name = renameValue.trim()
    if (!name) { setRenamingId(null); return }
    try {
      await api.categories.update(catId, { name })
      setRenamingId(null)
      onCategoriesChange?.()
    } catch {}
  }, [renameValue, onCategoriesChange])

  const handleDeleteCategory = async (catId: number) => {
    const cat = categories.find((c) => c.id === catId)
    if (!cat) return
    if (!await appConfirm(t("confirmDeleteCategory"))) return
    try {
      await api.categories.delete(cat.id)
      if (selectedCategoryId === catId) onCategoryChange(null)
      onCategoriesChange?.()
    } catch {}
  }

  const startRename = (cat: MediaCategory) => {
    setRenamingId(cat.id)
    setRenameValue(cat.name)
    setContextMenu(null)
  }

  const handlePillContextMenu = (e: React.MouseEvent, catId: number) => {
    e.preventDefault()
    setContextMenu({ id: catId, x: e.clientX, y: e.clientY })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: search + add media */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("search")}
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <Button onClick={onAdd} size="sm">
          <PlusIcon className="size-4" />
          {mediaType === "video" ? t("addVideo") : t("addAudio")}
        </Button>
      </div>

      {/* Category pills row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* All */}
        <button
          onClick={() => onCategoryChange(null)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
            selectedCategoryId === null
              ? "bg-accent text-white border-accent"
              : "bg-surface border-border-subtle text-text-secondary hover:border-accent/40 hover:text-text-primary"
          )}
        >
          {t("allCategories")}
          {totalCount !== undefined && (
            <span className="ml-1 opacity-70">({totalCount})</span>
          )}
        </button>

        {/* Uncategorized */}
        <button
          onClick={() => onCategoryChange(0)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
            selectedCategoryId === 0
              ? "bg-accent text-white border-accent"
              : "bg-surface border-border-subtle text-text-secondary hover:border-accent/40 hover:text-text-primary"
          )}
        >
          {t("uncategorized")}
          {uncategorizedCount !== undefined && (
            <span className="ml-1 opacity-70">({uncategorizedCount})</span>
          )}
        </button>

        {/* Category pills */}
        {categories.map((cat) => (
          <div key={cat.id} className="relative">
            {renamingId === cat.id ? (
              <input
                ref={renameRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(cat.id)
                  if (e.key === "Escape") setRenamingId(null)
                }}
                onBlur={() => handleRename(cat.id)}
                className="h-7 w-28 px-2 text-xs rounded-full border border-accent bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            ) : (
              <button
                onClick={() => onCategoryChange(cat.id)}
                onDoubleClick={() => startRename(cat)}
                onContextMenu={(e) => handlePillContextMenu(e, cat.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                  selectedCategoryId === cat.id
                    ? "bg-accent text-white border-accent"
                    : "bg-surface border-border-subtle text-text-secondary hover:border-accent/40 hover:text-text-primary"
                )}
              >
                {cat.name}
                {cat.item_count !== undefined && (
                  <span className="ml-1 opacity-70">({cat.item_count})</span>
                )}
              </button>
            )}
          </div>
        ))}

        {/* Add category pill */}
        {addingCategory ? (
          <div className="flex items-center gap-1">
            <input
              ref={addRef}
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory()
                if (e.key === "Escape") { setAddingCategory(false); setNewCatName("") }
              }}
              placeholder={t("categoryName")}
              className="h-7 w-28 px-2 text-xs rounded-full border border-border bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button size="sm" className="h-7 px-2" onClick={handleAddCategory} disabled={!newCatName.trim()}>
              <PlusIcon className="size-3.5" />
            </Button>
            <button onClick={() => { setAddingCategory(false); setNewCatName("") }} className="text-text-tertiary hover:text-text-primary">
              <XIcon className="size-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCategory(true)}
            className="px-2.5 py-1.5 text-xs rounded-full border border-dashed border-border-subtle text-text-tertiary hover:border-accent hover:text-accent transition-all"
            title={t("addCategory")}
          >
            <PlusIcon className="size-3.5" />
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[140px] rounded-lg border border-border-subtle bg-surface shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              const cat = categories.find((c) => c.id === contextMenu.id)
              if (cat) startRename(cat)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-overlay-4 flex items-center gap-2"
          >
            <PencilIcon className="size-3.5" />
            {t("editCategory")}
          </button>
          <button
            onClick={() => {
              handleDeleteCategory(contextMenu.id)
              setContextMenu(null)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-error hover:bg-overlay-4 flex items-center gap-2"
          >
            <Trash2Icon className="size-3.5" />
            {t("deleteCategory")}
          </button>
        </div>
      )}
    </div>
  )
}
