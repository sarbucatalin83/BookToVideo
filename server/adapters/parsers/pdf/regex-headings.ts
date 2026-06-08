const CHAPTER_PATTERNS = [
  /^(?:chapter|section|part)\s+\d+/i,
  /^\d+\.\s+[A-Z][^\n]{3,60}$/,
  /^[IVX]+\.\s+[A-Z][^\n]{3,60}$/,
]

export function isHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 80 || trimmed.length < 3) return false
  return CHAPTER_PATTERNS.some((p) => p.test(trimmed))
}

export function detectChapters(
  lines: string[],
): Array<{ id: string; title: string; position: number }> {
  const chapters: Array<{ id: string; title: string; position: number }> = []

  for (let i = 0; i < lines.length && chapters.length < 100; i++) {
    const line = lines[i].trim()
    if (!isHeadingLine(line)) continue

    // Require at least one surrounding blank line to reduce noise
    const prevBlank = i === 0 || lines[i - 1].trim() === ''
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === ''

    if (prevBlank || nextBlank) {
      chapters.push({ id: `chapter-${chapters.length}`, title: line, position: chapters.length })
    }
  }

  // Fallback: split by page into pseudo-chapters if nothing detected
  if (chapters.length === 0) {
    const pages = lines.join('\n').split('\f').slice(0, 100)
    for (let i = 0; i < pages.length; i++) {
      chapters.push({ id: `page-${i}`, title: `Page ${i + 1}`, position: i })
    }
  }

  return chapters
}
