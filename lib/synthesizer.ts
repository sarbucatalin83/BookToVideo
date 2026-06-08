import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { MODELS, type Provider, type ModelTier } from './model-config'

export interface SynthesisInput {
  chapterTitle: string
  chunks: Array<{
    position: number
    content: string
    principles: unknown
  }>
}

export interface SynthesisResult {
  content: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

function buildModel(provider: Provider, tier: ModelTier) {
  const { modelId } = MODELS[provider][tier]
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })(modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })(modelId)
    case 'openai':
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })(modelId)
  }
}

function buildPrompt(input: SynthesisInput): string {
  const chunkSummaries = input.chunks
    .map(c => {
      const quotes = Array.isArray(c.principles) ? (c.principles as string[]) : []
      const excerpt = c.content.slice(0, 300).replace(/\s+/g, ' ')
      return [
        `Chunk ${c.position + 1}:`,
        `Excerpt: ${excerpt}…`,
        quotes.length ? `Notable quotes: ${quotes.join(' | ')}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  return `Chapter: "${input.chapterTitle}"

${chunkSummaries}

Write a ChapterSynthesis with exactly three labeled sections:

**Narrative Thread**: How the chapter builds its argument and what journey it takes the reader on (2-3 sentences).
**Main Argument**: The central thesis or key claim in 1-2 sentences.
**Key Takeaways**:
- [3-5 bullet points of the most important technical learnings]

Be concise. Focus on technical substance.`
}

export async function generateChapterSynthesis(
  input: SynthesisInput,
  provider: Provider,
  tier: ModelTier,
): Promise<SynthesisResult> {
  const model = buildModel(provider, tier)
  const spec = MODELS[provider][tier]

  const { text, usage } = await generateText({
    model,
    system:
      'You are a technical editor producing concise chapter summaries for use as context in further LLM processing.',
    prompt: buildPrompt(input),
  })

  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const costUsd =
    (inputTokens * spec.inputPricePer1M) / 1_000_000 +
    (outputTokens * spec.outputPricePer1M) / 1_000_000

  return { content: text, inputTokens, outputTokens, costUsd }
}
