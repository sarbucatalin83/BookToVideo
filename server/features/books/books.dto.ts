import type { Book } from '@prisma/client'
import type { ManifestChapter, BookResponse } from '../../../lib/types'
import type { LlmManifestFields } from '../../adapters/llm/llm.port'

export function toExistingBookResponse(
  book: Book & { chapters: Array<{ id: string; title: string; position: number; status: string }> },
  isPdf: boolean,
): BookResponse {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    keyConcepts: book.keyConcepts as string[],
    prerequisiteLevel: book.prerequisiteLevel ?? 'unknown',
    primaryLanguages: [],
    provider: book.provider,
    modelTier: book.modelTier,
    depthPreset: book.depthPreset,
    themePreset: book.themePreset,
    voice: book.voice,
    chapters: book.chapters.map((c) => ({ ...c, status: c.status as ManifestChapter['status'] })),
    alreadyExisted: true,
    isPdfUpload: isPdf,
  }
}

export function toNewBookResponse(
  book: Book,
  chapters: ManifestChapter[],
  llm: LlmManifestFields,
  primaryLanguages: string[],
  isPdf: boolean,
): BookResponse {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    keyConcepts: llm.keyConcepts,
    prerequisiteLevel: llm.prerequisiteLevel,
    primaryLanguages,
    provider: book.provider,
    modelTier: book.modelTier,
    depthPreset: book.depthPreset,
    themePreset: book.themePreset,
    voice: book.voice,
    chapters,
    isPdfUpload: isPdf,
  }
}
