"use client"

import { useCallback, useRef, useState } from "react"

// --- Module-level drag state (avoids dataTransfer serialization issues) ---

export type MediaDragType = "game" | "video" | "audio" | "manga" | "novel"
export type MediaDragOperation = "move"

export interface DragPayload {
  version: 2
  type: MediaDragType
  primaryId: number
  ids: number[]
  sourceSurface: string
  operation: MediaDragOperation
}

interface LegacyDragPayload {
  type: MediaDragType
  id: number
}

let _draggedItem: DragPayload | null = null

export function getDraggedItem() {
  return _draggedItem
}

const MIME = "application/x-media-item"
export const MEDIA_DND_MIME = MIME

function hasMediaPayload(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(MIME)
}

export function hasExternalFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes("Files")
}

export function buildDragPayload({
  type,
  primaryId,
  ids,
  sourceSurface,
  operation = "move",
}: {
  type: MediaDragType
  primaryId: number
  ids?: number[]
  sourceSurface: string
  operation?: MediaDragOperation
}): DragPayload {
  const uniqueIds = Array.from(new Set([primaryId, ...(ids ?? [])])).filter((id) => Number.isFinite(id))
  return {
    version: 2,
    type,
    primaryId,
    ids: uniqueIds.length ? uniqueIds : [primaryId],
    sourceSurface,
    operation,
  }
}

function normalizePayload(value: unknown): DragPayload | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<DragPayload & LegacyDragPayload>
  if (!raw.type || !["game", "video", "audio", "manga", "novel"].includes(raw.type)) return null

  if (raw.version === 2 && typeof raw.primaryId === "number" && Array.isArray(raw.ids)) {
    const ids = raw.ids.filter((id) => typeof id === "number" && Number.isFinite(id))
    if (!ids.length) return null
    return buildDragPayload({
      type: raw.type,
      primaryId: raw.primaryId,
      ids,
      sourceSurface: raw.sourceSurface || raw.type,
      operation: raw.operation === "move" ? "move" : "move",
    })
  }

  if (typeof raw.id === "number" && Number.isFinite(raw.id)) {
    return buildDragPayload({
      type: raw.type,
      primaryId: raw.id,
      ids: [raw.id],
      sourceSurface: raw.type,
      operation: "move",
    })
  }

  return null
}

export function parseDragPayload(e: React.DragEvent): DragPayload | null {
  if (_draggedItem) return _draggedItem
  if (!hasMediaPayload(e)) return null
  try {
    return normalizePayload(JSON.parse(e.dataTransfer.getData(MIME)))
  } catch {
    return null
  }
}

export function setDragPayload(e: React.DragEvent, payload: DragPayload) {
  _draggedItem = payload
  e.dataTransfer.setData(MIME, JSON.stringify(payload))
  if (payload.type === "game") {
    e.dataTransfer.setData("application/x-game-id", String(payload.primaryId))
  }
  e.dataTransfer.effectAllowed = "move"
}

export function clearDragPayload() {
  _draggedItem = null
}

// --- useDragItem: makes an element draggable ---

export function useDragItem(
  type: MediaDragType,
  id: number,
  options?: {
    getIds?: (primaryId: number) => number[]
    sourceSurface?: string
  },
) {
  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      const payload = buildDragPayload({
        type,
        primaryId: id,
        ids: options?.getIds?.(id) ?? [id],
        sourceSurface: options?.sourceSurface ?? type,
      })
      setDragPayload(e, payload)
    },
    [type, id, options],
  )

  const onDragEnd = useCallback(() => {
    clearDragPayload()
  }, [])

  return { onDragStart, onDragEnd, draggable: true }
}

// --- useDropTarget: makes a folder/category item a drop target ---

export function useDropTarget(
  onDrop: (item: DragPayload) => void,
  options?: {
    acceptType?: MediaDragType
    sourceSurface?: string
  },
) {
  const [isOver, setIsOver] = useState(false)

  const accepts = useCallback(
    (payload: DragPayload | null) => {
      if (!payload) return false
      if (payload.operation !== "move") return false
      if (options?.acceptType && payload.type !== options.acceptType) return false
      return payload.ids.length > 0
    },
    [options],
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      // Only accept internal media items, not external files
      if (!hasMediaPayload(e) || hasExternalFiles(e)) return
      const payload = parseDragPayload(e)
      if (!accepts(payload)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = "move"
      setIsOver(true)
    },
    [accepts],
  )

  const onDragLeave = useCallback(() => {
    setIsOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasMediaPayload(e) || hasExternalFiles(e)) return
      const item = parseDragPayload(e)
      if (!item || !accepts(item)) return
      e.preventDefault()
      e.stopPropagation()
      setIsOver(false)
      onDrop(item)
      clearDragPayload()
    },
    [accepts, onDrop],
  )

  return { isOver, onDragOver, onDragLeave, onDrop: handleDrop }
}

// --- useMergeTarget: hover 500ms on another card → merge indicator ---

export function useMergeTarget(
  onMerge: (payload: DragPayload) => void,
  delayMs = 500,
  options?: {
    acceptType?: MediaDragType
  },
) {
  const [showMerge, setShowMerge] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!hasMediaPayload(e) || hasExternalFiles(e)) return
      const payload = parseDragPayload(e)
      if (!payload || payload.operation !== "move") return
      if (options?.acceptType && payload.type !== options.acceptType) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = "move"
      if (!timerRef.current && !showMerge) {
        timerRef.current = setTimeout(() => {
          setShowMerge(true)
          timerRef.current = null
        }, delayMs)
      }
    },
    [delayMs, options, showMerge],
  )

  const onDragLeave = useCallback(() => {
    clearTimer()
    setShowMerge(false)
  }, [clearTimer])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasMediaPayload(e) || hasExternalFiles(e)) return
      const item = parseDragPayload(e)
      if (!item || item.operation !== "move") return
      if (options?.acceptType && item.type !== options.acceptType) return
      e.preventDefault()
      e.stopPropagation()
      clearTimer()
      setShowMerge(false)
      onMerge(item)
      clearDragPayload()
    },
    [onMerge, clearTimer, options],
  )

  return { showMerge, onDragOver, onDragLeave, onDrop: handleDrop }
}
