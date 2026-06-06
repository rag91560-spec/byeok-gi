"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable
}

function isSelectionControlTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      [
        "[data-testid^='media-card-']",
        "[data-testid^='folder-card-']",
        "[data-testid^='media-select-']",
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "[role='button']",
        "[role='menuitem']",
      ].join(",")
    )
  )
}

export function useOsSelection(visibleIds: number[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const selectedIdsRef = useRef(selectedIds)
  const anchorIdRef = useRef<number | null>(null)

  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds])

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set<number>()
      prev.forEach((id) => {
        if (visibleSet.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [visibleSet])

  const getValidSelectedIds = useCallback(() => {
    const ids = Array.from(selectedIdsRef.current).filter((id) => visibleSet.has(id))
    if (ids.length !== selectedIdsRef.current.size) {
      const pruned = new Set(ids)
      selectedIdsRef.current = pruned
      setSelectedIds(pruned)
    }
    return ids
  }, [visibleSet])

  const clearSelection = useCallback(() => {
    anchorIdRef.current = null
    selectedIdsRef.current = new Set()
    setSelectedIds(new Set())
  }, [])

  const toggleId = useCallback((id: number, checked?: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const shouldSelect = checked ?? !next.has(id)
      if (shouldSelect) next.add(id)
      else next.delete(id)
      selectedIdsRef.current = next
      return next
    })
    anchorIdRef.current = id
  }, [])

  const selectRangeTo = useCallback((id: number) => {
    const anchorId = anchorIdRef.current ?? id
    const start = visibleIds.indexOf(anchorId)
    const end = visibleIds.indexOf(id)
    if (start < 0 || end < 0) {
      toggleId(id, true)
      return
    }
    const [from, to] = start <= end ? [start, end] : [end, start]
    setSelectedIds((prev) => {
      const next = new Set(prev)
      visibleIds.slice(from, to + 1).forEach((rangeId) => next.add(rangeId))
      selectedIdsRef.current = next
      return next
    })
  }, [toggleId, visibleIds])

  const handleItemClick = useCallback((id: number, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      event.stopPropagation()
      toggleId(id)
      return true
    }
    if (event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      selectRangeTo(id)
      return true
    }
    if (selectedIdsRef.current.size > 0) {
      event.preventDefault()
      event.stopPropagation()
      const next = new Set([id])
      selectedIdsRef.current = next
      setSelectedIds(next)
      anchorIdRef.current = id
      return true
    }
    return false
  }, [selectRangeTo, toggleId])

  const handleCheckboxSelect = useCallback((id: number, checked: boolean) => {
    toggleId(id, checked)
  }, [toggleId])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isEditableTarget(event.target)) return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault()
      const next = new Set(visibleIds)
      selectedIdsRef.current = next
      setSelectedIds(next)
    } else if (event.key === "Escape") {
      event.preventDefault()
      clearSelection()
    }
  }, [clearSelection, visibleIds])

  const handleBlankMouseDown = useCallback((event: React.MouseEvent) => {
    if (!event.currentTarget.contains(event.target as Node)) return
    if (isSelectionControlTarget(event.target)) return
    clearSelection()
  }, [clearSelection])

  const getDragIds = useCallback((primaryId: number) => {
    const valid = getValidSelectedIds()
    return valid.includes(primaryId) ? valid : [primaryId]
  }, [getValidSelectedIds])

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    setSelectedIds,
    clearSelection,
    handleItemClick,
    handleCheckboxSelect,
    handleKeyDown,
    handleBlankMouseDown,
    getValidSelectedIds,
    getDragIds,
  }
}
