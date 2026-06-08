/* eslint-disable @typescript-eslint/no-explicit-any */

const LANG_PATTERN = /class=["'](?:language-|lang-)(\w+)["']|```(\w+)/g
const NOISE_LANGS = new Set(['text', 'plaintext', 'plain', 'output', 'terminal'])

export async function detectLanguages(
  epub: any,
  chapters: Array<{ id: string; title: string; position: number }>,
): Promise<string[]> {
  const langSet = new Set<string>()
  for (const chapter of chapters.slice(0, 10)) {
    try {
      const html: string = await epub.getChapterRawAsync(chapter.id)
      for (const match of html.matchAll(LANG_PATTERN)) {
        const lang = (match[1] ?? match[2] ?? '').toLowerCase()
        if (lang && !NOISE_LANGS.has(lang)) langSet.add(lang)
      }
    } catch (err) {
      console.warn(`[epub] skipping unreadable chapter "${chapter.id}" (lang-detect pass):`, err)
    }
  }
  return Array.from(langSet)
}
