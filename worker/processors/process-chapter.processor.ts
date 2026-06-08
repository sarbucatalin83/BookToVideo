import type { Job } from 'bullmq'
import { prisma } from '../../shared/prisma'
import type { ProcessChapterJob } from '../../shared/queues/chapter-queue'

export async function processChapterJob(job: Job<ProcessChapterJob>): Promise<void> {
  const { chapterId } = job.data
  console.log(`[worker] processing chapter ${chapterId}`)

  const chunks = await prisma.chunk.findMany({
    where: { chapterId },
    orderBy: { position: 'asc' },
  })

  const pending = chunks.filter((c) => c.status !== 'done')

  if (pending.length === 0) {
    await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'done' } })
    return
  }

  await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'processing' } })

  for (const chunk of pending) {
    await prisma.chunk.update({ where: { id: chunk.id }, data: { status: 'processing' } })
    await new Promise((r) => setTimeout(r, 400))
    await prisma.chunk.update({ where: { id: chunk.id }, data: { status: 'done' } })
  }

  await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'done' } })
  console.log(`[worker] chapter ${chapterId} done`)
}
