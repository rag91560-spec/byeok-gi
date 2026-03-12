"use client"

import { SearchIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"

interface MediaToolbarProps {
  search: string
  onSearchChange: (val: string) => void
  onAdd: () => void
  mediaType: "video" | "audio"
}

export function MediaToolbar({
  search,
  onSearchChange,
  onAdd,
  mediaType,
}: MediaToolbarProps) {
  const { t } = useLocale()

  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("search")}
          className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <Button onClick={onAdd} size="sm">
        <PlusIcon className="size-4" />
        {mediaType === "video" ? t("addVideo") : t("addAudio")}
      </Button>
    </div>
  )
}
