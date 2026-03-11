export interface ScriptCue {
  index: number
  startTime: number
  endTime: number
  text: string
}

export type ScriptData =
  | { type: "timed"; cues: ScriptCue[] }
  | { type: "plain"; lines: string[] }

function parseTimeSRT(ts: string): number {
  // 00:01:23,456
  const m = ts.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!m) return 0
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000
}

function parseTimeVTT(ts: string): number {
  // 00:01:23.456 or 01:23.456
  const parts = ts.split(/[:.]/);
  if (parts.length === 4) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) + parseInt(parts[3]) / 1000
  }
  if (parts.length === 3) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 1000
  }
  return 0
}

export function parseSRT(raw: string): ScriptCue[] {
  const cues: ScriptCue[] = []
  const blocks = raw.trim().replace(/\r\n/g, "\n").split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split("\n")
    if (lines.length < 3) continue
    const timeMatch = lines[1].match(/(.+?)\s*-->\s*(.+)/)
    if (!timeMatch) continue
    const startTime = parseTimeSRT(timeMatch[1].trim())
    const endTime = parseTimeSRT(timeMatch[2].trim())
    const text = lines.slice(2).join("\n").trim()
    if (text) {
      cues.push({ index: cues.length, startTime, endTime, text })
    }
  }
  return cues
}

export function parseVTT(raw: string): ScriptCue[] {
  const cues: ScriptCue[] = []
  const content = raw.trim().replace(/\r\n/g, "\n")
  const blocks = content.split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split("\n")
    let timeLineIdx = lines.findIndex((l) => l.includes("-->"))
    if (timeLineIdx < 0) continue
    const timeMatch = lines[timeLineIdx].match(/(.+?)\s*-->\s*(.+)/)
    if (!timeMatch) continue
    const startTime = parseTimeVTT(timeMatch[1].trim())
    const endTime = parseTimeVTT(timeMatch[2].trim())
    const text = lines.slice(timeLineIdx + 1).join("\n").trim()
    if (text) {
      cues.push({ index: cues.length, startTime, endTime, text })
    }
  }
  return cues
}

export function parseScript(raw: string): ScriptData {
  const trimmed = raw.trim()
  if (!trimmed) return { type: "plain", lines: [] }

  // VTT detection
  if (trimmed.startsWith("WEBVTT")) {
    const cues = parseVTT(trimmed)
    if (cues.length > 0) return { type: "timed", cues }
  }

  // SRT detection: first block starts with a number, second line has -->
  const firstBlock = trimmed.split(/\n\n/)[0]
  if (firstBlock && /-->/m.test(firstBlock)) {
    const cues = parseSRT(trimmed)
    if (cues.length > 0) return { type: "timed", cues }
  }

  // Plain text fallback
  return { type: "plain", lines: trimmed.split(/\r?\n/) }
}
