"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
  Loader2Icon,
  LanguagesIcon,
} from "lucide-react"
import type { MediaFile, ScriptTranslation } from "@/lib/types"
import { api } from "@/lib/api"

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

interface AudioPlayerProps {
  gameId: number
  files: MediaFile[]
  scriptFiles: MediaFile[]
}

export function AudioPlayer({ gameId, files, scriptFiles }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [script, setScript] = useState<ScriptTranslation | null>(null)
  const [loadingScript, setLoadingScript] = useState(false)

  const currentFile = files[currentIndex] ?? null

  const play = useCallback(() => {
    audioRef.current?.play()
    setPlaying(true)
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setPlaying(false)
  }, [])

  const prev = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1))
    setPlaying(true)
  }, [])

  const next = useCallback(() => {
    setCurrentIndex(i => Math.min(files.length - 1, i + 1))
    setPlaying(true)
  }, [files.length])

  // Auto-play on track change
  useEffect(() => {
    if (!currentFile || !audioRef.current) return
    audioRef.current.src = api.media.serveUrl(gameId, currentFile.path)
    audioRef.current.volume = volume
    audioRef.current.muted = muted
    if (playing) {
      audioRef.current.play().catch(() => {})
    }
    setScript(null)
  }, [currentIndex, currentFile, gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Try to find and load matching script file
  useEffect(() => {
    if (!currentFile || scriptFiles.length === 0) return
    const baseName = currentFile.name.replace(/\.[^.]+$/, "")
    const match = scriptFiles.find(f => {
      const scriptBase = f.name.replace(/\.[^.]+$/, "")
      return scriptBase === baseName
    })
    if (!match) {
      setScript(null)
      return
    }
    setLoadingScript(true)
    api.media.translateScript(gameId, match.path)
      .then(setScript)
      .catch(() => setScript(null))
      .finally(() => setLoadingScript(false))
  }, [currentFile, scriptFiles, gameId])

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }, [])

  const handleEnded = useCallback(() => {
    if (currentIndex < files.length - 1) {
      next()
    } else {
      setPlaying(false)
    }
  }, [currentIndex, files.length, next])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const handleVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
    if (v > 0) setMuted(false)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (audioRef.current) audioRef.current.muted = !m
      return !m
    })
  }, [])

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No audio files found
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Player Controls */}
      <div className="rounded-lg p-4 bg-overlay-4 border border-overlay-6">
        {/* Current track info */}
        <p className="text-sm font-medium text-text-primary truncate mb-3">
          {currentFile?.name || "No track selected"}
        </p>

        {/* Seek bar */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-text-tertiary font-mono w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 accent-accent cursor-pointer"
          />
          <span className="text-[10px] text-text-tertiary font-mono w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              disabled={currentIndex === 0}
              className="size-8 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <SkipBackIcon className="size-4" />
            </button>
            <button
              onClick={playing ? pause : play}
              className="size-10 flex items-center justify-center rounded-full bg-accent text-white hover:brightness-110 transition-all active:scale-95"
            >
              {playing
                ? <PauseIcon className="size-5 fill-white" />
                : <PlayIcon className="size-5 fill-white ml-0.5" />
              }
            </button>
            <button
              onClick={next}
              disabled={currentIndex >= files.length - 1}
              className="size-8 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <SkipForwardIcon className="size-4" />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} className="text-text-secondary hover:text-text-primary transition-colors">
              {muted || volume === 0
                ? <VolumeXIcon className="size-4" />
                : <Volume2Icon className="size-4" />
              }
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={handleVolume}
              className="w-20 h-1 accent-accent cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Playlist */}
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {files.map((file, idx) => (
          <button
            key={file.path}
            onClick={() => { setCurrentIndex(idx); setPlaying(true) }}
            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2
              ${idx === currentIndex
                ? "bg-accent-muted text-accent border border-accent/30"
                : "text-text-secondary hover:text-text-primary hover:bg-overlay-4"
              }`}
          >
            {idx === currentIndex && playing && (
              <span className="size-2 rounded-full bg-accent animate-pulse shrink-0" />
            )}
            <span className="truncate">{file.name}</span>
            <span className="ml-auto text-[10px] text-text-tertiary shrink-0">
              {(file.size / 1024 / 1024).toFixed(1)}MB
            </span>
          </button>
        ))}
      </div>

      {/* Script Viewer */}
      {loadingScript && (
        <div className="flex items-center gap-2 text-text-tertiary text-xs p-3">
          <Loader2Icon className="size-3.5 animate-spin" />
          Loading script...
        </div>
      )}
      {script && script.original.length > 0 && (
        <div className="rounded-lg border border-overlay-6 overflow-hidden">
          <div className="px-3 py-2 bg-overlay-4 flex items-center gap-2">
            <LanguagesIcon className="size-4 text-accent" />
            <span className="text-xs font-medium text-text-primary">Script</span>
            <span className="text-[10px] text-text-tertiary ml-auto">
              {script.cached}/{script.total} cached
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-overlay-4">
            {script.original.map((line, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 px-3 py-2 text-xs">
                <p className="text-text-secondary">{line}</p>
                <p className={script.translated[i] ? "text-text-primary" : "text-text-tertiary italic"}>
                  {script.translated[i] || "(untranslated)"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
