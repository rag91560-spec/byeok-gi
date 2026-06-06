"use client"

export interface DropImportSummary {
  success: number
  duplicates: number
  unsupported: number
  failed: number
}

export const AUDIO_DROP_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".m4a",
  ".aac",
  ".opus",
  ".aiff",
  ".aif",
  ".wma",
])

export const VIDEO_DROP_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".mov",
  ".avi",
  ".webm",
  ".m4v",
  ".wmv",
  ".flv",
  ".mpeg",
  ".mpg",
])

export const MANGA_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".bmp",
  ".webp",
])

export const NOVEL_DROP_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".log",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".srt",
  ".vtt",
  ".ass",
  ".ssa",
  ".rpy",
  ".ks",
  ".epub",
  ".pdf",
])

export const NOVEL_READABLE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".log",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".srt",
  ".vtt",
  ".ass",
  ".ssa",
  ".rpy",
  ".ks",
])

export function emptyDropImportSummary(): DropImportSummary {
  return { success: 0, duplicates: 0, unsupported: 0, failed: 0 }
}

export function getDroppedFilePath(file: File): string {
  if (typeof window === "undefined") return ""
  return window.electronAPI?.getPathForFile?.(file) || (file as File & { path?: string }).path || ""
}

export function getPathExtension(value: string): string {
  const name = getPathBaseName(value).toLowerCase()
  const dot = name.lastIndexOf(".")
  return dot > -1 ? name.slice(dot) : ""
}

export function getPathBaseName(value: string): string {
  return value.split(/[\\/]/).pop() || value
}

export function getPathTitle(value: string): string {
  const baseName = getPathBaseName(value)
  const dot = baseName.lastIndexOf(".")
  return dot > 0 ? baseName.slice(0, dot) : baseName
}

export function isLikelyFolderDrop(file: File, path: string): boolean {
  return Boolean(path) && !getPathExtension(path) && file.size === 0
}

export function isDuplicateImportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /409|already|duplicate|duplicated|이미|중복|등록/i.test(message)
}

export function formatDropImportSummary(t: (key: "importDropSummary") => string, summary: DropImportSummary): string {
  return t("importDropSummary")
    .replace("{success}", String(summary.success))
    .replace("{duplicates}", String(summary.duplicates))
    .replace("{unsupported}", String(summary.unsupported))
    .replace("{failed}", String(summary.failed))
}
