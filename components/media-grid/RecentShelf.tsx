"use client"

import * as React from "react"

interface RecentShelfProps {
  title: string
  subtitle?: string
  icon: React.ReactNode
  children: React.ReactNode
}

export function RecentShelf({ title, subtitle, icon, children }: RecentShelfProps) {
  return (
    <section className="shrink-0 border-t border-border-subtle pt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-overlay-4 text-accent">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="truncate text-xs text-text-tertiary">{subtitle}</p>}
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-3">
          {React.Children.map(children, (child) => (
            <div className="w-[136px] shrink-0 sm:w-[156px]">{child}</div>
          ))}
        </div>
      </div>
    </section>
  )
}
