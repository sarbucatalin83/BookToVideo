/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EPub: any = require('epub2').default

import type { ParsedBook } from '../parsed-book'
import { selectChapterEntries } from './toc-selector'
import { extractIntroText } from './intro-text'
import { detectLanguages } from './language-detect'

export async function parseEpub(filePath: string): Promise<ParsedBook> {
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

  const toc: any[] = epub.toc && epub.toc.length > 0 ? epub.toc : []
  const flow: any[] = epub.flow ?? []
  console.log(`[epub] structure — toc=${toc.length} entries, flow=${flow.length} items`)

  const chapters = selectChapterEntries(toc, flow)
  console.log(`[epub] ${chapters.length} chapter(s) to process`)

  const tocText = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')

  console.log(`[epub] extracting intro text from first chapters…`)
  const introText = await extractIntroText(epub, chapters)

  console.log(`[epub] detecting programming languages…`)
  const primaryLanguages = await detectLanguages(epub, chapters)
  console.log(`[epub] language detection complete — [${primaryLanguages.join(', ') || 'none'}]`)

  return { title, author, language, chapters, primaryLanguages, tocText, introText }
}
