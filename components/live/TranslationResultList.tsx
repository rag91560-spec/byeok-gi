"use client"

import { useLocale } from "@/hooks/use-locale"
import { ClockIcon, Trash2Icon, SparklesIcon, ScanEyeIcon } from "lucide-react"
import type { LiveTranslationResult } from "@/lib/types"

interface TranslationResultListProps {
  results: LiveTranslationResult[]
  onClear: () => void
}

export function TranslationResultList({ results, onClear }: TranslationResultListProps) {
  const { t } = useLocale()

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <ScanEyeIcon className="size-10 mb-3 opacity-30" />
        <p className="text-sm">{t("translationResultsEmpty")}</p>
        <p className="text-xs mt-1">{t("selectWindowAndCapture")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="min-w-0 truncate text-sm font-medium text-text-primary">{t("translationResults")} ({results.length})</h3>
        <button
          onClick={onClear}
          className="shrink-0 rounded p-1 text-text-tertiary hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 transition-colors"
          title={t("clearAll")}
        >
          <Trash2Icon className="size-4" />
        </button>
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 lg:max-h-[calc(100vh-480px)]">
        {results.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  )
}

function ResultCard({ result }: { result: LiveTranslationResult }) {
  const { t } = useLocale()
  const time = new Date(result.timestamp)
  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}`

  return (
    <div className="rounded-lg border border-border-subtle bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {result.mode === "vision" ? (
            <SparklesIcon className="size-3.5 text-amber-400" />
          ) : (
            <ScanEyeIcon className="size-3.5 text-accent" />
          )}
          <span className="truncate text-[10px] font-medium text-text-tertiary uppercase">
            {result.mode === "vision" ? "Vision" : "OCR"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-text-tertiary">
          <ClockIcon className="size-3" />
          <span className="text-[10px]">{timeStr}</span>
        </div>
      </div>

      {/* Original */}
      <div>
        <p className="text-[10px] text-text-tertiary mb-0.5">{t("original")}</p>
        <p className="text-sm text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
          {result.original}
        </p>
      </div>

      {/* Translation */}
      <div className="border-t border-border-subtle pt-2">
        <p className="text-[10px] text-text-tertiary mb-0.5">{t("translation")}</p>
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed font-medium">
          {result.translated}
        </p>
      </div>
    </div>
  )
}
