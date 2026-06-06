"use client"

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  MusicIcon,
  Loader2Icon,
  Gamepad2Icon,
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  PlusIcon,
  UploadIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { useOsSelection } from "@/hooks/use-os-selection"
import { MEDIA_DND_MIME, hasExternalFiles } from "@/hooks/use-media-dnd"
import { api } from "@/lib/api"
import type { AudioItem, MediaCategory, MediaFile } from "@/lib/types"
import { cn, appConfirm } from "@/lib/utils"
import {
  AUDIO_DROP_EXTENSIONS,
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
import { BulkTranslateModal } from "@/components/media-grid/BulkTranslateModal"
import { CategoryGlossaryEditor } from "@/components/media-grid/CategoryGlossaryEditor"
import { AudioPlayerBar } from "@/components/media-grid/AudioPlayerBar"
import { AudioFullscreenPlayer } from "@/components/media-grid/AudioFullscreenPlayer"
import { FolderExplorer } from "@/components/media-grid/FolderExplorer"
import { FolderNameDialog, useFolderNameDialog } from "@/components/media-grid/FolderNameDialog"
import { FolderContextMenu, type FolderContextMenuTarget } from "@/components/media-grid/FolderContextMenu"
import { SubtitleWorkspace } from "@/components/subtitle/SubtitleWorkspace"

type Tab = "my" | "game"

interface GameInfo {
  id: number
  title: string
}

function AudioPageContent() {
  const { t } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>("my")

  // --- Current folder from URL ?folder=<id> ---
  const folderParam = searchParams.get("folder")
  const currentFolderId: number | null = folderParam ? parseInt(folderParam, 10) : null
  const navigateToFolder = useCallback((id: number | null) => {
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    if (id === null) sp.delete("folder")
    else sp.set("folder", String(id))
    const qs = sp.toString()
    router.replace(qs ? `/audio?${qs}` : "/audio")
  }, [router, searchParams])

  // --- My Audio state ---
  const [audioItems, setAudioItems] = useState<AudioItem[]>([])
  const [categories, setCategories] = useState<MediaCategory[]>([])
  const [myLoading, setMyLoading] = useState(true)
  const [bulkTranslateOpen, setBulkTranslateOpen] = useState(false)
  const [glossaryEditorCategoryId, setGlossaryEditorCategoryId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [activeTrack, setActiveTrack] = useState<AudioItem | null>(null)
  const [fullscreenTrack, setFullscreenTrack] = useState<AudioItem | null>(null)
  const [subtitleAudio, setSubtitleAudio] = useState<AudioItem | null>(null)
  const [thumbnailTargetId, setThumbnailTargetId] = useState<number | null>(null)
  const [isDropOver, setIsDropOver] = useState(false)
  const [dropImporting, setDropImporting] = useState(false)
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuTarget | null>(null)
  const { folderNameDialog, requestFolderName, closeFolderNameDialog } = useFolderNameDialog()
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const externalDropCounterRef = useRef(0)

  // --- Game Audio state ---
  const [games, setGames] = useState<GameInfo[]>([])
  const [gameLoading, setGameLoading] = useState(true)
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [gameSearch, setGameSearch] = useState("")
  const [audioFiles, setAudioFiles] = useState<MediaFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [playingFile, setPlayingFile] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load my audio
  const loadMyAudio = useCallback(async () => {
    try {
      const [items, cats] = await Promise.all([
        api.audio.list(),
        api.categories.list("audio"),
      ])
      setAudioItems(items)
      setCategories(cats)
    } catch {}
    finally { setMyLoading(false) }
  }, [])

  // Load game audio
  const loadGameAudio = useCallback(async () => {
    try {
      const res = await api.media.gameIds("audio")
      if (res.game_ids.length > 0) {
        const allGames = await api.games.list()
        const audioGames = allGames
          .filter((g) => res.game_ids.includes(g.id))
          .map((g) => ({ id: g.id, title: g.title }))
        setGames(audioGames)
      }
    } catch {}
    finally { setGameLoading(false) }
  }, [])

  useEffect(() => { loadMyAudio() }, [loadMyAudio])
  useEffect(() => { loadGameAudio() }, [loadGameAudio])

  // Load game files when selected
  useEffect(() => {
    if (!selectedGameId) { setAudioFiles([]); return }
    let cancelled = false
    setFilesLoading(true)
    api.media.files(selectedGameId, "audio")
      .then((res) => { if (!cancelled) setAudioFiles(res.files) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFilesLoading(false) })
    return () => { cancelled = true }
  }, [selectedGameId])

  // Cleanup game audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    }
  }, [])

  // --- My Audio filtering ---
  // When searching, surface matches across all folders; otherwise FolderExplorer
  // handles the per-folder filtering internally.
  const filtered = useMemo(() => {
    if (!search) return audioItems
    const s = search.toLowerCase()
    return audioItems.filter((a) => a.title.toLowerCase().includes(s))
  }, [audioItems, search])
  const filteredGames = useMemo(() => {
    if (!gameSearch) return games
    const s = gameSearch.toLowerCase()
    return games.filter((game) => game.title.toLowerCase().includes(s))
  }, [gameSearch, games])
  const visibleGameAudioFiles = useMemo(() => {
    if (!gameSearch) return audioFiles
    const s = gameSearch.toLowerCase()
    return audioFiles.filter((file) => file.name.toLowerCase().includes(s))
  }, [audioFiles, gameSearch])
  const visibleAudioIds = useMemo(() => {
    const visible = search
      ? filtered
      : audioItems.filter((a) => (a.category_id ?? null) === currentFolderId)
    return visible.map((a) => a.id)
  }, [audioItems, currentFolderId, filtered, search])
  const selection = useOsSelection(visibleAudioIds)

  const handleDelete = async (id: number) => {
    if (!await appConfirm(t("confirmRemoveAudioFromLibrary").replace("{count}", "1"))) return
    try {
      await api.audio.removeFromLibrary(id)
      setAudioItems((prev) => prev.filter((a) => a.id !== id))
      if (activeTrack?.id === id) setActiveTrack(null)
    } catch {}
  }

  const [scanning, setScanning] = useState(false)

  const handleAddFolder = async () => {
    if (!window.electronAPI?.selectAudioFolder) {
      alert(t("electronOnlyFeature"))
      return
    }
    const path = await window.electronAPI.selectAudioFolder()
    if (!path) return
    setScanning(true)
    try {
      const result = await api.audio.scanFolder(path, {
        parentCategoryId: currentFolderId,
        preserveStructure: true,
      })
      if (result.created_items.length > 0) {
        setAudioItems((prev) => [...result.created_items, ...prev])
      }
      if (result.created_categories.length > 0) {
        const cats = await api.categories.list("audio")
        setCategories(cats)
      }
      if (result.total === 0) {
        alert(t("noAudioFilesFound"))
      }
    } catch (err) {
      console.error("Folder scan failed:", err)
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
    const created: AudioItem[] = []
    let shouldRefreshCategories = false
    setDropImporting(true)

    for (const file of dropped) {
      const path = getDroppedFilePath(file)
      const label = path || file.name
      const ext = getPathExtension(label)

      if (isLikelyFolderDrop(file, path)) {
        try {
          const result = await api.audio.scanFolder(path, {
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

      if (!AUDIO_DROP_EXTENSIONS.has(ext) && !file.type.startsWith("audio/")) {
        summary.unsupported += 1
        continue
      }

      try {
        let item = path
          ? await api.audio.add({
              title: getPathTitle(path),
              type: "local",
              source: path,
              category_id: currentFolderId,
            })
          : await api.audio.addFile(file)
        if (!path && currentFolderId !== null) {
          item = await api.audio.update(item.id, { category_id: currentFolderId })
        }
        created.push(item)
        summary.success += 1
      } catch (error) {
        if (isDuplicateImportError(error)) summary.duplicates += 1
        else summary.failed += 1
      }
    }

    if (created.length > 0) {
      setAudioItems((prev) => [...created, ...prev])
    }
    if (shouldRefreshCategories) {
      api.categories.list("audio").then(setCategories).catch(() => {})
    }
    setDropImporting(false)
    alert(formatDropImportSummary(t, summary))
  }, [currentFolderId, isExternalImportDrag, t])

  const handleMoveToCategory = async (audioId: number, catId: number | null) => {
    try {
      const updated = await api.audio.update(audioId, { category_id: catId })
      setAudioItems((prev) => prev.map((a) => a.id === audioId ? updated : a))
    } catch {}
  }

  const handleBulkMove = async (categoryId: number | null) => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    try {
      await api.audio.bulkMove(ids, categoryId)
      setAudioItems((prev) => prev.map((a) =>
        ids.includes(a.id) ? { ...a, category_id: categoryId } : a
      ))
      selection.clearSelection()
      api.categories.list("audio").then(setCategories).catch(() => {})
    } catch {}
  }

  const handleBulkDelete = async () => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    if (!await appConfirm(t("confirmRemoveAudioFromLibrary").replace("{count}", String(ids.length)))) return
    const confirmedIds = selection.getValidSelectedIds()
    if (confirmedIds.length === 0) return
    try {
      await api.audio.removeFromLibrary(confirmedIds)
      setAudioItems((prev) => prev.filter((a) => !confirmedIds.includes(a.id)))
      selection.clearSelection()
    } catch {}
  }

  const handleDndMoveToCategory = async (payload: { ids: number[] }, categoryId: number | null) => {
    const ids = payload.ids.filter((id) => audioItems.some((item) => item.id === id && (item.category_id ?? null) !== categoryId))
    if (ids.length === 0) return
    await api.audio.bulkMove(ids, categoryId)
    setAudioItems((prev) => prev.map((a) =>
      ids.includes(a.id) ? { ...a, category_id: categoryId } : a
    ))
    selection.clearSelection()
    handleCategoriesRefresh()
  }

  const handleMergeDrop = async (targetId: number, payload: { ids: number[] }) => {
    const ids = Array.from(new Set([...payload.ids, targetId])).filter((id) => audioItems.some((item) => item.id === id))
    if (ids.length < 2) return
    const name = await requestFolderName(t("folderNameForSelected").replace("{count}", String(ids.length)), t("newFolder") || "새 폴더")
    if (!name) return
    const confirmedIds = ids.filter((id) => audioItems.some((item) => item.id === id))
    if (confirmedIds.length < 2) return
    try {
      const cat = await api.categories.create({ name, media_type: "audio", parent_id: currentFolderId })
      await api.audio.bulkMove(confirmedIds, cat.id)
      setAudioItems((prev) => prev.map((a) =>
        confirmedIds.includes(a.id) ? { ...a, category_id: cat.id } : a
      ))
      selection.clearSelection()
      handleCategoriesRefresh()
    } catch {}
  }

  const handleCreateFolderFromSelection = async () => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    const name = await requestFolderName(t("folderName") || "폴더 이름", t("newFolder") || "새 폴더")
    if (!name) return
    const confirmedIds = selection.getValidSelectedIds()
    if (confirmedIds.length === 0) return
    try {
      const cat = await api.categories.create({ name, media_type: "audio", parent_id: currentFolderId })
      await api.audio.bulkMove(confirmedIds, cat.id)
      setAudioItems((prev) => prev.map((a) =>
        confirmedIds.includes(a.id) ? { ...a, category_id: cat.id } : a
      ))
      selection.clearSelection()
      handleCategoriesRefresh()
    } catch {}
  }

  const handleCategoriesRefresh = () => {
    api.categories.list("audio").then(setCategories).catch(() => {})
  }

  const handleCreateFolder = async (name: string, parentId: number | null) => {
    try {
      await api.categories.create({ name, media_type: "audio", parent_id: parentId })
      const cats = await api.categories.list("audio")
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
      itemCount: audioItems.filter((item) => item.category_id === folderId).length,
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
      setAudioItems((prev) => prev.map((item) =>
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
      const updated = await api.audio.uploadThumbnail(thumbnailTargetId, file)
      setAudioItems((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    } catch {}
    e.target.value = ""
    setThumbnailTargetId(null)
  }

  // --- Game audio playback ---
  const handleGamePlay = (file: MediaFile) => {
    if (!selectedGameId) return
    if (playingFile === file.path && audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false) }
      else { audioRef.current.play(); setIsPlaying(true) }
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const url = api.media.serveUrl(selectedGameId, file.path)
    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingFile(file.path)
    setIsPlaying(true)
    audio.play()
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const searchValue = tab === "my" ? search : gameSearch
  const setSearchValue = tab === "my" ? setSearch : setGameSearch
  const headerMeta = tab === "my"
    ? `${audioItems.length} ${t("audio")}`
    : `${games.length} ${t("gameAudio")}`
  const sourceControls = (
    <div className="flex shrink-0 gap-1 rounded-lg bg-overlay-4 p-1">
      <button
        type="button"
        onClick={() => setTab("my")}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-md px-4 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          tab === "my"
            ? "bg-surface text-text-primary font-medium shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        )}
      >
        <MusicIcon className="size-4" />
        {t("myAudio")}
      </button>
      <button
        type="button"
        onClick={() => setTab("game")}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-md px-4 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          tab === "game"
            ? "bg-surface text-text-primary font-medium shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        )}
      >
        <Gamepad2Icon className="size-4" />
        {t("gameAudio")}
      </button>
    </div>
  )
  const header = (
    <LibrarySurfaceHeader
      className="mb-5"
      icon={tab === "my" ? <MusicIcon className="size-6" /> : <Gamepad2Icon className="size-6" />}
      title={t("audio")}
      meta={headerMeta}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder={t("searchAudio")}
      clearSearchLabel={t("clearSearch")}
      onClearSearch={searchValue ? () => setSearchValue("") : undefined}
      filterSlot={sourceControls}
      secondaryActions={activeTrack && activeTrack.type === "local" ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSubtitleAudio(activeTrack)}
          title={t("subtitlePipeline")}
        >
          {t("subtitlePipeline")}
        </Button>
      ) : null}
      primaryAction={tab === "my" ? (
        <Button onClick={handleAddFolder} size="lg" disabled={scanning}>
          {scanning ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          {t("addAudio")}
        </Button>
      ) : null}
    />
  )

  const loading = tab === "my" ? myLoading : gameLoading

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
    <div className="p-5 md:p-6 max-w-6xl mx-auto relative">
      {header}

      {/* Tab content */}
      {tab === "my" ? (
        <div
          data-testid="audio-drop-surface"
          className="relative"
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

          {/* Selection bar */}
          {selection.selectedCount > 0 && (
            <SelectionBar
              selectedCount={selection.selectedCount}
              categories={categories}
              onBulkMove={handleBulkMove}
              onBulkDelete={handleBulkDelete}
              onBulkTranslate={() => setBulkTranslateOpen(true)}
              onCreateFolderFromSelection={handleCreateFolderFromSelection}
              onDeselectAll={selection.clearSelection}
              removeActionKind="remove-from-library"
            />
          )}

          <div
            className="min-h-0"
            style={activeTrack ? { paddingBottom: 80 } : undefined}
          >
            {search ? (
              // Search view: flat list across all folders
              <div onMouseDown={selection.handleBlankMouseDown}>
                {filtered.length === 0 ? (
                  <LibraryEmptyState icon={<MusicIcon />} title={t("noResults") || "No results"} />
                ) : (
                  <div className="explorer-tile-grid" onMouseDown={selection.handleBlankMouseDown}>
                    {filtered.map((item) => (
                      <MediaCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        thumbnail={item.thumbnail || undefined}
                        mediaType="audio"
                        layout="panel"
                        duration={item.duration}
                        size={item.size}
                        categoryId={item.category_id}
                        categories={categories}
                        isActive={activeTrack?.id === item.id}
                        selectable
                        selected={selection.selectedIds.has(item.id)}
                        onSelect={(checked) => selection.handleCheckboxSelect(item.id, checked)}
                        onSelectionClick={(event) => selection.handleItemClick(item.id, event)}
                        getDragIds={selection.getDragIds}
                        sourceSurface="audio"
                        onClick={() => setActiveTrack(item)}
                        onDelete={() => handleDelete(item.id)}
                        onChangeThumbnail={() => handleChangeThumbnail(item.id)}
                        onMoveToCategory={(catId) => handleMoveToCategory(item.id, catId)}
                        onMergeDrop={(payload) => handleMergeDrop(item.id, payload)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : audioItems.length === 0 ? (
              <LibraryEmptyState icon={<MusicIcon />} title={t("noAudioFiles") || "No audio"}>
                <Button variant="secondary" size="sm" onClick={handleAddFolder} disabled={scanning}>
                  {scanning ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                  {t("addFirstAudio")}
                </Button>
              </LibraryEmptyState>
            ) : (
              <FolderExplorer<AudioItem>
                categories={categories}
                items={audioItems}
                currentFolderId={currentFolderId}
                onNavigate={navigateToFolder}
                onCreateFolder={handleCreateFolder}
                onDropItemsToFolder={handleDndMoveToCategory}
                acceptDropType="audio"
                onFolderContextMenu={openFolderContextMenu}
                folderPreviewAspect="panel"
                onBlankMouseDown={selection.handleBlankMouseDown}
                renderItem={(item) => (
                  <MediaCard
                    id={item.id}
                    title={item.title}
                    thumbnail={item.thumbnail || undefined}
                    mediaType="audio"
                    layout="panel"
                    duration={item.duration}
                    size={item.size}
                    categoryId={item.category_id}
                    categories={categories}
                    isActive={activeTrack?.id === item.id}
                    selectable
                    selected={selection.selectedIds.has(item.id)}
                    onSelect={(checked) => selection.handleCheckboxSelect(item.id, checked)}
                    onSelectionClick={(event) => selection.handleItemClick(item.id, event)}
                    getDragIds={selection.getDragIds}
                    sourceSurface="audio"
                    onClick={() => setActiveTrack(item)}
                    onDelete={() => handleDelete(item.id)}
                    onChangeThumbnail={() => handleChangeThumbnail(item.id)}
                    onMoveToCategory={(catId) => handleMoveToCategory(item.id, catId)}
                    onMergeDrop={(payload) => handleMergeDrop(item.id, payload)}
                  />
                )}
              />
            )}
          </div>

        </div>
      ) : (
        /* Game Audio tab — existing layout preserved */
        <div className="flex flex-1 min-h-0">
          {/* Left: Game list */}
          <div className="w-72 shrink-0 border-r border-border-subtle flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
              <Gamepad2Icon className="size-5 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">
                {t("gameAudio")}
              </h2>
              <span className="text-xs text-text-tertiary">({games.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {games.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
                  <MusicIcon className="size-10 text-text-tertiary" />
                  <p className="text-sm text-text-secondary">{t("noAudioGames")}</p>
                </div>
              ) : filteredGames.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
                  <MusicIcon className="size-10 text-text-tertiary" />
                  <p className="text-sm text-text-secondary">{t("noResults")}</p>
                </div>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {filteredGames.map((game) => (
                    <div
                      key={game.id}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all",
                        selectedGameId === game.id
                          ? "bg-accent-muted text-text-primary"
                          : "text-text-secondary hover:bg-overlay-4 hover:text-text-primary"
                      )}
                      onClick={() => setSelectedGameId(game.id)}
                    >
                      <Gamepad2Icon className="size-4 shrink-0 text-text-tertiary" />
                      <span className="flex-1 text-sm truncate">{game.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Audio files */}
          <div className="flex-1 p-4 min-w-0">
            {!selectedGameId ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-tertiary">
                <MusicIcon className="size-16" />
                <p className="text-sm">{t("selectAudioGame")}</p>
              </div>
            ) : filesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2Icon className="size-6 animate-spin text-text-tertiary" />
              </div>
            ) : audioFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-tertiary">
                <Volume2Icon className="size-16" />
                <p className="text-sm">{t("noAudioFiles")}</p>
              </div>
            ) : visibleGameAudioFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-tertiary">
                <MusicIcon className="size-16" />
                <p className="text-sm">{t("noResults")}</p>
              </div>
            ) : (
              <div className="space-y-0.5 max-w-2xl">
                <div className="text-xs text-text-tertiary mb-3">
                  {visibleGameAudioFiles.length} files
                </div>
                {visibleGameAudioFiles.map((file) => {
                  const isActive = playingFile === file.path
                  return (
                    <div
                      key={file.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all group",
                        isActive
                          ? "bg-accent-muted text-text-primary"
                          : "text-text-secondary hover:bg-overlay-4 hover:text-text-primary"
                      )}
                      onClick={() => handleGamePlay(file)}
                    >
                      <div className="size-8 flex items-center justify-center rounded-full bg-overlay-4 shrink-0">
                        {isActive && isPlaying ? (
                          <PauseIcon className="size-4 text-accent" />
                        ) : (
                          <PlayIcon className="size-4 text-text-tertiary group-hover:text-accent" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                      </div>
                      <span className="text-xs text-text-tertiary shrink-0">
                        {formatSize(file.size)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input for thumbnail change */}
      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleThumbnailFileChange}
      />

      {/* Audio player bar — shared across tabs */}
      <AudioPlayerBar
        track={activeTrack}
        playlist={audioItems}
        onTrackChange={setActiveTrack}
        onClose={() => setActiveTrack(null)}
        onFullscreen={() => { if (activeTrack) setFullscreenTrack(activeTrack) }}
        hidden={!!fullscreenTrack}
      />

      {/* Fullscreen player */}
      {fullscreenTrack && (
        <AudioFullscreenPlayer
          track={fullscreenTrack}
          playlist={audioItems}
          onTrackChange={(item) => { setFullscreenTrack(item); setActiveTrack(item) }}
          onClose={() => setFullscreenTrack(null)}
          onTrackUpdate={(updated) => {
            setAudioItems((prev) => prev.map((a) => a.id === updated.id ? updated : a))
            setFullscreenTrack(updated)
            if (activeTrack?.id === updated.id) setActiveTrack(updated)
          }}
        />
      )}

      {/* Bulk translate modal */}
      {bulkTranslateOpen && (
        <BulkTranslateModal
          audioIds={selection.getValidSelectedIds()}
          defaultCategoryId={(() => {
            const ids = selection.getValidSelectedIds()
            const cats = new Set(
              ids
                .map((id) => audioItems.find((a) => a.id === id)?.category_id ?? null)
                .filter((c) => c !== null)
            )
            return cats.size === 1 ? (Array.from(cats)[0] as number) : null
          })()}
          onClose={() => setBulkTranslateOpen(false)}
          onComplete={(updated) => {
            setAudioItems((prev) => {
              const map = new Map(updated.map((u) => [u.id, u]))
              return prev.map((a) => map.get(a.id) || a)
            })
            selection.clearSelection()
          }}
        />
      )}

      {/* Category glossary editor */}
      {glossaryEditorCategoryId !== null && (
        <CategoryGlossaryEditor
          categoryId={glossaryEditorCategoryId}
          categoryName={
            categories.find((c) => c.id === glossaryEditorCategoryId)?.name || ""
          }
          onClose={() => setGlossaryEditorCategoryId(null)}
        />
      )}

      {/* Subtitle workspace for audio */}
      {subtitleAudio && (
        <SubtitleWorkspace
          mediaId={subtitleAudio.id}
          mediaType="audio"
          mediaSource={api.audio.serveUrl(subtitleAudio.id)}
          mediaTitle={subtitleAudio.title}
          onClose={() => setSubtitleAudio(null)}
        />
      )}
    </div>
  )
}

export default function AudioPage() {
  return (
    <Suspense>
      <AudioPageContent />
    </Suspense>
  )
}
