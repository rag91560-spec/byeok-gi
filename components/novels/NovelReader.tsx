"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactElement } from "react"
import {
  BookTextIcon,
  CheckIcon,
  ChevronLeftIcon,
  Loader2Icon,
  PipetteIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { api } from "@/lib/api"
import {
  applyTextColorMark,
  normalizeTextColorMarks,
  removeMarksInRange,
  type TextColorMark,
} from "@/lib/novel-text-color-marks"
import { normalizeNovelContentStyle, parseNovelRichText } from "@/lib/novel-rich-text"
import { cn } from "@/lib/utils"
import type { NovelContentStyle, NovelItem, NovelStyleRange } from "@/lib/types"

type ReaderBackground = "dark" | "paper" | "sepia"
type ReaderFont = "serif" | "sans" | "system" | "mono"
type ColorPickerMode = "grid" | "spectrum" | "sliders"

interface RgbaColor {
  r: number
  g: number
  b: number
  a: number
}

interface ArticleSelectionRange {
  start: number
  end: number
  selectedText: string
}

interface ReaderSettings {
  fontFamily: ReaderFont
  textColor: string
  activeMarkColor: string
  colorMarks: TextColorMark[]
  fontSize: number
  lineHeight: number
  contentWidth: number
  pageMargin: number
  background: ReaderBackground
  scrollMode: "scroll"
}

const STORAGE_KEY = "varo.novelReader.settings.v1"

const DEFAULT_SETTINGS: ReaderSettings = {
  fontFamily: "serif",
  textColor: "#e7e3d8",
  activeMarkColor: "#ef7766",
  colorMarks: [],
  fontSize: 17,
  lineHeight: 1.75,
  contentWidth: 760,
  pageMargin: 28,
  background: "dark",
  scrollMode: "scroll",
}

const COLOR_GRID = [
  ["#ffffff", "#e6e6e6", "#cccccc", "#b3b3b3", "#999999", "#808080", "#666666", "#4d4d4d", "#333333", "#1a1a1a"],
  ["#c7f2ff", "#7cc8ff", "#578cff", "#6a58e8", "#9b59dc", "#d36d9b", "#ef7766", "#f09a4a", "#ebcc55", "#aad66a"],
  ["#6ed3ff", "#346cf0", "#4825c9", "#8426ba", "#bf3b6d", "#d73b2a", "#df612a", "#d69332", "#c3bd36", "#7bb64b"],
  ["#3b97b7", "#21428f", "#310b82", "#590874", "#821335", "#7d180e", "#79310f", "#845514", "#72741d", "#4b7e2d"],
  ["#1f5f73", "#11275f", "#1d0757", "#38064e", "#571029", "#54120b", "#4c200d", "#57370d", "#515416", "#315c24"],
  ["#0b3440", "#071a3d", "#11043d", "#250339", "#360819", "#330905", "#2c1306", "#341f05", "#303209", "#1c3416"],
]

const SPECTRUM_COLORS = [
  "#ffffff",
  "#b9e7ff",
  "#65a8ff",
  "#5941ef",
  "#8f2dda",
  "#d64081",
  "#f04b37",
  "#f5822f",
  "#ffd24a",
  "#d9e94c",
  "#8fcf5a",
  "#111111",
]

interface NovelReaderProps {
  novel: NovelItem
  onClose: () => void
  onUpdated?: (novel: NovelItem) => void
}

function parseSettings(raw?: string | null): ReaderSettings {
  if (!raw) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(raw)
    const settings = { ...DEFAULT_SETTINGS, ...parsed }
    settings.colorMarks = normalizeTextColorMarks(Array.isArray(settings.colorMarks) ? settings.colorMarks : [], Number.POSITIVE_INFINITY)
    const hasSelectionColorFields = Array.isArray(parsed.colorMarks) || typeof parsed.activeMarkColor === "string"
    if (!hasSelectionColorFields && parsed.textColor && parsed.textColor !== DEFAULT_SETTINGS.textColor) {
      settings.activeMarkColor = parsed.textColor
      settings.textColor = defaultTextColorForBackground(settings.background)
    }
    if (settings.background === "paper" && settings.textColor === DEFAULT_SETTINGS.textColor) {
      return { ...settings, textColor: "#23201b" }
    }
    return settings
  } catch {
    return DEFAULT_SETTINGS
  }
}

function stripNovelSpecificSettings(settings: ReaderSettings): ReaderSettings {
  return { ...settings, colorMarks: [] }
}

function loadStoredSettings(novel: NovelItem): ReaderSettings {
  if (novel.reader_settings_json && novel.reader_settings_json !== "{}") {
    return parseSettings(novel.reader_settings_json)
  }
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  return stripNovelSpecificSettings(parseSettings(window.localStorage.getItem(STORAGE_KEY)))
}

function fontFamily(settings: ReaderSettings) {
  if (settings.fontFamily === "serif") return "ui-serif, Georgia, Cambria, 'Times New Roman', serif"
  if (settings.fontFamily === "sans") return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  if (settings.fontFamily === "mono") return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
}

function backgroundStyle(settings: ReaderSettings) {
  if (settings.background === "paper") return { background: "#f4f0e7", color: settings.textColor }
  if (settings.background === "sepia") return { background: "#282015", color: "#eadfc8" }
  return { background: "#111114", color: settings.textColor }
}

function defaultTextColorForBackground(background: ReaderBackground) {
  return background === "paper" ? "#23201b" : DEFAULT_SETTINGS.textColor
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function normalizeHex(hex: string) {
  const clean = hex.trim().replace(/^#/, "")
  if (clean.length === 3) {
    return `#${clean.split("").map((char) => `${char}${char}`).join("")}`
  }
  if (clean.length === 6) return `#${clean}`
  return DEFAULT_SETTINGS.textColor
}

function hexToRgba(hex: string, alpha = 1): RgbaColor {
  const normalized = normalizeHex(hex)
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
    a: alpha,
  }
}

function rgbaToCss(color: RgbaColor) {
  const alpha = Math.max(0, Math.min(1, color.a))
  if (alpha >= 0.995) {
    return rgbaToHex(color)
  }
  return `rgba(${clampColor(color.r)}, ${clampColor(color.g)}, ${clampColor(color.b)}, ${alpha.toFixed(2)})`
}

function rgbaToHex(color: RgbaColor) {
  return `#${[color.r, color.g, color.b].map((part) => clampColor(part).toString(16).padStart(2, "0")).join("")}`
}

function parseCssColor(value: string): RgbaColor {
  const trimmed = value.trim()
  if (trimmed.startsWith("#")) return hexToRgba(trimmed)
  const rgbaMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i)
  if (!rgbaMatch) return hexToRgba(DEFAULT_SETTINGS.textColor)
  const parts = rgbaMatch[1].split(",").map((part) => part.trim())
  return {
    r: clampColor(Number(parts[0])),
    g: clampColor(Number(parts[1])),
    b: clampColor(Number(parts[2])),
    a: parts[3] === undefined ? 1 : Math.max(0, Math.min(1, Number(parts[3]))),
  }
}

function mixColor(color: RgbaColor, target: RgbaColor, amount: number): RgbaColor {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
    a: color.a,
  }
}

function colorWithTone(baseColor: RgbaColor, brightness: number, opacity: number) {
  const alpha = Math.max(0.1, Math.min(1, opacity / 100))
  const base = { ...baseColor, a: alpha }
  if (brightness === 100) return rgbaToCss(base)
  if (brightness > 100) {
    return rgbaToCss(mixColor(base, { r: 255, g: 255, b: 255, a: alpha }, Math.min(1, (brightness - 100) / 60)))
  }
  return rgbaToCss(mixColor(base, { r: 0, g: 0, b: 0, a: alpha }, Math.min(1, (100 - brightness) / 70)))
}

function styleForNovelRange(range: NovelStyleRange): CSSProperties {
  const style: CSSProperties = {}
  if (range.color) style.color = range.color
  if (range.backgroundColor) style.backgroundColor = range.backgroundColor
  if (range.fontSize) style.fontSize = `${range.fontSize}px`
  if (range.fontWeight) {
    style.fontWeight = {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    }[range.fontWeight]
  }
  if (range.fontStyle) style.fontStyle = range.fontStyle
  if (range.textDecoration) style.textDecoration = range.textDecoration
  return style
}

function renderContentWithStyles(content: string, contentStyle: NovelContentStyle, marks: TextColorMark[]) {
  const importedRanges = normalizeNovelContentStyle(contentStyle, content.length).ranges
  const manualRanges: NovelStyleRange[] = normalizeTextColorMarks(marks, content.length).map((mark) => ({
    id: mark.id,
    start: mark.start,
    end: mark.end,
    color: mark.color,
  }))
  const ranges = [...importedRanges, ...manualRanges].sort((a, b) => a.start - b.start || a.end - b.end)
  if (ranges.length === 0) return [content]

  const boundaries = new Set([0, content.length])
  for (const range of ranges) {
    boundaries.add(range.start)
    boundaries.add(range.end)
  }

  const points = Array.from(boundaries).sort((a, b) => a - b)
  const nodes: Array<string | ReactElement> = []
  const activeRanges: NovelStyleRange[] = []
  let rangeIndex = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    if (end <= start) continue

    const text = content.slice(start, end)
    while (rangeIndex < ranges.length && ranges[rangeIndex].start <= start) {
      activeRanges.push(ranges[rangeIndex])
      rangeIndex += 1
    }
    for (let activeIndex = activeRanges.length - 1; activeIndex >= 0; activeIndex -= 1) {
      if (activeRanges[activeIndex].end <= start) activeRanges.splice(activeIndex, 1)
    }
    const segmentRanges = activeRanges.filter((range) => range.end >= end)
    if (segmentRanges.length === 0) {
      nodes.push(text)
      continue
    }

    const style: CSSProperties = {}
    for (const range of segmentRanges) Object.assign(style, styleForNovelRange(range))
    nodes.push(<span key={`styled-${start}-${end}`} style={style}>{text}</span>)
  }
  return nodes
}

function parseReaderContentResult(
  result: { content: string; content_style_json: string },
  extension: string,
) {
  let nextContent = result.content
  let nextStyle = normalizeNovelContentStyle(result.content_style_json, nextContent.length)
  if (nextStyle.ranges.length === 0) {
    const parsed = parseNovelRichText(result.content, extension)
    nextContent = parsed.content
    nextStyle = parsed.contentStyle
  }
  return { content: nextContent, contentStyle: nextStyle }
}

function isNodeInsideArticle(article: HTMLElement, node: Node) {
  return node === article || article.contains(node)
}

function getArticleSelectionRange(article: HTMLElement): ArticleSelectionRange | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!isNodeInsideArticle(article, range.startContainer) || !isNodeInsideArticle(article, range.endContainer)) return null

  const preRange = document.createRange()
  preRange.selectNodeContents(article)
  preRange.setEnd(range.startContainer, range.startOffset)
  const start = preRange.toString().length
  const selectedText = range.toString()
  const end = start + selectedText.length
  if (end <= start) return null
  return { start, end, selectedText }
}

function translationKey(novel: NovelItem) {
  if (novel.translation_status === "complete") return "novelTranslationComplete"
  if (novel.translation_status === "partial") return "novelTranslationPartial"
  return "novelTranslationOriginal"
}

function isNetworkLoadError(message: string) {
  return /failed to fetch|fetch failed|backend request failed|network|HTTP 502/i.test(message)
}

export function NovelReader({ novel, onClose, onUpdated }: NovelReaderProps) {
  const { t } = useLocale()
  const [activeNovel, setActiveNovel] = useState(novel)
  const [content, setContent] = useState("")
  const [contentStyle, setContentStyle] = useState<NovelContentStyle>({ ranges: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reimporting, setReimporting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>(() => loadStoredSettings(novel))
  const [progress, setProgress] = useState(Math.max(0, Math.min(100, novel.read_progress || 0)))
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [sourceMessage, setSourceMessage] = useState("")
  const [selectionMessage, setSelectionMessage] = useState("")
  const [selectedTextRange, setSelectedTextRange] = useState<ArticleSelectionRange | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const saveTimerRef = useRef<number | null>(null)

  const settingsJson = useMemo(() => JSON.stringify(settings), [settings])
  const renderedContent = useMemo(
    () => renderContentWithStyles(content, contentStyle, settings.colorMarks),
    [content, contentStyle, settings.colorMarks]
  )

  const saveProgress = useCallback(async (nextProgress = progress, nextSettingsJson = settingsJson) => {
    try {
      const updated = await api.novels.updateProgress(novel.id, nextProgress, nextSettingsJson)
      setSaved(true)
      setSaveError("")
      onUpdated?.(updated)
      window.setTimeout(() => setSaved(false), 1400)
    } catch (err) {
      console.error("Novel reader progress save failed:", err)
      setSaved(false)
      setSaveError(t("readerSaveFailed"))
    }
  }, [novel.id, onUpdated, progress, settingsJson, t])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stripNovelSpecificSettings(settings)))
  }, [settings])

  useEffect(() => {
    setActiveNovel(novel)
  }, [novel])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const touched = await api.novels.touch(novel.id)
        setActiveNovel(touched)
        setSettings(loadStoredSettings(touched))
        setProgress(Math.max(0, Math.min(100, touched.read_progress || 0)))
        onUpdated?.(touched)
        const result = await api.novels.readContent(novel.id)
        if (cancelled) return
        const parsed = parseReaderContentResult(result, touched.extension || novel.extension)
        setContent(parsed.content)
        setContentStyle(parsed.contentStyle)
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : t("unknownError")
          setError(
            isNetworkLoadError(message)
              ? t("novelReaderLoadFailedNetwork")
              : t("novelReaderLoadFailed").replace("{error}", message)
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [novel.extension, novel.id, onUpdated, t])

  useEffect(() => {
    if (loading || !scrollRef.current) return
    const container = scrollRef.current
    const max = container.scrollHeight - container.clientHeight
    if (max <= 0) return
    container.scrollTop = (max * progress) / 100
  }, [loading, progress])

  useEffect(() => {
    setSelectedTextRange(null)
    setSelectionMessage("")
  }, [novel.id, content])

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const max = container.scrollHeight - container.clientHeight
    const next = max <= 0 ? 100 : Math.max(0, Math.min(100, (container.scrollTop / max) * 100))
    setProgress(next)
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      void saveProgress(next)
    }, 1200)
  }, [saveProgress])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [])

  const close = () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    void saveProgress(progress)
    onClose()
  }

  const captureArticleSelection = useCallback(() => {
    const article = articleRef.current
    if (!article) return
    const range = getArticleSelectionRange(article)
    if (range) setSelectedTextRange(range)
  }, [])

  const applySelectionColor = useCallback((color = settings.activeMarkColor) => {
    const article = articleRef.current
    if (!article || !content) return
    const range = getArticleSelectionRange(article) || selectedTextRange
    if (!range) {
      setSelectionMessage(t("readerSelectTextFirst"))
      return
    }
    const nextSettings = {
      ...settings,
      activeMarkColor: color,
      colorMarks: applyTextColorMark(settings.colorMarks, range.start, range.end, color, content.length),
    }
    setSettings(nextSettings)
    setSelectionMessage(t("readerSelectionColorApplied").replace("{count}", String(range.selectedText.length)))
    setSelectedTextRange(null)
    window.getSelection()?.removeAllRanges()
    void saveProgress(progress, JSON.stringify(nextSettings))
  }, [content, progress, saveProgress, selectedTextRange, settings, t])

  const clearSelectionColor = useCallback(() => {
    const article = articleRef.current
    if (!article || !content) return
    const range = getArticleSelectionRange(article) || selectedTextRange
    if (!range) {
      setSelectionMessage(t("readerSelectTextFirst"))
      return
    }
    const nextSettings = {
      ...settings,
      colorMarks: removeMarksInRange(settings.colorMarks, range.start, range.end, content.length),
    }
    setSettings(nextSettings)
    setSelectionMessage(t("readerSelectionColorCleared").replace("{count}", String(range.selectedText.length)))
    setSelectedTextRange(null)
    window.getSelection()?.removeAllRanges()
    void saveProgress(progress, JSON.stringify(nextSettings))
  }, [content, progress, saveProgress, selectedTextRange, settings, t])

  const handleReimportSource = useCallback(async () => {
    if (!activeNovel.source_path_allowed || reimporting) return
    setReimporting(true)
    setSourceMessage("")
    setError("")
    try {
      const updated = await api.novels.reimportSource(novel.id)
      setActiveNovel(updated)
      onUpdated?.(updated)
      const result = await api.novels.readContent(novel.id)
      const parsed = parseReaderContentResult(result, updated.extension || novel.extension)
      setContent(parsed.content)
      setContentStyle(parsed.contentStyle)
      const nextSettings = loadStoredSettings(updated)
      setSettings(nextSettings)
      setProgress(Math.max(0, Math.min(100, updated.read_progress || progress)))
      setSelectedTextRange(null)
      setSelectionMessage("")
      setSourceMessage(t("novelSourceReimported"))
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknownError")
      setSourceMessage(t("novelSourceReimportFailed").replace("{error}", message))
    } finally {
      setReimporting(false)
    }
  }, [activeNovel.source_path_allowed, novel.extension, novel.id, onUpdated, progress, reimporting, t])

  const bg = backgroundStyle(settings)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-text-primary">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface/95 px-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={close} aria-label={t("close")}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <BookTextIcon className="size-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-text-primary">{activeNovel.title}</h2>
            <span className="shrink-0 rounded bg-accent/12 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              {t(translationKey(activeNovel))}
            </span>
          </div>
        </div>
        {saved && (
          <span className="hidden items-center gap-1 text-xs text-success sm:inline-flex">
            <CheckIcon className="size-3.5" />
            {t("saved")}
          </span>
        )}
        {saveError && (
          <span className="hidden max-w-[220px] truncate text-xs text-error sm:inline" title={saveError}>
            {saveError}
          </span>
        )}
        {sourceMessage && (
          <span className={cn("hidden max-w-[260px] truncate text-xs sm:inline", sourceMessage.includes("{error}") ? "text-error" : "text-text-secondary")} title={sourceMessage}>
            {sourceMessage}
          </span>
        )}
        {activeNovel.source_path_allowed && (
          <Button variant="secondary" size="sm" onClick={handleReimportSource} disabled={reimporting}>
            <RefreshCwIcon className={cn("size-4", reimporting && "animate-spin")} />
            {t("novelReimportSource")}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
          <SlidersHorizontalIcon className="size-4" />
          {t("readerSettings")}
        </Button>
        <Button variant="ghost" size="icon" onClick={close} aria-label={t("close")}>
          <XIcon className="size-4" />
        </Button>
      </header>

      <main className="relative min-h-0 flex-1" style={{ background: bg.background }}>
        <div ref={scrollRef} className="h-full overflow-y-auto" onScroll={handleScroll}>
          <article
            ref={articleRef}
            className="mx-auto min-h-full select-text whitespace-pre-wrap break-words"
            onMouseUp={captureArticleSelection}
            onKeyUp={captureArticleSelection}
            style={{
              maxWidth: settings.contentWidth,
              padding: `${settings.pageMargin}px 20px ${settings.pageMargin + 40}px`,
              fontFamily: fontFamily(settings),
              fontSize: settings.fontSize,
              lineHeight: settings.lineHeight,
              color: settings.textColor,
            }}
          >
            {loading ? (
              <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2Icon className="size-6 animate-spin text-accent" />
              </div>
            ) : error ? (
              <div className="rounded-md border border-error/30 bg-error/10 p-4 text-sm text-error">{error}</div>
            ) : content ? (
              renderedContent
            ) : (
              <div className="flex min-h-[50vh] items-center justify-center rounded-md border border-dashed border-border-subtle bg-overlay-2 p-6 text-center text-sm text-text-secondary">
                {t("novelPreviewUnavailable")}
              </div>
            )}
          </article>
        </div>

        {settingsOpen && (
          <aside
            className="absolute right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-[320px] overflow-y-auto rounded-lg border border-border-subtle bg-surface p-4 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{t("readerSettings")}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(false)} aria-label={t("close")}>
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <SettingSelect
                label={t("readerFont")}
                value={settings.fontFamily}
                onChange={(value) => setSettings((prev) => ({ ...prev, fontFamily: value as ReaderFont }))}
                options={[
                  ["serif", t("readerFontSerif")],
                  ["sans", t("readerFontSans")],
                  ["system", t("readerFontSystem")],
                  ["mono", t("readerFontMono")],
                ]}
              />
              <TextColorPicker
                label={t("readerSelectionColor")}
                value={settings.activeMarkColor}
                markCount={settings.colorMarks.length}
                selectionMessage={selectionMessage}
                onChange={(value) => setSettings((prev) => ({ ...prev, activeMarkColor: value }))}
                onApplyToSelection={applySelectionColor}
                onClearSelectionColor={clearSelectionColor}
              />
              <SettingRange
                label={t("readerFontSize")}
                value={settings.fontSize}
                min={13}
                max={24}
                step={1}
                suffix="px"
                onChange={(value) => setSettings((prev) => ({ ...prev, fontSize: value }))}
              />
              <SettingRange
                label={t("readerLineHeight")}
                value={settings.lineHeight}
                min={1.3}
                max={2.2}
                step={0.05}
                onChange={(value) => setSettings((prev) => ({ ...prev, lineHeight: value }))}
              />
              <SettingRange
                label={t("readerContentWidth")}
                value={settings.contentWidth}
                min={560}
                max={980}
                step={20}
                suffix="px"
                onChange={(value) => setSettings((prev) => ({ ...prev, contentWidth: value }))}
              />
              <SettingRange
                label={t("readerPageMargin")}
                value={settings.pageMargin}
                min={12}
                max={72}
                step={4}
                suffix="px"
                onChange={(value) => setSettings((prev) => ({ ...prev, pageMargin: value }))}
              />
              <SettingSelect
                label={t("readerBackground")}
                value={settings.background}
                onChange={(value) => {
                  const background = value as ReaderBackground
                  setSettings((prev) => {
                    const previousDefault = defaultTextColorForBackground(prev.background)
                    if (prev.textColor === previousDefault) {
                      return { ...prev, background, textColor: defaultTextColorForBackground(background) }
                    }
                    return { ...prev, background }
                  })
                }}
                options={[
                  ["dark", t("readerBackgroundDark")],
                  ["sepia", t("readerBackgroundSepia")],
                  ["paper", t("readerBackgroundPaper")],
                ]}
              />
              <SettingSelect
                label={t("readerScrollMode")}
                value={settings.scrollMode}
                onChange={() => setSettings((prev) => ({ ...prev, scrollMode: "scroll" }))}
                options={[["scroll", t("readerScrollModeContinuous")]]}
              />
            </div>
          </aside>
        )}
      </main>

      <footer className="h-2 shrink-0 bg-surface">
        <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </footer>
    </div>
  )
}

function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  )
}

function TextColorPicker({
  label,
  value,
  markCount,
  selectionMessage,
  onChange,
  onApplyToSelection,
  onClearSelectionColor,
}: {
  label: string
  value: string
  markCount: number
  selectionMessage: string
  onChange: (value: string) => void
  onApplyToSelection: (value: string) => void
  onClearSelectionColor: () => void
}) {
  const { t } = useLocale()
  const initialColor = parseCssColor(value)
  const [mode, setMode] = useState<ColorPickerMode>("grid")
  const [baseColor, setBaseColor] = useState<RgbaColor>(initialColor)
  const [brightness, setBrightness] = useState(100)
  const [opacity, setOpacity] = useState(Math.round(initialColor.a * 100))
  const [manualColor, setManualColor] = useState(value)
  const lastValueRef = useRef(value)

  useEffect(() => {
    if (value === lastValueRef.current) return
    lastValueRef.current = value
    const parsed = parseCssColor(value)
    setBaseColor(parsed)
    setBrightness(100)
    setOpacity(Math.round(parsed.a * 100))
    setManualColor(value)
  }, [value])

  const applyColor = (nextBase: RgbaColor, nextBrightness = brightness, nextOpacity = opacity) => {
    const nextValue = colorWithTone(nextBase, nextBrightness, nextOpacity)
    lastValueRef.current = nextValue
    setManualColor(nextValue)
    onChange(nextValue)
  }

  const selectColor = (hex: string) => {
    const nextBase = hexToRgba(hex)
    setBaseColor(nextBase)
    setBrightness(100)
    applyColor(nextBase, 100, opacity)
  }

  const updateBrightness = (nextBrightness: number) => {
    setBrightness(nextBrightness)
    applyColor(baseColor, nextBrightness, opacity)
  }

  const updateOpacity = (nextOpacity: number) => {
    setOpacity(nextOpacity)
    applyColor(baseColor, brightness, nextOpacity)
  }

  const updateRgb = (channel: "r" | "g" | "b", nextValue: number) => {
    const nextBase = { ...baseColor, [channel]: nextValue }
    setBaseColor(nextBase)
    setBrightness(100)
    applyColor(nextBase, 100, opacity)
  }

  const commitManualColor = () => {
    const parsed = parseCssColor(manualColor)
    setBaseColor(parsed)
    setBrightness(100)
    setOpacity(Math.round(parsed.a * 100))
    const nextValue = rgbaToCss(parsed)
    lastValueRef.current = nextValue
    onChange(nextValue)
  }

  const activeColor = colorWithTone(baseColor, brightness, opacity)
  const activeBaseHex = rgbaToHex(baseColor).toLowerCase()

  return (
    <section className="rounded-md border border-border-subtle bg-overlay-2 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PipetteIcon className="size-4 shrink-0 text-accent" />
          <span className="truncate text-xs font-medium text-text-secondary">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="size-7 rounded-md border border-border-subtle shadow-inner"
            style={{ background: activeColor }}
            aria-hidden="true"
          />
          <input
            value={manualColor}
            onChange={(event) => setManualColor(event.currentTarget.value)}
            onBlur={commitManualColor}
            className="h-8 w-[104px] rounded-md border border-border-subtle bg-surface-elevated px-2 text-xs text-text-primary focus:border-accent/50 focus:outline-none"
            aria-label={label}
          />
        </div>
      </div>
      <p className="mb-3 text-xs leading-5 text-text-tertiary">
        {t("readerSelectionColorHint")}
      </p>

      <div className="mb-3 grid grid-cols-3 rounded-md bg-surface-elevated p-1">
        {([
          ["grid", t("readerColorGrid")],
          ["spectrum", t("readerColorSpectrum")],
          ["sliders", t("readerColorSliders")],
        ] as Array<[ColorPickerMode, string]>).map(([nextMode, modeLabel]) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setMode(nextMode)}
            className={cn(
              "h-8 rounded text-xs font-medium text-text-secondary transition-colors",
              mode === nextMode && "bg-overlay-5 text-text-primary shadow-sm"
            )}
          >
            {modeLabel}
          </button>
        ))}
      </div>

      {mode === "grid" && (
        <div className="grid gap-px overflow-hidden rounded-md border border-border-subtle bg-border-subtle" style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}>
          {COLOR_GRID.flat().map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              onClick={() => selectColor(hex)}
              className={cn(
                "aspect-square min-h-7 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent",
                activeBaseHex === hex.toLowerCase() && "ring-2 ring-accent ring-offset-2 ring-offset-surface"
              )}
              style={{ background: hex }}
            />
          ))}
        </div>
      )}

      {mode === "spectrum" && (
        <div className="space-y-3">
          <div
            className="h-10 rounded-md border border-border-subtle"
            style={{ background: "linear-gradient(90deg, #ffffff, #5bc7ff, #335cff, #8a2be2, #e92f84, #ff4f32, #ffd447, #9ad84f, #111111)" }}
          />
          <div className="grid grid-cols-6 gap-1.5">
            {SPECTRUM_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={hex}
                onClick={() => selectColor(hex)}
                className="h-8 rounded-md border border-border-subtle transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ background: hex }}
              />
            ))}
          </div>
        </div>
      )}

      {mode === "sliders" && (
        <div className="space-y-3">
          <ColorChannel label="R" value={baseColor.r} color="#ef4444" onChange={(nextValue) => updateRgb("r", nextValue)} />
          <ColorChannel label="G" value={baseColor.g} color="#22c55e" onChange={(nextValue) => updateRgb("g", nextValue)} />
          <ColorChannel label="B" value={baseColor.b} color="#3b82f6" onChange={(nextValue) => updateRgb("b", nextValue)} />
        </div>
      )}

      <div className="mt-4 space-y-3">
        <ColorToneRange
          label={t("readerColorBrightness")}
          value={brightness}
          min={30}
          max={160}
          suffix="%"
          background="linear-gradient(90deg, #050505, #808080, #ffffff)"
          onChange={updateBrightness}
        />
        <ColorToneRange
          label={t("readerColorOpacity")}
          value={opacity}
          min={10}
          max={100}
          suffix="%"
          background="linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.95))"
          checkerboard
          onChange={updateOpacity}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onApplyToSelection(activeColor)}
          className="justify-center"
        >
          {t("readerApplySelectionColor")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelectionColor}
          className="justify-center"
        >
          {t("readerClearSelectionColor")}
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-tertiary">
        <span>{t("readerColorMarksCount").replace("{count}", String(markCount))}</span>
        {selectionMessage && <span className="truncate text-accent">{selectionMessage}</span>}
      </div>
    </section>
  )
}

function ColorChannel({
  label,
  value,
  color,
  onChange,
}: {
  label: string
  value: number
  color: string
  onChange: (value: number) => void
}) {
  return (
    <label className="grid grid-cols-[18px_1fr_34px] items-center gap-2 text-xs text-text-secondary">
      <span className="font-semibold">{label}</span>
      <input
        type="range"
        min={0}
        max={255}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-full"
        style={{ accentColor: color }}
      />
      <span className="text-right tabular-nums text-text-tertiary">{value}</span>
    </label>
  )
}

function ColorToneRange({
  label,
  value,
  min,
  max,
  suffix,
  background,
  checkerboard = false,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  background: string
  checkerboard?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-secondary">
        <span>{label}</span>
        <span className="tabular-nums text-text-tertiary">{value}{suffix}</span>
      </span>
      <span
        className={cn("block rounded-full p-1", checkerboard && "bg-[length:12px_12px]")}
        style={{
          backgroundImage: checkerboard
            ? "linear-gradient(45deg, #2f3036 25%, transparent 25%), linear-gradient(-45deg, #2f3036 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2f3036 75%), linear-gradient(-45deg, transparent 75%, #2f3036 75%)"
            : undefined,
          backgroundPosition: checkerboard ? "0 0, 0 6px, 6px -6px, -6px 0px" : undefined,
          backgroundColor: checkerboard ? "#15161a" : undefined,
        }}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          className="h-7 w-full cursor-pointer appearance-none rounded-full bg-transparent accent-white"
          style={{ background }}
        />
      </span>
    </label>
  )
}

function SettingRange({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-secondary">
        <span>{label}</span>
        <span className="tabular-nums text-text-tertiary">{Number.isInteger(value) ? value : value.toFixed(2)}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className={cn("w-full accent-[var(--accent)]")}
      />
    </label>
  )
}
