"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import type {
  CaptureSource,
  CaptureRegion,
  LiveTranslationResult,
  LiveSettings,
  OCRTextBlock,
  TranslatedBlock,
} from "@/lib/types"

const DEFAULT_SETTINGS: LiveSettings = {
  sourceId: "",
  sourceName: "",
  language: "auto",
  ocrEngine: "auto",
  provider: "offline",
  model: "",
  sourceLang: "auto",
  targetLang: "ko",
  autoMode: false,
  autoIntervalMs: 2000,
  overlayEnabled: false,
  overlayOpacity: 90,
  region: null,
  useVision: false,
}

export function useLiveTranslation() {
  const [settings, setSettings] = useState<LiveSettings>(() => {
    try {
      const saved = localStorage.getItem("gt-live-settings")
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
    } catch { /* ignore */ }
    return DEFAULT_SETTINGS
  })
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [results, setResults] = useState<LiveTranslationResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [capturing, setCapturing] = useState(false)
  const [lastCapture, setLastCapture] = useState<string | null>(null)
  const resultIdRef = useRef(0)
  const processingRef = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Persist settings
  useEffect(() => {
    localStorage.setItem("gt-live-settings", JSON.stringify(settings))
  }, [settings])

  const updateSettings = useCallback((patch: Partial<LiveSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const refreshSources = useCallback(async () => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation) {
      setError("Electron API not available")
      return
    }
    try {
      const list = await electron.liveTranslation.listSources()
      setSources(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list sources")
    }
  }, [])

  const captureAndTranslate = useCallback(async () => {
    const electron = window.electronAPI
    const s = settingsRef.current
    if (!electron?.liveTranslation || !s.sourceId) return

    setLoading(true)
    setError("")
    try {
      const { image, error: captureError } = await electron.liveTranslation.captureScreen({
        sourceId: s.sourceId,
        region: s.region,
      })
      if (captureError || !image) {
        setError(captureError || "Capture failed")
        return
      }

      setLastCapture(`data:image/png;base64,${image}`)

      // Get image dimensions from base64 PNG header
      const imgEl = new Image()
      const imgSize = await new Promise<{ w: number; h: number }>((resolve) => {
        imgEl.onload = () => resolve({ w: imgEl.naturalWidth, h: imgEl.naturalHeight })
        imgEl.onerror = () => resolve({ w: 1920, h: 1080 })
        imgEl.src = `data:image/png;base64,${image}`
      })

      if (s.useVision) {
        // Vision API: AI extracts text + positions + translates in one call
        const visionResult = await api.live.vision(
          image, s.sourceLang, s.targetLang, s.provider, s.model
        )
        if (visionResult.error) {
          setError(visionResult.error)
          return
        }
        const id = String(++resultIdRef.current)
        // Vision returns positions as percentage (0-100), convert to pixel coords
        const translatedBlocks: TranslatedBlock[] = visionResult.entries.map((e) => ({
          original: e.original,
          translated: e.translated,
          x: (e.x / 100) * imgSize.w,
          y: (e.y / 100) * imgSize.h,
          width: (e.width / 100) * imgSize.w,
          height: (e.height / 100) * imgSize.h,
        }))
        const result: LiveTranslationResult = {
          id,
          original: visionResult.entries.map((e) => e.original).join("\n"),
          translated: visionResult.entries.map((e) => e.translated).join("\n"),
          blocks: translatedBlocks.map((b) => ({ text: b.original, x: b.x, y: b.y, width: b.width, height: b.height })),
          translatedBlocks,
          imageWidth: imgSize.w,
          imageHeight: imgSize.h,
          timestamp: Date.now(),
          mode: "vision",
        }
        setResults((prev) => [result, ...prev].slice(0, 50))
        if (s.overlayEnabled) {
          electron.liveTranslation.updateOverlay({ ...result, overlayOpacity: s.overlayOpacity })
        }
      } else {
        // OCR → get blocks with positions → translate each block
        const ocrResult = await api.live.ocr(image, s.language, s.ocrEngine)
        if (ocrResult.error) {
          setError(ocrResult.error)
          return
        }
        if (!ocrResult.full_text.trim()) {
          setError("No text detected")
          return
        }

        // Translate blocks individually to preserve position mapping
        // When language=auto, use OCR-detected language for translation source
        const detectedLang = ocrResult.language || s.language
        const effectiveSourceLang = s.language === "auto" ? "auto" : s.language
        const blockTranslation = await api.live.translateBlocks(
          ocrResult.blocks, effectiveSourceLang, s.targetLang, s.provider, s.model, detectedLang
        )
        if (blockTranslation.error) {
          setError(blockTranslation.error)
          return
        }

        const id = String(++resultIdRef.current)
        const result: LiveTranslationResult = {
          id,
          original: ocrResult.full_text,
          translated: blockTranslation.blocks.map((b) => b.translated).join("\n"),
          blocks: ocrResult.blocks,
          translatedBlocks: blockTranslation.blocks,
          imageWidth: imgSize.w,
          imageHeight: imgSize.h,
          timestamp: Date.now(),
          mode: "ocr",
        }
        setResults((prev) => [result, ...prev].slice(0, 50))
        if (s.overlayEnabled) {
          electron.liveTranslation.updateOverlay({ ...result, overlayOpacity: s.overlayOpacity })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  const selectRegion = useCallback(async () => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation) return
    const region = await electron.liveTranslation.selectRegion()
    if (region) {
      updateSettings({ region })
    }
  }, [updateSettings])

  const clearRegion = useCallback(() => {
    updateSettings({ region: null })
  }, [updateSettings])

  const toggleOverlay = useCallback(async () => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation) return

    if (settings.overlayEnabled) {
      await electron.liveTranslation.hideOverlay()
      updateSettings({ overlayEnabled: false })
    } else {
      await electron.liveTranslation.showOverlay()
      updateSettings({ overlayEnabled: true })
    }
  }, [settings.overlayEnabled, updateSettings])

  const startAutoCapture = useCallback(async () => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation || !settings.sourceId) return

    setCapturing(true)
    updateSettings({ autoMode: true })
    await electron.liveTranslation.startAutoCapture({
      sourceId: settings.sourceId,
      intervalMs: settings.autoIntervalMs,
      region: settings.region,
    })
  }, [settings.sourceId, settings.autoIntervalMs, settings.region, updateSettings])

  const stopAutoCapture = useCallback(async () => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation) return

    setCapturing(false)
    updateSettings({ autoMode: false })
    await electron.liveTranslation.stopAutoCapture()
  }, [updateSettings])

  // Handle auto-capture frames
  useEffect(() => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation || !capturing) return

    const cleanup = electron.liveTranslation.onAutoCaptureFrame(async ({ image }) => {
      if (!image || processingRef.current) return
      processingRef.current = true
      setLastCapture(`data:image/png;base64,${image}`)
      const s = settingsRef.current

      try {
        // Get image dimensions
        const imgEl = new Image()
        const imgSize = await new Promise<{ w: number; h: number }>((resolve) => {
          imgEl.onload = () => resolve({ w: imgEl.naturalWidth, h: imgEl.naturalHeight })
          imgEl.onerror = () => resolve({ w: 1920, h: 1080 })
          imgEl.src = `data:image/png;base64,${image}`
        })

        if (s.useVision) {
          // Vision API: AI extracts text + positions + translates in one call
          const visionResult = await api.live.vision(
            image, s.sourceLang, s.targetLang, s.provider, s.model
          )
          if (visionResult.error) return

          const id = String(++resultIdRef.current)
          const translatedBlocks: TranslatedBlock[] = visionResult.entries.map((e) => ({
            original: e.original,
            translated: e.translated,
            x: (e.x / 100) * imgSize.w,
            y: (e.y / 100) * imgSize.h,
            width: (e.width / 100) * imgSize.w,
            height: (e.height / 100) * imgSize.h,
          }))
          const result: LiveTranslationResult = {
            id,
            original: visionResult.entries.map((e) => e.original).join("\n"),
            translated: visionResult.entries.map((e) => e.translated).join("\n"),
            blocks: translatedBlocks.map((b) => ({ text: b.original, x: b.x, y: b.y, width: b.width, height: b.height })),
            translatedBlocks,
            imageWidth: imgSize.w,
            imageHeight: imgSize.h,
            timestamp: Date.now(),
            mode: "vision",
          }
          setResults((prev) => {
            if (prev.length > 0 && prev[0].original === result.original) return prev
            return [result, ...prev].slice(0, 50)
          })

          if (s.overlayEnabled && electron.liveTranslation) {
            electron.liveTranslation.updateOverlay({ ...result, overlayOpacity: s.overlayOpacity })
          }
        } else {
          const ocrResult = await api.live.ocr(image, s.language, s.ocrEngine)
          if (!ocrResult.full_text.trim() || ocrResult.error) return

          const detectedLang = ocrResult.language || s.language
          const effectiveSourceLang = s.language === "auto" ? "auto" : s.language
          const blockTranslation = await api.live.translateBlocks(
            ocrResult.blocks, effectiveSourceLang, s.targetLang, s.provider, s.model, detectedLang
          )
          if (blockTranslation.error) return

          const id = String(++resultIdRef.current)
          const result: LiveTranslationResult = {
            id,
            original: ocrResult.full_text,
            translated: blockTranslation.blocks.map((b) => b.translated).join("\n"),
            blocks: ocrResult.blocks,
            translatedBlocks: blockTranslation.blocks,
            imageWidth: imgSize.w,
            imageHeight: imgSize.h,
            timestamp: Date.now(),
            mode: "ocr",
          }
          setResults((prev) => {
            if (prev.length > 0 && prev[0].original === result.original) return prev
            return [result, ...prev].slice(0, 50)
          })

          if (s.overlayEnabled && electron.liveTranslation) {
            electron.liveTranslation.updateOverlay({ ...result, overlayOpacity: s.overlayOpacity })
          }
        }
      } catch { /* ignore auto-capture errors */ } finally {
        processingRef.current = false
      }
    })

    return cleanup
  }, [capturing])

  // Cleanup auto-capture on unmount
  useEffect(() => {
    return () => {
      const electron = window.electronAPI
      if (electron?.liveTranslation) {
        electron.liveTranslation.stopAutoCapture()
      }
    }
  }, [])

  // Register hotkeys when on live page
  useEffect(() => {
    const electron = window.electronAPI
    if (!electron?.liveTranslation) return

    electron.liveTranslation.registerHotkeys()

    const cleanups = [
      electron.liveTranslation.onHotkeyCapture(() => { captureAndTranslate() }),
      electron.liveTranslation.onHotkeyOverlay(() => { toggleOverlay() }),
      electron.liveTranslation.onHotkeyRegion(() => { selectRegion() }),
    ]

    return () => {
      cleanups.forEach((c) => c())
      electron.liveTranslation.unregisterHotkeys()
    }
  }, [captureAndTranslate, toggleOverlay, selectRegion])

  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  return {
    settings,
    updateSettings,
    sources,
    refreshSources,
    results,
    clearResults,
    loading,
    error,
    capturing,
    lastCapture,
    captureAndTranslate,
    selectRegion,
    clearRegion,
    toggleOverlay,
    startAutoCapture,
    stopAutoCapture,
  }
}
