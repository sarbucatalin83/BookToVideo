export interface BookManifest {
  id: string
  title: string
  author: string
  keyConcepts: string[]
  prerequisiteLevel: string | null
  depthPreset: string
  primaryLanguages?: string[]
}

export interface ChapterSynthesis {
  chapterId: string
  content: string
}

export interface RollingContext {
  bookManifest: string
  prevSummary: string | null
  currentChunk: string
  nextPreview: string | null
  totalTokens: number
}

export interface AssembleContextParams {
  book: BookManifest
  currentChunk: { content: string }
  nextChunk: { content: string } | null
  prevSummary: string | null
}
