"use client"

import { useRef, useEffect, useMemo } from "react"
import type { ScriptData, ScriptCue } from "@/lib/script-parser"
import { cn } from "@/lib/utils"

interface ScriptDisplayProps {
  script: ScriptData
  currentTime?: number
  onSeek?: (time: number) => void
  translations?: string[]
}

export function ScriptDisplay({ script, currentTime = 0, onSeek, translations }: ScriptDisplayProps) {
  const activeRef = useRef<HTMLDivElement>(null)

  const activeCueIndex = useMemo(() => {
    if (script.type !== "timed") return -1
    for (let i = script.cues.length - 1; i >= 0; i--) {
      if (currentTime >= script.cues[i].startTime) return i
    }
    return -1
  }, [script, currentTime])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeCueIndex])

  if (script.type === "timed") {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {script.cues.map((cue, i) => {
          const isActive = i === activeCueIndex
          const isPast = i < activeCueIndex
          return (
            <div
              key={cue.index}
              ref={isActive ? activeRef : undefined}
              className={cn(
                "px-4 py-2.5 rounded-lg transition-all duration-300",
                isActive
                  ? "border-l-3 border-accent bg-accent/5"
                  : "border-l-3 border-transparent",
                onSeek && "cursor-pointer hover:bg-overlay-4",
              )}
              onClick={() => onSeek?.(cue.startTime)}
            >
              <p
                className={cn(
                  "whitespace-pre-wrap transition-all duration-300",
                  isActive
                    ? "text-text-primary text-lg font-medium"
                    : isPast
                      ? "text-text-tertiary opacity-50 text-base"
                      : "text-text-secondary opacity-60 text-base",
                )}
              >
                {cue.text}
              </p>
              {translations?.[i] && (
                <p className="text-accent/80 text-sm mt-1 whitespace-pre-wrap">
                  {translations[i]}
                </p>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Plain text mode — build translation index mapping (skip empty lines)
  let transIdx = 0
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      {script.lines.map((line, i) => {
        const trans = line.trim() ? translations?.[transIdx++] : undefined
        return (
          <div key={i} className="py-0.5">
            <p className="text-text-secondary text-base leading-relaxed">
              {line || "\u00A0"}
            </p>
            {trans && (
              <p className="text-accent/80 text-sm leading-relaxed">
                {trans}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
