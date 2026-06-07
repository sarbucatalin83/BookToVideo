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

  // Use TOC when available; fall back to spine flow
  const toc: any[] = epub.toc && epub.toc.length > 0 ? epub.toc : []
  const flow: any[] = epub.flow ?? []
  console.log(`[epub] structure — toc=${toc.length} entries, flow=${flow.length} items`)

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
  console.log(`[epub] ${chapters.length} chapter(s) to process`)

  const tocText = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')

  // Pull intro text from first chapter with meaningful content
  console.log(`[epub] extracting intro text from first chapters…`)
  let introText = ''
  for (const chapter of chapters.slice(0, 5)) {
    try {
      const html: string = await epub.getChapterRawAsync(chapter.id)
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (text.length > 100) {
        introText = text.slice(0, 1500)
        console.log(`[epub] intro text — ${introText.length} chars from chapter "${chapter.id}"`)
        break
      }
    } catch (err) {
      console.warn(`[epub] skipping unreadable chapter "${chapter.id}" (intro pass):`, err)
    }
  }

  // Detect programming languages from fenced code blocks / class attributes
  console.log(`[epub] detecting programming languages…`)
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
    } catch (err) {
      console.warn(`[epub] skipping unreadable chapter "${chapter.id}" (lang-detect pass):`, err)
    }
  }

  const primaryLanguages = Array.from(langSet)
  console.log(`[epub] language detection complete — [${primaryLanguages.join(', ') || 'none'}]`)
  return { title, author, language, chapters, primaryLanguages, tocText, introText }
}
