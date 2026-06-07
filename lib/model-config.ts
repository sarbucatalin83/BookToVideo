export type Provider = 'anthropic' | 'google' | 'openai'
export type ModelTier = 'fast' | 'balanced' | 'best'
export type DepthPreset = 'overview' | 'standard' | 'deep_dive'
export type ThemePreset = 'dark' | 'light' | 'high_contrast'

export interface ModelSpec {
  modelId: string
  displayName: string
  inputPricePer1M: number   // USD per 1M input tokens
  outputPricePer1M: number  // USD per 1M output tokens
}

export const MODELS: Record<Provider, Record<ModelTier, ModelSpec>> = {
  anthropic: {
    fast:     { modelId: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5',  inputPricePer1M: 0.80,  outputPricePer1M: 4.00 },
    balanced: { modelId: 'claude-sonnet-4-6',          displayName: 'Claude Sonnet 4.6', inputPricePer1M: 3.00,  outputPricePer1M: 15.00 },
    best:     { modelId: 'claude-opus-4-7',             displayName: 'Claude Opus 4.7',   inputPricePer1M: 15.00, outputPricePer1M: 75.00 },
  },
  google: {
    fast:     { modelId: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', inputPricePer1M: 0.10,  outputPricePer1M: 0.40 },
    balanced: { modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', inputPricePer1M: 0.30,  outputPricePer1M: 2.50 },
    best:     { modelId: 'gemini-2.5-pro',   displayName: 'Gemini 2.5 Pro',   inputPricePer1M: 1.25,  outputPricePer1M: 10.00 },
  },
  openai: {
    fast:     { modelId: 'gpt-4o-mini', displayName: 'GPT-4o mini', inputPricePer1M: 0.15,  outputPricePer1M: 0.60 },
    balanced: { modelId: 'gpt-4o',      displayName: 'GPT-4o',      inputPricePer1M: 2.50,  outputPricePer1M: 10.00 },
    best:     { modelId: 'o4-mini',     displayName: 'o4-mini',     inputPricePer1M: 1.10,  outputPricePer1M: 4.40 },
  },
}

// Estimated LLM usage per depth preset (used for cost projection only)
const DEPTH_PARAMS: Record<DepthPreset, { chunksPerChapter: number; avgInputTokens: number; avgOutputTokens: number }> = {
  overview:  { chunksPerChapter: 3,  avgInputTokens: 800,  avgOutputTokens: 400 },
  standard:  { chunksPerChapter: 6,  avgInputTokens: 1200, avgOutputTokens: 600 },
  deep_dive: { chunksPerChapter: 12, avgInputTokens: 2000, avgOutputTokens: 1000 },
}

export function estimateCost(
  provider: Provider,
  tier: ModelTier,
  depth: DepthPreset,
  chapterCount: number,
): number {
  const model = MODELS[provider][tier]
  const params = DEPTH_PARAMS[depth]
  const totalChunks = chapterCount * params.chunksPerChapter
  const inputCost = (totalChunks * params.avgInputTokens * model.inputPricePer1M) / 1_000_000
  const outputCost = (totalChunks * params.avgOutputTokens * model.outputPricePer1M) / 1_000_000
  return inputCost + outputCost
}

export const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',  accent: 'American', gender: 'Female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',    accent: 'American', gender: 'Female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',   accent: 'American', gender: 'Female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni',  accent: 'American', gender: 'Male' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',    accent: 'American', gender: 'Female' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh',    accent: 'American', gender: 'Male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold',  accent: 'American', gender: 'Male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    accent: 'American', gender: 'Male' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam',     accent: 'American', gender: 'Male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  accent: 'British',  gender: 'Male' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',  accent: 'British',  gender: 'Male' },
  { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Glinda',  accent: 'American', gender: 'Female' },
] as const
