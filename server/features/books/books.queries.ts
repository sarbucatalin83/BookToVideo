import { prisma } from '../../../shared/prisma'
import type { Provider } from '../../adapters/llm/provider-registry'

export async function findBookByTitleAuthor(title: string, author: string) {
  return prisma.book.findFirst({
    where: { title, author },
    include: { chapters: { orderBy: { position: 'asc' } } },
  })
}

export async function deleteBook(id: string) {
  return prisma.book.delete({ where: { id } })
}

export async function createBookWithChapters(
  data: {
    title: string
    author: string
    keyConcepts: string[]
    prerequisiteLevel: string
    provider: Provider
  },
  chapters: Array<{ title: string; position: number }>,
) {
  return prisma.$transaction(async (tx) => {
    const book = await tx.book.create({ data })
    await tx.chapter.createMany({
      data: chapters.map((c) => ({ bookId: book.id, title: c.title, position: c.position })),
    })
    return book
  })
}

export async function fetchBookChapters(bookId: string) {
  const rows = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { position: 'asc' },
    select: { id: true, title: true, position: true, status: true },
  })
  return rows.map((c) => ({ ...c, status: c.status as 'pending' | 'processing' | 'done' | 'error' }))
}

export async function setBookSettings(
  id: string,
  data: {
    provider?: Provider
    modelTier?: 'fast' | 'balanced' | 'best'
    depthPreset?: 'overview' | 'standard' | 'deep_dive'
    themePreset?: 'dark' | 'light' | 'high_contrast'
    voice?: string | null
  },
) {
  return prisma.book.update({ where: { id }, data })
}
