"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import { MonitorIcon, AppWindowIcon, RefreshCwIcon } from "lucide-react"
import type { CaptureSource } from "@/lib/types"

interface WindowSelectorProps {
  sources: CaptureSource[]
  selectedId: string
  onSelect: (source: CaptureSource) => void
  onRefresh: () => void
}

export function WindowSelector({ sources, selectedId, onSelect, onRefresh }: WindowSelectorProps) {
  const { t } = useLocale()

  useEffect(() => {
    if (sources.length === 0) onRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const screens = sources.filter((s) => s.isScreen)
  const windows = sources.filter((s) => !s.isScreen)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">캡처 대상</h3>
        <button
          onClick={onRefresh}
          className="text-text-tertiary hover:text-text-primary transition-colors"
          title="새로고침"
        >
          <RefreshCwIcon className="size-4" />
        </button>
      </div>

      {sources.length === 0 ? (
        <p className="text-xs text-text-tertiary py-4 text-center">캡처 가능한 윈도우를 불러오는 중...</p>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {screens.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary px-1 pt-1">화면</p>
              {screens.map((s) => (
                <SourceItem key={s.id} source={s} selected={selectedId === s.id} onSelect={onSelect} />
              ))}
            </>
          )}
          {windows.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary px-1 pt-2">윈도우</p>
              {windows.map((s) => (
                <SourceItem key={s.id} source={s} selected={selectedId === s.id} onSelect={onSelect} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SourceItem({ source, selected, onSelect }: { source: CaptureSource; selected: boolean; onSelect: (s: CaptureSource) => void }) {
  return (
    <button
      onClick={() => onSelect(source)}
      className={cn(
        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-all text-sm",
        selected
          ? "bg-accent/15 text-accent border border-accent/30"
          : "text-text-secondary hover:bg-overlay-4 hover:text-text-primary border border-transparent"
      )}
    >
      {source.icon ? (
        <img src={source.icon} alt="" className="size-5 shrink-0 rounded" />
      ) : source.isScreen ? (
        <MonitorIcon className="size-5 shrink-0" />
      ) : (
        <AppWindowIcon className="size-5 shrink-0" />
      )}
      <span className="truncate text-[13px]">{source.name}</span>
    </button>
  )
}
