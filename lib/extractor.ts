import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { MODELS, type Provider, type ModelTier, type DepthPreset } from './model-config'

const DEPTH_THRESHOLD: Record<DepthPreset, number> = {
  overview: 0.8,
  standard: 0.6,
  deep_dive: 0.3,
}

const chunkExtractionSchema = z.object({
  codeBlocks: z.array(
    z.object({
      language: z.string().describe('Programming language of the code block'),
      importance_score: z
        .number()
        .min(0)
        .max(1)
        .describe('Importance of this code block (0 = trivial, 1 = essential)'),
      concept_introduced: z
        .string()
        .describe('Main concept or technique this code block demonstrates'),
    })
  ).describe('Programming code blocks found in this chunk'),
  notable_quotes: z
    .array(z.string())
    .describe('Memorable, instructive sentences worth highlighting as slides (max 3)'),
})

export interface ExtractedCodeBlock {
  language: string
  importance_score: number
  concept_introduced: string
  significant: boolean
}

export interface ExtractionResult {
  codeBlocks: ExtractedCodeBlock[]
  notable_quotes: string[]
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

const SYSTEM_PROMPT = `You are a technical book analyst. Extract structured data from book chunk content.
- codeBlocks: identify each programming language, rate importance 0-1, describe the concept it introduces. Return empty array if no code is present.
- notable_quotes: select up to 3 memorable, instructive sentences worth highlighting as presentation slides.`

export async function extractChunk(
  context: string,
  provider: Provider,
  tier: ModelTier,
  depth: DepthPreset,
): Promise<ExtractionResult> {
  const model = buildModel(provider, tier)
  const spec = MODELS[provider][tier]
  const threshold = DEPTH_THRESHOLD[depth]

  const { object, usage } = await generateObject({
    model,
    schema: chunkExtractionSchema,
    system: SYSTEM_PROMPT,
    prompt: context,
  })

  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const costUsd =
    (inputTokens * spec.inputPricePer1M) / 1_000_000 +
    (outputTokens * spec.outputPricePer1M) / 1_000_000

  return {
    codeBlocks: object.codeBlocks.map(cb => ({
      ...cb,
      significant: cb.importance_score >= threshold,
    })),
    notable_quotes: object.notable_quotes,
    inputTokens,
    outputTokens,
    costUsd,
  }
}
