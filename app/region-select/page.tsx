"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { CaptureRegion } from "@/lib/types"

export default function RegionSelectPage() {
  const [dragging, setDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // Make body fully transparent
    document.documentElement.style.background = "transparent"
    document.body.style.background = "transparent"
    document.body.style.margin = "0"
    document.body.style.padding = "0"
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    setStartPos({ x: e.clientX, y: e.clientY })
    setCurrentPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      setCurrentPos({ x: e.clientX, y: e.clientY })
    },
    [dragging]
  )

  const handleMouseUp = useCallback(() => {
    if (!dragging) return
    setDragging(false)

    const x = Math.min(startPos.x, currentPos.x)
    const y = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)

    if (width > 10 && height > 10) {
      const newRegion: CaptureRegion = { x, y, width, height }
      window.electronAPI?.liveTranslation?.confirmRegion(newRegion)
    }
  }, [dragging, startPos, currentPos])

  // ESC to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.close()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "fixed",
        inset: 0,
        cursor: "crosshair",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        userSelect: "none",
      }}
    >
      {/* Instructions */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "8px 16px",
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "#ffffff",
          fontSize: "14px",
          borderRadius: "8px",
          pointerEvents: "none",
        }}
      >
        드래그하여 번역 영역을 선택하세요 (ESC: 취소)
      </div>

      {/* Selection rectangle */}
      {dragging && (
        <div
          style={{
            position: "absolute",
            left: Math.min(startPos.x, currentPos.x),
            top: Math.min(startPos.y, currentPos.y),
            width: Math.abs(currentPos.x - startPos.x),
            height: Math.abs(currentPos.y - startPos.y),
            border: "2px solid #6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.15)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  )
}
