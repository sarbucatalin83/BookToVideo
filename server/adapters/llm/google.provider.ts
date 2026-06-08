import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LlmProvider, LlmManifestFields } from './llm.port'
import { buildManifestPrompt } from './manifest-prompt'
import { parseManifestResponse } from './manifest-response'

export class GoogleProvider implements LlmProvider {
  private genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

  async extractManifestFields(tocText: string, introText: string): Promise<LlmManifestFields> {
    const prompt = buildManifestPrompt(tocText, introText)
    console.log(`[llm] → Google gemini-2.5-flash | prompt ${prompt.length} chars`)
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      console.log(`[llm] ✓ Google responded | ${text.length} chars`)
      return parseManifestResponse(text, 'Google')
    } catch (err) {
      console.error('[llm] Google API call failed:', err)
      return { keyConcepts: [], prerequisiteLevel: 'unknown', chapters: [] }
    }
  }
}
