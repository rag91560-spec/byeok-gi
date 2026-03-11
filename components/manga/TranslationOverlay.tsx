"use client"

import type { MangaTranslationEntry } from "@/lib/types"

interface TranslationOverlayProps {
  entries: MangaTranslationEntry[]
  imageWidth: number
  imageHeight: number
}

export function TranslationOverlay({ entries, imageWidth, imageHeight }: TranslationOverlayProps) {
  if (!entries.length || !imageWidth || !imageHeight) return null

  return (
    <div className="absolute inset-0 pointer-events-none">
      {entries.map((entry, i) => {
        const left = entry.x * 100
        const top = entry.y * 100
        const width = entry.width * 100
        const height = entry.height * 100

        return (
          <div
            key={i}
            className="absolute bg-[var(--card)]/90 rounded px-1 py-0.5 pointer-events-auto"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              minHeight: `${height}%`,
            }}
            title={entry.original}
          >
            <span
              className="text-text-primary font-medium leading-tight block"
              style={{
                fontSize: `clamp(8px, ${Math.min(height * 0.7, 2)}vw, 16px)`,
                writingMode: entry.direction === "vertical" ? "vertical-rl" : "horizontal-tb",
              }}
            >
              {entry.translated}
            </span>
          </div>
        )
      })}
    </div>
  )
}
