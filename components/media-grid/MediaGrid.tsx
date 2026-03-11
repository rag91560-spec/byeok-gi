"use client"

import type { ReactNode } from "react"

interface MediaGridProps {
  children: ReactNode
}

export function MediaGrid({ children }: MediaGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {children}
    </div>
  )
}
