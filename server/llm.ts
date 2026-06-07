import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

export type Provider = 'anthropic' | 'google' | 'openai'

export interface LlmManifestFields {
  keyConcepts: string[]
  prerequisiteLevel: string
  chapters: Array<{ title: string }>
}

const PROVIDER_ENV: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
}

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  openai: 'OpenAI',
}

export function getProviderEnvError(provider: Provider): string | null {
  const envVar = PROVIDER_ENV[provider]
  if (!process.env[envVar]) {
    return `${envVar} is not set on the server. Add it to your .env file to use the ${PROVIDER_LABEL[provider]} provider.`
  }
  return null
}

const PROMPT = (tocText: string, introText: string) => `Given the table of contents and introduction of a book, extract:
1. key_concepts: 5-10 core concepts a reader will learn (short phrases)
2. prerequisite_level: one of "beginner", "intermediate", or "advanced"
3. chapters: ordered list of chapter titles as they appear in the book (exclude only non-content items like cover, copyright, dedication, acknowledgements, and index)

Respond ONLY with valid JSON, no markdown, no explanation. Example:
{"key_concepts":["dependency injection","async/await","type narrowing"],"prerequisite_level":"intermediate","chapters":[{"title":"Getting Started"},{"title":"Core Concepts"}]}

Table of contents:
${tocText.slice(0, 4000)}

Introduction excerpt:
${introText.slice(0, 800)}`

export async function extractManifestFields(
  tocText: string,
  introText: string,
  provider: Provider,
): Promise<LlmManifestFields> {
  const prompt = PROMPT(tocText, introText)
  let text: string

  try {
    if (provider === 'anthropic') {
      console.log(`[llm] → Anthropic claude-haiku-4-5 | prompt ${prompt.length} chars`)
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      text = message.content[0].type === 'text' ? message.content[0].text : ''
      console.log(`[llm] ✓ Anthropic responded | ${text.length} chars`)
    } else if (provider === 'google') {
      console.log(`[llm] → Google gemini-2.5-flash | prompt ${prompt.length} chars`)
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const result = await model.generateContent(prompt)
      text = result.response.text()
      console.log(`[llm] ✓ Google responded | ${text.length} chars`)
    } else {
      console.log(`[llm] → OpenAI gpt-4o-mini | prompt ${prompt.length} chars`)
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      text = response.choices[0]?.message?.content ?? ''
      console.log(`[llm] ✓ OpenAI responded | ${text.length} chars`)
    }
  } catch (err) {
    console.error(`[llm] ${PROVIDER_LABEL[provider]} API call failed:`, err)
    return { keyConcepts: [], prerequisiteLevel: 'unknown', chapters: [] }
  }

  try {
    const parsed = JSON.parse(text) as { key_concepts?: string[]; prerequisite_level?: string; chapters?: Array<{ title?: string }> }
    const chapters = Array.isArray(parsed.chapters)
      ? parsed.chapters.filter((c) => typeof c?.title === 'string' && c.title.trim()).map((c) => ({ title: c.title!.trim() }))
      : []
    return {
      keyConcepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [],
      prerequisiteLevel: parsed.prerequisite_level ?? 'unknown',
      chapters,
    }
  } catch (err) {
    console.error('[llm] Failed to parse LLM response as JSON. Raw text:', JSON.stringify(text), 'Error:', err)
    return { keyConcepts: [], prerequisiteLevel: 'unknown', chapters: [] }
  }
}
