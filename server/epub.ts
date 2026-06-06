/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EPub: any = require('epub2').default

export interface ParsedEpub {
  title: string
  author: string
  language: string
  chapters: Array<{ id: string; title: string; position: number }>
  primaryLanguages: string[]
  tocText: string
  introText: string
}

export async function parseEpub(filePath: string): Promise<ParsedEpub> {
  const epub = await EPub.createAsync(filePath)

  const title: string = epub.metadata.title ?? 'Unknown Title'
  const author: string = epub.metadata.creator ?? epub.metadata.author ?? 'Unknown Author'
  const language: string = epub.metadata.language ?? 'en'

  // Use TOC when available; fall back to spine flow
  const toc: any[] = epub.toc && epub.toc.length > 0 ? epub.toc : []
  const flow: any[] = epub.flow ?? []

  const rawItems = toc.length > 0
    ? toc.map((item: any, idx: number) => ({
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

  const tocText = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')

  // Pull intro text from first chapter with meaningful content
  let introText = ''
  for (const chapter of chapters.slice(0, 5)) {
    try {
      const html: string = await epub.getChapterRawAsync(chapter.id)
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (text.length > 100) {
        introText = text.slice(0, 1500)
        break
      }
    } catch {
      // unreadable chapter — skip
    }
  }

  // Detect programming languages from fenced code blocks / class attributes
  const langSet = new Set<string>()
  const langPattern = /class=["'](?:language-|lang-)(\w+)["']|```(\w+)/g
  const noise = new Set(['text', 'plaintext', 'plain', 'output', 'terminal'])
  for (const chapter of chapters.slice(0, 10)) {
    try {
      const html: string = await epub.getChapterRawAsync(chapter.id)
      for (const match of html.matchAll(langPattern)) {
        const lang = (match[1] ?? match[2] ?? '').toLowerCase()
        if (lang && !noise.has(lang)) langSet.add(lang)
      }
    } catch {
      // skip
    }
  }

  return { title, author, language, chapters, primaryLanguages: Array.from(langSet), tocText, introText }
}
