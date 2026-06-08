// Extract chapter titles from the PDF outline (bookmarks sidebar).
// Returns null if the document has no outline or the outline is empty.
export function chaptersFromOutline(
  outline: Array<{ title?: string; items?: unknown[] }> | null,
): Array<{ id: string; title: string; position: number }> | null {
  if (!outline?.length) return null
  const chapters: Array<{ id: string; title: string; position: number }> = []
  for (const item of outline) {
    if (!item.title?.trim() || chapters.length >= 100) break
    chapters.push({ id: `chapter-${chapters.length}`, title: item.title.trim(), position: chapters.length })
  }
  return chapters.length > 0 ? chapters : null
}
