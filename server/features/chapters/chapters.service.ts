import { getChapterQueue } from '../../../shared/queues/chapter-queue'
import { NotFoundError } from '../../../shared/errors'
import {
  findChapterById,
  countChunksByChapter,
  createStubChunks,
  resetPendingChunks,
  setChapterStatus,
} from './chapters.queries'

const STUB_CHUNK_COUNT = 5

export async function enqueueChapterProcessing(chapterId: string): Promise<{ jobId: string | undefined; alreadyDone?: boolean }> {
  const chapter = await findChapterById(chapterId)
  if (!chapter) throw new NotFoundError('Chapter not found')

  if (chapter.status === 'done') return { jobId: undefined, alreadyDone: true }

  const existingCount = await countChunksByChapter(chapterId)
  if (existingCount === 0) await createStubChunks(chapterId, STUB_CHUNK_COUNT)

  await resetPendingChunks(chapterId)
  await setChapterStatus(chapterId, 'pending')

  const queue = getChapterQueue()
  const job = await queue.add('process-chapter', { chapterId })
  return { jobId: job.id }
}
