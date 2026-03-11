"use client"

import { cn } from "@/lib/utils"
import {
  CameraIcon,
  PlayIcon,
  SquareIcon,
  CropIcon,
  XIcon,
  LayersIcon,
  EyeIcon,
  EyeOffIcon,
  Settings2Icon,
} from "lucide-react"
import type { LiveSettings, CaptureSource } from "@/lib/types"

interface CapturePanelProps {
  settings: LiveSettings
  onUpdateSettings: (patch: Partial<LiveSettings>) => void
  loading: boolean
  capturing: boolean
  onCapture: () => void
  onStartAuto: () => void
  onStopAuto: () => void
  onSelectRegion: () => void
  onClearRegion: () => void
  onToggleOverlay: () => void
}

export function CapturePanel({
  settings,
  onUpdateSettings,
  loading,
  capturing,
  onCapture,
  onStartAuto,
  onStopAuto,
  onSelectRegion,
  onClearRegion,
  onToggleOverlay,
}: CapturePanelProps) {
  return (
    <div className="space-y-4">
      {/* Capture controls */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onCapture}
          disabled={!settings.sourceId || loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            "bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <CameraIcon className="size-4" />
          {loading ? "캡처 중..." : "캡처 + 번역"}
        </button>

        {!capturing ? (
          <button
            onClick={onStartAuto}
            disabled={!settings.sourceId}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-overlay-4 transition-all disabled:opacity-50"
          >
            <PlayIcon className="size-4" />
            자동 캡처
          </button>
        ) : (
          <button
            onClick={onStopAuto}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
          >
            <SquareIcon className="size-4" />
            자동 중지
          </button>
        )}

        <button
          onClick={onToggleOverlay}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all",
            settings.overlayEnabled
              ? "border-accent/30 text-accent bg-accent/10"
              : "border-border-subtle text-text-secondary hover:text-text-primary hover:bg-overlay-4"
          )}
        >
          {settings.overlayEnabled ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
          오버레이
        </button>
      </div>

      {/* Region */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSelectRegion}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-overlay-4 transition-all"
        >
          <CropIcon className="size-3.5" />
          영역 선택
        </button>
        {settings.region && (
          <>
            <span className="text-[11px] text-text-tertiary">
              {Math.round(settings.region.width)}x{Math.round(settings.region.height)}
            </span>
            <button onClick={onClearRegion} className="text-text-tertiary hover:text-red-400">
              <XIcon className="size-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-text-tertiary mb-1 block">OCR 언어</label>
          <select
            value={settings.language}
            onChange={(e) => onUpdateSettings({ language: e.target.value })}
            className="w-full bg-overlay-4 border border-border-subtle rounded-lg px-2.5 py-1.5 text-sm text-text-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
          >
            <option value="ja">일본어</option>
            <option value="zh">중국어 (간체)</option>
            <option value="zh-tw">중국어 (번체)</option>
            <option value="ko">한국어</option>
            <option value="en">영어</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-text-tertiary mb-1 block">OCR 엔진</label>
          <select
            value={settings.ocrEngine}
            onChange={(e) => onUpdateSettings({ ocrEngine: e.target.value as LiveSettings["ocrEngine"] })}
            className="w-full bg-overlay-4 border border-border-subtle rounded-lg px-2.5 py-1.5 text-sm text-text-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
          >
            <option value="auto">자동 (추천)</option>
            <option value="winocr">Windows OCR</option>
            <option value="tesseract">Tesseract</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-text-tertiary mb-1 block">번역 제공자</label>
          <select
            value={settings.provider}
            onChange={(e) => onUpdateSettings({ provider: e.target.value })}
            className="w-full bg-overlay-4 border border-border-subtle rounded-lg px-2.5 py-1.5 text-sm text-text-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
          >
            <option value="test">테스트 (API 키 불필요)</option>
            <option value="claude">Claude</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-text-tertiary mb-1 block">대상 언어</label>
          <select
            value={settings.targetLang}
            onChange={(e) => onUpdateSettings({ targetLang: e.target.value })}
            className="w-full bg-overlay-4 border border-border-subtle rounded-lg px-2.5 py-1.5 text-sm text-text-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
          >
            <option value="ko">한국어</option>
            <option value="en">영어</option>
            <option value="zh">중국어</option>
          </select>
        </div>
      </div>

      {/* Advanced toggles */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={settings.useVision}
            onChange={(e) => onUpdateSettings({ useVision: e.target.checked })}
            className="accent-accent"
          />
          Vision API (이미지 직접 분석)
        </label>

        <div className="flex items-center gap-2">
          <label className="text-[11px] text-text-tertiary">자동 간격</label>
          <select
            value={settings.autoIntervalMs}
            onChange={(e) => onUpdateSettings({ autoIntervalMs: Number(e.target.value) })}
            className="bg-overlay-4 border border-border-subtle rounded px-2 py-1 text-xs text-text-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
          >
            <option value={1000}>1초</option>
            <option value={2000}>2초</option>
            <option value={3000}>3초</option>
            <option value={5000}>5초</option>
          </select>
        </div>
      </div>

      {/* Hotkey hints */}
      <div className="text-[11px] text-text-tertiary space-y-0.5">
        <p>Ctrl+Shift+T: 캡처  |  Ctrl+Shift+O: 오버레이  |  Ctrl+Shift+R: 영역 선택</p>
      </div>
    </div>
  )
}
