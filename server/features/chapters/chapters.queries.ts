import { prisma } from '../../../shared/prisma'

export async function findChapterById(id: string) {
  return prisma.chapter.findUnique({ where: { id }, select: { id: true, status: true } })
}

export async function countChunksByChapter(chapterId: string) {
  return prisma.chunk.count({ where: { chapterId } })
}

export async function createStubChunks(chapterId: string, count: number) {
  return prisma.chunk.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      chapterId,
      position: i,
      content: `[stub chunk ${i + 1}]`,
      tokenCount: 100,
    })),
  })
}

export async function resetPendingChunks(chapterId: string) {
  return prisma.chunk.updateMany({
    where: { chapterId, status: { not: 'done' } },
    data: { status: 'pending' },
  })
}

export async function setChapterStatus(id: string, status: string) {
  return prisma.chapter.update({ where: { id }, data: { status } })
}

export async function fetchChapterChunks(chapterId: string) {
  return prisma.chunk.findMany({
    where: { chapterId },
    orderBy: { position: 'asc' },
    select: { id: true, position: true, content: true, tokenCount: true, status: true },
  })
}

export async function pollChunkProgress(chapterId: string) {
  return prisma.chunk.findMany({
    where: { chapterId },
    orderBy: { position: 'asc' },
    select: { position: true, status: true },
  })
}
