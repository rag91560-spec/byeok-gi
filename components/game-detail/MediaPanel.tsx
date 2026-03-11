"use client"

import { useState, useEffect, useCallback } from "react"
import {
  MusicIcon,
  VideoIcon,
  FileTextIcon,
  FolderPlusIcon,
  Trash2Icon,
  Loader2Icon,
  FolderOpenIcon,
  SearchIcon,
} from "lucide-react"
import { api } from "@/lib/api"
import type { MediaFolder, MediaFile, MediaScanResult } from "@/lib/types"
import { AudioPlayer } from "./AudioPlayer"
import { VideoPlayer } from "./VideoPlayer"

type MediaTab = "audio" | "video" | "script"

const TAB_CONFIG: { key: MediaTab; icon: typeof MusicIcon; label: string }[] = [
  { key: "audio", icon: MusicIcon, label: "Audio" },
  { key: "video", icon: VideoIcon, label: "Video" },
  { key: "script", icon: FileTextIcon, label: "Script" },
]

const TAB_ADD_LABEL: Record<MediaTab, string> = {
  audio: "음성 폴더 추가",
  video: "영상 폴더 추가",
  script: "스크립트 폴더 추가",
}

interface MediaPanelProps {
  gameId: number
}

export function MediaPanel({ gameId }: MediaPanelProps) {
  const [tab, setTab] = useState<MediaTab>("audio")
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)
  const [addingFolder, setAddingFolder] = useState(false)
  const [folderPath, setFolderPath] = useState("")
  const [error, setError] = useState("")
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<MediaScanResult | null>(null)

  const loadFolders = useCallback(async () => {
    try {
      const res = await api.media.folders(gameId)
      setFolders(res.folders)
    } catch {
      // No folders yet
    }
  }, [gameId])

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.media.files(gameId, tab)
      setFiles(res.files)
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [gameId, tab])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleAddFolder = useCallback(async () => {
    if (!folderPath.trim()) return
    setError("")
    try {
      await api.media.addFolder(gameId, {
        folder_path: folderPath.trim(),
        media_type: tab,
      })
      setFolderPath("")
      setAddingFolder(false)
      await loadFolders()
      await loadFiles()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add folder")
    }
  }, [gameId, folderPath, tab, loadFolders, loadFiles])

  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanResult(null)
    setError("")
    try {
      const result = await api.media.scan(gameId)
      setScanResult(result)
      if (result.added.length > 0) {
        await loadFolders()
        await loadFiles()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed")
    } finally {
      setScanning(false)
    }
  }, [gameId, loadFolders, loadFiles])

  const handleRemoveFolder = useCallback(async (folderId: number) => {
    try {
      await api.media.removeFolder(gameId, folderId)
      await loadFolders()
      await loadFiles()
    } catch {
      // ignore
    }
  }, [gameId, loadFolders, loadFiles])

  const tabFolders = folders.filter(f => f.media_type === tab)
  const audioFiles = files.filter(f => f.type === "audio")
  const videoFiles = files.filter(f => f.type === "video")
  const scriptFiles = files.filter(f => f.type === "script")

  // Get all script files across all tabs for subtitle/script matching
  const [allScriptFiles, setAllScriptFiles] = useState<MediaFile[]>([])
  useEffect(() => {
    api.media.files(gameId, "script")
      .then(res => setAllScriptFiles(res.files))
      .catch(() => setAllScriptFiles([]))
  }, [gameId, folders])

  return (
    <div className="rounded-lg bg-overlay-2 border border-overlay-6 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-overlay-6">
        <MusicIcon className="size-5 text-accent" />
        <h2 className="text-base font-semibold text-text-primary">Media</h2>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-overlay-6">
        {TAB_CONFIG.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors
              ${tab === key
                ? "text-accent border-b-2 border-accent bg-accent/5"
                : "text-text-tertiary hover:text-text-secondary"
              }`}
          >
            <Icon className="size-3.5" />
            {label}
            {tab === key && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-accent/15 text-[10px] font-bold">
                {tab === "audio" ? audioFiles.length : tab === "video" ? videoFiles.length : scriptFiles.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Folders management */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-tertiary uppercase tracking-wider">Folders</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-overlay-4 transition-colors disabled:opacity-50"
              >
                {scanning ? <Loader2Icon className="size-3.5 animate-spin" /> : <SearchIcon className="size-3.5" />}
                Auto Scan
              </button>
              <button
                onClick={() => setAddingFolder(!addingFolder)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-overlay-4 transition-colors"
              >
                <FolderPlusIcon className="size-3.5" />
                {TAB_ADD_LABEL[tab]}
              </button>
            </div>
          </div>

          {addingFolder && (
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={folderPath}
                onChange={e => setFolderPath(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddFolder()}
                placeholder={`${tab === "audio" ? "음성" : tab === "video" ? "영상" : "스크립트"} 폴더 경로...`}
                className="flex-1 h-8 px-2.5 rounded-md text-xs bg-overlay-4 border border-overlay-6 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
              />
              <button
                onClick={handleAddFolder}
                className="px-3 h-8 rounded-md text-xs font-medium bg-accent text-white hover:brightness-110 transition-all"
              >
                Add
              </button>
              <button
                onClick={() => { setAddingFolder(false); setFolderPath(""); setError("") }}
                className="px-2 h-8 rounded-md text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-error mb-2">{error}</p>
          )}

          {scanResult && (
            <div className="mb-2 px-2.5 py-2 rounded-md bg-accent/10 border border-accent/20 text-xs text-text-secondary">
              {scanResult.added.length > 0 ? (
                <p>
                  <span className="font-medium text-accent">{scanResult.added.length}</span> folder{scanResult.added.length > 1 ? "s" : ""} added ({scanResult.total_files} files)
                </p>
              ) : (
                <p>No new media folders found</p>
              )}
            </div>
          )}

          {tabFolders.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-text-tertiary text-xs">
              <FolderOpenIcon className="size-4" />
              No {tab} folders registered
            </div>
          ) : (
            <div className="space-y-1">
              {tabFolders.map(folder => (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-overlay-4 text-xs group"
                >
                  <FolderOpenIcon className="size-3.5 text-text-tertiary shrink-0" />
                  <span className="text-text-secondary truncate flex-1 font-mono">
                    {folder.folder_path}
                  </span>
                  {folder.label && (
                    <span className="px-1.5 py-0.5 rounded bg-overlay-6 text-text-tertiary text-[10px] shrink-0">
                      {folder.label}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveFolder(folder.id)}
                    className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error transition-all shrink-0"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2Icon className="size-5 text-accent animate-spin" />
          </div>
        )}

        {/* Tab content */}
        {!loading && tab === "audio" && (
          <AudioPlayer gameId={gameId} files={audioFiles} scriptFiles={allScriptFiles} />
        )}

        {!loading && tab === "video" && (
          <VideoPlayer gameId={gameId} files={videoFiles} scriptFiles={allScriptFiles} />
        )}

        {!loading && tab === "script" && (
          <ScriptList gameId={gameId} files={scriptFiles} />
        )}
      </div>
    </div>
  )
}

/* ─── Script List (inline helper) ─── */
function ScriptList({ gameId, files }: { gameId: number; files: MediaFile[] }) {
  const [selectedScript, setSelectedScript] = useState<string | null>(null)
  const [scriptData, setScriptData] = useState<{ original: string[]; translated: string[] } | null>(null)
  const [translating, setTranslating] = useState(false)

  const handleSelect = useCallback(async (filePath: string) => {
    if (selectedScript === filePath) {
      setSelectedScript(null)
      setScriptData(null)
      return
    }
    setSelectedScript(filePath)
    setTranslating(true)
    try {
      const res = await api.media.translateScript(gameId, filePath)
      setScriptData({ original: res.original, translated: res.translated })
    } catch {
      setScriptData(null)
    } finally {
      setTranslating(false)
    }
  }, [gameId, selectedScript])

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No script files found
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {files.map(file => (
        <div key={file.path}>
          <button
            onClick={() => handleSelect(file.path)}
            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2
              ${selectedScript === file.path
                ? "bg-accent-muted text-accent border border-accent/30"
                : "text-text-secondary hover:text-text-primary hover:bg-overlay-4"
              }`}
          >
            <FileTextIcon className="size-3.5 shrink-0" />
            <span className="truncate">{file.name}</span>
            <span className="ml-auto text-[10px] text-text-tertiary shrink-0">
              {(file.size / 1024).toFixed(1)}KB
            </span>
          </button>

          {selectedScript === file.path && (
            <div className="mt-1 rounded-md border border-overlay-6 overflow-hidden">
              {translating ? (
                <div className="flex items-center gap-2 p-3 text-text-tertiary text-xs">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Translating...
                </div>
              ) : scriptData ? (
                <div className="max-h-64 overflow-y-auto divide-y divide-overlay-4">
                  {scriptData.original.map((line, i) => (
                    <div key={i} className="grid grid-cols-2 gap-3 px-3 py-2 text-xs">
                      <p className="text-text-secondary">{line}</p>
                      <p className={scriptData.translated[i] ? "text-text-primary" : "text-text-tertiary italic"}>
                        {scriptData.translated[i] || "(untranslated)"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-3 text-xs text-text-tertiary">Failed to load script</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
