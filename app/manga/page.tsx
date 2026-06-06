"use client"

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  PlusIcon,
  BookOpenIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { useMangaLibrary } from "@/hooks/use-manga"
import { MangaCard } from "@/components/manga/MangaCard"
import { ScrapeModal } from "@/components/manga/ScrapeModal"
import { FolderExplorer } from "@/components/media-grid/FolderExplorer"
import { FolderNameDialog, useFolderNameDialog } from "@/components/media-grid/FolderNameDialog"
import { FolderContextMenu, type FolderContextMenuTarget } from "@/components/media-grid/FolderContextMenu"
import { LibraryEmptyState } from "@/components/media-grid/LibraryEmptyState"
import { LibrarySurfaceHeader } from "@/components/media-grid/LibrarySurfaceHeader"
import { SelectionBar } from "@/components/media-grid/SelectionBar"
import { useOsSelection } from "@/hooks/use-os-selection"
import { MEDIA_DND_MIME, hasExternalFiles, type DragPayload } from "@/hooks/use-media-dnd"
import { api } from "@/lib/api"
import { appConfirm } from "@/lib/utils"
import {
  MANGA_IMAGE_EXTENSIONS,
  emptyDropImportSummary,
  formatDropImportSummary,
  getDroppedFilePath,
  getPathBaseName,
  getPathExtension,
  getPathTitle,
  isDuplicateImportError,
  isLikelyFolderDrop,
} from "@/lib/external-drop-import"
import type { MangaItem, MediaCategory } from "@/lib/types"

async function readFilesystemFile(path: string): Promise<File> {
  const response = await fetch(`/api/filesystem/serve?path=${encodeURIComponent(path)}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const blob = await response.blob()
  return new File([blob], getPathBaseName(path), { type: blob.type })
}

function MangaLibraryPageContent() {
  const { t } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const folderParam = searchParams.get("folder")
  const currentFolderId: number | null = folderParam ? parseInt(folderParam, 10) : null
  const navigateToFolder = useCallback((id: number | null) => {
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    if (id === null) sp.delete("folder")
    else sp.set("folder", String(id))
    const qs = sp.toString()
    router.replace(qs ? `/manga?${qs}` : "/manga")
  }, [router, searchParams])

  const [search, setSearch] = useState("")
  const [scrapeOpen, setScrapeOpen] = useState(false)
  const { items, loading, refresh } = useMangaLibrary(search)
  const [thumbnailTargetId, setThumbnailTargetId] = useState<number | null>(null)
  const [isDropOver, setIsDropOver] = useState(false)
  const [dropImporting, setDropImporting] = useState(false)
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuTarget | null>(null)
  const { folderNameDialog, requestFolderName, closeFolderNameDialog } = useFolderNameDialog()
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const externalDropCounterRef = useRef(0)

  // Category state
  const [categories, setCategories] = useState<MediaCategory[]>([])

  // Load categories
  const loadCategories = useCallback(() => {
    api.categories.list("manga").then(setCategories).catch(() => {})
  }, [])
  useEffect(() => { loadCategories() }, [loadCategories])

  const visibleMangaIds = useMemo(() => {
    const visible = search
      ? items.map((item) => item.id)
      : items.filter((item) => (item.category_id ?? null) === currentFolderId).map((item) => item.id)
    return visible
  }, [currentFolderId, items, search])
  const selection = useOsSelection(visibleMangaIds)

  const handleDelete = useCallback(
    async (id: number) => {
      if (!await appConfirm(t("confirmRemoveMangaFromLibrary").replace("{count}", "1"))) return
      try {
        await api.manga.removeFromLibrary(id)
        refresh()
      } catch {}
    },
    [refresh, t]
  )

  const uploadDroppedManga = useCallback(async (title: string, files: File[]) => {
    let item = await api.manga.upload(title, files)
    if (currentFolderId !== null) {
      item = await api.manga.update(item.id, { category_id: currentFolderId })
    }
    return item
  }, [currentFolderId])

  const isExternalImportDrag = useCallback((event: React.DragEvent) => {
    return hasExternalFiles(event) && !Array.from(event.dataTransfer.types).includes(MEDIA_DND_MIME)
  }, [])

  const handleExternalDragEnter = useCallback((event: React.DragEvent) => {
    if (!isExternalImportDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    externalDropCounterRef.current += 1
    setIsDropOver(true)
  }, [isExternalImportDrag])

  const handleExternalDragLeave = useCallback((event: React.DragEvent) => {
    if (!isExternalImportDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    externalDropCounterRef.current -= 1
    if (externalDropCounterRef.current <= 0) {
      externalDropCounterRef.current = 0
      setIsDropOver(false)
    }
  }, [isExternalImportDrag])

  const handleExternalDragOver = useCallback((event: React.DragEvent) => {
    if (!isExternalImportDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "copy"
  }, [isExternalImportDrag])

  const handleExternalDrop = useCallback(async (event: React.DragEvent) => {
    if (!isExternalImportDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    setIsDropOver(false)
    externalDropCounterRef.current = 0

    const dropped = Array.from(event.dataTransfer.files)
    if (dropped.length === 0) return

    const summary = emptyDropImportSummary()
    const looseImages: File[] = []
    setDropImporting(true)

    for (const file of dropped) {
      const path = getDroppedFilePath(file)
      const label = path || file.name
      const ext = getPathExtension(label)

      if (isLikelyFolderDrop(file, path)) {
        const title = prompt(t("folderName"), getPathTitle(path))
        if (!title) continue
        try {
          const result = await api.filesystem.browse(path, ".jpg,.jpeg,.png,.bmp,.webp")
          const imageEntries = result.entries.filter((entry) => entry.type === "file")
          if (imageEntries.length === 0) {
            summary.unsupported += 1
            continue
          }
          const files = await Promise.all(imageEntries.map((entry) => readFilesystemFile(entry.path)))
          await uploadDroppedManga(title.trim(), files)
          summary.success += 1
        } catch (error) {
          if (isDuplicateImportError(error)) summary.duplicates += 1
          else summary.failed += 1
        }
        continue
      }

      if (!MANGA_IMAGE_EXTENSIONS.has(ext) && !file.type.startsWith("image/")) {
        summary.unsupported += 1
        continue
      }

      try {
        looseImages.push(path ? await readFilesystemFile(path) : file)
      } catch {
        summary.failed += 1
      }
    }

    if (looseImages.length > 0) {
      const title = prompt(t("folderName"), getPathTitle(looseImages[0].name))
      if (title) {
        try {
          await uploadDroppedManga(title.trim(), looseImages)
          summary.success += 1
        } catch (error) {
          if (isDuplicateImportError(error)) summary.duplicates += 1
          else summary.failed += 1
        }
      }
    }

    setDropImporting(false)
    refresh()
    alert(formatDropImportSummary(t, summary))
  }, [isExternalImportDrag, refresh, t, uploadDroppedManga])

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

  // Folder (category) CRUD
  const handleCreateFolder = async (name: string, parentId: number | null) => {
    try {
      await api.categories.create({ name, media_type: "manga", parent_id: parentId })
      loadCategories()
    } catch (err) {
      console.error("Failed to create folder:", err)
      alert(t("folderCreateFailed").replace("{error}", err instanceof Error ? err.message : String(err)))
    }
  }

  const openFolderContextMenu = (folderId: number, event: React.MouseEvent) => {
    const cat = categories.find((c) => c.id === folderId)
    if (!cat) return
    setFolderContextMenu({
      id: cat.id,
      name: cat.name,
      x: event.clientX,
      y: event.clientY,
      itemCount: items.filter((item) => item.category_id === folderId).length,
      childFolderCount: categories.filter((child) => child.parent_id === folderId).length,
    })
  }

  const handleRenameFolder = async (target: FolderContextMenuTarget) => {
    setFolderContextMenu(null)
    const name = await requestFolderName(t("renameFolder"), target.name)
    if (!name || name.trim() === target.name) return
    try {
      await api.categories.update(target.id, { name: name.trim() })
      loadCategories()
    } catch {}
  }

  const handleRemoveFolder = async (target: FolderContextMenuTarget) => {
    setFolderContextMenu(null)
    const cat = categories.find((c) => c.id === target.id)
    const parentId = cat?.parent_id ?? null
    const message = t("removeFolderConfirm")
      .replace("{name}", target.name)
      .replace("{items}", String(target.itemCount))
      .replace("{folders}", String(target.childFolderCount))
    if (!(await appConfirm(message))) return
    try {
      await api.categories.delete(target.id)
      if (currentFolderId === target.id) navigateToFolder(parentId)
      loadCategories()
      refresh()
    } catch {}
  }

  // Move single item
  const handleMoveToCategory = async (mangaId: number, categoryId: number | null) => {
    try {
      await api.manga.update(mangaId, { category_id: categoryId })
      refresh()
      loadCategories()
    } catch {}
  }

  // DnD move (sidebar/folder drop)
  const handleDndMoveToCategory = async (payload: DragPayload, categoryId: number | null) => {
    const validIds = payload.ids.filter((id) => items.some((item) => item.id === id && (item.category_id ?? null) !== categoryId))
    if (validIds.length === 0) return
    try {
      await api.manga.bulkMove(validIds, categoryId)
      selection.clearSelection()
      refresh()
      loadCategories()
    } catch {}
  }

  // Merge: card-to-card drop
  const handleMergeDrop = async (targetId: number, payload: DragPayload) => {
    const ids = Array.from(new Set([...payload.ids, targetId])).filter((id) => items.some((item) => item.id === id))
    if (ids.length < 2) return
    const name = await requestFolderName(t("folderNameForSelected").replace("{count}", String(ids.length)), t("newFolder"))
    if (!name) return
    const confirmedIds = ids.filter((id) => items.some((item) => item.id === id))
    if (confirmedIds.length < 2) return
    try {
      const cat = await api.categories.create({ name, media_type: "manga", parent_id: currentFolderId })
      await api.manga.bulkMove(confirmedIds, cat.id)
      selection.clearSelection()
      refresh()
      loadCategories()
    } catch {}
  }

  // Bulk move
  const handleBulkMove = async (categoryId: number | null) => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    try {
      await api.manga.bulkMove(ids, categoryId)
      selection.clearSelection()
      refresh()
      loadCategories()
    } catch {}
  }

  // Bulk delete
  const handleBulkDelete = async () => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    if (!await appConfirm(t("confirmRemoveMangaFromLibrary").replace("{count}", String(ids.length)))) return
    const confirmedIds = selection.getValidSelectedIds()
    if (confirmedIds.length === 0) return
    try {
      await api.manga.removeFromLibrary(confirmedIds)
      selection.clearSelection()
      refresh()
    } catch {}
  }

  const handleCreateFolderFromSelection = async () => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    const name = await requestFolderName(t("folderName"), t("newFolder"))
    if (!name) return
    const confirmedIds = selection.getValidSelectedIds()
    if (confirmedIds.length === 0) return
    try {
      const cat = await api.categories.create({ name, media_type: "manga", parent_id: currentFolderId })
      await api.manga.bulkMove(confirmedIds, cat.id)
      selection.clearSelection()
      refresh()
      loadCategories()
    } catch {}
  }

  const renderMangaCard = (manga: MangaItem) => (
    <MangaCard
      manga={manga}
      onClick={() => router.push(`/manga/${manga.id}`)}
      onDelete={handleDelete}
      onChangeThumbnail={handleChangeThumbnail}
      selectable
      selected={selection.selectedIds.has(manga.id)}
      onSelect={(checked) => selection.handleCheckboxSelect(manga.id, checked)}
      onSelectionClick={(event) => selection.handleItemClick(manga.id, event)}
      getDragIds={() => selection.getDragIds(manga.id)}
      sourceSurface="manga"
      categories={categories}
      onMoveToCategory={(catId) => handleMoveToCategory(manga.id, catId)}
      onMergeDrop={(payload) => handleMergeDrop(manga.id, payload)}
    />
  )

  return (
    <div
      data-testid="manga-drop-surface"
      className="flex-1 flex flex-col min-h-0 relative"
      tabIndex={0}
      onMouseDown={selection.handleBlankMouseDown}
      onKeyDown={selection.handleKeyDown}
      onDragEnter={handleExternalDragEnter}
      onDragLeave={handleExternalDragLeave}
      onDragOver={handleExternalDragOver}
      onDrop={handleExternalDrop}
    >
      {(isDropOver || dropImporting) && (
        <div className="absolute inset-0 z-50 bg-accent/10 backdrop-blur-sm border-2 border-dashed border-accent rounded-xl flex flex-col items-center justify-center gap-3 pointer-events-none">
          {dropImporting ? <Loader2Icon className="size-10 animate-spin text-accent" /> : <UploadIcon className="size-10 text-accent" />}
          <p className="text-base font-semibold text-accent">{t("dropMediaToImport")}</p>
          <p className="text-sm text-text-secondary">{t("dropMediaHint")}</p>
        </div>
      )}

      {folderNameDialog && (
        <FolderNameDialog request={folderNameDialog} onClose={closeFolderNameDialog} />
      )}
      {folderContextMenu && (
        <FolderContextMenu
          target={folderContextMenu}
          onClose={() => setFolderContextMenu(null)}
          onRename={handleRenameFolder}
          onRemove={handleRemoveFolder}
        />
      )}

      <LibrarySurfaceHeader
        className="px-6 pb-4 pt-6"
        icon={<BookOpenIcon className="size-6" />}
        title={t("manga")}
        meta={`${items.length}${t("mangaWorks")}`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("mangaSearchPlaceholder")}
        clearSearchLabel={t("clearSearch")}
        onClearSearch={search ? () => setSearch("") : undefined}
        primaryAction={
          <Button size="lg" onClick={() => setScrapeOpen(true)}>
            <PlusIcon className="size-4" />
            {t("mangaScrape")}
          </Button>
        }
      />

      {/* Selection bar */}
      {selection.selectedCount > 0 && (
        <div className="px-6">
          <SelectionBar
            selectedCount={selection.selectedCount}
            categories={categories}
            onBulkMove={handleBulkMove}
            onCreateFolderFromSelection={handleCreateFolderFromSelection}
            onBulkDelete={handleBulkDelete}
            onDeselectAll={selection.clearSelection}
            removeActionKind="remove-from-library"
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2Icon className="size-6 animate-spin text-accent" />
          </div>
        ) : search ? (
          // Search view: flat list across all folders
          <div className="flex-1 overflow-y-auto min-h-0" onMouseDown={selection.handleBlankMouseDown}>
            {items.length === 0 ? (
              <LibraryEmptyState icon={<BookOpenIcon />} title={t("mangaNoResults")} />
            ) : (
              <div className="explorer-tile-grid" onMouseDown={selection.handleBlankMouseDown}>
                {items.map((manga) => (
                  <div key={manga.id}>{renderMangaCard(manga)}</div>
                ))}
              </div>
            )}
          </div>
        ) : items.length === 0 ? (
          <LibraryEmptyState icon={<BookOpenIcon />} title={t("mangaEmpty")}>
            <Button variant="secondary" size="sm" onClick={() => setScrapeOpen(true)}>
              <PlusIcon className="size-4" />
              {t("mangaScrapeFirst")}
            </Button>
          </LibraryEmptyState>
        ) : (
          <FolderExplorer<MangaItem>
            categories={categories}
            items={items}
            currentFolderId={currentFolderId}
            onNavigate={navigateToFolder}
            onCreateFolder={handleCreateFolder}
            onDropItemsToFolder={handleDndMoveToCategory}
            acceptDropType="manga"
            onFolderContextMenu={openFolderContextMenu}
            folderPreviewAspect="panel"
            onBlankMouseDown={selection.handleBlankMouseDown}
            renderItem={renderMangaCard}
          />
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

export default function MangaLibraryPage() {
  return (
    <Suspense>
      <MangaLibraryPageContent />
    </Suspense>
  )
}
