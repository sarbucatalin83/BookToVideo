import type { LlmManifestFields } from './llm.port'

export function parseManifestResponse(text: string, providerLabel: string): LlmManifestFields {
  try {
    const parsed = JSON.parse(text) as {
      key_concepts?: string[]
      prerequisite_level?: string
      chapters?: Array<{ title?: string }>
    }
    const chapters = Array.isArray(parsed.chapters)
      ? parsed.chapters
          .filter((c) => typeof c?.title === 'string' && c.title.trim())
          .map((c) => ({ title: c.title!.trim() }))
      : []
    return {
      keyConcepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [],
      prerequisiteLevel: parsed.prerequisite_level ?? 'unknown',
      chapters,
    }
  } catch (err) {
    console.error(`[llm] Failed to parse ${providerLabel} response as JSON. Raw text:`, JSON.stringify(text), 'Error:', err)
    return { keyConcepts: [], prerequisiteLevel: 'unknown', chapters: [] }
  }
}
