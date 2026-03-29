"use client"

import { useMemo, useRef, useEffect, useState } from "react"
import type { SubtitleSegment, SubtitleStyleOptions } from "@/lib/types"

// ASS PlayResY — subtitle font sizes are defined relative to this
const ASS_PLAY_RES_Y = 1080

// Convert ASS &HAABBGGRR color to CSS rgba
function assColorToCss(assColor: string): string {
  const hex = assColor.replace(/^&H/i, "").padStart(8, "0")
  const a = parseInt(hex.slice(0, 2), 16)
  const b = parseInt(hex.slice(2, 4), 16)
  const g = parseInt(hex.slice(4, 6), 16)
  const r = parseInt(hex.slice(6, 8), 16)
  const alpha = (255 - a) / 255
  return `rgba(${r},${g},${b},${alpha})`
}

interface SubtitleOverlayProps {
  segments: SubtitleSegment[]
  currentTime: number
  displayMode: "original" | "translated" | "both"
  style?: SubtitleStyleOptions
  className?: string
}

export function SubtitleOverlay({ segments, currentTime, displayMode, style, className = "" }: SubtitleOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(480)

  // Measure parent container height for accurate font scaling
  useEffect(() => {
    const el = containerRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height || 480)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Binary search for active segment
  const activeSegment = useMemo(() => {
    if (!segments.length || currentTime < 0) return null
    let lo = 0, hi = segments.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (segments[mid].end_time < currentTime) lo = mid + 1
      else if (segments[mid].start_time > currentTime) hi = mid - 1
      else return segments[mid]
    }
    return null
  }, [segments, currentTime])

  if (!activeSegment) return <div ref={containerRef} className="hidden" />

  const original = activeSegment.original_text
  const translated = activeSegment.translated_text

  // Scale ASS font_size to preview container proportionally
  const scale = containerHeight / ASS_PLAY_RES_Y
  const fontSize = style ? `${Math.max(12, Math.round(style.font_size * scale))}px` : undefined
  const textColor = style ? assColorToCss(style.primary_color) : undefined
  const outlineColor = style ? assColorToCss(style.outline_color) : undefined
  const outlineWidth = style?.outline_width ?? 2
  const outlineSize = Math.max(1, Math.round(outlineWidth * scale))
  const textShadow = style && outlineColor && outlineWidth > 0
    ? `${outlineSize}px ${outlineSize}px 0 ${outlineColor}, -${outlineSize}px -${outlineSize}px 0 ${outlineColor}, ${outlineSize}px -${outlineSize}px 0 ${outlineColor}, -${outlineSize}px ${outlineSize}px 0 ${outlineColor}`
    : undefined

  // Position: alignment 8=top, 5=center, 2(default)=bottom
  const positionClass = style?.alignment === 8
    ? "top-4" : style?.alignment === 5
    ? "top-1/2 -translate-y-1/2" : "bottom-8"

  const horizontalClass = "left-1/2 -translate-x-1/2"

  return (
    <div ref={containerRef} className={`absolute ${positionClass} ${horizontalClass} max-w-[90%] text-center pointer-events-none ${className}`}>
      <div className="bg-black/75 px-4 py-2 rounded-lg inline-block">
        {(displayMode === "original" || displayMode === "both") && original && (
          <p
            className="leading-relaxed whitespace-pre-wrap"
            style={{ fontSize, color: textColor || "#ffffff", textShadow }}
          >
            {original}
          </p>
        )}
        {(displayMode === "translated" || displayMode === "both") && translated && (
          <p
            className={`leading-relaxed whitespace-pre-wrap ${displayMode === "both" ? "mt-1 border-t border-white/20 pt-1" : ""}`}
            style={{ fontSize, color: textColor || "#ffff88", textShadow }}
          >
            {translated}
          </p>
        )}
      </div>
    </div>
  )
}
