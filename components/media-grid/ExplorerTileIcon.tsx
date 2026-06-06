"use client"

import {
  FileTextIcon,
  FilmIcon,
  Gamepad2Icon,
  ImageIcon,
  MusicIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type ExplorerTileIconKind =
  | "folder"
  | "folder-new"
  | "game"
  | "video"
  | "audio"
  | "subtitle"
  | "novel"
  | "manga"

const fileGlyphs: Record<Exclude<ExplorerTileIconKind, "folder" | "folder-new">, LucideIcon> = {
  game: Gamepad2Icon,
  video: FilmIcon,
  audio: MusicIcon,
  subtitle: FileTextIcon,
  novel: FileTextIcon,
  manga: ImageIcon,
}

interface ExplorerTileIconProps {
  kind: ExplorerTileIconKind
  className?: string
  thumbnail?: string
}

export function ExplorerTileIcon({ kind, className, thumbnail }: ExplorerTileIconProps) {
  if (kind === "folder" || kind === "folder-new") {
    const isNew = kind === "folder-new"

    return (
      <div className={cn("relative h-16 w-20", className)} aria-hidden="true">
        {isNew ? (
          <>
            <div className="absolute left-2 top-2 h-5 w-8 rounded-t-md border-2 border-b-0 border-dashed border-text-tertiary/70" />
            <div className="absolute inset-x-1 bottom-2 h-10 rounded-md border-2 border-dashed border-text-tertiary/70 bg-transparent" />
            <PlusIcon className="absolute left-1/2 top-[2.05rem] size-7 -translate-x-1/2 -translate-y-1/2 text-accent" strokeWidth={2.2} />
          </>
        ) : (
          <>
            <div className="absolute left-2 top-2 h-5 w-9 rounded-t-md border border-white/10 bg-accent/75" />
            <div className="absolute left-1 right-2 top-4 h-4 rounded-t-md border border-white/10 bg-accent/80" />
            <div className="absolute inset-x-1 bottom-2 h-10 rounded-md border border-white/10 bg-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]" />
          </>
        )}
      </div>
    )
  }

  const Glyph = fileGlyphs[kind]
  const thumbnailUrl = thumbnail?.trim()

  if (thumbnailUrl) {
    return (
      <div
        className={cn(
          "relative h-[76px] w-full max-w-[112px] overflow-hidden rounded-lg border border-border-subtle bg-surface-elevated bg-cover bg-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          className,
        )}
        style={{ backgroundImage: `url("${thumbnailUrl}")` }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-white/5" />
        <div
          className="absolute right-0 top-0 h-5 w-5 rounded-tr-lg bg-accent/90 shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)]"
          style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
        />
        <div className="absolute bottom-1 left-1 rounded bg-background/75 p-0.5 text-accent shadow-sm backdrop-blur-sm">
          <Glyph className="size-3" strokeWidth={2} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative flex h-16 w-14 items-center justify-center rounded-md border border-border-subtle bg-surface-elevated shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
      aria-hidden="true"
    >
      <div
        className="absolute right-0 top-0 h-5 w-5 rounded-tr-md bg-accent/90 shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)]"
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
      />
      <Glyph className="relative z-10 size-7 text-accent" strokeWidth={1.9} />
    </div>
  )
}
