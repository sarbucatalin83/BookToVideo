import Anthropic from '@anthropic-ai/sdk'

export interface LlmManifestFields {
  keyConcepts: string[]
  prerequisiteLevel: string
}

export async function extractManifestFields(
  tocText: string,
  introText: string,
): Promise<LlmManifestFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { keyConcepts: [], prerequisiteLevel: 'unknown' }
  }

  const client = new Anthropic({ apiKey })

  const prompt = `Given the table of contents and introduction of a book, extract:
1. key_concepts: 5-10 core concepts a reader will learn (short phrases)
2. prerequisite_level: one of "beginner", "intermediate", or "advanced"

Respond ONLY with valid JSON, no markdown, no explanation. Example:
{"key_concepts":["dependency injection","async/await","type narrowing"],"prerequisite_level":"intermediate"}

Table of contents:
${tocText.slice(0, 1000)}

Introduction excerpt:
${introText.slice(0, 800)}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const parsed = JSON.parse(text) as { key_concepts?: string[]; prerequisite_level?: string }
    return {
      keyConcepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [],
      prerequisiteLevel: parsed.prerequisite_level ?? 'unknown',
    }
  } catch {
    return { keyConcepts: [], prerequisiteLevel: 'unknown' }
  }
}
