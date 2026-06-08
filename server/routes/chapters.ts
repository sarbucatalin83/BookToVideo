import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma'
import { chunkChapter } from '../../lib/chunker'
import { getChapterQueue } from '../queue'

export const chaptersRouter = Router()

chaptersRouter.post('/:id/process', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      select: { id: true, status: true, content: true },
    })
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found' })
      return
    }

    if (chapter.status === 'done') {
      res.json({ jobId: null, alreadyDone: true })
      return
    }

    const existingCount = await prisma.chunk.count({ where: { chapterId: id } })
    if (existingCount === 0) {
      if (chapter.content) {
        await chunkChapter(id, chapter.content)
      } else {
        await prisma.chunk.createMany({
          data: Array.from({ length: 3 }, (_, i) => ({
            chapterId: id,
            position: i,
            content: `[no content — re-upload book to populate]`,
            tokenCount: 10,
          })),
        })
      }
    }

    await prisma.chunk.updateMany({
      where: { chapterId: id, status: { not: 'done' } },
      data: { status: 'pending' },
    })

    await prisma.chapter.update({ where: { id }, data: { status: 'pending' } })

    const queue = getChapterQueue()
    const job = await queue.add('process-chapter', { chapterId: id })

    res.json({ jobId: job.id })
  } catch (err) {
    console.error(`[chapters] POST /${id}/process failed:`, err)
    res.status(500).json({ error: 'Failed to enqueue chapter job' })
  }
})

chaptersRouter.get('/:id/summary', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  try {
    const summary = await prisma.summary.findUnique({ where: { chapterId: id } })
    res.json({ content: summary?.content ?? null })
  } catch (err) {
    console.error(`[chapters] GET /${id}/summary failed:`, err)
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

chaptersRouter.get('/:id/chunks', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params

  try {
    const chapter = await prisma.chapter.findUnique({ where: { id }, select: { id: true } })
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found' })
      return
    }

    const chunks = await prisma.chunk.findMany({
      where: { chapterId: id },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, content: true, tokenCount: true, status: true },
    })

    res.json(chunks.map(c => ({ ...c, status: c.status as string })))
  } catch (err) {
    console.error(`[chapters] GET /${id}/chunks failed:`, err)
    res.status(500).json({ error: 'Failed to fetch chunks' })
  }
})

chaptersRouter.get('/:id/progress', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params

  const chapter = await prisma.chapter.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let closed = false
  req.on('close', () => { closed = true })

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const poll = async () => {
    if (closed) return

    try {
      const chunks = await prisma.chunk.findMany({
        where: { chapterId: id },
        orderBy: { position: 'asc' },
        select: { position: true, status: true, costUsd: true },
      })

      const total = chunks.length
      const doneCount = chunks.filter(c => c.status === 'done').length
      const active = chunks.find(c => c.status === 'processing')
      const totalCostUsd = chunks.reduce((sum, c) => sum + c.costUsd, 0)

      sendEvent({
        type: 'progress',
        chunkIndex: active?.position ?? doneCount,
        total,
        done: doneCount,
        status: active ? 'processing' : doneCount === total && total > 0 ? 'done' : 'pending',
        costUsd: totalCostUsd,
      })

      if (doneCount === total && total > 0) {
        sendEvent({ type: 'complete' })
        res.end()
        return
      }
    } catch (err) {
      console.error(`[chapters] SSE poll error for chapter ${id}:`, err)
    }

    if (!closed) setTimeout(poll, 500)
  }

  poll()
})
