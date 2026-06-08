import OpenAI from 'openai'
import type { LlmProvider, LlmManifestFields } from './llm.port'
import { buildManifestPrompt } from './manifest-prompt'
import { parseManifestResponse } from './manifest-response'

export class OpenAIProvider implements LlmProvider {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  async extractManifestFields(tocText: string, introText: string): Promise<LlmManifestFields> {
    const prompt = buildManifestPrompt(tocText, introText)
    console.log(`[llm] → OpenAI gpt-4o-mini | prompt ${prompt.length} chars`)
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.choices[0]?.message?.content ?? ''
      console.log(`[llm] ✓ OpenAI responded | ${text.length} chars`)
      return parseManifestResponse(text, 'OpenAI')
    } catch (err) {
      console.error('[llm] OpenAI API call failed:', err)
      return { keyConcepts: [], prerequisiteLevel: 'unknown', chapters: [] }
    }
  }
}
