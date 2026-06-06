export interface TextColorMark {
  id: string
  start: number
  end: number
  color: string
}

const FALLBACK_MARK_COLOR = "#ef7766"

export function normalizeTextColorMarks(marks: TextColorMark[], contentLength: number): TextColorMark[] {
  const maxLength = Number.isFinite(contentLength) ? contentLength : Number.MAX_SAFE_INTEGER
  return marks
    .map((mark) => ({
      id: mark.id || `${mark.start}-${mark.end}-${mark.color}`,
      start: Math.max(0, Math.min(maxLength, Math.floor(mark.start))),
      end: Math.max(0, Math.min(maxLength, Math.floor(mark.end))),
      color: mark.color || FALLBACK_MARK_COLOR,
    }))
    .filter((mark) => mark.end > mark.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

export function removeMarksInRange(marks: TextColorMark[], start: number, end: number, contentLength: number): TextColorMark[] {
  const next: TextColorMark[] = []
  for (const mark of normalizeTextColorMarks(marks, contentLength)) {
    if (mark.end <= start || mark.start >= end) {
      next.push(mark)
      continue
    }
    if (mark.start < start) {
      next.push({ ...mark, id: `${mark.id}-left-${start}`, end: start })
    }
    if (mark.end > end) {
      next.push({ ...mark, id: `${mark.id}-right-${end}`, start: end })
    }
  }
  return next
}

export function applyTextColorMark(marks: TextColorMark[], start: number, end: number, color: string, contentLength: number): TextColorMark[] {
  return normalizeTextColorMarks(
    [
      ...removeMarksInRange(marks, start, end, contentLength),
      { id: `${Date.now()}-${start}-${end}`, start, end, color },
    ],
    contentLength
  )
}
