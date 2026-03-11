"use client"

import { useState, useRef, useCallback } from "react"
import {
  PlayIcon,
  PauseIcon,
  MaximizeIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import type { MediaFile } from "@/lib/types"
import { api } from "@/lib/api"

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

interface VideoPlayerProps {
  gameId: number
  files: MediaFile[]
  scriptFiles: MediaFile[]
}

export function VideoPlayer({ gameId, files, scriptFiles }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)

  const currentFile = files[currentIndex] ?? null

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
      setPlaying(false)
    } else {
      videoRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }, [playing])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current.requestFullscreen()
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (videoRef.current) videoRef.current.muted = !m
      return !m
    })
  }, [])

  // Find subtitle files matching current video
  const getSubtitleTracks = useCallback(() => {
    if (!currentFile) return []
    const baseName = currentFile.name.replace(/\.[^.]+$/, "")
    return scriptFiles.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase()
      if (ext !== "srt" && ext !== "vtt" && ext !== "ass") return false
      const scriptBase = f.name.replace(/\.[^.]+$/, "")
      return scriptBase === baseName || scriptBase.startsWith(baseName)
    })
  }, [currentFile, scriptFiles])

  const selectVideo = useCallback((idx: number) => {
    setCurrentIndex(idx)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No video files found
      </div>
    )
  }

  const subtitleTracks = getSubtitleTracks()

  return (
    <div className="space-y-3">
      {/* Video Player */}
      <div ref={containerRef} className="relative rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={currentFile ? api.media.serveUrl(gameId, currentFile.path) : undefined}
          className="w-full aspect-video"
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration)
              videoRef.current.volume = volume
            }
          }}
          onEnded={() => {
            setPlaying(false)
            if (currentIndex < files.length - 1) {
              setCurrentIndex(currentIndex + 1)
              setPlaying(true)
            }
          }}
          onClick={togglePlay}
        >
          {subtitleTracks.map((track, i) => {
            const ext = track.name.split(".").pop()?.toLowerCase()
            // HTML5 video only supports .vtt natively
            if (ext !== "vtt") return null
            return (
              <track
                key={track.path}
                kind="subtitles"
                src={api.media.serveUrl(gameId, track.path)}
                label={track.name}
                default={i === 0}
              />
            )
          })}
        </video>

        {/* Overlay controls */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          {/* Seek bar */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={e => {
              const time = parseFloat(e.target.value)
              if (videoRef.current) {
                videoRef.current.currentTime = time
                setCurrentTime(time)
              }
            }}
            className="w-full h-1 accent-accent cursor-pointer mb-2"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="size-8 flex items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors"
              >
                {playing
                  ? <PauseIcon className="size-4 fill-white" />
                  : <PlayIcon className="size-4 fill-white ml-0.5" />
                }
              </button>
              <span className="text-[10px] text-white/70 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
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
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setVolume(v)
                  if (videoRef.current) videoRef.current.volume = v
                  if (v > 0) setMuted(false)
                }}
                className="w-16 h-1 accent-accent cursor-pointer"
              />
              <button
                onClick={toggleFullscreen}
                className="size-8 flex items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              >
                <MaximizeIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video list */}
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {files.map((file, idx) => (
          <button
            key={file.path}
            onClick={() => selectVideo(idx)}
            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2
              ${idx === currentIndex
                ? "bg-accent-muted text-accent border border-accent/30"
                : "text-text-secondary hover:text-text-primary hover:bg-overlay-4"
              }`}
          >
            <span className="truncate">{file.name}</span>
            <span className="ml-auto text-[10px] text-text-tertiary shrink-0">
              {(file.size / 1024 / 1024).toFixed(1)}MB
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
