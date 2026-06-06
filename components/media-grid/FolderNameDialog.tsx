"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"

export type FolderNameDialogRequest = {
  title: string
  defaultValue: string
  resolve: (value: string | null) => void
}

export function useFolderNameDialog() {
  const [folderNameDialog, setFolderNameDialog] = useState<FolderNameDialogRequest | null>(null)

  const requestFolderName = useCallback((title: string, defaultValue: string) => {
    return new Promise<string | null>((resolve) => {
      setFolderNameDialog((active) => {
        active?.resolve(null)
        return { title, defaultValue, resolve }
      })
    })
  }, [])

  const closeFolderNameDialog = useCallback((value: string | null) => {
    setFolderNameDialog((active) => {
      active?.resolve(value)
      return null
    })
  }, [])

  return { folderNameDialog, requestFolderName, closeFolderNameDialog }
}

export function FolderNameDialog({
  request,
  onClose,
}: {
  request: FolderNameDialogRequest
  onClose: (value: string | null) => void
}) {
  const { t } = useLocale()
  const [name, setName] = useState(request.defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(request.defaultValue)
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [request])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onClose(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={request.title}
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose(null)
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-border-subtle bg-surface p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-text-primary">{request.title}</h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              submit()
            } else if (event.key === "Escape") {
              event.preventDefault()
              onClose(null)
            }
          }}
          className="mt-4 w-full rounded-md border border-border-subtle bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent/50 focus:outline-none"
          placeholder={t("folderName")}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onClose(null)}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="default" size="sm" onClick={submit} disabled={!name.trim()}>
            {t("create")}
          </Button>
        </div>
      </div>
    </div>
  )
}
