import 'dotenv/config'
import { Worker } from 'bullmq'
import { probeRedis } from '../shared/queues/redis-probe'
import { processChapterJob } from './processors/process-chapter.processor'

const REDIS_URL = process.env.REDIS_URL

if (!REDIS_URL) {
  console.error('[worker] REDIS_URL is required but not set')
  process.exit(1)
}

;(async () => {
  const redisAvailable = await probeRedis(REDIS_URL)
  if (!redisAvailable) {
    console.warn(`[worker] Redis not available at ${REDIS_URL} — worker disabled.`)
    console.warn('[worker] Run `npm run dev:infra` to start Redis, then restart the dev server.')
    process.exit(0)
  }

  const worker = new Worker('chapter-processing', processChapterJob, {
    connection: { url: REDIS_URL },
  })

  worker.on('completed', (job) => console.log(`[worker] job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err))

  console.log('[worker] BullMQ worker started — waiting for jobs')
})()
