"use client"

import type { MouseEventHandler, ReactNode } from "react"

interface MediaGridProps {
  children: ReactNode
  onMouseDown?: MouseEventHandler<HTMLDivElement>
}

export function MediaGrid({ children, onMouseDown }: MediaGridProps) {
  return (
    <div
      className="explorer-tile-grid"
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  )
}
