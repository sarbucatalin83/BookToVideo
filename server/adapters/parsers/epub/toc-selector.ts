/* eslint-disable @typescript-eslint/no-explicit-any */

// epub2 flattens all navPoints into epub.toc with a `level` property.
// level 0 = top-level (often "Parts"), level 1 = chapters within parts.
// We pick the shallowest level that represents actual chapters.
export function selectChapterEntries(
  toc: any[],
  flow: any[],
): Array<{ id: string; title: string; position: number }> {
  const byLevel = new Map<number, any[]>()
  for (const item of toc) {
    const lvl: number = typeof item.level === 'number' ? item.level : 0
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl)!.push(item)
  }

  const level0 = byLevel.get(0) ?? []
  const level1 = byLevel.get(1) ?? []
  const chapterEntries =
    level0.length > 0 && level0.length <= 5 && level1.length >= level0.length * 2
      ? level1
      : level0.length > 0
        ? level0
        : toc

  const rawItems = chapterEntries.length > 0
    ? chapterEntries.map((item: any, idx: number) => ({
        id: item.id as string,
        title: (item.title as string | undefined) ?? `Chapter ${idx + 1}`,
        position: (item.order as number | undefined) ?? idx,
      }))
    : flow.map((item: any, idx: number) => ({
        id: item.id as string,
        title: `Chapter ${idx + 1}`,
        position: idx,
      }))

  return rawItems.slice(0, 100)
}
