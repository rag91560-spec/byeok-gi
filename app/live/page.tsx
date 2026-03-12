"use client"

import { useEffect } from "react"
import { ScanEyeIcon, AlertTriangleIcon } from "lucide-react"
import { useLiveTranslation } from "@/hooks/use-live-translation"
import { useLicenseStatus } from "@/hooks/use-api"
import { useLocale } from "@/hooks/use-locale"
import { WindowSelector } from "@/components/live/WindowSelector"
import { CapturePanel } from "@/components/live/CapturePanel"
import { TranslationResultList } from "@/components/live/TranslationResultList"

export default function LivePage() {
  const { t } = useLocale()
  const { license } = useLicenseStatus()
  const {
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
  } = useLiveTranslation()

  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ScanEyeIcon className="size-6 text-accent" />
          <h1 className="text-xl font-bold text-text-primary">{t("liveTranslation")}</h1>
        </div>
        <p className="text-sm text-text-secondary">
          {t("liveTranslationDesc")}
        </p>
      </div>

      {!isElectron && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20 mb-6">
          <AlertTriangleIcon className="size-5 text-warning shrink-0" />
          <p className="text-sm text-warning">
            {t("liveElectronOnly")}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Source selection + Capture settings */}
        <div className="lg:col-span-1 space-y-6">
          {/* Window Selector */}
          <div className="rounded-xl border border-border-subtle bg-card p-4">
            <WindowSelector
              sources={sources}
              selectedId={settings.sourceId}
              onSelect={(s) => updateSettings({ sourceId: s.id, sourceName: s.name })}
              onRefresh={refreshSources}
            />
          </div>

          {/* Capture Panel */}
          <div className="rounded-xl border border-border-subtle bg-card p-4">
            <CapturePanel
              settings={settings}
              onUpdateSettings={updateSettings}
              loading={loading}
              capturing={capturing}
              onCapture={captureAndTranslate}
              onStartAuto={startAutoCapture}
              onStopAuto={stopAutoCapture}
              onSelectRegion={selectRegion}
              onClearRegion={clearRegion}
              onToggleOverlay={toggleOverlay}
              licensed={license.valid}
            />
          </div>

          {/* Last capture preview */}
          {lastCapture && (
            <div className="rounded-xl border border-border-subtle bg-card p-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">{t("lastCapture")}</h3>
              <img
                src={lastCapture}
                alt="Last capture"
                className="w-full rounded-lg border border-border-subtle"
              />
            </div>
          )}
        </div>

        {/* Right: Translation results */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border-subtle bg-card p-4">
            <TranslationResultList results={results} onClear={clearResults} />
          </div>
        </div>
      </div>

      {/* Fullscreen warning */}
      <div className="mt-6 text-[11px] text-text-tertiary space-y-1">
        <p>* {t("fullscreenWarning")}</p>
        <p>* {t("ocrLanguagePackNotice")}</p>
      </div>
    </div>
  )
}
