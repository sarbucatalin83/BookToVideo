// Scan the extracted text for a visible "Table of Contents" page and parse
// chapter titles from it. Returns null if no TOC section is found.
export function chaptersFromTocText(
  lines: string[],
): Array<{ id: string; title: string; position: number }> | null {
  let tocStart = -1
  for (let i = 0; i < Math.min(lines.length, 300); i++) {
    if (/^(?:table\s+of\s+)?contents?$/i.test(lines[i].trim())) {
      tocStart = i + 1
      break
    }
  }
  if (tocStart === -1) return null

  const chapters: Array<{ id: string; title: string; position: number }> = []
  let consecutiveEmpty = 0

  for (let i = tocStart; i < lines.length && chapters.length < 100; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) {
      if (++consecutiveEmpty > 4) break
      continue
    }
    consecutiveEmpty = 0

    // TOC entries always end with a page number — skip lines that don't
    if (!/\d+\s*$/.test(trimmed)) continue

    // Strip trailing page number: "Chapter Name ......... 15" → "Chapter Name"
    const cleaned = trimmed.replace(/[\s.…\-–]+\d+\s*$/, '').trim()
    if (!cleaned || cleaned.length < 3 || cleaned.length > 120) continue

    chapters.push({ id: `chapter-${chapters.length}`, title: cleaned, position: chapters.length })
  }

  return chapters.length > 0 ? chapters : null
}
