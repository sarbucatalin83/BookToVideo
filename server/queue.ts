import { Queue } from 'bullmq'

let _queue: Queue | null = null

export function getChapterQueue(): Queue {
  if (!_queue) {
    const url = process.env.REDIS_URL
    if (!url) throw new Error('REDIS_URL is required but not set')
    _queue = new Queue('chapter-processing', { connection: { url } })
  }
  return _queue
}
