"use client"

import { useState, useEffect } from "react"
import type { LiveTranslationResult } from "@/lib/types"

export default function OverlayPage() {
  const [data, setData] = useState<LiveTranslationResult | null>(null)
  const [windowSize, setWindowSize] = useState({ w: 1920, h: 1080 })

  useEffect(() => {
    // Transparent background for overlay window
    document.documentElement.style.background = "transparent"
    document.body.style.background = "transparent"
    document.body.style.margin = "0"
    document.body.style.padding = "0"
    document.body.style.overflow = "hidden"

    // Track overlay window size for coordinate scaling
    const updateSize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  useEffect(() => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation) return

    const cleanup = electron.liveTranslation.onOverlayData((raw) => {
      setData(raw as LiveTranslationResult)
    })

    return cleanup
  }, [])

  if (!data || !data.translatedBlocks || data.translatedBlocks.length === 0) {
    // No positioned blocks — show fallback at bottom
    if (data?.translated) {
      return (
        <div
          style={{
            position: "fixed",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "85%",
            padding: "10px 20px",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            color: "#ffffff",
            fontSize: "17px",
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

  // Scale factor: OCR coords (in capture image pixels) → overlay window pixels
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

        // Calculate font size proportional to block height
        const fontSize = Math.max(12, Math.min(height * 0.7, 28))

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left,
              top,
              width: width > 0 ? width : undefined,
              minHeight: height > 0 ? height : undefined,
              padding: "2px 6px",
              // Solid background to cover the original text underneath
              backgroundColor: "rgba(15, 15, 20, 0.92)",
              color: "#ffffff",
              fontSize,
              lineHeight: 1.4,
              borderRadius: "3px",
              whiteSpace: "pre-wrap",
              overflow: "hidden",
              fontFamily: "'Pretendard Variable', 'Noto Sans KR', sans-serif",
              display: "flex",
              alignItems: "center",
              boxSizing: "border-box",
            }}
          >
            {block.translated}
          </div>
        )
      })}
    </>
  )
}
