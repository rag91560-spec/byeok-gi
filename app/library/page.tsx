"use client"

import { useState, useCallback, useRef, useEffect, useMemo, type DragEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  FolderOpenIcon,
  Gamepad2Icon,
  PlusIcon,
  ScanIcon,
  Loader2Icon,
  XIcon,
  ImageIcon,
  SmartphoneIcon,
  MonitorIcon,
  FilterIcon,
  MusicIcon,
  VideoIcon,
  UploadIcon,
  CheckIcon,
  ClockIcon,
  Trash2Icon,
  ImagePlusIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FolderExplorer } from "@/components/media-grid/FolderExplorer"
import { ExplorerTileIcon } from "@/components/media-grid/ExplorerTileIcon"
import { LibraryEmptyState } from "@/components/media-grid/LibraryEmptyState"
import { LibrarySurfaceHeader } from "@/components/media-grid/LibrarySurfaceHeader"
import { SelectionBar } from "@/components/media-grid/SelectionBar"
import { RecentShelf } from "@/components/media-grid/RecentShelf"
import { FolderNameDialog, useFolderNameDialog } from "@/components/media-grid/FolderNameDialog"
import { FolderContextMenu, type FolderContextMenuTarget } from "@/components/media-grid/FolderContextMenu"
import { CoverSearchModal } from "@/components/game-detail/CoverSearchModal"
import { useLocale } from "@/hooks/use-locale"
import { useGames } from "@/hooks/use-api"
import { api } from "@/lib/api"
import type { Game, GameFolder, MediaCategory } from "@/lib/types"
import { appConfirm, cn, getProgressPct } from "@/lib/utils"
import { useOsSelection } from "@/hooks/use-os-selection"
import { useDragItem, useMergeTarget, type DragPayload } from "@/hooks/use-media-dnd"
import {
  emptyDropImportSummary,
  formatDropImportSummary,
  getDroppedFilePath,
  getPathTitle,
  isDuplicateImportError,
} from "@/lib/external-drop-import"

function dateValue(value?: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

/* ─── Game tile ─── */
function GameCard({
  game,
  onClick,
  onMergeDrop,
  selectable,
  selected = false,
  onSelect,
  onSelectionClick,
  getDragIds,
  sourceSurface = "game",
  onDelete,
  onChangeCover,
}: {
  game: Game
  onClick: () => void
  onMergeDrop?: (payload: DragPayload) => void
  selectable?: boolean
  selected?: boolean
  onSelect?: (checked: boolean) => void
  onSelectionClick?: (event: React.MouseEvent) => boolean
  getDragIds?: (primaryId: number) => number[]
  sourceSurface?: string
  onDelete?: () => void
  onChangeCover?: () => void
}) {
  const { t } = useLocale()
  const pct = getProgressPct(game)
  const metaParts = [
    game.engine || (game.platform === "android" ? "APK" : "PC"),
    game.variant_lang,
    game.string_count > 0 ? `${pct}%` : null,
  ].filter(Boolean)
  const metaText = metaParts.join(" · ")
  const coverUrl = game.cover_path ? `/api/covers/${game.id}.jpg` : undefined
  const hasCover = Boolean(coverUrl)

  const drag = useDragItem("game", game.id, { getIds: getDragIds, sourceSurface })
  const mergeHandler = useCallback(
    (payload: DragPayload) => {
      if (payload.ids.includes(game.id)) return
      onMergeDrop?.(payload)
    },
    [game.id, onMergeDrop],
  )
  const merge = useMergeTarget(mergeHandler, 500, { acceptType: "game" })
  const mergeProps = onMergeDrop
    ? { onDragOver: merge.onDragOver as unknown as (e: DragEvent) => void, onDragLeave: merge.onDragLeave as unknown as (e: DragEvent) => void, onDrop: merge.onDrop as unknown as (e: DragEvent) => void }
    : {}

  return (
    <div
      data-testid={`media-card-game-${game.id}`}
      className={`group relative cursor-pointer rounded-md transition-colors duration-150 ease-out ${
        merge.showMerge ? "animate-pulse" : ""
      }`}
      onClick={(event) => {
        if (onSelectionClick?.(event)) return
        onClick()
      }}
      draggable={drag.draggable}
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
      {...mergeProps}
    >
      <div
        className={cn(
          "card-hover-frame flex aspect-[3/4] w-full flex-col rounded-md px-2.5 py-2.5",
          hasCover
            ? "justify-end bg-cover bg-center text-left"
            : "items-center text-center",
        )}
        style={hasCover ? { backgroundImage: `url("${coverUrl}")` } : undefined}
        data-hover-active={merge.showMerge || selected ? "true" : undefined}
      >
        {hasCover && (
          <div className="tile-cover-shade pointer-events-none absolute inset-0 z-0" />
        )}

        {/* Selection checkbox */}
        {selectable && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSelect?.(!selected)
            }}
            className={`absolute left-1.5 top-1.5 z-20 flex size-5 items-center justify-center rounded border-2 transition-all ${
              selected
                ? "bg-accent border-accent text-white"
                : "border-text-tertiary/70 bg-background/80 opacity-0 hover:border-text-secondary group-hover:opacity-100"
            }`}
            aria-label={selected ? t("deselectAll") : t("selectItem")}
          >
            {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
          </button>
        )}

        {!selected && (onDelete || onChangeCover) && (
          <div className="absolute right-1.5 top-1.5 z-20 flex flex-col gap-1.5">
            {onDelete && (
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
                className="rounded-full bg-black/70 p-1.5 text-white opacity-0 shadow-sm transition-all hover:bg-error/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50 group-hover:opacity-100"
                title={t("removeFromLibrary")}
                aria-label={t("removeFromLibrary")}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            )}
            {onChangeCover && (
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onChangeCover()
                }}
                className="rounded-full bg-black/70 p-1.5 text-white opacity-0 shadow-sm transition-all hover:bg-accent/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 group-hover:opacity-100"
                title={t("changeThumbnail")}
                aria-label={t("changeThumbnail")}
              >
                <ImagePlusIcon className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {!hasCover && (
          <div className="flex min-h-0 flex-1 w-full items-center justify-center">
            <ExplorerTileIcon kind="game" />
          </div>
        )}

        <div className="relative z-10 w-full min-w-0">
          <h3
            className={cn(
              "truncate text-[13px] font-medium leading-5",
              hasCover ? "tile-cover-text" : "text-text-primary",
            )}
            title={game.title}
          >
            {game.title}
          </h3>
          {metaText && (
            <p
              className={cn(
                "mt-0.5 h-4 truncate text-[11px] leading-4",
                hasCover ? "tile-cover-text tile-cover-meta" : "text-text-tertiary",
              )}
              title={metaText}
            >
              {metaText}
            </p>
          )}
        </div>

        {selected && <div className="absolute inset-0 z-[5] bg-accent/10 pointer-events-none" />}

        {/* Merge overlay */}
        {merge.showMerge && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-accent/20 pointer-events-none">
            <span className="bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-lg">
              {t("createFolder")}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ─── */
function LibraryPageContent() {
  const { t } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const { games, loading, refresh } = useGames(searchQuery || undefined)
  const [adding, setAdding] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<"all" | "windows" | "android" | "audio" | "video">("all")
  const [mediaGameIds, setMediaGameIds] = useState<{ audio: Set<number>; video: Set<number> }>({ audio: new Set(), video: new Set() })
  const [showApkModal, setShowApkModal] = useState(false)
  const [apkPath, setApkPath] = useState("")
  const [apkLoading, setApkLoading] = useState(false)
  const [apkResults, setApkResults] = useState<Array<{ title: string; package_name: string; path: string; size: number }>>([])
  const [importingApk, setImportingApk] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const { folderNameDialog, requestFolderName, closeFolderNameDialog } = useFolderNameDialog()
  const [coverSearchGame, setCoverSearchGame] = useState<Game | null>(null)

  // Folder state
  const [folders, setFolders] = useState<GameFolder[]>([])
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuTarget | null>(null)

  // --- Current folder from URL ?folder=<id> ---
  const folderParam = searchParams.get("folder")
  const currentFolderId: number | null = folderParam ? parseInt(folderParam, 10) : null
  const navigateToFolder = useCallback((id: number | null) => {
    const sp = new URLSearchParams(Array.from(searchParams.entries()))
    if (id === null) sp.delete("folder")
    else sp.set("folder", String(id))
    const qs = sp.toString()
    router.replace(qs ? `/library?${qs}` : "/library")
  }, [router, searchParams])

  // Load folders
  const loadFolders = useCallback(() => {
    api.folders.list().then(setFolders).catch(() => {})
  }, [])
  useEffect(() => { loadFolders() }, [loadFolders])

  const handleCreateFolder = useCallback(async (name: string, parentId: number | null) => {
    try {
      const folder = await api.folders.create({ name, parent_id: parentId })
      setFolders(prev => [...prev, folder])
    } catch (err) {
      console.error("Create folder failed:", err)
      alert(t("folderCreateFailed").replace("{error}", err instanceof Error ? err.message : String(err)))
    }
  }, [t])

  const openFolderContextMenu = useCallback((folderId: number, event: React.MouseEvent) => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return
    setFolderContextMenu({
      id: folder.id,
      name: folder.name,
      x: event.clientX,
      y: event.clientY,
      itemCount: games.filter((game) => game.folder_id === folderId).length,
      childFolderCount: folders.filter((child) => child.parent_id === folderId).length,
    })
  }, [folders, games])

  const handleRenameFolder = useCallback(async (target: FolderContextMenuTarget) => {
    setFolderContextMenu(null)
    const name = await requestFolderName(t("renameFolder"), target.name)
    if (!name || name.trim() === target.name) return
    try {
      const updated = await api.folders.update(target.id, { name: name.trim() })
      setFolders(prev => prev.map(f => f.id === target.id ? updated : f))
    } catch (err) { console.error("Rename folder failed:", err) }
  }, [requestFolderName, t])

  const handleRemoveFolder = useCallback(async (target: FolderContextMenuTarget) => {
    setFolderContextMenu(null)
    const folder = folders.find(f => f.id === target.id)
    const parentId = folder?.parent_id ?? null
    const message = t("removeFolderConfirm")
      .replace("{name}", target.name)
      .replace("{items}", String(target.itemCount))
      .replace("{folders}", String(target.childFolderCount))
    if (!(await appConfirm(message))) return
    try {
      await api.folders.delete(target.id)
      setFolders(prev => prev
        .filter(f => f.id !== target.id)
        .map(f => f.parent_id === target.id ? { ...f, parent_id: parentId } : f)
      )
      if (currentFolderId === target.id) navigateToFolder(parentId)
      refresh()
    } catch (err) { console.error("Remove folder failed:", err) }
  }, [folders, currentFolderId, navigateToFolder, refresh, t])

  // Move games to folder (selection/DnD)
  const moveGameIdsToFolder = useCallback(async (gameIds: number[], folderId: number | null) => {
    const validIds = gameIds.filter((gameId) =>
      games.some((game) => game.id === gameId && (game.folder_id ?? null) !== folderId),
    )
    if (validIds.length === 0) return
    try {
      await Promise.all(validIds.map((gameId) => api.games.update(gameId, { folder_id: folderId } as Partial<Game>)))
      refresh()
    } catch (err) { console.error("Move game to folder failed:", err) }
  }, [games, refresh])

  // Game → Game merge: create folder and move both
  const handleGameMergeDrop = useCallback(async (targetGameId: number, payload: DragPayload) => {
    const ids = Array.from(new Set([...payload.ids, targetGameId])).filter((gameId) => games.some((game) => game.id === gameId))
    if (ids.length < 2) return false
    const name = await requestFolderName(t("folderNameForSelected").replace("{count}", String(ids.length)), t("newFolder") || "새 폴더")
    if (!name) return false
    const confirmedIds = ids.filter((gameId) => games.some((game) => game.id === gameId))
    if (confirmedIds.length < 2) return false
    try {
      const folder = await api.folders.create({ name, parent_id: currentFolderId })
      setFolders(prev => [...prev, folder])
      await Promise.all(confirmedIds.map((gameId) => api.games.update(gameId, { folder_id: folder.id } as Partial<Game>)))
      refresh()
      return true
    } catch (err) {
      console.error("Merge games to folder failed:", err)
      return false
    }
  }, [games, refresh, requestFolderName, t, currentFolderId])

  // External file Drag & Drop handlers
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    dragCounterRef.current = 0

    // Ignore internal game drags — only handle external file drops
    if (e.dataTransfer.types.includes("application/x-game-id")) return

    const files = e.dataTransfer.files
    if (!files.length) return

    const summary = emptyDropImportSummary()
    const paths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      // Electron 35+: File.path removed, use webUtils.getPathForFile via preload
      const p = getDroppedFilePath(f)
      if (p) paths.push(p)
      else summary.unsupported += 1
    }
    if (!paths.length) {
      alert(formatDropImportSummary(t, summary))
      return
    }

    // APK files → import directly
    const apkPaths = paths.filter(p => p.toLowerCase().endsWith(".apk"))
    const folderPaths = paths.filter(p => !p.toLowerCase().endsWith(".apk"))

    for (const apk of apkPaths) {
      try {
        const name = getPathTitle(apk) || "Unknown"
        await api.android.importApk(apk, name)
        summary.success += 1
      } catch (err) {
        console.error("APK import failed:", err)
        if (isDuplicateImportError(err)) summary.duplicates += 1
        else summary.failed += 1
      }
    }

    for (const p of folderPaths) {
      try {
        await api.games.create({ path: p })
        summary.success += 1
      } catch (err) {
        console.error("Add game failed:", err)
        if (isDuplicateImportError(err)) summary.duplicates += 1
        else summary.failed += 1
      }
    }

    if (apkPaths.length || folderPaths.length) {
      refresh()
      // Auto-fetch covers
      api.covers.fetchAll().then(() => refresh()).catch(() => {})
    }
    alert(formatDropImportSummary(t, summary))
  }, [refresh, t])

  // Load media game IDs for filter
  useEffect(() => {
    Promise.all([
      api.media.gameIds("audio"),
      api.media.gameIds("video"),
    ]).then(([audioRes, videoRes]) => {
      setMediaGameIds({
        audio: new Set(audioRes.game_ids),
        video: new Set(videoRes.game_ids),
      })
    }).catch(() => {})
  }, [games])

  const [fetchingCovers, setFetchingCovers] = useState(false)
  const [scanningAll, setScanningAll] = useState(false)

  // Auto-refresh while covers are being fetched
  useEffect(() => {
    if (!fetchingCovers) return
    const interval = setInterval(() => refresh(), 5000)
    return () => clearInterval(interval)
  }, [fetchingCovers, refresh])

  const handleAddGameFolder = useCallback(async () => {
    if (!window.electronAPI?.selectGameFolder) {
      alert(t("electronOnlyFeature"))
      return
    }
    const path = await window.electronAPI.selectGameFolder()
    if (!path) return
    setAdding(true)
    try {
      // First try: treat the selected folder as a directory containing multiple games
      let scanned: Array<{ title: string; path: string; engine: string; exe_path: string; platform?: string; variant_lang?: string }> = []
      try {
        scanned = await api.games.scanDirectory(path)
      } catch {
        scanned = []
      }

      // Skip client-side dedup — server returns 409 for duplicates, handled in runOne
      const fresh = scanned

      if (fresh.length > 0) {
        // Sequential with concurrency limit (3) to avoid hammering backend scans
        const CONCURRENCY = 3
        let added = 0
        let skipped = 0
        const failed: Array<{ title: string; error: string }> = []

        const runOne = async (g: typeof fresh[number]) => {
          try {
            if (g.platform === "android") {
              await api.android.importApk(g.path, g.title)
            } else {
              await api.games.create({
                path: g.path,
                title: g.title,
                engine: g.engine,
                exe_path: g.exe_path,
                variant_lang: g.variant_lang,
              })
            }
            added++
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            if (/409|이미 등록/i.test(msg)) {
              skipped++
            } else {
              failed.push({ title: g.title, error: msg })
            }
          }
        }

        // Process in chunks of CONCURRENCY, refreshing UI between chunks
        for (let i = 0; i < fresh.length; i += CONCURRENCY) {
          const chunk = fresh.slice(i, i + CONCURRENCY)
          await Promise.all(chunk.map(runOne))
          refresh() // incremental reveal
        }

        // Fire cover fetch in background — no spinner, no polling (UI will update on next natural refresh)
        api.covers.fetchAll()
          .then(() => refresh())
          .catch((e) => console.error("Cover fetch all failed:", e))

        if (failed.length > 0) {
          const preview = failed.slice(0, 5).map(f => `• ${f.title}: ${f.error}`).join("\n")
          const more = failed.length > 5 ? `\n...+${failed.length - 5}` : ""
          alert(t("addGameResult").replace("{added}", String(added)).replace("{skipped}", String(skipped)).replace("{failed}", String(failed.length)) + `\n\n${preview}${more}`)
        } else if (added === 0 && skipped > 0) {
          alert(t("alreadyRegisteredGames").replace("{count}", String(skipped)))
        }
        return
      }

      // Fallback: treat the selected folder itself as a single game
      try {
        const game = await api.games.create({ path })
        refresh()
        api.covers.fetch(game.id).then(() => refresh()).catch((e) => console.error("Cover fetch failed:", e))
      } catch (e) {
        alert(t("addGameFailed").replace("{error}", e instanceof Error ? e.message : String(e)))
      }
    } finally {
      setAdding(false)
    }
  }, [refresh, t])

  const handleScanAll = useCallback(async () => {
    setScanningAll(true)
    try {
      await api.games.scanAll()
      refresh()
    } catch (e) { console.error("Scan all failed:", e) } finally {
      setScanningAll(false)
    }
  }, [refresh])

  const handleFetchAllCovers = useCallback(async () => {
    setFetchingCovers(true)
    try {
      await api.covers.fetchAll()
      refresh()
    } catch (e) { console.error("Fetch all covers failed:", e) } finally {
      setFetchingCovers(false)
    }
  }, [refresh])

  const handleScanApks = useCallback(async () => {
    if (!apkPath.trim()) return
    setApkLoading(true)
    try {
      const res = await api.android.scanApks(apkPath.trim())
      setApkResults(res.apks)
    } catch (e) { console.error("Scan APKs failed:", e);
      setApkResults([])
    } finally {
      setApkLoading(false)
    }
  }, [apkPath])

  const handleImportApk = useCallback(async (apk: { title: string; path: string }) => {
    setImportingApk(apk.path)
    try {
      await api.android.importApk(apk.path, apk.title)
      setApkResults((prev) => prev.filter((a) => a.path !== apk.path))
      refresh()
    } catch (e) { console.error("Import APK failed:", e) } finally {
      setImportingApk(null)
    }
  }, [refresh])

  const handleImportAllApks = useCallback(async () => {
    setApkLoading(true)
    try {
      await Promise.allSettled(
        apkResults.map((apk) => api.android.importApk(apk.path, apk.title))
      )
      setApkResults([])
      refresh()
    } finally {
      setApkLoading(false)
    }
  }, [apkResults, refresh])

  // Platform filter
  const platformFiltered = useMemo(() => {
    if (platformFilter === "all") return games
    if (platformFilter === "audio") return games.filter(g => mediaGameIds.audio.has(g.id))
    if (platformFilter === "video") return games.filter(g => mediaGameIds.video.has(g.id))
    return games.filter(g => (g.platform || "windows") === platformFilter)
  }, [games, mediaGameIds, platformFilter])
  // When searching, show flat (all folders); otherwise let FolderExplorer handle folder filtering
  const hasAndroid = games.some(g => g.platform === "android")
  const hasMedia = mediaGameIds.audio.size > 0 || mediaGameIds.video.size > 0

  // Adapt GameFolder[] → MediaCategory-like shape for FolderExplorer
  const folderCategories: MediaCategory[] = folders.map(f => ({
    id: f.id,
    name: f.name,
    media_type: "game" as unknown as MediaCategory["media_type"],
    parent_id: f.parent_id ?? null,
    sort_order: f.sort_order,
    created_at: f.created_at,
    updated_at: f.created_at,
  }))
  // Shim games with category_id (alias for folder_id) so FolderExplorer can filter
  const gamesForExplorer = useMemo(
    () => platformFiltered.map(g => ({ ...g, category_id: g.folder_id ?? null })),
    [platformFiltered],
  )
  const showRecentShelves = !searchQuery && currentFolderId === null
  const recentlyPlayedGames = useMemo(() => {
    if (!showRecentShelves) return [] as Array<Game & { category_id: number | null }>
    return [...gamesForExplorer]
      .filter((game) => !!game.last_played_at)
      .sort((a, b) => dateValue(b.last_played_at) - dateValue(a.last_played_at))
      .slice(0, 8)
  }, [gamesForExplorer, showRecentShelves])
  const recentGameIds = useMemo(() => {
    if (!showRecentShelves) return [] as number[]
    return recentlyPlayedGames.map((game) => game.id)
  }, [recentlyPlayedGames, showRecentShelves])
  const visibleGameIds = useMemo(() => {
    const folderIds = searchQuery
      ? gamesForExplorer.map((game) => game.id)
      : gamesForExplorer.filter((game) => (game.category_id ?? null) === currentFolderId).map((game) => game.id)
    return Array.from(new Set([...folderIds, ...recentGameIds]))
  }, [currentFolderId, gamesForExplorer, recentGameIds, searchQuery])
  const selection = useOsSelection(visibleGameIds)

  const handleBulkGameMove = useCallback(async (folderId: number | null) => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    await moveGameIdsToFolder(ids, folderId)
    selection.clearSelection()
  }, [moveGameIdsToFolder, selection])

  const handleDropGamesToFolder = useCallback(async (payload: DragPayload, folderId: number | null) => {
    await moveGameIdsToFolder(payload.ids, folderId)
    selection.clearSelection()
  }, [moveGameIdsToFolder, selection])

  const handleBulkGameDelete = useCallback(async () => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    if (!await appConfirm(t("confirmRemoveGameFromLibrary").replace("{count}", String(ids.length)))) return
    const confirmedIds = selection.getValidSelectedIds()
    if (confirmedIds.length === 0) return
    try {
      await api.games.removeFromLibrary(confirmedIds)
      selection.clearSelection()
      refresh()
    } catch (err) {
      console.error("Remove games from library failed:", err)
    }
  }, [refresh, selection, t])

  const handleRemoveGame = useCallback(async (gameId: number) => {
    if (!await appConfirm(t("confirmRemoveGameFromLibrary").replace("{count}", "1"))) return
    try {
      await api.games.removeFromLibrary([gameId])
      selection.clearSelection()
      refresh()
    } catch (err) {
      console.error("Remove game from library failed:", err)
    }
  }, [refresh, selection, t])

  const handleCreateFolderFromSelection = useCallback(async () => {
    const ids = selection.getValidSelectedIds()
    if (ids.length === 0) return
    const name = await requestFolderName(t("folderNameForSelected").replace("{count}", String(ids.length)), t("newFolder") || "새 폴더")
    if (!name) return
    const confirmedIds = selection.getValidSelectedIds()
    if (confirmedIds.length === 0) return
    try {
      const folder = await api.folders.create({ name, parent_id: currentFolderId })
      setFolders(prev => [...prev, folder])
      await moveGameIdsToFolder(confirmedIds, folder.id)
      selection.clearSelection()
    } catch (err) {
      console.error("Create folder from selected games failed:", err)
    }
  }, [currentFolderId, moveGameIdsToFolder, requestFolderName, selection, t])

  const platformFilterControls = (hasAndroid || hasMedia) ? (
    <>
      <FilterIcon className="size-3.5 text-text-tertiary" />
      {(["all", "windows", "android", "audio", "video"] as const).map((p) => {
        if (p === "android" && !hasAndroid) return null
        if (p === "audio" && mediaGameIds.audio.size === 0) return null
        if (p === "video" && mediaGameIds.video.size === 0) return null
        return (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
              platformFilter === p
                ? "bg-accent-muted text-accent border-accent/30"
                : "bg-overlay-2 text-text-secondary border-transparent hover:bg-overlay-4"
            }`}
          >
            {p === "all" && t("platformAll")}
            {p === "windows" && <><MonitorIcon className="size-3 inline mr-1" />{t("platformWindows")}</>}
            {p === "android" && <><SmartphoneIcon className="size-3 inline mr-1" />{t("platformAndroid")}</>}
            {p === "audio" && <><MusicIcon className="size-3 inline mr-1" />{t("platformAudio")}</>}
            {p === "video" && <><VideoIcon className="size-3 inline mr-1" />{t("platformVideo")}</>}
          </button>
        )
      })}
    </>
  ) : undefined

  return (
    <div
      data-testid="library-drop-surface"
      className="p-5 md:p-6 max-w-6xl mx-auto relative"
      tabIndex={0}
      onMouseDown={selection.handleBlankMouseDown}
      onKeyDown={selection.handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-accent/10 backdrop-blur-sm border-2 border-dashed border-accent rounded-xl flex flex-col items-center justify-center gap-3 pointer-events-none">
          <UploadIcon className="size-12 text-accent" />
          <p className="text-lg font-semibold text-accent">{t("dropToAdd")}</p>
          <p className="text-sm text-text-secondary">{t("dropHint")}</p>
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
        className="mb-5"
        icon={<Gamepad2Icon className="size-6" />}
        title={t("games")}
        meta={`${games.length} ${t("games")}`}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t("searchGames")}
        clearSearchLabel={t("clearSearch")}
        onClearSearch={searchQuery ? () => setSearchQuery("") : undefined}
        filterSlot={platformFilterControls}
        secondaryActions={(
          <>
            {games.length > 0 && (
              <Button
                variant="secondary"
                size="lg"
                onClick={handleScanAll}
                disabled={scanningAll}
                title={t("scanAllTooltip")}
                className="px-4 text-sm"
              >
                {scanningAll ? <Loader2Icon className="size-4 animate-spin" /> : <ScanIcon className="size-4" />}
                <span className="hidden md:inline">{t("scanAll")}</span>
              </Button>
            )}
            {games.some(g => !g.cover_path) && (
              <Button
                variant="secondary"
                size="lg"
                onClick={handleFetchAllCovers}
                disabled={fetchingCovers}
                title={t("fetchCoversTooltip")}
                className="px-4 text-sm"
              >
                {fetchingCovers ? <Loader2Icon className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                <span className="hidden md:inline">{t("fetchCovers")}</span>
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setShowApkModal(!showApkModal)}
              title={t("importApk")}
              className="px-4 text-sm"
            >
              <SmartphoneIcon className="size-4" />
              <span className="hidden md:inline">{t("importApk")}</span>
            </Button>
          </>
        )}
        primaryAction={(
          <Button size="lg" onClick={handleAddGameFolder} disabled={adding}>
            {adding ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
            <span className="hidden sm:inline">{t("addGame")}</span>
          </Button>
        )}
      />

      {/* APK Import Panel */}
      {showApkModal && (
        <div className="mb-5 rounded-xl overflow-hidden bg-surface border border-border-subtle">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <SmartphoneIcon className="size-4 text-emerald-500" />
                {t("apkImportTitle")}
              </h3>
              <button
                onClick={() => { setShowApkModal(false); setApkResults([]) }}
                className="size-7 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-overlay-4 transition-colors"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
            <div>
              <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5 block">
                {t("apkFolderPath")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apkPath}
                  onChange={(e) => setApkPath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScanApks()}
                  placeholder="D:\Downloads\APKs"
                  className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-text-primary text-sm font-mono placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                />
                <Button variant="default" size="sm" onClick={handleScanApks} loading={apkLoading} className="shrink-0">
                  <ScanIcon className="size-4" /> {t("scan")}
                </Button>
              </div>
            </div>
            {apkResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">{apkResults.length}{t("apkFound")}</p>
                  <Button variant="default" size="sm" onClick={handleImportAllApks} loading={apkLoading}>
                    <PlusIcon className="size-3" /> {t("importAll")}
                  </Button>
                </div>
                {apkResults.map((apk) => (
                  <div key={apk.path} className="flex items-center justify-between p-2.5 rounded-lg bg-overlay-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{apk.title}</p>
                      <p className="text-xs text-text-tertiary">
                        {apk.package_name} · {(apk.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleImportApk(apk)}
                      loading={importingApk === apk.path}
                      className="shrink-0 ml-2"
                    >
                      <PlusIcon className="size-3" /> {t("add")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selection.selectedCount > 0 && (
        <div className="mb-4">
          <SelectionBar
            selectedCount={selection.selectedCount}
            categories={folderCategories}
            onBulkMove={handleBulkGameMove}
            onCreateFolderFromSelection={handleCreateFolderFromSelection}
            onBulkDelete={handleBulkGameDelete}
            onDeselectAll={selection.clearSelection}
            removeActionKind="remove-from-library"
          />
        </div>
      )}

      {showRecentShelves && recentlyPlayedGames.length > 0 && (
        <div className="mb-4 space-y-4" onMouseDown={selection.handleBlankMouseDown}>
          <RecentShelf
            title={t("recentlyPlayed")}
            subtitle={t("recentLauncher")}
            icon={<ClockIcon className="size-4" />}
          >
            {recentlyPlayedGames.map((game) => (
              <GameCard
                key={`played-${game.id}`}
                game={game}
                onClick={() => router.push(`/library/${game.id}`)}
                selectable
                selected={selection.selectedIds.has(game.id)}
                onSelect={(checked) => selection.handleCheckboxSelect(game.id, checked)}
                onSelectionClick={(event) => selection.handleItemClick(game.id, event)}
                getDragIds={() => selection.getDragIds(game.id)}
                sourceSurface="game"
                onDelete={() => handleRemoveGame(game.id)}
                onChangeCover={() => setCoverSearchGame(game)}
                onMergeDrop={(payload) => {
                  void handleGameMergeDrop(game.id, payload).then((moved) => {
                    if (moved) selection.clearSelection()
                  })
                }}
              />
            ))}
          </RecentShelf>
        </div>
      )}

      {/* Content */}
      <div onMouseDown={selection.handleBlankMouseDown}>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="size-8 text-accent animate-spin" />
        </div>
      ) : platformFiltered.length === 0 ? (
        <LibraryEmptyState
          icon={<FolderOpenIcon />}
          title={t("noGames")}
        >
          <Button variant="secondary" size="sm" onClick={handleAddGameFolder} disabled={adding}>
            {adding ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
            {t("addGame")}
          </Button>
        </LibraryEmptyState>
      ) : (
        <FolderExplorer<Game & { category_id: number | null }>
          categories={folderCategories}
          items={gamesForExplorer}
          currentFolderId={currentFolderId}
          onNavigate={navigateToFolder}
          onCreateFolder={handleCreateFolder}
          onDropItemsToFolder={handleDropGamesToFolder}
          acceptDropType="game"
          onFolderContextMenu={openFolderContextMenu}
          folderPreviewAspect="panel"
          onBlankMouseDown={selection.handleBlankMouseDown}
          renderItem={(game) => (
            <GameCard
              game={game}
              onClick={() => router.push(`/library/${game.id}`)}
              selectable
              selected={selection.selectedIds.has(game.id)}
              onSelect={(checked) => selection.handleCheckboxSelect(game.id, checked)}
              onSelectionClick={(event) => selection.handleItemClick(game.id, event)}
              getDragIds={() => selection.getDragIds(game.id)}
              sourceSurface="game"
              onDelete={() => handleRemoveGame(game.id)}
              onChangeCover={() => setCoverSearchGame(game)}
              onMergeDrop={(payload) => {
                void handleGameMergeDrop(game.id, payload).then((moved) => {
                  if (moved) selection.clearSelection()
                })
              }}
            />
          )}
        />
      )}
      </div>

      {coverSearchGame && (
        <CoverSearchModal
          gameId={coverSearchGame.id}
          game={coverSearchGame}
          onClose={() => setCoverSearchGame(null)}
          onRefresh={() => {
            setCoverSearchGame(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryPageContent />
    </Suspense>
  )
}
