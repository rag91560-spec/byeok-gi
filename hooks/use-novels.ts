"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale } from "@/hooks/use-locale"
import { api } from "@/lib/api"
import type { NovelItem } from "@/lib/types"

function isNetworkLoadError(message: string) {
  return /failed to fetch|fetch failed|backend request failed|network|HTTP 502/i.test(message)
}

export function useNovelLibrary(search?: string) {
  const { t } = useLocale()
  const [items, setItems] = useState<NovelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.novels.list(search)
      setItems(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknownError")
      setError(isNetworkLoadError(message) ? t("novelListLoadFailedNetwork") : t("novelListLoadFailed"))
    } finally {
      setLoading(false)
    }
  }, [search, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { items, loading, error, refresh }
}
