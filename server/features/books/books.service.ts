import fs from 'fs/promises'
import { pickParser } from '../../adapters/parsers/pick-parser'
import { getProvider } from '../../adapters/llm/provider-registry'
import type { Provider } from '../../adapters/llm/provider-registry'
import {
  findBookByTitleAuthor,
  deleteBook,
  createBookWithChapters,
  fetchBookChapters,
  setBookSettings,
} from './books.queries'
import { toExistingBookResponse, toNewBookResponse } from './books.dto'
import { UnprocessableError, NotFoundError } from '../../../shared/errors'
import type { BookResponse } from '../../../lib/types'

export async function createBookFromUpload(params: {
  tmpPath: string
  ext: string
  provider: Provider
  force: boolean
  fileMeta: string
}): Promise<BookResponse> {
  const { tmpPath, ext, provider, force, fileMeta } = params
  console.log(`[books] processing upload: ${fileMeta} → tmpPath=${tmpPath}`)

  try {
    let parsed
    try {
      parsed = await pickParser(ext).parse(tmpPath)
    } catch (err) {
      console.error(`[books] file parse step failed for ${fileMeta}:`, err)
      throw new UnprocessableError('Failed to parse uploaded file')
    }

    const existing = await findBookByTitleAuthor(parsed.title, parsed.author)

    if (existing && !force) {
      console.log(`[books] duplicate found — returning existing book id=${existing.id} for ${fileMeta}`)
      return toExistingBookResponse(existing, ext === '.pdf')
    }

    if (existing && force) {
      console.log(`[books] force reprocess — deleting existing book id=${existing.id} for ${fileMeta}`)
      await deleteBook(existing.id)
    }

    console.log(`[books] calling LLM (${provider}) for manifest fields…`)
    const llm = await getProvider(provider).extractManifestFields(parsed.tocText, parsed.introText)
    console.log(`[books] LLM done — keyConcepts=${llm.keyConcepts.length} prerequisiteLevel="${llm.prerequisiteLevel}" chapters=${llm.chapters.length}`)

    // Prefer LLM-extracted chapters when the count is plausible relative to
    // what the parser found (LLM may filter front matter, but returning fewer
    // than half the parsed chapters almost always means truncation or aggressive
    // filtering — fall back to the parser in that case).
    const llmCountOk = llm.chapters.length > 0 && llm.chapters.length >= Math.ceil(parsed.chapters.length / 2)
    const chaptersToStore = llmCountOk
      ? llm.chapters.map((c, i) => ({ title: c.title, position: i }))
      : parsed.chapters.map((c) => ({ title: c.title, position: c.position }))

    const book = await createBookWithChapters(
      {
        title: parsed.title,
        author: parsed.author,
        keyConcepts: llm.keyConcepts,
        prerequisiteLevel: llm.prerequisiteLevel,
        provider,
      },
      chaptersToStore,
    )

    const chapters = await fetchBookChapters(book.id)
    console.log(`[books] created book id=${book.id} title="${book.title}" chapters=${chapters.length} for ${fileMeta}`)

    return toNewBookResponse(book, chapters, llm, parsed.primaryLanguages, ext === '.pdf')
  } finally {
    await fs.unlink(tmpPath).catch((err) => {
      console.warn(`[books] failed to delete temp file "${tmpPath}":`, err)
    })
  }
}

export async function updateBookSettings(
  id: string,
  data: {
    provider?: Provider
    modelTier?: 'fast' | 'balanced' | 'best'
    depthPreset?: 'overview' | 'standard' | 'deep_dive'
    themePreset?: 'dark' | 'light' | 'high_contrast'
    voice?: string | null
  },
) {
  try {
    const book = await setBookSettings(id, data)
    console.log(`[books] PATCH /${id} — saved config provider=${book.provider} tier=${book.modelTier} depth=${book.depthPreset}`)
    return {
      provider: book.provider,
      modelTier: book.modelTier,
      depthPreset: book.depthPreset,
      themePreset: book.themePreset,
      voice: book.voice,
    }
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') throw new NotFoundError('Book not found')
    throw err
  }
}
