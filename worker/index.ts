import 'dotenv/config'
import net from 'net'
import { Worker } from 'bullmq'
import { prisma } from '../lib/prisma'
import { assembleContext, formatRollingContext } from '../lib/context-assembler'
import { extractChunk } from '../lib/extractor'
import { generateChapterSynthesis } from '../lib/synthesizer'
import type { Provider, ModelTier, DepthPreset } from '../lib/model-config'
import type { BookManifest } from '../lib/chunk-types'

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

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts - 1) {
        const delayMs = 1000 * Math.pow(2, attempt)
        console.warn(`[worker] attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, err)
        await new Promise(r => setTimeout(r, delayMs))
      }
    }
  }
  throw lastError
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

      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { book: true },
      })

      if (!chapter) throw new Error(`Chapter ${chapterId} not found`)

      const { book } = chapter
      const bookManifest: BookManifest = {
        id: book.id,
        title: book.title,
        author: book.author,
        keyConcepts: Array.isArray(book.keyConcepts) ? (book.keyConcepts as string[]) : [],
        prerequisiteLevel: book.prerequisiteLevel,
        depthPreset: book.depthPreset,
      }

      // ADR 0001: fetch preceding chapter's synthesis for the chapter-boundary slot
      let precedingChapterSynthesis: string | null = null
      if (chapter.position > 0) {
        const prevChapter = await prisma.chapter.findFirst({
          where: { bookId: book.id, position: chapter.position - 1 },
          include: { summary: true },
        })
        precedingChapterSynthesis = prevChapter?.summary?.content ?? null
        if (precedingChapterSynthesis) {
          console.log(`[worker] found preceding synthesis for chapter ${chapterId}`)
        }
      }

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
        const nextChunk = chunks.find(c => c.position === chunk.position + 1) ?? null

        // ADR 0001: chapter boundary uses preceding synthesis; within-chapter uses null until Slice 9+
        const prevSummary = chunk.position === 0 ? precedingChapterSynthesis : null

        await prisma.chunk.update({ where: { id: chunk.id }, data: { status: 'processing' } })

        const ctx = assembleContext({
          book: bookManifest,
          currentChunk: { content: chunk.content },
          nextChunk: nextChunk ? { content: nextChunk.content } : null,
          prevSummary,
        })
        const contextStr = formatRollingContext(ctx)

        try {
          const result = await withRetry(() =>
            extractChunk(
              contextStr,
              book.provider as Provider,
              book.modelTier as ModelTier,
              book.depthPreset as DepthPreset,
            )
          )

          await prisma.chunk.update({
            where: { id: chunk.id },
            data: {
              status: 'done',
              codeBlocks: result.codeBlocks,
              principles: result.notable_quotes,
              costUsd: result.costUsd,
            },
          })

          console.log(
            `[worker] chunk ${chunk.id} (pos ${chunk.position}) done` +
            ` — in:${result.inputTokens} out:${result.outputTokens} cost:$${result.costUsd.toFixed(6)}`
          )
        } catch (err) {
          console.error(`[worker] chunk ${chunk.id} failed after retries:`, err)
          await prisma.chunk.update({ where: { id: chunk.id }, data: { status: 'error' } })
        }
      }

      // Generate ChapterSynthesis after all chunks are processed
      const doneChunks = await prisma.chunk.findMany({
        where: { chapterId, status: 'done' },
        orderBy: { position: 'asc' },
        select: { position: true, content: true, principles: true },
      })

      if (doneChunks.length > 0) {
        try {
          const synthesis = await generateChapterSynthesis(
            { chapterTitle: chapter.title, chunks: doneChunks },
            book.provider as Provider,
            book.modelTier as ModelTier,
          )

          await prisma.summary.upsert({
            where: { chapterId },
            create: { chapterId, content: synthesis.content },
            update: { content: synthesis.content },
          })

          console.log(
            `[worker] chapter ${chapterId} synthesis done` +
            ` — in:${synthesis.inputTokens} out:${synthesis.outputTokens} cost:$${synthesis.costUsd.toFixed(6)}`
          )
        } catch (err) {
          console.warn(`[worker] chapter ${chapterId} synthesis failed (non-fatal):`, err)
        }
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
