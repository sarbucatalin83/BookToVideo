import 'dotenv/config'
import net from 'net'
import { Worker } from 'bullmq'
import { prisma } from '../lib/prisma'

const REDIS_URL = process.env.REDIS_URL

if (!REDIS_URL) {
  console.error('[worker] REDIS_URL is required but not set')
  process.exit(1)
}

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
      const { chapterId } = job.data as { chapterId: string }
      console.log(`[worker] processing chapter ${chapterId}`)

      const chunks = await prisma.chunk.findMany({
        where: { chapterId },
        orderBy: { position: 'asc' },
      })

      const pending = chunks.filter(c => c.status !== 'done')

      if (pending.length === 0) {
        await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'done' } })
        return
      }

      await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'processing' } })

      for (const chunk of pending) {
        await prisma.chunk.update({ where: { id: chunk.id }, data: { status: 'processing' } })
        await new Promise(r => setTimeout(r, 400))
        await prisma.chunk.update({ where: { id: chunk.id }, data: { status: 'done' } })
      }

      await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'done' } })
      console.log(`[worker] chapter ${chapterId} done`)
    },
    { connection: { url: REDIS_URL } },
  )

  worker.on('completed', (job) => console.log(`[worker] job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err))

  console.log('[worker] BullMQ worker started — waiting for jobs')
})()
