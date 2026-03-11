"use client"

import { useEffect } from "react"
import { ScanEyeIcon, AlertTriangleIcon } from "lucide-react"
import { useLiveTranslation } from "@/hooks/use-live-translation"
import { useLocale } from "@/hooks/use-locale"
import { WindowSelector } from "@/components/live/WindowSelector"
import { CapturePanel } from "@/components/live/CapturePanel"
import { TranslationResultList } from "@/components/live/TranslationResultList"

export default function LivePage() {
  const { t } = useLocale()
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
          <h1 className="text-xl font-bold text-text-primary">라이브 번역</h1>
        </div>
        <p className="text-sm text-text-secondary">
          실시간 화면 캡처 + OCR + AI 번역. 모든 게임에서 사용 가능합니다.
        </p>
      </div>

      {!isElectron && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20 mb-6">
          <AlertTriangleIcon className="size-5 text-warning shrink-0" />
          <p className="text-sm text-warning">
            라이브 번역은 데스크톱 앱에서만 사용할 수 있습니다. Electron 환경에서 실행해주세요.
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
            />
          </div>

          {/* Last capture preview */}
          {lastCapture && (
            <div className="rounded-xl border border-border-subtle bg-card p-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">마지막 캡처</h3>
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
        <p>* 전체화면(Exclusive Fullscreen) 게임에서는 오버레이가 표시되지 않습니다. "보더리스 윈도우" 모드를 사용해주세요.</p>
        <p>* 일본어/중국어 OCR 사용 시 Windows 설정 → 시간 및 언어 → 언어에서 해당 언어 팩이 설치되어 있어야 합니다.</p>
      </div>
    </div>
  )
}
