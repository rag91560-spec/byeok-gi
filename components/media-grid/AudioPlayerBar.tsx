"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
  Maximize2Icon,
} from "lucide-react"
import type { AudioItem } from "@/lib/types"
import { api } from "@/lib/api"

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

interface AudioPlayerBarProps {
  track: AudioItem | null
  playlist: AudioItem[]
  onTrackChange: (item: AudioItem) => void
  onClose: () => void
  onFullscreen?: () => void
  hidden?: boolean
}

export function AudioPlayerBar({ track, playlist, onTrackChange, onClose, onFullscreen, hidden }: AudioPlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)

  const currentIndex = track ? playlist.findIndex((a) => a.id === track.id) : -1

  useEffect(() => {
    if (!track || !audioRef.current) return
    if (hidden) {
      audioRef.current.pause()
      setPlaying(false)
      return
    }
    const src = track.type === "local" ? api.audio.serveUrl(track.id) : track.source
    audioRef.current.src = src
    audioRef.current.volume = volume
    audioRef.current.muted = muted
    audioRef.current.play().then(() => setPlaying(true)).catch(() => {})
  }, [track, hidden]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(() => {
    audioRef.current?.play()
    setPlaying(true)
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setPlaying(false)
  }, [])

  const prev = useCallback(() => {
    if (currentIndex > 0) onTrackChange(playlist[currentIndex - 1])
  }, [currentIndex, playlist, onTrackChange])

  const next = useCallback(() => {
    if (currentIndex < playlist.length - 1) onTrackChange(playlist[currentIndex + 1])
  }, [currentIndex, playlist, onTrackChange])

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }, [])

  const handleEnded = useCallback(() => {
    if (currentIndex < playlist.length - 1) {
      next()
    } else {
      setPlaying(false)
    }
  }, [currentIndex, playlist.length, next])

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
    setMuted((m) => {
      if (audioRef.current) audioRef.current.muted = !m
      return !m
    })
  }, [])

  if (!track || hidden) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border-subtle shadow-lg">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Seek bar (thin line on top) */}
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        className="absolute -top-1 left-0 w-full h-2 accent-accent cursor-pointer appearance-none bg-transparent
          [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-overlay-6 [&::-webkit-slider-runnable-track]:rounded
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:-mt-1"
      />

      <div className="flex items-center gap-4 px-4 py-2.5 max-w-screen-xl mx-auto">
        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{track.title}</p>
          <p className="text-[10px] text-text-tertiary font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            disabled={currentIndex <= 0}
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
            disabled={currentIndex >= playlist.length - 1}
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

        {/* Fullscreen */}
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="text-text-tertiary hover:text-text-primary transition-colors ml-1"
          >
            <Maximize2Icon className="size-4" />
          </button>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary transition-colors ml-1"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
