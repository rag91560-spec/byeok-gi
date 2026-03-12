"use client"

import { useState, useEffect } from "react"
import type { LiveTranslationResult } from "@/lib/types"

interface OverlayData extends LiveTranslationResult {
  overlayOpacity?: number
}

export default function OverlayPage() {
  const [data, setData] = useState<OverlayData | null>(null)
  const [windowSize, setWindowSize] = useState({ w: 1920, h: 1080 })

  useEffect(() => {
    document.documentElement.style.background = "transparent"
    document.body.style.background = "transparent"
    document.body.style.margin = "0"
    document.body.style.padding = "0"
    document.body.style.overflow = "hidden"

    const updateSize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  useEffect(() => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation) return

    const cleanup = electron.liveTranslation.onOverlayData((raw) => {
      setData(raw as OverlayData)
    })

    return cleanup
  }, [])

  // Opacity: 0-100 → 0-1
  const opacity = (data?.overlayOpacity ?? 90) / 100
  const bgColor = `rgba(10, 10, 15, ${opacity})`

  if (!data || !data.translatedBlocks || data.translatedBlocks.length === 0) {
    if (data?.translated) {
      return (
        <div
          style={{
            position: "fixed",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "85%",
            padding: "14px 28px",
            backgroundColor: bgColor,
            color: "#ffffff",
            fontSize: "22px",
            fontWeight: 500,
            lineHeight: 1.6,
            borderRadius: "10px",
            whiteSpace: "pre-wrap",
            textAlign: "center",
            fontFamily: "'Pretendard Variable', 'Noto Sans KR', sans-serif",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          {data.translated}
        </div>
      )
    }
    return null
  }

  const imgW = data.imageWidth || 1920
  const imgH = data.imageHeight || 1080
  const scaleX = windowSize.w / imgW
  const scaleY = windowSize.h / imgH

  return (
    <>
      {data.translatedBlocks.map((block, i) => {
        const left = block.x * scaleX
        const top = block.y * scaleY
        const width = block.width * scaleX
        const height = block.height * scaleY
        const fontSize = Math.max(16, Math.min(height * 0.85, 36))

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: left - 4,
              top: top - 2,
              width: width > 0 ? width + 16 : undefined,
              minHeight: height > 0 ? height + 8 : undefined,
              padding: "4px 10px",
              backgroundColor: bgColor,
              color: "#ffffff",
              fontSize,
              fontWeight: 500,
              lineHeight: 1.5,
              borderRadius: "6px",
              whiteSpace: "pre-wrap",
              overflow: "visible",
              fontFamily: "'Pretendard Variable', 'Noto Sans KR', sans-serif",
              display: "flex",
              alignItems: "center",
              boxSizing: "border-box",
              letterSpacing: "0.02em",
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            {block.translated}
          </div>
        )
      })}
    </>
  )
}
