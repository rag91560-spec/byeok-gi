"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useLocale } from "@/hooks/use-locale"
import { useSubtitles, useSubtitleSegments, useSubtitleJob } from "@/hooks/use-subtitle-job"
import { api } from "@/lib/api"
import type { SubtitleSet, SubtitleSegment, SubtitleStyleOptions } from "@/lib/types"
import { AI_PROVIDERS, getProvider } from "@/lib/providers"
import { ChipButton } from "@/components/game-detail/ChipButton"
import { SubtitleOverlay } from "./SubtitleOverlay"
import { SubtitleEditor } from "./SubtitleEditor"
import { STTPanel } from "./STTPanel"

interface SubtitleWorkspaceProps {
  mediaId: number
  mediaType: "video" | "audio"
  mediaSource: string
  mediaTitle: string
  onClose: () => void
}

type PipelineStep = "extract" | "stt" | "edit" | "translate" | "export"

const STEPS: PipelineStep[] = ["extract", "stt", "edit", "translate", "export"]

// ASS &HAABBGGRR ↔ hex #RRGGBB conversion
function assToHex(ass: string): string {
  const h = ass.replace(/^&H/i, "").padStart(8, "0")
  const r = h.slice(6, 8)
  const g = h.slice(4, 6)
  const b = h.slice(2, 4)
  return `#${r}${g}${b}`
}
function hexToAss(hex: string): string {
  const h = hex.replace("#", "")
  const r = h.slice(0, 2)
  const g = h.slice(2, 4)
  const b = h.slice(4, 6)
  return `&H00${b}${g}${r}`.toUpperCase()
}

const POSITION_PRESETS = [
  { label: "Bottom", alignment: 2, margin_v: 30 },
  { label: "Top", alignment: 8, margin_v: 30 },
  { label: "Center", alignment: 5, margin_v: 0 },
] as const

const DEFAULT_STYLE: SubtitleStyleOptions = {
  font_name: "Arial",
  font_size: 28,
  primary_color: "&H00FFFFFF",
  outline_color: "&H00000000",
  outline_width: 2,
  alignment: 2,
  margin_v: 30,
}

export function SubtitleWorkspace({
  mediaId, mediaType, mediaSource, mediaTitle, onClose,
}: SubtitleWorkspaceProps) {
  const { t } = useLocale()
  const { subtitles, loading: subsLoading, refresh: refreshSubtitles } = useSubtitles(mediaType, mediaId)
  const [activeSubtitleId, setActiveSubtitleId] = useState<number | null>(null)
  const { segments, subtitle, loading, refresh: refreshSegments, setSegments } = useSubtitleSegments(activeSubtitleId)
  const { jobProgress, startTranslate, cancelJob, reset: resetJob } = useSubtitleJob()
  const { jobProgress: hardsubProgress, startHardsub, cancelJob: cancelHardsub, reset: resetHardsub } = useSubtitleJob()
  const [currentStep, setCurrentStep] = useState<PipelineStep>("extract")
  const [currentTime, setCurrentTime] = useState(0)
  const [displayMode, setDisplayMode] = useState<"original" | "translated" | "both">("both")
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState("")
  const [provider, setProvider] = useState(AI_PROVIDERS[0]?.id ?? "claude_oauth")
  const [selectedModel, setSelectedModel] = useState(AI_PROVIDERS[0]?.defaultModel ?? "sonnet")
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyleOptions>({ ...DEFAULT_STYLE })

  // Auto-select first subtitle, or auto-create if none exist
  useEffect(() => {
    if (subtitles.length > 0 && !activeSubtitleId) {
      setActiveSubtitleId(subtitles[0].id)
    } else if (subtitles.length === 0 && !activeSubtitleId && !subsLoading) {
      // Auto-create subtitle record so STT panel is immediately usable
      handleCreateSubtitle().catch(() => {})
    }
  }, [subtitles, activeSubtitleId])

  // Determine current step from subtitle status
  useEffect(() => {
    if (!subtitle) {
      setCurrentStep("extract")
      return
    }
    switch (subtitle.status) {
      case "pending": setCurrentStep("stt"); break
      case "transcribing": setCurrentStep("stt"); break
      case "transcribed": setCurrentStep("edit"); break
      case "translating": setCurrentStep("translate"); break
      case "translated": setCurrentStep("export"); break
      default: setCurrentStep("edit"); break
    }
  }, [subtitle?.status])

  // Time update handler
  const handleTimeUpdate = useCallback(() => {
    const el = mediaType === "video" ? videoRef.current : audioRef.current
    if (el) setCurrentTime(el.currentTime)
  }, [mediaType])

  const handleSeek = useCallback((time: number) => {
    const el = mediaType === "video" ? videoRef.current : audioRef.current
    if (el) {
      el.currentTime = time
      setCurrentTime(time)
    }
  }, [mediaType])

  // Create new subtitle
  const handleCreateSubtitle = async () => {
    const sub = await api.subtitle.create({
      media_id: mediaId,
      media_type: mediaType,
      label: mediaTitle,
    })
    await refreshSubtitles()
    setActiveSubtitleId(sub.id)
  }

  // Import subtitle file
  const handleImportFile = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".srt,.vtt,.ass,.ssa"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const result = await api.subtitle.importFile(file, mediaId, mediaType, mediaTitle)
        await refreshSubtitles()
        setActiveSubtitleId(result.subtitle.id)
      } catch {
        // ignore
      }
    }
    input.click()
  }

  // Provider change handler
  const handleProviderChange = (id: string) => {
    setProvider(id)
    const p = getProvider(id)
    if (p) setSelectedModel(p.defaultModel)
  }

  // Start translation
  const handleTranslate = async () => {
    if (!activeSubtitleId) return
    setTranslating(true)
    setTranslateError("")
    try {
      await startTranslate(activeSubtitleId, {
        source_lang: subtitle?.source_lang || "ja",
        target_lang: "ko",
        provider,
        model: selectedModel,
      })
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : "Failed")
      setTranslating(false)
    }
  }

  // Watch translation completion — use progress object, not just status
  useEffect(() => {
    if (jobProgress.status === "completed") {
      if (translating) {
        setTranslating(false)
        refreshSegments()
        refreshSubtitles()
      }
    } else if (jobProgress.status === "error") {
      setTranslating(false)
      setTranslateError(jobProgress.error || "Unknown error")
    }
  }, [jobProgress])

  // Hardsub export
  const [hardsubbing, setHardsubbing] = useState(false)
  const [hardsubError, setHardsubError] = useState("")
  const [hardsubJobId, setHardsubJobId] = useState("")

  const handleHardsub = async () => {
    if (!activeSubtitleId) return
    setHardsubbing(true)
    setHardsubError("")
    try {
      const result = await startHardsub(activeSubtitleId, subtitleStyle)
      setHardsubJobId(result.job_id)
    } catch (e) {
      setHardsubError(e instanceof Error ? e.message : "Failed")
      setHardsubbing(false)
    }
  }

  // Watch hardsub completion
  useEffect(() => {
    if (hardsubProgress.status === "completed" && hardsubbing) {
      setHardsubbing(false)
      // Auto-download
      if (hardsubJobId) {
        api.subtitle.downloadHardsub(hardsubJobId).then(({ blob, filename }) => {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = filename
          a.click()
          URL.revokeObjectURL(url)
        }).catch(() => {})
      }
    } else if (hardsubProgress.status === "error") {
      setHardsubbing(false)
      setHardsubError(hardsubProgress.error || "Unknown error")
    }
  }, [hardsubProgress])

  // Export
  const handleExport = async (format: "srt" | "vtt" | "ass") => {
    if (!activeSubtitleId) return
    try {
      const { blob, filename } = await api.subtitle.exportBlob(activeSubtitleId, {
        format,
        use_translated: true,
        ...(format === "ass" ? {
          font_name: subtitleStyle.font_name,
          font_size: subtitleStyle.font_size,
          primary_color: subtitleStyle.primary_color,
          outline_color: subtitleStyle.outline_color,
          alignment: subtitleStyle.alignment,
          margin_v: subtitleStyle.margin_v,
        } : {}),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }

  const stepLabels: Record<PipelineStep, string> = {
    extract: t("stepExtract"),
    stt: t("stepSTT"),
    edit: t("stepEdit"),
    translate: t("stepTranslate"),
    export: t("stepExport"),
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-sm hover:text-primary">
            ← {t("close")}
          </button>
          <h2 className="font-medium text-sm truncate max-w-[300px]">{mediaTitle}</h2>
        </div>

        {/* Pipeline steps indicator */}
        <div className="flex items-center gap-0.5">
          {STEPS.map((step, i) => {
            const stepIdx = STEPS.indexOf(currentStep)
            const isDone = i < stepIdx
            const isActive = step === currentStep
            return (
              <div key={step} className="flex items-center">
                {i > 0 && (
                  <div className={`w-8 h-0.5 ${isDone ? "bg-primary" : "bg-muted"}`} />
                )}
                <button
                  onClick={() => setCurrentStep(step)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-all ${
                    isActive ? "bg-primary text-primary-foreground shadow-sm" :
                    isDone ? "bg-primary/15 text-primary hover:bg-primary/25" :
                    "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground" />
                    </span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  )}
                  {stepLabels[step]}
                </button>
              </div>
            )
          })}
        </div>

        {/* Display mode */}
        <div className="flex items-center gap-1 text-xs">
          {(["original", "translated", "both"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDisplayMode(mode)}
              className={`px-2 py-1 rounded ${displayMode === mode ? "bg-primary/20 text-primary" : "hover:bg-accent"}`}
            >
              {mode === "original" ? t("subtitleOriginal") :
               mode === "translated" ? t("subtitleTranslation") :
               t("subtitleBoth")}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Media player */}
        <div className="w-1/2 flex flex-col border-r">
          <div className="flex-1 relative bg-black flex items-center justify-center">
            {mediaType === "video" ? (
              <>
                <video
                  ref={videoRef}
                  src={mediaSource}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  className="max-h-full max-w-full"
                />
                <SubtitleOverlay
                  segments={segments}
                  currentTime={currentTime}
                  displayMode={displayMode}
                  style={subtitleStyle}
                />
              </>
            ) : (
              <div className="p-6 w-full">
                <audio
                  ref={audioRef}
                  src={mediaSource}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Subtitle info bar */}
          {subtitle && (
            <div className="px-3 py-1.5 border-t text-xs text-muted-foreground flex items-center gap-4">
              <span>{t("status")}: {subtitle.status}</span>
              <span>{t("subtitleSegments")}: {subtitle.segment_count}</span>
              {subtitle.duration > 0 && (
                <span>{t("subtitleDuration")}: {Math.round(subtitle.duration)}s</span>
              )}
              {subtitle.source_lang && <span>{subtitle.source_lang} → {subtitle.target_lang || "?"}</span>}
            </div>
          )}
        </div>

        {/* Right: Controls / Editor */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* No subtitle yet */}
          {!activeSubtitleId && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
              <p className="text-sm text-muted-foreground">{t("noSubtitles")}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateSubtitle}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  {t("createSubtitle")}
                </button>
                <button
                  onClick={handleImportFile}
                  className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
                >
                  {t("importSubtitleFile")}
                </button>
              </div>
            </div>
          )}

          {/* STT Panel (for extract/stt steps) */}
          {activeSubtitleId && (currentStep === "extract" || currentStep === "stt") && (
            <div className="p-4">
              <STTPanel
                subtitle={subtitle}
                mediaId={mediaId}
                mediaType={mediaType}
                onComplete={() => {
                  refreshSegments()
                  refreshSubtitles()
                  setCurrentStep("edit")
                }}
                onTranslateNow={() => {
                  refreshSegments()
                  refreshSubtitles()
                  setCurrentStep("translate")
                }}
              />
              {/* Import alternative */}
              <div className="mt-3 text-center">
                <button
                  onClick={handleImportFile}
                  className="text-xs text-muted-foreground hover:text-primary underline"
                >
                  {t("importSubtitleFile")}
                </button>
              </div>
            </div>
          )}

          {/* Editor (edit/translate/export steps) */}
          {activeSubtitleId && currentStep !== "extract" && currentStep !== "stt" && (
            <>
              {/* Export step */}
              {currentStep === "export" && subtitle && (
                <div className="mx-3 mt-3 space-y-3 overflow-y-auto">
                  {/* Top: completion banner + export + retranslate */}
                  <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-card">
                    <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium">{t("translationCompleted")}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("segmentsTranslated").replace("{count}", String(subtitle.segment_count))}
                    </span>
                    <div className="flex-1" />
                    {(["srt", "vtt", "ass"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => handleExport(fmt)}
                        className="px-3 py-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-md hover:bg-primary/20 uppercase font-medium"
                      >
                        {fmt}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentStep("translate")}
                      className="px-2 py-1 text-xs text-muted-foreground border rounded hover:bg-accent hover:text-foreground"
                    >
                      {t("retranslate")}
                    </button>
                  </div>

                  {/* Hardsub section (video only) */}
                  {mediaType === "video" && (
                    <div className="p-3 border rounded-lg bg-card">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Hardsub</h4>
                      {!hardsubbing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleHardsub}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                          >
                            {t("exportHardsub")}
                          </button>
                          {hardsubError && (
                            <span className="text-xs text-destructive">{hardsubError}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{t("hardsubProgress")}</span>
                          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all"
                              style={{ width: `${hardsubProgress.progress * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono">{Math.round(hardsubProgress.progress * 100)}%</span>
                          <button
                            onClick={cancelHardsub}
                            className="px-2 py-0.5 text-xs text-destructive border rounded hover:bg-destructive/10"
                          >
                            {t("cancel")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Style Inspector — always visible */}
                  <div className="p-3 border rounded-lg bg-card space-y-3">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <h4 className="text-sm font-medium">자막 스타일</h4>
                    </div>

                    {/* Text section */}
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">텍스트</span>
                      {/* Font size */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">글꼴 크기</span>
                        <input
                          type="range"
                          min={16}
                          max={60}
                          value={subtitleStyle.font_size}
                          onChange={(e) => setSubtitleStyle(s => ({ ...s, font_size: Number(e.target.value) }))}
                          className="flex-1 h-1 accent-primary"
                        />
                        <span className="text-xs font-mono w-12 text-right">{subtitleStyle.font_size}px</span>
                      </div>
                      {/* Text color */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">색상</span>
                        <input
                          type="color"
                          value={assToHex(subtitleStyle.primary_color)}
                          onChange={(e) => setSubtitleStyle(s => ({ ...s, primary_color: hexToAss(e.target.value) }))}
                          className="w-7 h-7 rounded border border-muted cursor-pointer bg-transparent p-0"
                        />
                        <span className="text-xs font-mono text-muted-foreground">{assToHex(subtitleStyle.primary_color).toUpperCase()}</span>
                      </div>
                    </div>

                    <div className="border-t" />

                    {/* Outline section */}
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">외곽선</span>
                      {/* Outline width */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">두께</span>
                        <input
                          type="range"
                          min={0}
                          max={8}
                          value={subtitleStyle.outline_width}
                          onChange={(e) => setSubtitleStyle(s => ({ ...s, outline_width: Number(e.target.value) }))}
                          className="flex-1 h-1 accent-primary"
                        />
                        <span className="text-xs font-mono w-12 text-right">{subtitleStyle.outline_width}</span>
                      </div>
                      {/* Outline color */}
                      <div className={`flex items-center gap-2 transition-opacity ${subtitleStyle.outline_width === 0 ? "opacity-40 pointer-events-none" : ""}`}>
                        <span className="text-xs text-muted-foreground w-16">색상</span>
                        <input
                          type="color"
                          value={assToHex(subtitleStyle.outline_color)}
                          onChange={(e) => setSubtitleStyle(s => ({ ...s, outline_color: hexToAss(e.target.value) }))}
                          className="w-7 h-7 rounded border border-muted cursor-pointer bg-transparent p-0"
                        />
                        <span className="text-xs font-mono text-muted-foreground">{assToHex(subtitleStyle.outline_color).toUpperCase()}</span>
                      </div>
                    </div>

                    <div className="border-t" />

                    {/* Position */}
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">위치</span>
                      <div className="flex gap-1.5">
                        {POSITION_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            onClick={() => setSubtitleStyle(s => ({ ...s, alignment: p.alignment, margin_v: p.margin_v }))}
                            className={`flex-1 px-3 py-1.5 text-xs rounded-md border transition-all ${
                              subtitleStyle.alignment === p.alignment
                                ? "bg-primary/15 text-primary border-primary/30 font-medium"
                                : "border-muted hover:bg-accent"
                            }`}
                          >
                            {p.label === "Bottom" ? "하단" :
                             p.label === "Center" ? "중앙" : "상단"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b">
                {currentStep === "edit" && segments.length > 0 && (
                  <button
                    onClick={() => setCurrentStep("translate")}
                    className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    {t("translateSubtitle")} →
                  </button>
                )}
                {currentStep === "translate" && (
                  <div className="flex flex-col gap-2 w-full">
                    {/* Provider selection */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{t("aiProvider")}:</span>
                      {AI_PROVIDERS.map((p) => (
                        <ChipButton
                          key={p.id}
                          selected={provider === p.id}
                          onClick={() => handleProviderChange(p.id)}
                        >
                          {p.name}
                        </ChipButton>
                      ))}
                    </div>

                    {/* Model selection (only if provider has 2+ models) */}
                    {(() => {
                      const currentProvider = getProvider(provider)
                      return currentProvider && currentProvider.models.length > 1 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{t("model")}:</span>
                          {currentProvider.models.map((m) => (
                            <ChipButton
                              key={m}
                              selected={selectedModel === m}
                              onClick={() => setSelectedModel(m)}
                            >
                              {m}
                            </ChipButton>
                          ))}
                        </div>
                      ) : null
                    })()}

                    {/* Translate button / progress */}
                    <div className="flex items-center gap-2">
                      {!translating ? (
                        <button
                          onClick={handleTranslate}
                          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                          {t("translateSubtitle")}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${jobProgress.progress * 100}%` }}
                            />
                          </div>
                          <span className="text-xs">{Math.round(jobProgress.progress * 100)}%</span>
                          <button
                            onClick={cancelJob}
                            className="px-2 py-0.5 text-xs text-destructive border rounded hover:bg-destructive/10"
                          >
                            {t("cancel")}
                          </button>
                        </div>
                      )}
                      {translateError && (
                        <span className="text-xs text-destructive">{translateError}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Re-recognize (STT) button — always available */}
                <button
                  onClick={() => setCurrentStep("stt")}
                  className="px-2 py-1 text-xs border rounded-md hover:bg-accent text-muted-foreground"
                  title={t("reRecognize")}
                >
                  {t("reRecognize")}
                </button>

                <div className="flex-1" />

                {/* Subtitle selector if multiple */}
                {subtitles.length > 1 && (
                  <select
                    value={activeSubtitleId ?? ""}
                    onChange={(e) => setActiveSubtitleId(Number(e.target.value))}
                    className="text-xs border rounded px-2 py-1 bg-background"
                  >
                    {subtitles.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label || `#${s.id}`} ({s.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Segment editor */}
              <SubtitleEditor
                segments={segments}
                currentTime={currentTime}
                onSeek={handleSeek}
                onSegmentsChange={refreshSegments}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
