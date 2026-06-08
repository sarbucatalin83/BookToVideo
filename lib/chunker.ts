import { prisma } from './prisma'
import { countTokens } from './tokenizer'

const TARGET_TOKENS = 2500
const PARAGRAPH_SEPARATOR = /\n\n+/

export async function chunkChapter(chapterId: string, text: string): Promise<string[]> {
  const paragraphs = text.split(PARAGRAPH_SEPARATOR).filter(p => p.trim().length > 0)

  const rawChunks: { content: string; tokenCount: number }[] = []
  let current: string[] = []
  let currentTokens = 0

  for (const para of paragraphs) {
    const paraTokens = countTokens(para)

    if (currentTokens + paraTokens > TARGET_TOKENS && current.length > 0) {
      rawChunks.push({ content: current.join('\n\n'), tokenCount: currentTokens })
      current = [para]
      currentTokens = paraTokens
    } else {
      current.push(para)
      currentTokens += paraTokens
    }
  }

  if (current.length > 0) {
    rawChunks.push({ content: current.join('\n\n'), tokenCount: currentTokens })
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.chunk.deleteMany({ where: { chapterId } })

    const chunks = await Promise.all(
      rawChunks.map((chunk, i) =>
        tx.chunk.create({
          data: {
            chapterId,
            position: i,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
          },
        })
      )
    )

    await Promise.all(
      chunks.map((chunk, i) =>
        tx.chunk.update({
          where: { id: chunk.id },
          data: {
            prevChunkId: i > 0 ? chunks[i - 1].id : null,
            nextChunkId: i < chunks.length - 1 ? chunks[i + 1].id : null,
          },
        })
      )
    )

    return chunks
  })

  return created.map(c => c.id)
}
