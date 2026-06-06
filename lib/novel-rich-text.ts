import type { NovelContentStyle, NovelStyleRange } from "@/lib/types"

type NovelStyleDraft = Omit<NovelStyleRange, "id" | "start" | "end">

interface ParsedNovelRichText {
  content: string
  contentStyle: NovelContentStyle
}

const MAX_STYLE_RANGES = 5000

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tr",
  "ul",
])

const BASIC_COLOR_NAMES = new Set([
  "black",
  "white",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
  "grey",
  "brown",
  "cyan",
  "magenta",
  "lime",
  "navy",
  "teal",
  "silver",
  "maroon",
  "olive",
])

function hasStyle(style: NovelStyleDraft) {
  return Boolean(
    style.color
    || style.backgroundColor
    || style.fontSize
    || style.fontWeight
    || style.fontStyle
    || style.textDecoration
  )
}

function normalizeStyleRange(range: NovelStyleRange, contentLength: number): NovelStyleRange | null {
  const start = Math.max(0, Math.min(contentLength, Math.floor(range.start)))
  const end = Math.max(0, Math.min(contentLength, Math.floor(range.end)))
  if (end <= start) return null
  const next: NovelStyleRange = {
    id: range.id || `style-${start}-${end}`,
    start,
    end,
  }
  if (range.color) next.color = sanitizeCssColor(range.color)
  if (range.backgroundColor) next.backgroundColor = sanitizeCssColor(range.backgroundColor)
  if (range.fontSize) next.fontSize = sanitizeFontSize(range.fontSize)
  if (range.fontWeight) next.fontWeight = sanitizeFontWeight(range.fontWeight)
  if (range.fontStyle === "italic") next.fontStyle = "italic"
  if (range.textDecoration === "underline") next.textDecoration = "underline"
  return hasStyle(next) ? next : null
}

export function normalizeNovelContentStyle(value: unknown, contentLength: number): NovelContentStyle {
  let ranges: unknown = value
  if (typeof value === "string" && value.trim()) {
    try {
      ranges = JSON.parse(value)
    } catch {
      return { ranges: [] }
    }
  }
  if (ranges && typeof ranges === "object" && "ranges" in ranges) {
    ranges = (ranges as { ranges?: unknown }).ranges
  }
  if (!Array.isArray(ranges)) return { ranges: [] }
  return {
    ranges: ranges
      .slice(0, MAX_STYLE_RANGES)
      .map((range, index) => {
        const candidate = range as Partial<NovelStyleRange>
        return normalizeStyleRange({ ...candidate, id: candidate.id || `style-${index}` } as NovelStyleRange, contentLength)
      })
      .filter((range): range is NovelStyleRange => Boolean(range))
      .sort((a, b) => a.start - b.start || a.end - b.end),
  }
}

export function serializeNovelContentStyle(style: NovelContentStyle) {
  return JSON.stringify(normalizeNovelContentStyle(style, Number.POSITIVE_INFINITY))
}

export function shouldParseRichNovelText(text: string, extension = "") {
  const ext = extension.toLowerCase()
  if (ext === ".html" || ext === ".htm" || ext === ".xml") return true
  if (/<(?:span|font|b|strong|i|em|u|br|p|div|ruby|rt|section|article)\b/i.test(text)) return true
  return /\[(?:color|colour|bg|background|size|b|i|u)(?:=[^\]]*)?\]/i.test(text)
}

export function parseNovelRichText(text: string, extension = ""): ParsedNovelRichText {
  if (!shouldParseRichNovelText(text, extension)) {
    return { content: text, contentStyle: { ranges: [] } }
  }
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return parseHtmlNovelText(text)
  }
  return parseBbCodeNovelText(text)
}

function sanitizeCssColor(value?: string | null) {
  if (!value) return undefined
  const clean = value.trim().replace(/["']/g, "")
  if (/^#[0-9a-f]{3,8}$/i.test(clean)) return clean
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(clean)) return clean
  if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(clean)) return clean
  if (BASIC_COLOR_NAMES.has(clean.toLowerCase())) return clean.toLowerCase()
  return undefined
}

function sanitizeFontSize(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value === "number") return Math.max(10, Math.min(40, Math.round(value)))
  const clean = value.trim().toLowerCase()
  const numeric = Number(clean.replace(/[^\d.]/g, ""))
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined
  if (clean.endsWith("px")) return Math.max(10, Math.min(40, Math.round(numeric)))
  if (clean.endsWith("rem") || clean.endsWith("em")) return Math.max(10, Math.min(40, Math.round(numeric * 17)))
  if (clean.endsWith("%")) return Math.max(10, Math.min(40, Math.round((numeric / 100) * 17)))
  return Math.max(10, Math.min(40, Math.round(numeric)))
}

function sanitizeFontWeight(value?: string | null) {
  if (!value) return undefined
  const clean = value.trim().toLowerCase()
  if (clean === "bold" || clean === "bolder" || Number(clean) >= 700) return "bold"
  if (clean === "600" || clean === "semibold") return "semibold"
  if (clean === "500" || clean === "medium") return "medium"
  return undefined
}

function htmlFontSize(value?: string | null) {
  if (!value) return undefined
  const size = Number(value.trim().replace(/[^\d]/g, ""))
  const map: Record<number, number> = { 1: 11, 2: 13, 3: 16, 4: 18, 5: 22, 6: 28, 7: 34 }
  return map[size]
}

function appendText(buffer: string[], value: string) {
  if (!value) return
  buffer.push(value)
}

function appendNewline(buffer: string[]) {
  const current = buffer.join("")
  if (!current || current.endsWith("\n")) return
  buffer.push("\n")
}

function trimContentAndRanges(content: string, ranges: NovelStyleRange[]) {
  const leading = content.length - content.trimStart().length
  const endOffset = content.trimEnd().length
  if (leading === 0 && endOffset === content.length) {
    return { content, ranges }
  }
  const trimmed = content.slice(leading, endOffset)
  const adjustedRanges = ranges.map((range) => ({
    ...range,
    start: range.start - leading,
    end: range.end - leading,
  }))
  return { content: trimmed, ranges: adjustedRanges }
}

function parseInlineStyle(styleText: string): NovelStyleDraft {
  const style: NovelStyleDraft = {}
  for (const part of styleText.split(";")) {
    const [rawKey, ...rawValue] = part.split(":")
    if (!rawKey || rawValue.length === 0) continue
    const key = rawKey.trim().toLowerCase()
    const value = rawValue.join(":").trim()
    if (key === "color") style.color = sanitizeCssColor(value)
    if (key === "background" || key === "background-color") style.backgroundColor = sanitizeCssColor(value)
    if (key === "font-size") style.fontSize = sanitizeFontSize(value)
    if (key === "font-weight") style.fontWeight = sanitizeFontWeight(value)
    if (key === "font-style" && value.toLowerCase().includes("italic")) style.fontStyle = "italic"
    if (key === "text-decoration" && value.toLowerCase().includes("underline")) style.textDecoration = "underline"
  }
  return style
}

function mergeStyle(base: NovelStyleDraft, next: NovelStyleDraft): NovelStyleDraft {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)),
  }
}

function styleFromElement(element: Element): NovelStyleDraft {
  let style: NovelStyleDraft = {}
  const tag = element.tagName.toLowerCase()
  if (tag === "b" || tag === "strong") style.fontWeight = "bold"
  if (tag === "i" || tag === "em") style.fontStyle = "italic"
  if (tag === "u") style.textDecoration = "underline"
  if (tag === "big") style.fontSize = 22
  if (tag === "small") style.fontSize = 13
  if (tag === "font") {
    style = mergeStyle(style, {
      color: sanitizeCssColor(element.getAttribute("color")),
      fontSize: sanitizeFontSize(htmlFontSize(element.getAttribute("size"))),
    })
  }
  const inline = element.getAttribute("style")
  if (inline) style = mergeStyle(style, parseInlineStyle(inline))
  return style
}

function parseHtmlNovelText(html: string): ParsedNovelRichText {
  if (typeof DOMParser === "undefined") {
    return { content: stripMarkupFallback(html), contentStyle: { ranges: [] } }
  }
  const doc = new DOMParser().parseFromString(html, "text/html")
  const root = doc.body
  const buffer: string[] = []
  const ranges: NovelStyleRange[] = []

  function walk(node: Node, activeStyle: NovelStyleDraft) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ""
      const start = buffer.join("").length
      appendText(buffer, text)
      const end = buffer.join("").length
      if (end > start && hasStyle(activeStyle)) {
        ranges.push({ id: `html-${ranges.length}-${start}-${end}`, start, end, ...activeStyle })
      }
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as Element
    const tag = element.tagName.toLowerCase()
    if (tag === "script" || tag === "style" || tag === "noscript") return
    if (tag === "br") {
      appendNewline(buffer)
      return
    }
    if (BLOCK_TAGS.has(tag)) appendNewline(buffer)
    const nextStyle = mergeStyle(activeStyle, styleFromElement(element))
    for (const child of Array.from(element.childNodes)) {
      walk(child, nextStyle)
    }
    if (BLOCK_TAGS.has(tag)) appendNewline(buffer)
  }

  for (const child of Array.from(root.childNodes)) {
    walk(child, {})
  }

  const trimmed = trimContentAndRanges(buffer.join(""), ranges)
  return { content: trimmed.content, contentStyle: normalizeNovelContentStyle({ ranges: trimmed.ranges }, trimmed.content.length) }
}

interface BbStackItem {
  tag: string
  start: number
  style: NovelStyleDraft
}

function bbStyle(tag: string, rawValue?: string): NovelStyleDraft | null {
  const key = tag.toLowerCase()
  const value = rawValue?.trim()
  if (key === "color" || key === "colour") return { color: sanitizeCssColor(value) }
  if (key === "bg" || key === "background") return { backgroundColor: sanitizeCssColor(value) }
  if (key === "size") return { fontSize: sanitizeFontSize(value) }
  if (key === "b") return { fontWeight: "bold" }
  if (key === "i") return { fontStyle: "italic" }
  if (key === "u") return { textDecoration: "underline" }
  return null
}

function parseBbCodeNovelText(text: string): ParsedNovelRichText {
  const tokenPattern = /\[\/?(?:color|colour|bg|background|size|b|i|u)(?:=[^\]]*)?\]/gi
  const buffer: string[] = []
  const ranges: NovelStyleRange[] = []
  const stack: BbStackItem[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(text))) {
    appendText(buffer, text.slice(cursor, match.index))
    const token = match[0]
    const closeMatch = token.match(/^\[\/([a-z]+)\]$/i)
    if (closeMatch) {
      const tag = closeMatch[1].toLowerCase()
      const stackIndex = stack.map((item) => item.tag).lastIndexOf(tag)
      if (stackIndex >= 0) {
        const [item] = stack.splice(stackIndex, 1)
        const end = buffer.join("").length
        if (end > item.start && hasStyle(item.style)) {
          ranges.push({ id: `bb-${ranges.length}-${item.start}-${end}`, start: item.start, end, ...item.style })
        }
      }
    } else {
      const openMatch = token.match(/^\[([a-z]+)(?:=([^\]]+))?\]$/i)
      const style = openMatch ? bbStyle(openMatch[1], openMatch[2]) : null
      if (openMatch && style && hasStyle(style)) {
        stack.push({ tag: openMatch[1].toLowerCase(), start: buffer.join("").length, style })
      } else {
        appendText(buffer, token)
      }
    }
    cursor = match.index + token.length
  }

  appendText(buffer, text.slice(cursor))
  const content = buffer.join("")
  const end = content.length
  for (const item of stack) {
    if (end > item.start && hasStyle(item.style)) {
      ranges.push({ id: `bb-${ranges.length}-${item.start}-${end}`, start: item.start, end, ...item.style })
    }
  }
  return { content, contentStyle: normalizeNovelContentStyle({ ranges }, content.length) }
}

function stripMarkupFallback(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim()
}
