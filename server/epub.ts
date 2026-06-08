/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EPub: any = require('epub2').default

export interface ParsedEpub {
  title: string
  author: string
  language: string
  chapters: Array<{ id: string; title: string; position: number }>
  chapterContents: string[]
  primaryLanguages: string[]
  tocText: string
  introText: string
}

export async function parseEpub(filePath: string): Promise<ParsedEpub> {
  console.log(`[epub] parsing: ${filePath}`)
  let epub: any
  try {
    epub = await EPub.createAsync(filePath)
  } catch (err) {
    console.error(`[epub] failed to open EPUB "${filePath}":`, err)
    throw err
  }

  const title: string = epub.metadata.title ?? 'Unknown Title'
  const author: string = epub.metadata.creator ?? epub.metadata.author ?? 'Unknown Author'
  const language: string = epub.metadata.language ?? 'en'
  console.log(`[epub] metadata — title="${title}" author="${author}" lang=${language}`)

  // epub2 flattens all navPoints (including nested sub-sections) into epub.toc
  // with a `level` property: 0 = top-level, 1 = one level deep, etc.
  // Books organised into Parts have their chapters at level 1; flat books have
  // chapters at level 0. Pick the shallowest level that is likely "chapters":
  // if level 0 is sparse (≤ 5 entries, i.e. probably Parts) and level 1 has
  // substantially more entries, prefer level 1; otherwise use level 0.
  const toc: any[] = epub.toc && epub.toc.length > 0 ? epub.toc : []
  const flow: any[] = epub.flow ?? []
  console.log(`[epub] structure — toc=${toc.length} entries, flow=${flow.length} items`)

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

  const chapters = rawItems.slice(0, 100)
  console.log(`[epub] ${chapters.length} chapter(s) to process`)

  const tocText = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')

  // Extract text content + detect languages in a single pass over all chapters
  console.log(`[epub] extracting chapter text and detecting languages…`)
  const chapterContents: string[] = []
  let introText = ''
  const langSet = new Set<string>()
  const langPattern = /class=["'](?:language-|lang-)(\w+)["']|```(\w+)/g
  const noise = new Set(['text', 'plaintext', 'plain', 'output', 'terminal'])

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    try {
      const html: string = await epub.getChapterRawAsync(chapter.id)
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      chapterContents.push(text)

      if (!introText && text.length > 100) {
        introText = text.slice(0, 1500)
        console.log(`[epub] intro text — ${introText.length} chars from chapter "${chapter.id}"`)
      }

      if (i < 10) {
        for (const match of html.matchAll(langPattern)) {
          const lang = (match[1] ?? match[2] ?? '').toLowerCase()
          if (lang && !noise.has(lang)) langSet.add(lang)
        }
      }
    } catch (err) {
      console.warn(`[epub] skipping unreadable chapter "${chapter.id}":`, err)
      chapterContents.push('')
    }
  }

  const primaryLanguages = Array.from(langSet)
  console.log(`[epub] extracted ${chapterContents.length} chapter(s), languages: [${primaryLanguages.join(', ') || 'none'}]`)
  return { title, author, language, chapters, chapterContents, primaryLanguages, tocText, introText }
}
