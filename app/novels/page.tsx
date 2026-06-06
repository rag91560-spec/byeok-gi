"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BookTextIcon, Loader2Icon, PlusIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FolderContextMenu, type FolderContextMenuTarget } from "@/components/media-grid/FolderContextMenu"
import { FolderExplorer } from "@/components/media-grid/FolderExplorer"
import { FolderNameDialog, useFolderNameDialog } from "@/components/media-grid/FolderNameDialog"
import { LibraryEmptyState } from "@/components/media-grid/LibraryEmptyState"
import { LibrarySurfaceHeader } from "@/components/media-grid/LibrarySurfaceHeader"
import { RecentShelf } from "@/components/media-grid/RecentShelf"
import { SelectionBar } from "@/components/media-grid/SelectionBar"
import { NovelCard } from "@/components/novels/NovelCard"
import { NovelReader } from "@/components/novels/NovelReader"
import { useLocale } from "@/hooks/use-locale"
import { useNovelLibrary } from "@/hooks/use-novels"
import { MEDIA_DND_MIME, hasExternalFiles, type DragPayload } from "@/hooks/use-media-dnd"
import { useOsSelection } from "@/hooks/use-os-selection"
import { api } from "@/lib/api"
import {
  NOVEL_DROP_EXTENSIONS,
  NOVEL_READABLE_EXTENSIONS,
  emptyDropImportSummary,
  formatDropImportSummary,
  getDroppedFilePath,
  getPathBaseName,
  getPathExtension,
  getPathTitle,
  isDuplicateImportError,
  isLikelyFolderDrop,
  type DropImportSummary,
} from "@/lib/external-drop-import"
import { parseNovelRichText, serializeNovelContentStyle } from "@/lib/novel-rich-text"
import { appConfirm } from "@/lib/utils"
import type { MediaCategory, NovelImportPathInput, NovelImportResult, NovelItem } from "@/lib/types"

const ACCEPTED_NOVEL_FILES = Array.from(NOVEL_DROP_EXTENSIONS).join(",")
const MAX_CACHED_TEXT_CHARS = 1_000_000

type SortMode = "recent" | "title" | "progress" | "added"

function addSummary(target: DropImportSummary, source?: Partial<DropImportSummary>) {
  if (!source) return
  target.success += source.success ?? 0
  target.duplicates += source.duplicates ?? 0
  target.unsupported += source.unsupported ?? 0
  target.failed += source.failed ?? 0
}

function dateValue(value?: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function sortNovels(items: NovelItem[], sort: SortMode) {
  const next = [...items]
  if (sort === "title") {
    return next.sort((a, b) => a.title.localeCompare(b.title))
  }
  if (sort === "progress") {
    return next.sort((a, b) => (b.read_progress || 0) - (a.read_progress || 0) || b.id - a.id)
  }
  if (sort === "added") {
    return next.sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at))
  }
  return next.sort((a, b) => {
    const aRecent = dateValue(a.last_opened_at) || dateValue(a.updated_at) || dateValue(a.created_at)
    const bRecent = dateValue(b.last_opened_at) || dateValue(b.updated_at) || dateValue(b.created_at)
    return bRecent - aRecent
  })
}

function isSupportedNovel(file: File, label: string) {
  const extension = getPathExtension(label)
  return NOVEL_DROP_EXTENSIONS.has(extension) || file.type.startsWith("text/")
}

function isReadableNovel(file: File, extension: string) {
  return NOVEL_READABLE_EXTENSIONS.has(extension) || file.type.startsWith("text/")
}

function buildSampleNovel() {
  const content = [
    "제목: 푸른 창 아래의 번역가",
    "",
    "1장",
    "",
    "비 오는 밤, 오래된 게임 런처의 목록 사이에 이름 없는 텍스트 파일 하나가 조용히 추가되었다.",
    "그 파일은 게임도, 영상도, 음악도 아니었다. 하지만 누군가에게는 다음에 읽을 세계였다.",
    "",
    "주인공은 첫 문장을 읽고 북마크를 남겼다.",
    "원본 파일은 그대로 두고, 라이브러리 안에서만 새로운 위치를 얻었다.",
  ].join("\n")
  return {
    title: "푸른 창 아래의 번역가",
    file_name: "sample-blue-window-translator.txt",
    extension: ".txt",
    content,
    preview: "비 오는 밤, 오래된 게임 런처의 목록 사이에 이름 없는 텍스트 파일 하나가 조용히 추가되었다.",
    size: new Blob([content]).size,
    metadata_only: false,
    translation_status: "original" as const,
  }
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function NovelLibraryPageContent() {
  const { t } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const folderParam = searchParams.get("folder")
  const currentFolderId: number | null = folderParam ? parseInt(folderParam, 10) : null
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("recent")
  const [categories, setCategories] = useState<MediaCategory[]>([])
  const [importing, setImporting] = useState(false)
  const [isDropOver, setIsDropOver] = useState(false)
  const [readerItem, setReaderItem] = useState<NovelItem | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuTarget | null>(null)
  const { folderNameDialog, requestFolderName, closeFolderNameDialog } = useFolderNameDialog()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const externalDropCounterRef = useRef(0)
  const { items, loading, error, refresh } = useNovelLibrary(search)

  const navigateToFolder = useCallback((id: number | null) => {
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    if (id === null) sp.delete("folder")
    else sp.set("folder", String(id))
    const qs = sp.toString()
    router.replace(qs ? `/novels?${qs}` : "/novels")
  }, [router, searchParams])

  const loadCategories = useCallback(() => {
    api.categories.list("novels").then(setCategories).catch((err) => {
      console.error("Load novel categories failed:", err)
    })
  }, [])

  const showActionError = useCallback((err: unknown) => {
    alert(t("novelActionFailed").replace("{error}", errorText(err)))
  }, [t])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const sortedItems = useMemo(() => sortNovels(items, sortMode), [items, sortMode])
  const continueReading = useMemo(() => (
    sortNovels(items.filter((item) => item.read_progress > 0 || item.last_opened_at), "recent").slice(0, 6)
  ), [items])

  const visibleNovelIds = useMemo(() => {
    if (search) return sortedItems.map((item) => item.id)
    const folderIds = sortedItems
      .filter((item) => (item.category_id ?? null) === currentFolderId)
      .map((item) => item.id)
    if (currentFolderId !== null) return folderIds
    return Array.from(new Set([
      ...folderIds,
      ...continueReading.map((item) => item.id),
    ]))
  }, [continueReading, currentFolderId, search, sortedItems])
  const selection = useOsSelection(visibleNovelIds)

  const showShelves = !search.trim() && currentFolderId === null && items.length > 0

  const showSummary = useCallback((summary: DropImportSummary) => {
    alert(`${t("novelImportComplete")}\n${formatDropImportSummary(t, summary)}`)
  }, [t])

  const handleImportResult = useCallback((result: NovelImportResult, summary: DropImportSummary) => {
    addSummary(summary, result.summary)
  }, [])

  const importPaths = useCallback(async (paths: NovelImportPathInput[]) => {
    const validPaths = paths.filter((item) => item.path)
    if (validPaths.length === 0) return
    const summary = emptyDropImportSummary()
    setImporting(true)
    try {
      const result = await api.novels.importPaths(validPaths, currentFolderId)
      handleImportResult(result, summary)
      await refresh()
      loadCategories()
      showSummary(summary)
    } catch (err) {
      alert(t("novelImportFailed").replace("{error}", errorText(err)))
    } finally {
      setImporting(false)
    }
  }, [currentFolderId, handleImportResult, loadCategories, refresh, showSummary, t])

  const importFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const summary = emptyDropImportSummary()
    setImporting(true)
    try {
      for (const file of files) {
        const path = getDroppedFilePath(file)
        const label = path || file.name
        if (isLikelyFolderDrop(file, path)) {
          summary.failed += 1
          continue
        }

        if (!isSupportedNovel(file, label)) {
          summary.unsupported += 1
          continue
        }

        const extension = getPathExtension(label)
        const readable = isReadableNovel(file, extension)
        let content = ""
        let preview = ""
        let metadataOnly = !readable
        if (readable) {
          let rawContent = ""
          try {
            rawContent = (await file.text()).slice(0, MAX_CACHED_TEXT_CHARS)
          } catch {
            summary.failed += 1
            continue
          }
          const parsed = parseNovelRichText(rawContent, extension)
          content = parsed.content
          preview = content.replace(/\s+/g, " ").trim().slice(0, 240)
          metadataOnly = content.length === 0
          try {
            await api.novels.add({
              title: getPathTitle(label),
              file_name: getPathBaseName(label),
              extension,
              size: file.size,
              content,
              preview,
              metadata_only: metadataOnly,
              category_id: currentFolderId,
              translation_status: "original",
              content_style_json: serializeNovelContentStyle(parsed.contentStyle),
            })
            summary.success += 1
          } catch (err) {
            if (isDuplicateImportError(err)) summary.duplicates += 1
            else summary.failed += 1
          }
          continue
        }
        try {
          await api.novels.add({
            title: getPathTitle(label),
            file_name: getPathBaseName(label),
            extension,
            size: file.size,
            content,
            preview,
            metadata_only: metadataOnly,
            category_id: currentFolderId,
            translation_status: "original",
          })
          summary.success += 1
        } catch (err) {
          if (isDuplicateImportError(err)) summary.duplicates += 1
          else summary.failed += 1
        }
      }
      await refresh()
      loadCategories()
      showSummary(summary)
    } finally {
      setImporting(false)
    }
  }, [currentFolderId, loadCategories, refresh, showSummary])

  const handleAddClick = useCallback(async () => {
    if (window.electronAPI?.selectNovelFiles) {
      try {
        const selected = await window.electronAPI.selectNovelFiles()
        const paths = selected.map((item) => (typeof item === "string" ? { path: item } : item))
        await importPaths(paths)
      } catch (err) {
        alert(t("novelImportFailed").replace("{error}", errorText(err)))
      }
      return
    }
    fileInputRef.current?.click()
  }, [importPaths, t])

  const isExternalImportDrag = useCallback((event: DragEvent) => {
    return hasExternalFiles(event) && !Array.from(event.dataTransfer.types).includes(MEDIA_DND_MIME)
  }, [])

  const handleExternalDragEnter = useCallback((event: DragEvent) => {
    if (!isExternalImportDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    externalDropCounterRef.current += 1
    setIsDropOver(true)
  }, [isExternalImportDrag])

  const handleExternalDragLeave = useCallback((event: DragEvent) => {
    if (!isExternalImportDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    externalDropCounterRef.current -= 1
    if (externalDropCounterRef.current <= 0) {
      externalDropCounterRef.current = 0
      setIsDropOver(false)
    }
  }, [isExternalImportDrag])

  const handleExternalDragOver = useCallback((event: DragEvent) => {
    if (!isExternalImportDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "copy"
  }, [isExternalImportDrag])

  const handleExternalDrop = useCallback((event: DragEvent) => {
    if (!isExternalImportDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    setIsDropOver(false)
    externalDropCounterRef.current = 0
    void importFiles(Array.from(event.dataTransfer.files))
  }, [importFiles, isExternalImportDrag])

  const handleCreateFolder = useCallback(async (name: string, parentId: number | null) => {
    try {
      await api.categories.create({ name, media_type: "novels", parent_id: parentId })
      loadCategories()
    } catch (err) {
      alert(t("folderCreateFailed").replace("{error}", errorText(err)))
    }
  }, [loadCategories, t])

  const openFolderContextMenu = useCallback((folderId: number, event: React.MouseEvent) => {
    const category = categories.find((item) => item.id === folderId)
    if (!category) return
    setFolderContextMenu({
      id: category.id,
      name: category.name,
      x: event.clientX,
      y: event.clientY,
      itemCount: items.filter((item) => item.category_id === folderId).length,
      childFolderCount: categories.filter((child) => child.parent_id === folderId).length,
    })
  }, [categories, items])

  const handleRenameFolder = useCallback(async (target: FolderContextMenuTarget) => {
    setFolderContextMenu(null)
    const name = await requestFolderName(t("renameFolder"), target.name)
    if (!name || name.trim() === target.name) return
    try {
      await api.categories.update(target.id, { name: name.trim() })
      loadCategories()
    } catch (err) {
      showActionError(err)
    }
  }, [loadCategories, requestFolderName, showActionError, t])

  const handleRemoveFolder = useCallback(async (target: FolderContextMenuTarget) => {
    setFolderContextMenu(null)
    const category = categories.find((item) => item.id === target.id)
    const parentId = category?.parent_id ?? null
    const message = t("removeFolderConfirm")
      .replace("{name}", target.name)
      .replace("{items}", String(target.itemCount))
      .replace("{folders}", String(target.childFolderCount))
    if (!(await appConfirm(message))) return
    try {
      await api.categories.delete(target.id)
      if (currentFolderId === target.id) navigateToFolder(parentId)
      loadCategories()
      await refresh()
    } catch (err) {
      showActionError(err)
    }
  }, [categories, currentFolderId, loadCategories, navigateToFolder, refresh, showActionError, t])

  const handleMoveToCategory = useCallback(async (novelId: number, categoryId: number | null) => {
    try {
      await api.novels.update(novelId, { category_id: categoryId })
      await refresh()
      loadCategories()
    } catch (err) {
      showActionError(err)
    }
  }, [loadCategories, refresh, showActionError])

  const handleDndMoveToCategory = useCallback(async (payload: DragPayload, categoryId: number | null) => {
    const validIds = payload.ids.filter((id) => items.some((item) => item.id === id && (item.category_id ?? null) !== categoryId))
    if (validIds.length === 0) return
    try {
      await api.novels.bulkMove(validIds, categoryId)
      selection.clearSelection()
      await refresh()
      loadCategories()
    } catch (err) {
      showActionError(err)
    }
  }, [items, loadCategories, refresh, selection, showActionError])

  const handleMergeDrop = useCallback(async (targetId: number, payload: DragPayload) => {
    const ids = Array.from(new Set([...payload.ids, targetId])).filter((id) => items.some((item) => item.id === id))
    if (ids.length < 2) return
    const name = await requestFolderName(t("folderNameForSelected").replace("{count}", String(ids.length)), t("newFolder"))
    if (!name) return
    const confirmedIds = ids.filter((id) => items.some((item) => item.id === id))
    if (confirmedIds.length < 2) return
    try {
      const category = await api.categories.create({ name, media_type: "novels", parent_id: currentFolderId })
      await api.novels.bulkMove(confirmedIds, category.id)
      selection.clearSelection()
      await refresh()
      loadCategories()
    } catch (err) {
      showActionError(err)
    }
  }, [currentFolderId, items, loadCategories, refresh, requestFolderName, selection, showActionError, t])

  const handleBulkMove = useCallback(async (categoryId: number | null) => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    try {
      await api.novels.bulkMove(ids, categoryId)
      selection.clearSelection()
      await refresh()
      loadCategories()
    } catch (err) {
      showActionError(err)
    }
  }, [loadCategories, refresh, selection, showActionError])

  const handleBulkDelete = useCallback(async () => {
    const count = selection.getValidSelectedIds().length
    if (count === 0) return
    if (!(await appConfirm(t("novelRemoveConfirm").replace("{count}", String(count))))) return
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    try {
      await api.novels.removeFromLibrary(ids)
      selection.clearSelection()
      await refresh()
    } catch (err) {
      showActionError(err)
    }
  }, [refresh, selection, showActionError, t])

  const handleRemoveOne = useCallback(async (id: number) => {
    if (!(await appConfirm(t("novelRemoveConfirm").replace("{count}", "1")))) return
    try {
      await api.novels.removeFromLibrary(id)
      if (readerItem?.id === id) setReaderItem(null)
      await refresh()
    } catch (err) {
      showActionError(err)
    }
  }, [readerItem?.id, refresh, showActionError, t])

  const handleCreateFolderFromSelection = useCallback(async () => {
    const count = selection.getValidSelectedIds().length
    if (count === 0) return
    const name = await requestFolderName(t("folderNameForSelected").replace("{count}", String(count)), t("newFolder"))
    if (!name) return
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    try {
      const category = await api.categories.create({ name, media_type: "novels", parent_id: currentFolderId })
      await api.novels.bulkMove(ids, category.id)
      selection.clearSelection()
      await refresh()
      loadCategories()
    } catch (err) {
      showActionError(err)
    }
  }, [currentFolderId, loadCategories, refresh, requestFolderName, selection, showActionError, t])

  const handleAddSample = useCallback(async () => {
    setImporting(true)
    try {
      await api.novels.add({ ...buildSampleNovel(), category_id: currentFolderId })
      await refresh()
    } catch (err) {
      alert(t("novelImportFailed").replace("{error}", errorText(err)))
    } finally {
      setImporting(false)
    }
  }, [currentFolderId, refresh, t])

  const renderNovelCard = useCallback((novel: NovelItem) => (
    <NovelCard
      novel={novel}
      onOpen={() => setReaderItem(novel)}
      onRemove={handleRemoveOne}
      selectable
      selected={selection.selectedIds.has(novel.id)}
      onSelect={(checked) => selection.handleCheckboxSelect(novel.id, checked)}
      onSelectionClick={(event) => selection.handleItemClick(novel.id, event)}
      getDragIds={() => selection.getDragIds(novel.id)}
      sourceSurface="novels"
      categories={categories}
      onMoveToCategory={(categoryId) => handleMoveToCategory(novel.id, categoryId)}
      onMergeDrop={(payload) => handleMergeDrop(novel.id, payload)}
    />
  ), [categories, handleMergeDrop, handleMoveToCategory, handleRemoveOne, selection])

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-testid="novels-drop-surface"
      tabIndex={0}
      onMouseDown={selection.handleBlankMouseDown}
      onKeyDown={selection.handleKeyDown}
      onDragEnter={handleExternalDragEnter}
      onDragLeave={handleExternalDragLeave}
      onDragOver={handleExternalDragOver}
      onDrop={handleExternalDrop}
    >
      {(isDropOver || importing) && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-sm">
          {importing ? <Loader2Icon className="size-10 animate-spin text-accent" /> : <UploadIcon className="size-10 text-accent" />}
          <p className="text-base font-semibold text-accent">{t("novelDropTitle")}</p>
          <p className="text-sm text-text-secondary">{t("novelDropHint")}</p>
        </div>
      )}

      {folderNameDialog && <FolderNameDialog request={folderNameDialog} onClose={closeFolderNameDialog} />}
      {folderContextMenu && (
        <FolderContextMenu
          target={folderContextMenu}
          onClose={() => setFolderContextMenu(null)}
          onRename={handleRenameFolder}
          onRemove={handleRemoveFolder}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_NOVEL_FILES}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ""
          void importFiles(files)
        }}
      />

      <LibrarySurfaceHeader
        className="px-6 pb-4 pt-6"
        icon={<BookTextIcon className="size-6" />}
        title={t("novelLibraryTitle")}
        meta={`${items.length}${t("novelWorks")}`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("novelSearchPlaceholder")}
        clearSearchLabel={t("clearSearch")}
        onClearSearch={search ? () => setSearch("") : undefined}
        filterSlot={
          <label className="flex h-11 min-w-[184px] items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-secondary">
            <span className="shrink-0">{t("sortBy")}</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.currentTarget.value as SortMode)}
              className="min-w-0 flex-1 bg-surface-elevated text-text-primary [color-scheme:dark] focus:outline-none"
            >
              <option className="bg-surface text-text-primary" value="recent">{t("sortRecent")}</option>
              <option className="bg-surface text-text-primary" value="title">{t("sortTitle")}</option>
              <option className="bg-surface text-text-primary" value="progress">{t("sortProgress")}</option>
              <option className="bg-surface text-text-primary" value="added">{t("sortAdded")}</option>
            </select>
          </label>
        }
        secondaryActions={
          <Button variant="secondary" size="lg" onClick={handleAddSample} disabled={importing}>
            <BookTextIcon className="size-4" />
            {t("addSampleNovel")}
          </Button>
        }
        primaryAction={
          <Button size="lg" onClick={handleAddClick} loading={importing}>
            <PlusIcon className="size-4" />
            {t("addNovelFiles")}
          </Button>
        }
      />

      {selection.selectedCount > 0 && (
        <div className="shrink-0 px-6 pb-3">
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

      <div className="min-h-0 flex-1 px-6 pb-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2Icon className="size-7 animate-spin text-accent" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</div>
        ) : search ? (
          <div className="h-full overflow-y-auto" onMouseDown={selection.handleBlankMouseDown}>
            {sortedItems.length === 0 ? (
              <EmptyNovels onAdd={handleAddClick} onAddSample={handleAddSample} />
            ) : (
              <div className="explorer-tile-grid" onMouseDown={selection.handleBlankMouseDown}>
                {sortedItems.map((novel) => <div key={novel.id}>{renderNovelCard(novel)}</div>)}
              </div>
            )}
          </div>
        ) : sortedItems.length === 0 && categories.length === 0 ? (
          <EmptyNovels onAdd={handleAddClick} onAddSample={handleAddSample} />
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-4">
            {showShelves && (
              <>
                {continueReading.length > 0 && (
                  <RecentShelf title={t("continueReading")} subtitle={t("continueReadingSubtitle")} icon={<BookTextIcon className="size-4" />}>
                    {continueReading.map((novel) => <div key={novel.id}>{renderNovelCard(novel)}</div>)}
                  </RecentShelf>
                )}
              </>
            )}
            <div className="min-h-0 flex-1">
              <FolderExplorer<NovelItem>
                categories={categories}
                items={sortedItems}
                currentFolderId={currentFolderId}
                onNavigate={navigateToFolder}
                onCreateFolder={handleCreateFolder}
                onDropItemsToFolder={handleDndMoveToCategory}
                acceptDropType="novel"
                onFolderContextMenu={openFolderContextMenu}
                folderPreviewAspect="panel"
                onBlankMouseDown={selection.handleBlankMouseDown}
                renderItem={renderNovelCard}
                emptyState={<EmptyFolder onAdd={handleAddClick} />}
              />
            </div>
          </div>
        )}
      </div>

      {readerItem && (
        <NovelReader
          novel={readerItem}
          onClose={() => {
            setReaderItem(null)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

function EmptyNovels({ onAdd, onAddSample }: { onAdd: () => void; onAddSample: () => void }) {
  const { t } = useLocale()
  return (
    <LibraryEmptyState
      icon={<BookTextIcon />}
      title={t("noNovels")}
    >
      <Button variant="secondary" size="sm" onClick={onAddSample}>
        <BookTextIcon className="size-4" />
        {t("addSampleNovel")}
      </Button>
      <Button variant="secondary" size="sm" onClick={onAdd}>
        <PlusIcon className="size-4" />
        {t("addNovelFiles")}
      </Button>
    </LibraryEmptyState>
  )
}

function EmptyFolder({ onAdd }: { onAdd: () => void }) {
  const { t } = useLocale()
  return (
    <LibraryEmptyState icon={<BookTextIcon />} title={t("emptyFolder")}>
      <Button variant="secondary" size="sm" onClick={onAdd}>
        <PlusIcon className="size-4" />
        {t("addNovelFiles")}
      </Button>
    </LibraryEmptyState>
  )
}

export default function NovelsPage() {
  return (
    <Suspense>
      <NovelLibraryPageContent />
    </Suspense>
  )
}
