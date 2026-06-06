"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface LibraryEmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  detail?: ReactNode
  children?: ReactNode
  className?: string
}

export function LibraryEmptyState({
  icon,
  title,
  description,
  detail,
  children,
  className,
}: LibraryEmptyStateProps) {
  return (
    <div
      data-testid="library-empty-state"
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center py-20 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-16 items-center justify-center text-text-tertiary/70 [&_svg]:size-14 [&_svg]:stroke-[1.7]">
          {icon}
        </div>
      ) : null}
      <p className="text-base font-medium text-text-secondary">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-text-tertiary">{description}</p>
      ) : null}
      {detail ? (
        <p className="mt-1 max-w-sm text-xs text-text-tertiary">{detail}</p>
      ) : null}
      {children ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2 [&_button]:rounded-full [&_button]:px-5">
          {children}
        </div>
      ) : null}
    </div>
  )
}
