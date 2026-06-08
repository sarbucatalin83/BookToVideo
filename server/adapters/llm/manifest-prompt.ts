export function buildManifestPrompt(tocText: string, introText: string): string {
  return `Given the table of contents and introduction of a book, extract:
1. key_concepts: 5-10 core concepts a reader will learn (short phrases)
2. prerequisite_level: one of "beginner", "intermediate", or "advanced"
3. chapters: ordered list of chapter titles as they appear in the book (exclude only non-content items like cover, copyright, dedication, acknowledgements, and index)

Respond ONLY with valid JSON, no markdown, no explanation. Example:
{"key_concepts":["dependency injection","async/await","type narrowing"],"prerequisite_level":"intermediate","chapters":[{"title":"Getting Started"},{"title":"Core Concepts"}]}

Table of contents:
${tocText.slice(0, 4000)}

Introduction excerpt:
${introText.slice(0, 800)}`
}
