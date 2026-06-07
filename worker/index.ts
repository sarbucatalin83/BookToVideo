import 'dotenv/config'
import net from 'net'
import { Worker } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

function probeRedis(url: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const { hostname: host, port: portStr } = new URL(url)
    const port = parseInt(portStr || '6379', 10)
    const socket = net.createConnection({ port, host })
    const timer = setTimeout(() => { socket.destroy(); resolve(false) }, timeoutMs)
    socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true) })
    socket.on('error', () => { clearTimeout(timer); resolve(false) })
  })
}

;(async () => {
  const redisAvailable = await probeRedis(REDIS_URL)
  if (!redisAvailable) {
    console.warn(`[worker] Redis not available at ${REDIS_URL} — worker disabled.`)
    console.warn('[worker] Run `npm run dev:infra` to start Redis, then restart the dev server.')
    process.exit(0)
  }

  const worker = new Worker(
    'chapter-processing',
    async (job) => {
      console.log(`[worker] received job ${job.id}: chapter ${job.data.chapterId}`)
      // TODO: implement in Slice 5
    },
    { connection: { url: REDIS_URL } },
  )

  worker.on('completed', (job) => console.log(`[worker] job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err))

  console.log('[worker] BullMQ worker started — waiting for jobs')
})()
