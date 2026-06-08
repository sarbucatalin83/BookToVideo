/* eslint-disable @typescript-eslint/no-explicit-any */

export async function extractIntroText(
  epub: any,
  chapters: Array<{ id: string; title: string; position: number }>,
): Promise<string> {
  for (const chapter of chapters.slice(0, 5)) {
    try {
      const html: string = await epub.getChapterRawAsync(chapter.id)
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (text.length > 100) {
        const introText = text.slice(0, 1500)
        console.log(`[epub] intro text — ${introText.length} chars from chapter "${chapter.id}"`)
        return introText
      }
    } catch (err) {
      console.warn(`[epub] skipping unreadable chapter "${chapter.id}" (intro pass):`, err)
    }
  }
  return ''
}
