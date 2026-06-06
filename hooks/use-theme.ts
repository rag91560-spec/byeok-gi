"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import React from "react"
import type { ReactNode } from "react"

export type Theme = "dark" | "light" | "system"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "dark" | "light"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
})

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  try {
    const saved = localStorage.getItem("gt-theme")
    if (saved === "dark" || saved === "light" || saved === "system") return saved
  } catch { /* SSR / restricted access */ }
  return "dark"
}

function applyResolvedTheme(resolved: "dark" | "light") {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.classList.toggle("light", resolved === "light")
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setThemeState(getStoredTheme())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const resolved = theme === "system" ? getSystemTheme() : theme
    setResolvedTheme(resolved)
    applyResolvedTheme(resolved)
  }, [theme, hydrated])

  useEffect(() => {
    if (!hydrated || theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      const resolved = getSystemTheme()
      setResolvedTheme(resolved)
      applyResolvedTheme(resolved)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme, hydrated])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem("gt-theme", t)
  }, [])

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, resolvedTheme, setTheme } },
    children
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
