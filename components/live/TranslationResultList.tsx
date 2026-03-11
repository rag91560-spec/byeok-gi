"use client"

import { cn } from "@/lib/utils"
import { ClockIcon, Trash2Icon, SparklesIcon, ScanEyeIcon } from "lucide-react"
import type { LiveTranslationResult } from "@/lib/types"

interface TranslationResultListProps {
  results: LiveTranslationResult[]
  onClear: () => void
}

export function TranslationResultList({ results, onClear }: TranslationResultListProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <ScanEyeIcon className="size-10 mb-3 opacity-30" />
        <p className="text-sm">번역 결과가 여기에 표시됩니다</p>
        <p className="text-xs mt-1">윈도우를 선택하고 캡처 버튼을 눌러보세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">번역 결과 ({results.length})</h3>
        <button
          onClick={onClear}
          className="text-text-tertiary hover:text-red-400 transition-colors"
          title="전체 삭제"
        >
          <Trash2Icon className="size-4" />
        </button>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-480px)] overflow-y-auto">
        {results.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  )
}

function ResultCard({ result }: { result: LiveTranslationResult }) {
  const time = new Date(result.timestamp)
  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`

  return (
    <div className="rounded-lg border border-border-subtle bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {result.mode === "vision" ? (
            <SparklesIcon className="size-3.5 text-amber-400" />
          ) : (
            <ScanEyeIcon className="size-3.5 text-accent" />
          )}
          <span className="text-[10px] font-medium text-text-tertiary uppercase">
            {result.mode === "vision" ? "Vision" : "OCR"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-tertiary">
          <ClockIcon className="size-3" />
          <span className="text-[10px]">{timeStr}</span>
        </div>
      </div>

      {/* Original */}
      <div>
        <p className="text-[10px] text-text-tertiary mb-0.5">원문</p>
        <p className="text-sm text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
          {result.original}
        </p>
      </div>

      {/* Translation */}
      <div className="border-t border-border-subtle pt-2">
        <p className="text-[10px] text-text-tertiary mb-0.5">번역</p>
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed font-medium">
          {result.translated}
        </p>
      </div>
    </div>
  )
}
