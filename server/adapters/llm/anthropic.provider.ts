import Anthropic from '@anthropic-ai/sdk'
import type { LlmProvider, LlmManifestFields } from './llm.port'
import { buildManifestPrompt } from './manifest-prompt'
import { parseManifestResponse } from './manifest-response'

export class AnthropicProvider implements LlmProvider {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  async extractManifestFields(tocText: string, introText: string): Promise<LlmManifestFields> {
    const prompt = buildManifestPrompt(tocText, introText)
    console.log(`[llm] → Anthropic claude-haiku-4-5 | prompt ${prompt.length} chars`)
    try {
      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      console.log(`[llm] ✓ Anthropic responded | ${text.length} chars`)
      return parseManifestResponse(text, 'Anthropic')
    } catch (err) {
      console.error('[llm] Anthropic API call failed:', err)
      return { keyConcepts: [], prerequisiteLevel: 'unknown', chapters: [] }
    }
  }
}
