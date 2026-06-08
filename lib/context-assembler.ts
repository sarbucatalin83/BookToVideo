import { countTokens, truncateToTokens } from './tokenizer'
import type { BookManifest, AssembleContextParams, RollingContext } from './chunk-types'

export function formatRollingContext(ctx: RollingContext): string {
  const sections: string[] = ['## Book Context\n' + ctx.bookManifest]
  if (ctx.prevSummary) sections.push('## Previous Summary\n' + ctx.prevSummary)
  sections.push('## Current Chunk\n' + ctx.currentChunk)
  if (ctx.nextPreview) sections.push('## Next Chunk Preview\n' + ctx.nextPreview)
  return sections.join('\n\n')
}

const BUDGET = {
  manifest: 600,
  prevSummary: 200,
  currentChunk: 2500,
  nextPreview: 100,
} as const

function serializeManifest(book: BookManifest): string {
  const parts: (string | null)[] = [
    `Title: ${book.title}`,
    `Author: ${book.author}`,
    `Key Concepts: ${book.keyConcepts.join(', ')}`,
    book.prerequisiteLevel ? `Prerequisite Level: ${book.prerequisiteLevel}` : null,
    `Depth: ${book.depthPreset}`,
    book.primaryLanguages?.length
      ? `Primary Languages: ${book.primaryLanguages.join(', ')}`
      : null,
  ]
  return parts.filter((p): p is string => p !== null).join('\n')
}

export function assembleContext(params: AssembleContextParams): RollingContext {
  const { book, currentChunk, nextChunk, prevSummary } = params

  const manifestStr = truncateToTokens(serializeManifest(book), BUDGET.manifest)
  const prevSummaryStr = prevSummary
    ? truncateToTokens(prevSummary, BUDGET.prevSummary)
    : null
  const currentStr = truncateToTokens(currentChunk.content, BUDGET.currentChunk)
  const nextPreviewStr = nextChunk
    ? truncateToTokens(nextChunk.content, BUDGET.nextPreview)
    : null

  const totalTokens =
    countTokens(manifestStr) +
    (prevSummaryStr ? countTokens(prevSummaryStr) : 0) +
    countTokens(currentStr) +
    (nextPreviewStr ? countTokens(nextPreviewStr) : 0)

  return {
    bookManifest: manifestStr,
    prevSummary: prevSummaryStr,
    currentChunk: currentStr,
    nextPreview: nextPreviewStr,
    totalTokens,
  }
}
