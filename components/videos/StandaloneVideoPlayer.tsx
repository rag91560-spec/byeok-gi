"use client"

import { useMemo } from "react"
import type { VideoItem } from "@/lib/types"
import { api } from "@/lib/api"

interface StandaloneVideoPlayerProps {
  readonly video: VideoItem
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? null
}

export function StandaloneVideoPlayer({ video }: StandaloneVideoPlayerProps) {
  const playerContent = useMemo(() => {
    if (video.type === "local") {
      return (
        <video
          key={video.id}
          src={api.videos.serveUrl(video.id)}
          controls
          autoPlay
          className="w-full h-full object-contain bg-black rounded-lg"
        />
      )
    }

    // URL type
    const ytId = getYouTubeId(video.source)
    if (ytId) {
      return (
        <iframe
          key={video.id}
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="w-full h-full rounded-lg"
        />
      )
    }

    // Other URL — try <video> tag
    return (
      <video
        key={video.id}
        src={video.source}
        controls
        autoPlay
        className="w-full h-full object-contain bg-black rounded-lg"
      />
    )
  }, [video])

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-text-primary mb-3 truncate">{video.title}</h2>
      <div className="flex-1 min-h-0">
        {playerContent}
      </div>
    </div>
  )
}
