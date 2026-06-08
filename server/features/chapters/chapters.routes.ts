import { Router, Request, Response } from 'express'
import { enqueueChapterProcessing } from './chapters.service'
import { findChapterById, fetchChapterChunks } from './chapters.queries'
import { ProgressSseStream } from './chapters.progress-sse'
import { NotFoundError } from '../../../shared/errors'

export const chaptersRouter = Router()

chaptersRouter.post('/:id/process', async (req: Request, res: Response): Promise<void> => {
  const result = await enqueueChapterProcessing(req.params.id)
  res.json({ jobId: result.jobId ?? null, ...(result.alreadyDone && { alreadyDone: true }) })
})

chaptersRouter.get('/:id/chunks', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const chapter = await findChapterById(id)
  if (!chapter) throw new NotFoundError('Chapter not found')
  const chunks = await fetchChapterChunks(id)
  res.json(chunks.map((c) => ({ ...c, status: c.status as string })))
})

chaptersRouter.get('/:id/progress', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const chapter = await findChapterById(id)
  if (!chapter) throw new NotFoundError('Chapter not found')
  const stream = new ProgressSseStream(id, res)
  req.on('close', () => stream.onClose())
  stream.open()
})
