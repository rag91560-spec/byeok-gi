"use client"

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Loader2Icon,
  FilmIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { useOsSelection } from "@/hooks/use-os-selection"
import { MEDIA_DND_MIME, hasExternalFiles } from "@/hooks/use-media-dnd"
import { api } from "@/lib/api"
import type { VideoItem, MediaCategory } from "@/lib/types"
import { appConfirm } from "@/lib/utils"
import {
  VIDEO_DROP_EXTENSIONS,
  emptyDropImportSummary,
  formatDropImportSummary,
  getDroppedFilePath,
  getPathExtension,
  getPathTitle,
  isDuplicateImportError,
  isLikelyFolderDrop,
} from "@/lib/external-drop-import"
import { MediaCard } from "@/components/media-grid/MediaCard"
import { LibraryEmptyState } from "@/components/media-grid/LibraryEmptyState"
import { LibrarySurfaceHeader } from "@/components/media-grid/LibrarySurfaceHeader"
import { SelectionBar } from "@/components/media-grid/SelectionBar"
import { FolderExplorer } from "@/components/media-grid/FolderExplorer"
import { FolderNameDialog, useFolderNameDialog } from "@/components/media-grid/FolderNameDialog"
import { FolderContextMenu, type FolderContextMenuTarget } from "@/components/media-grid/FolderContextMenu"
import { StandaloneVideoPlayer } from "@/components/videos/StandaloneVideoPlayer"
import { SubtitleWorkspace } from "@/components/subtitle/SubtitleWorkspace"

function VideosPageContent() {
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
    router.replace(qs ? `/videos?${qs}` : "/videos")
  }, [router, searchParams])

  const [videos, setVideos] = useState<VideoItem[]>([])
  const [categories, setCategories] = useState<MediaCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null)
  const [search, setSearch] = useState("")
  const [thumbnailTargetId, setThumbnailTargetId] = useState<number | null>(null)
  const [subtitleVideo, setSubtitleVideo] = useState<VideoItem | null>(null)
  const [isDropOver, setIsDropOver] = useState(false)
  const [dropImporting, setDropImporting] = useState(false)
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuTarget | null>(null)
  const { folderNameDialog, requestFolderName, closeFolderNameDialog } = useFolderNameDialog()
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const externalDropCounterRef = useRef(0)

  const loadData = useCallback(async () => {
    try {
      const [list, cats] = await Promise.all([
        api.videos.list(),
        api.categories.list("video"),
      ])
      setVideos(list)
      setCategories(cats)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    if (!search) return videos
    const s = search.toLowerCase()
    return videos.filter((v) => v.title.toLowerCase().includes(s))
  }, [videos, search])
  const visibleVideoIds = useMemo(() => {
    const visible = search
      ? filtered
      : videos.filter((v) => (v.category_id ?? null) === currentFolderId)
    return visible.map((v) => v.id)
  }, [currentFolderId, filtered, search, videos])
  const selection = useOsSelection(visibleVideoIds)

  const handleDelete = async (id: number) => {
    if (!await appConfirm(t("confirmRemoveVideoFromLibrary").replace("{count}", "1"))) return
    try {
      await api.videos.removeFromLibrary(id)
      setVideos((prev) => prev.filter((v) => v.id !== id))
      if (playingVideo?.id === id) setPlayingVideo(null)
    } catch {}
  }

  const handleAddFiles = async () => {
    if (!window.electronAPI?.selectVideoFiles) {
      alert(t("electronOnlyFeature"))
      return
    }
    const filePaths = await window.electronAPI.selectVideoFiles()
    if (!filePaths?.length) return
    setScanning(true)
    try {
      const created: VideoItem[] = []
      for (const filePath of filePaths) {
        const name = filePath.split(/[\\/]/).pop() || filePath
        const item = await api.videos.add({
          title: name,
          type: "local",
          source: filePath,
          category_id: currentFolderId,
        })
        created.push(item)
      }
      if (created.length > 0) {
        setVideos((prev) => [...created, ...prev])
      }
    } catch (err) {
      console.error("File add failed:", err)
      alert(t("folderScanFailed").replace("{error}", err instanceof Error ? err.message : String(err)))
    } finally {
      setScanning(false)
    }
  }

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
    const created: VideoItem[] = []
    let shouldRefreshCategories = false
    setDropImporting(true)

    for (const file of dropped) {
      const path = getDroppedFilePath(file)
      const label = path || file.name
      const ext = getPathExtension(label)

      if (isLikelyFolderDrop(file, path)) {
        try {
          const result = await api.videos.scanFolder(path, {
            parentCategoryId: currentFolderId,
            preserveStructure: true,
          })
          created.push(...result.created_items)
          summary.success += result.created_items.length
          if (result.created_categories.length > 0) shouldRefreshCategories = true
          if (result.total === 0) summary.unsupported += 1
        } catch (error) {
          if (isDuplicateImportError(error)) summary.duplicates += 1
          else summary.failed += 1
        }
        continue
      }

      if (!VIDEO_DROP_EXTENSIONS.has(ext) && !file.type.startsWith("video/")) {
        summary.unsupported += 1
        continue
      }

      try {
        let item = path
          ? await api.videos.add({
              title: getPathTitle(path),
              type: "local",
              source: path,
              category_id: currentFolderId,
            })
          : await api.videos.addFile(file)
        if (!path && currentFolderId !== null) {
          item = await api.videos.update(item.id, { category_id: currentFolderId })
        }
        created.push(item)
        summary.success += 1
      } catch (error) {
        if (isDuplicateImportError(error)) summary.duplicates += 1
        else summary.failed += 1
      }
    }

    if (created.length > 0) {
      setVideos((prev) => [...created, ...prev])
    }
    if (shouldRefreshCategories) {
      api.categories.list("video").then(setCategories).catch(() => {})
    }
    setDropImporting(false)
    alert(formatDropImportSummary(t, summary))
  }, [currentFolderId, isExternalImportDrag, t])

  const handleMoveToCategory = async (videoId: number, categoryId: number | null) => {
    try {
      const updated = await api.videos.update(videoId, { category_id: categoryId })
      setVideos((prev) => prev.map((v) => v.id === videoId ? updated : v))
    } catch {}
  }

  const handleBulkMove = async (categoryId: number | null) => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    try {
      await api.videos.bulkMove(ids, categoryId)
      setVideos((prev) => prev.map((v) =>
        ids.includes(v.id) ? { ...v, category_id: categoryId } : v
      ))
      selection.clearSelection()
      api.categories.list("video").then(setCategories).catch(() => {})
    } catch {}
  }

  const handleBulkDelete = async () => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    if (!await appConfirm(t("confirmRemoveVideoFromLibrary").replace("{count}", String(ids.length)))) return
    const confirmedIds = selection.getValidSelectedIds()
    if (confirmedIds.length === 0) return
    try {
      await api.videos.removeFromLibrary(confirmedIds)
      setVideos((prev) => prev.filter((v) => !confirmedIds.includes(v.id)))
      selection.clearSelection()
    } catch {}
  }

  const handleDndMoveToCategory = async (payload: { ids: number[] }, categoryId: number | null) => {
    const ids = payload.ids.filter((id) => videos.some((item) => item.id === id && (item.category_id ?? null) !== categoryId))
    if (ids.length === 0) return
    await api.videos.bulkMove(ids, categoryId)
    setVideos((prev) => prev.map((v) =>
      ids.includes(v.id) ? { ...v, category_id: categoryId } : v
    ))
    selection.clearSelection()
    handleCategoriesRefresh()
  }

  const handleMergeDrop = async (targetId: number, payload: { ids: number[] }) => {
    const ids = Array.from(new Set([...payload.ids, targetId])).filter((id) => videos.some((item) => item.id === id))
    if (ids.length < 2) return
    const name = await requestFolderName(t("folderNameForSelected").replace("{count}", String(ids.length)), t("newFolder"))
    if (!name) return
    const confirmedIds = ids.filter((id) => videos.some((item) => item.id === id))
    if (confirmedIds.length < 2) return
    try {
      const cat = await api.categories.create({ name, media_type: "video", parent_id: currentFolderId })
      await api.videos.bulkMove(confirmedIds, cat.id)
      setVideos((prev) => prev.map((v) =>
        confirmedIds.includes(v.id) ? { ...v, category_id: cat.id } : v
      ))
      selection.clearSelection()
      handleCategoriesRefresh()
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
      const cat = await api.categories.create({ name, media_type: "video", parent_id: currentFolderId })
      await api.videos.bulkMove(confirmedIds, cat.id)
      setVideos((prev) => prev.map((v) =>
        confirmedIds.includes(v.id) ? { ...v, category_id: cat.id } : v
      ))
      selection.clearSelection()
      handleCategoriesRefresh()
    } catch {}
  }

  const handleCategoriesRefresh = () => {
    api.categories.list("video").then(setCategories).catch(() => {})
  }

  const handleCreateFolder = async (name: string, parentId: number | null) => {
    try {
      await api.categories.create({ name, media_type: "video", parent_id: parentId })
      const cats = await api.categories.list("video")
      setCategories(cats)
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
      itemCount: videos.filter((item) => item.category_id === folderId).length,
      childFolderCount: categories.filter((child) => child.parent_id === folderId).length,
    })
  }

  const handleRenameFolder = async (target: FolderContextMenuTarget) => {
    setFolderContextMenu(null)
    const name = await requestFolderName(t("renameFolder"), target.name)
    if (!name || name.trim() === target.name) return
    try {
      await api.categories.update(target.id, { name: name.trim() })
      handleCategoriesRefresh()
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
      setVideos((prev) => prev.map((item) =>
        item.category_id === target.id ? { ...item, category_id: parentId } : item
      ))
      if (currentFolderId === target.id) navigateToFolder(parentId)
      handleCategoriesRefresh()
    } catch {}
  }

  const handleChangeThumbnail = (id: number) => {
    setThumbnailTargetId(id)
    thumbnailInputRef.current?.click()
  }

  const handleThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || thumbnailTargetId === null) return
    try {
      const updated = await api.videos.uploadThumbnail(thumbnailTargetId, file)
      setVideos((prev) => prev.map((v) => v.id === updated.id ? updated : v))
    } catch {}
    e.target.value = ""
    setThumbnailTargetId(null)
  }

  const header = (
    <LibrarySurfaceHeader
      className="mb-5"
      icon={<FilmIcon className="size-6" />}
      title={t("videos")}
      meta={`${videos.length} ${t("videos")}`}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t("searchVideos")}
      clearSearchLabel={t("clearSearch")}
      onClearSearch={search ? () => setSearch("") : undefined}
      primaryAction={
        <Button onClick={handleAddFiles} size="lg" disabled={scanning}>
          {scanning ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          {t("addVideo")}
        </Button>
      }
    />
  )

  if (loading) {
    return (
      <div className="p-5 md:p-6 max-w-6xl mx-auto relative">
        {header}
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="size-6 animate-spin text-text-tertiary" />
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="video-drop-surface"
      className="p-5 md:p-6 max-w-6xl mx-auto relative"
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

      {header}

      {/* Selection bar */}
      {selection.selectedCount > 0 && (
        <SelectionBar
          selectedCount={selection.selectedCount}
          categories={categories}
          onBulkMove={handleBulkMove}
          onBulkDelete={handleBulkDelete}
          onCreateFolderFromSelection={handleCreateFolderFromSelection}
          onDeselectAll={selection.clearSelection}
          removeActionKind="remove-from-library"
        />
      )}

      <div onMouseDown={selection.handleBlankMouseDown}>
        {search ? (
          <div onMouseDown={selection.handleBlankMouseDown}>
            {filtered.length === 0 ? (
              <LibraryEmptyState icon={<FilmIcon />} title={t("noResults") || "No results"} />
            ) : (
              <div className="explorer-tile-grid" onMouseDown={selection.handleBlankMouseDown}>
                {filtered.map((video) => (
                  <MediaCard
                    key={video.id}
                    id={video.id}
                    title={video.title}
                    thumbnail={video.thumbnail || undefined}
                    mediaType="video"
                    layout="panel"
                    duration={video.duration}
                    size={video.size}
                    categoryId={video.category_id}
                    categories={categories}
                    isActive={playingVideo?.id === video.id}
                    selectable
                    selected={selection.selectedIds.has(video.id)}
                    onSelect={(checked) => selection.handleCheckboxSelect(video.id, checked)}
                    onSelectionClick={(event) => selection.handleItemClick(video.id, event)}
                    getDragIds={selection.getDragIds}
                    sourceSurface="video"
                    onClick={() => setPlayingVideo(video)}
                    onDelete={() => handleDelete(video.id)}
                    onChangeThumbnail={() => handleChangeThumbnail(video.id)}
                    onMoveToCategory={(catId) => handleMoveToCategory(video.id, catId)}
                    onMergeDrop={(payload) => handleMergeDrop(video.id, payload)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : videos.length === 0 ? (
          <LibraryEmptyState icon={<FilmIcon />} title={t("noVideos")}>
            <Button variant="secondary" size="sm" onClick={handleAddFiles} disabled={scanning}>
              {scanning ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
              {t("addFirstVideo")}
            </Button>
          </LibraryEmptyState>
        ) : (
          <FolderExplorer<VideoItem>
            categories={categories}
            items={videos}
            currentFolderId={currentFolderId}
            onNavigate={navigateToFolder}
            onCreateFolder={handleCreateFolder}
            onDropItemsToFolder={handleDndMoveToCategory}
            acceptDropType="video"
            onFolderContextMenu={openFolderContextMenu}
            folderPreviewAspect="panel"
            onBlankMouseDown={selection.handleBlankMouseDown}
            renderItem={(video) => (
              <MediaCard
                id={video.id}
                title={video.title}
                thumbnail={video.thumbnail || undefined}
                mediaType="video"
                layout="panel"
                duration={video.duration}
                size={video.size}
                categoryId={video.category_id}
                categories={categories}
                isActive={playingVideo?.id === video.id}
                selectable
                selected={selection.selectedIds.has(video.id)}
                onSelect={(checked) => selection.handleCheckboxSelect(video.id, checked)}
                onSelectionClick={(event) => selection.handleItemClick(video.id, event)}
                getDragIds={selection.getDragIds}
                sourceSurface="video"
                onClick={() => setPlayingVideo(video)}
                onDelete={() => handleDelete(video.id)}
                onChangeThumbnail={() => handleChangeThumbnail(video.id)}
                onMoveToCategory={(catId) => handleMoveToCategory(video.id, catId)}
                onMergeDrop={(payload) => handleMergeDrop(video.id, payload)}
              />
            )}
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

      {/* Video player modal overlay */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="w-[90vw] max-w-6xl h-[85vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <StandaloneVideoPlayer
              video={playingVideo}
              onClose={() => setPlayingVideo(null)}
              onOpenSubtitles={() => { setSubtitleVideo(playingVideo); setPlayingVideo(null) }}
            />
          </div>
        </div>
      )}

      {/* Subtitle workspace */}
      {subtitleVideo && (
        <SubtitleWorkspace
          mediaId={subtitleVideo.id}
          mediaType="video"
          mediaSource={api.videos.serveUrl(subtitleVideo.id)}
          mediaTitle={subtitleVideo.title}
          onClose={() => setSubtitleVideo(null)}
        />
      )}
    </div>
  )
}

export default function VideosPage() {
  return (
    <Suspense>
      <VideosPageContent />
    </Suspense>
  )
}
