"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react"
import {
  BookOpenIcon,
  BookTextIcon,
  ClockIcon,
  FileAudioIcon,
  FileVideoIcon,
  Gamepad2Icon,
  Loader2Icon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { LibraryEmptyState } from "@/components/media-grid/LibraryEmptyState"
import { LibrarySurfaceHeader } from "@/components/media-grid/LibrarySurfaceHeader"
import { RecentShelf } from "@/components/media-grid/RecentShelf"
import { useLocale, type TranslationKey } from "@/hooks/use-locale"
import { api, type LibraryMutationResult } from "@/lib/api"
import { appConfirm } from "@/lib/utils"
import type { AudioItem, Game, MangaItem, NovelItem, VideoItem } from "@/lib/types"

type TrashSurface = "games" | "videos" | "audio" | "manga" | "novels"
type TrashRecord = (Game | VideoItem | AudioItem | MangaItem | NovelItem) & {
  id: number
  title: string
  removed_at: string | null
  created_at: string
}

interface SurfaceConfig {
  key: TrashSurface
  labelKey: TranslationKey
  icon: ComponentType<{ className?: string }>
  list: () => Promise<TrashRecord[]>
  restore: (ids: number[]) => Promise<LibraryMutationResult>
}

const SURFACES: SurfaceConfig[] = [
  {
    key: "games",
    labelKey: "games",
    icon: Gamepad2Icon,
    list: () => api.games.listTrash() as Promise<TrashRecord[]>,
    restore: (ids) => api.games.restoreFromTrash(ids),
  },
  {
    key: "videos",
    labelKey: "videos",
    icon: FileVideoIcon,
    list: () => api.videos.listTrash() as Promise<TrashRecord[]>,
    restore: (ids) => api.videos.restoreFromTrash(ids),
  },
  {
    key: "audio",
    labelKey: "audio",
    icon: FileAudioIcon,
    list: () => api.audio.listTrash() as Promise<TrashRecord[]>,
    restore: (ids) => api.audio.restoreFromTrash(ids),
  },
  {
    key: "manga",
    labelKey: "manga",
    icon: BookOpenIcon,
    list: () => api.manga.listTrash() as Promise<TrashRecord[]>,
    restore: (ids) => api.manga.restoreFromTrash(ids),
  },
  {
    key: "novels",
    labelKey: "novels",
    icon: BookTextIcon,
    list: () => api.novels.listTrash() as Promise<TrashRecord[]>,
    restore: (ids) => api.novels.restoreFromTrash(ids),
  },
]

function emptyItems(): Record<TrashSurface, TrashRecord[]> {
  return { games: [], videos: [], audio: [], manga: [], novels: [] }
}

function emptySelection(): Record<TrashSurface, Set<number>> {
  return { games: new Set(), videos: new Set(), audio: new Set(), manga: new Set(), novels: new Set() }
}

function itemSubtitle(surface: TrashSurface, item: TrashRecord) {
  if (surface === "novels" && "file_name" in item && item.file_name) return item.file_name
  if ("engine" in item && item.engine) return item.engine
  if ("source" in item && item.source) return item.source
  if ("source_path" in item && item.source_path) return item.source_path
  if ("file_name" in item && item.file_name) return item.file_name
  if ("page_count" in item) return `${item.page_count}p`
  if ("path" in item && item.path) return item.path
  return ""
}

function dateValue(value?: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function sortTrashRecords(records: TrashRecord[]) {
  return [...records].sort((a, b) => {
    const aDate = dateValue(a.removed_at) || dateValue(a.created_at)
    const bDate = dateValue(b.removed_at) || dateValue(b.created_at)
    return bDate - aDate
  })
}

export default function LibraryTrashPage() {
  const { t, locale } = useLocale()
  const [items, setItems] = useState<Record<TrashSurface, TrashRecord[]>>(emptyItems)
  const [selected, setSelected] = useState<Record<TrashSurface, Set<number>>>(emptySelection)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<TrashSurface | null>(null)
  const [error, setError] = useState("")

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    [locale],
  )

  const formatRemovedAt = useCallback(
    (value: string | null) => {
      if (!value) return ""
      const time = new Date(value)
      if (Number.isNaN(time.getTime())) return value
      return formatter.format(time)
    },
    [formatter],
  )

  const loadTrash = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const entries = await Promise.all(
        SURFACES.map(async (surface) => [surface.key, await surface.list()] as const),
      )
      const next = emptyItems()
      for (const [key, value] of entries) next[key] = sortTrashRecords(value)
      setItems(next)
      setSelected((prev) => {
        const pruned = emptySelection()
        for (const surface of SURFACES) {
          const valid = new Set(next[surface.key].map((item) => item.id))
          prev[surface.key].forEach((id) => {
            if (valid.has(id)) pruned[surface.key].add(id)
          })
        }
        return pruned
      })
    } catch (err) {
      console.error("Load library trash failed:", err)
      setError(t("trashLoadFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadTrash()
  }, [loadTrash])

  const totalCount = useMemo(
    () => SURFACES.reduce((sum, surface) => sum + items[surface.key].length, 0),
    [items],
  )

  const normalizedSearch = search.trim().toLocaleLowerCase()
  const visibleItems = useMemo(() => {
    if (!normalizedSearch) return items
    const next = emptyItems()
    for (const surface of SURFACES) {
      const surfaceLabel = t(surface.labelKey)
      next[surface.key] = items[surface.key].filter((item) => (
        [item.title, itemSubtitle(surface.key, item), surfaceLabel]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedSearch)
      ))
    }
    return next
  }, [items, normalizedSearch, t])

  const visibleTotalCount = useMemo(
    () => SURFACES.reduce((sum, surface) => sum + visibleItems[surface.key].length, 0),
    [visibleItems],
  )

  const recentTrashItems = useMemo(() => (
    SURFACES.flatMap((surface) => (
      visibleItems[surface.key].map((item) => ({ surface, item }))
    ))
      .sort((a, b) => {
        const aDate = dateValue(a.item.removed_at) || dateValue(a.item.created_at)
        const bDate = dateValue(b.item.removed_at) || dateValue(b.item.created_at)
        return bDate - aDate
      })
      .slice(0, 8)
  ), [visibleItems])

  const getValidSelectedIds = useCallback((surface: TrashSurface) => {
    const validIds = new Set(items[surface].map((item) => item.id))
    return Array.from(selected[surface]).filter((id) => validIds.has(id))
  }, [items, selected])

  const toggleOne = useCallback((surface: TrashSurface, id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev[surface])
      if (checked) next.add(id)
      else next.delete(id)
      return { ...prev, [surface]: next }
    })
  }, [])

  const toggleAll = useCallback((surface: TrashSurface, checked: boolean) => {
    setSelected((prev) => ({
      ...prev,
      [surface]: checked ? new Set(visibleItems[surface].map((item) => item.id)) : new Set<number>(),
    }))
  }, [visibleItems])

  const restoreIds = useCallback(async (surface: SurfaceConfig, candidateIds: number[]) => {
    const validIds = candidateIds.filter((id) => items[surface.key].some((item) => item.id === id))
    if (validIds.length === 0) return
    setRestoring(surface.key)
    try {
      await surface.restore(validIds)
      setItems((prev) => ({
        ...prev,
        [surface.key]: prev[surface.key].filter((item) => !validIds.includes(item.id)),
      }))
      setSelected((prev) => {
        const next = new Set(prev[surface.key])
        validIds.forEach((id) => next.delete(id))
        return { ...prev, [surface.key]: next }
      })
      alert(t("restoredFromTrash").replace("{count}", String(validIds.length)))
    } catch (err) {
      console.error("Restore from trash failed:", err)
      setError(err instanceof Error ? err.message : t("unknownError"))
    } finally {
      setRestoring(null)
    }
  }, [items, t])

  const restoreSelected = useCallback(async (surface: SurfaceConfig, candidateIds?: number[]) => {
    const ids = candidateIds ?? getValidSelectedIds(surface.key)
    const count = ids.length
    if (count === 0) return
    if (!(await appConfirm(t("confirmRestoreFromTrash").replace("{count}", String(count))))) return
    await restoreIds(surface, ids)
  }, [getValidSelectedIds, restoreIds, t])

  const restoreOne = useCallback(async (surface: SurfaceConfig, id: number) => {
    if (!(await appConfirm(t("confirmRestoreFromTrash").replace("{count}", "1")))) return
    await restoreIds(surface, [id])
  }, [restoreIds, t])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 md:p-6">
      <LibrarySurfaceHeader
        icon={<Trash2Icon className="size-6" />}
        title={t("trashTitle")}
        meta={t("trashSubtitle")}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("trashSearchPlaceholder")}
        clearSearchLabel={t("clearSearch")}
        onClearSearch={search ? () => setSearch("") : undefined}
        primaryAction={(
          <Button variant="secondary" size="lg" onClick={loadTrash} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RotateCcwIcon className="size-4" />}
            {t("refresh")}
          </Button>
        )}
      />

      {error && (
        <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2Icon className="size-7 animate-spin text-accent" />
        </div>
      ) : totalCount === 0 ? (
        <LibraryEmptyState icon={<Trash2Icon />} title={t("trashEmpty")} />
      ) : visibleTotalCount === 0 ? (
        <LibraryEmptyState icon={<Trash2Icon />} title={t("noResults")} />
      ) : (
        <div className="space-y-6">
          {recentTrashItems.length > 0 && (
            <RecentShelf
              title={t("recentlyAdded")}
              subtitle={t("trashRecentlyAddedSubtitle")}
              icon={<ClockIcon className="size-4" />}
            >
              {recentTrashItems.map(({ surface, item }) => {
                const Icon = surface.icon
                const subtitle = itemSubtitle(surface.key, item)
                const removedDate = formatRemovedAt(item.removed_at)
                return (
                  <article
                    key={`${surface.key}-${item.id}`}
                    className="flex min-h-[132px] flex-col rounded-md border border-border-subtle bg-surface px-3 py-3"
                  >
                    <div className="mb-2 flex min-w-0 items-center gap-1.5 text-[11px] text-text-tertiary">
                      <Icon className="size-3.5 shrink-0 text-accent" />
                      <span className="truncate">{t(surface.labelKey)}</span>
                    </div>
                    <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-text-primary" title={item.title}>
                      {item.title}
                    </h3>
                    {subtitle && (
                      <p className="mt-1 truncate text-[11px] text-text-tertiary" title={subtitle}>
                        {subtitle}
                      </p>
                    )}
                    {removedDate && (
                      <p className="mt-1 text-[11px] text-text-tertiary">
                        {t("trashRemovedAt").replace("{date}", removedDate)}
                      </p>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={restoring === surface.key}
                      onClick={() => restoreOne(surface, item.id)}
                      className="mt-auto h-8 w-full text-xs"
                    >
                      <RotateCcwIcon className="size-3.5" />
                      {t("restoreFromTrash")}
                    </Button>
                  </article>
                )
              })}
            </RecentShelf>
          )}

          {SURFACES.map((surface) => {
            const Icon = surface.icon
            const records = visibleItems[surface.key]
            const recordIds = new Set(records.map((item) => item.id))
            const selectedIds = getValidSelectedIds(surface.key).filter((id) => recordIds.has(id))
            const allChecked = records.length > 0 && selectedIds.length === records.length
            return (
              <section key={surface.key} className="border-t border-border-subtle pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-accent" />
                    <h2 className="truncate text-sm font-semibold text-text-primary">
                      {t(surface.labelKey)}
                    </h2>
                    <span className="text-xs text-text-tertiary">{records.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        disabled={records.length === 0}
                        onChange={(event) => toggleAll(surface.key, event.currentTarget.checked)}
                      />
                      {t("selectItem")}
                    </label>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={selectedIds.length === 0 || restoring === surface.key}
                      onClick={() => restoreSelected(surface, selectedIds)}
                    >
                      {restoring === surface.key ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <RotateCcwIcon className="size-4" />
                      )}
                      {t("restoreSelected")}
                    </Button>
                  </div>
                </div>

                {records.length === 0 ? (
                  <p className="py-4 text-sm text-text-tertiary">{t("trashSectionEmpty")}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {records.map((item) => {
                      const checked = selectedIds.includes(item.id)
                      const subtitle = itemSubtitle(surface.key, item)
                      const removedDate = formatRemovedAt(item.removed_at)
                      return (
                        <article
                          key={item.id}
                          className="rounded-md border border-border-subtle bg-surface px-3 py-3"
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggleOne(surface.key, item.id, event.currentTarget.checked)}
                              aria-label={t("selectItem")}
                              className="mt-1 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-medium text-text-primary" title={item.title}>
                                {item.title}
                              </h3>
                              {subtitle && (
                                <p className="mt-0.5 truncate text-xs text-text-tertiary" title={subtitle}>
                                  {subtitle}
                                </p>
                              )}
                              {removedDate && (
                                <p className="mt-1 text-[11px] text-text-tertiary">
                                  {t("trashRemovedAt").replace("{date}", removedDate)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={restoring === surface.key}
                              onClick={() => restoreOne(surface, item.id)}
                            >
                              <RotateCcwIcon className="size-4" />
                              {t("restoreFromTrash")}
                            </Button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
