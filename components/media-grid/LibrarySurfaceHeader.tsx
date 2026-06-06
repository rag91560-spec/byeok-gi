"use client"

import type { ReactNode } from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LibrarySurfaceHeaderProps {
  icon?: ReactNode
  title?: ReactNode
  meta?: ReactNode
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchAriaLabel?: string
  clearSearchLabel?: string
  onClearSearch?: () => void
  leadingControls?: ReactNode
  filterSlot?: ReactNode
  secondaryActions?: ReactNode
  primaryAction?: ReactNode
  className?: string
  searchClassName?: string
  actionsClassName?: string
}

/**
 * Presentational library header shell. Pages own all filtering, fetching,
 * selection, folder, delete, restore, and action behavior.
 */
export function LibrarySurfaceHeader({
  icon,
  title,
  meta,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  clearSearchLabel = "Clear search",
  onClearSearch,
  leadingControls,
  filterSlot,
  secondaryActions,
  primaryAction,
  className,
  searchClassName,
  actionsClassName,
}: LibrarySurfaceHeaderProps) {
  const hasTitleRow = Boolean(icon || title || meta)
  const hasActionGroup = Boolean(secondaryActions || primaryAction)
  const showClear = Boolean(searchValue && onClearSearch)

  return (
    <header className={cn("shrink-0 space-y-3", className)} data-testid="library-surface-header">
      {hasTitleRow ? (
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              {icon ? <div className="shrink-0 text-accent">{icon}</div> : null}
              {title ? (
                <div className="min-w-0 truncate text-2xl font-bold text-text-primary">
                  {title}
                </div>
              ) : null}
            </div>
            {meta ? <div className="mt-1 text-sm text-text-secondary">{meta}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {leadingControls ? <div className="min-w-0 shrink-0">{leadingControls}</div> : null}

        <div className={cn("relative min-w-[220px] flex-1", searchClassName)}>
          <SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel ?? searchPlaceholder}
            className="h-11 w-full rounded-xl border border-border bg-surface-elevated pl-10 pr-10 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          {showClear ? (
            <button
              type="button"
              onClick={onClearSearch}
              aria-label={clearSearchLabel}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-background hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>

        {filterSlot ? (
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{filterSlot}</div>
        ) : null}

        {hasActionGroup ? (
          <div className={cn("flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2", actionsClassName)}>
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </div>
    </header>
  )
}
