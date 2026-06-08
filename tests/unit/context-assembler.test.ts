import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/tokenizer', () => ({
  countTokens: (text: string) => Math.ceil(text.length / 4),
  truncateToTokens: (text: string, maxTokens: number) => text.slice(0, maxTokens * 4),
}))

import { assembleContext } from '../../lib/context-assembler'
import type { BookManifest } from '../../lib/chunk-types'

const baseBook: BookManifest = {
  id: 'book-1',
  title: 'TypeScript Deep Dive',
  author: 'Basarat Ali Syed',
  keyConcepts: ['types', 'generics', 'decorators'],
  prerequisiteLevel: 'intermediate',
  depthPreset: 'standard',
  primaryLanguages: ['TypeScript'],
}

describe('assembleContext', () => {
  it('assembles all four layers for a normal mid-chapter chunk', () => {
    const result = assembleContext({
      book: baseBook,
      currentChunk: { content: 'This is the current chunk content.' },
      nextChunk: { content: 'This is the next chunk preview.' },
      prevSummary: 'Summary of the previous chunk.',
    })

    expect(result.bookManifest).toContain('TypeScript Deep Dive')
    expect(result.bookManifest).toContain('Basarat Ali Syed')
    expect(result.prevSummary).toBe('Summary of the previous chunk.')
    expect(result.currentChunk).toBe('This is the current chunk content.')
    expect(result.nextPreview).not.toBeNull()
    expect(result.totalTokens).toBeGreaterThan(0)
  })

  it('uses preceding chapter synthesis as prevSummary at a chapter boundary', () => {
    const synthesis = 'Chapter 1 covered the basics of the TypeScript type system.'

    const result = assembleContext({
      book: baseBook,
      currentChunk: { content: 'Chapter 2 begins with advanced generics.' },
      nextChunk: null,
      prevSummary: synthesis,
    })

    expect(result.prevSummary).toBe(synthesis)
    expect(result.nextPreview).toBeNull()
    expect(result.currentChunk).toBe('Chapter 2 begins with advanced generics.')
  })

  it('leaves prevSummary null at a chapter boundary without synthesis', () => {
    const result = assembleContext({
      book: baseBook,
      currentChunk: { content: 'First chunk of the very first chapter.' },
      nextChunk: { content: 'Second chunk coming up.' },
      prevSummary: null,
    })

    expect(result.prevSummary).toBeNull()
    expect(result.currentChunk).toBe('First chunk of the very first chapter.')
    expect(result.bookManifest).toContain('TypeScript Deep Dive')
  })

  it('truncates prevSummary and nextPreview to their token budgets', () => {
    // mock: countTokens = len/4, truncateToTokens cuts at maxTokens*4 chars
    // prevSummary budget = 200 tokens → 800 chars max
    // nextPreview budget = 100 tokens → 400 chars max
    const longSummary = 'S'.repeat(2000)
    const longNext = 'N'.repeat(2000)

    const result = assembleContext({
      book: baseBook,
      currentChunk: { content: 'Normal chunk.' },
      nextChunk: { content: longNext },
      prevSummary: longSummary,
    })

    expect(result.prevSummary!.length).toBeLessThanOrEqual(800)
    expect(result.nextPreview!.length).toBeLessThanOrEqual(400)
  })
})
