"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  LanguagesIcon,
  Loader2Icon,
  ArrowLeftIcon,
  MaximizeIcon,
  MinimizeIcon,
  GripVerticalIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useMangaTranslation } from "@/hooks/use-manga"
import { TranslationOverlay } from "./TranslationOverlay"
import { TranslationPanel } from "./TranslationPanel"
import { ImageManager } from "./ImageManager"

interface MangaViewerProps {
  mangaId: number
  pageCount: number
  initialPage?: number
  onBack: () => void
  onUpdate?: () => void
}

type ViewMode = "scroll" | "page"
type TranslationMode = "off" | "overlay" | "panel"

export function MangaViewer({ mangaId, pageCount, initialPage = 1, onBack, onUpdate }: MangaViewerProps) {
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [zoom, setZoom] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>("scroll")
  const [translationMode, setTranslationMode] = useState<TranslationMode>("off")
  const [fullscreen, setFullscreen] = useState(false)
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 })
  const [imageManagerOpen, setImageManagerOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { translation, loading: translating, translate } = useMangaTranslation(mangaId, currentPage)

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (viewMode !== "page") return
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setCurrentPage((p) => Math.max(1, p - 1))
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault()
        setCurrentPage((p) => Math.min(pageCount, p + 1))
      } else if (e.key === "Escape") {
        if (fullscreen) setFullscreen(false)
        else onBack()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [viewMode, pageCount, fullscreen, onBack])

  // Scroll mode: track current page from scroll position
  useEffect(() => {
    if (viewMode !== "scroll" || !scrollContainerRef.current) return
    const container = scrollContainerRef.current

    function handleScroll() {
      const children = container.querySelectorAll("[data-page]")
      let closest = 1
      let minDist = Infinity
      children.forEach((child) => {
        const rect = child.getBoundingClientRect()
        const dist = Math.abs(rect.top - container.getBoundingClientRect().top)
        if (dist < minDist) {
          minDist = dist
          closest = parseInt(child.getAttribute("data-page") || "1")
        }
      })
      setCurrentPage(closest)
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [viewMode])

  const handleTranslate = useCallback(async () => {
    if (!translation) {
      // First click: fetch translation + show overlay
      setTranslationMode("overlay")
      try {
        await translate()
      } catch {
        // error already set in hook
      }
    } else {
      // Already translated: cycle off → overlay → panel
      setTranslationMode((m) => {
        if (m === "off") return "overlay"
        if (m === "overlay") return "panel"
        return "off"
      })
    }
  }, [translation, translate])

  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight })
  }, [])

  return (
    <div ref={containerRef} className={cn("flex flex-col h-full bg-black", fullscreen && "fixed inset-0 z-50")}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface/95 backdrop-blur-sm border-b border-border-subtle shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm text-text-secondary">
            {currentPage} / {pageCount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === "scroll" ? "page" : "scroll")}
            className="text-xs"
          >
            {viewMode === "scroll" ? "페이지" : "스크롤"}
          </Button>

          {/* Zoom */}
          <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
            <ZoomOutIcon className="size-4" />
          </Button>
          <span className="text-xs text-text-secondary w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
            <ZoomInIcon className="size-4" />
          </Button>

          {/* Translation */}
          <Button
            variant={translationMode !== "off" ? "default" : "ghost"}
            size="icon"
            onClick={handleTranslate}
            disabled={translating}
            title={!translation ? "번역" : translationMode === "off" ? "오버레이" : translationMode === "overlay" ? "패널" : "끄기"}
          >
            {translating ? <Loader2Icon className="size-4 animate-spin" /> : <LanguagesIcon className="size-4" />}
          </Button>

          {/* Edit (Image Manager) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setImageManagerOpen(true)}
            title="이미지 관리"
          >
            <GripVerticalIcon className="size-4" />
          </Button>

          {/* Fullscreen */}
          <Button variant="ghost" size="icon" onClick={() => setFullscreen(!fullscreen)}>
            {fullscreen ? <MinimizeIcon className="size-4" /> : <MaximizeIcon className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "page" ? (
        /* Page mode */
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Nav buttons */}
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="absolute left-2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white disabled:opacity-30 transition-all"
          >
            <ChevronLeftIcon className="size-6" />
          </button>

          <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
            <img
              src={api.manga.imageUrl(mangaId, currentPage)}
              alt={`Page ${currentPage}`}
              className="max-h-[calc(100vh-60px)] max-w-full object-contain"
              draggable={false}
              onLoad={handleImgLoad}
            />
            {translationMode === "overlay" && translation && (
              <TranslationOverlay
                entries={translation.positions}
                imageWidth={imgDimensions.width}
                imageHeight={imgDimensions.height}
              />
            )}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage >= pageCount}
            className="absolute right-2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white disabled:opacity-30 transition-all"
          >
            <ChevronRightIcon className="size-6" />
          </button>
        </div>
      ) : (
        /* Scroll mode */
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center py-4 gap-1" style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
              <div key={page} data-page={page} className="relative w-full max-w-3xl">
                <img
                  src={api.manga.imageUrl(mangaId, page)}
                  alt={`Page ${page}`}
                  className="w-full"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thumbnail strip (page mode) */}
      {viewMode === "page" && pageCount <= 100 && (
        <div className="flex gap-1 px-2 py-1.5 bg-surface/95 backdrop-blur-sm border-t border-border-subtle overflow-x-auto shrink-0">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                "shrink-0 w-10 h-14 rounded overflow-hidden border-2 transition-all",
                page === currentPage ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img
                src={api.manga.imageUrl(mangaId, page)}
                alt={`Thumb ${page}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Translation panel (side panel mode) */}
      {translation && (
        <TranslationPanel
          entries={translation.positions}
          open={translationMode === "panel"}
          onClose={() => setTranslationMode("off")}
        />
      )}

      {/* Image Manager */}
      <ImageManager
        mangaId={mangaId}
        pageCount={pageCount}
        open={imageManagerOpen}
        onClose={() => setImageManagerOpen(false)}
        onUpdate={() => onUpdate?.()}
      />
    </div>
  )
}
