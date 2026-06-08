import type { Response } from 'express'
import { pollChunkProgress } from './chapters.queries'

export class ProgressSseStream {
  private closed = false

  constructor(
    private readonly chapterId: string,
    private readonly res: Response,
  ) {}

  open() {
    this.res.setHeader('Content-Type', 'text/event-stream')
    this.res.setHeader('Cache-Control', 'no-cache')
    this.res.setHeader('Connection', 'keep-alive')
    this.res.flushHeaders()
    this.poll()
  }

  onClose() {
    this.closed = true
  }

  private send(data: object) {
    this.res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  private async poll() {
    if (this.closed) return

    try {
      const chunks = await pollChunkProgress(this.chapterId)
      const total = chunks.length
      const doneCount = chunks.filter((c) => c.status === 'done').length
      const active = chunks.find((c) => c.status === 'processing')

      this.send({
        type: 'progress',
        chunkIndex: active?.position ?? doneCount,
        total,
        done: doneCount,
        status: active ? 'processing' : doneCount === total && total > 0 ? 'done' : 'pending',
      })

      if (doneCount === total && total > 0) {
        this.send({ type: 'complete' })
        this.res.end()
        return
      }
    } catch (err) {
      console.error(`[chapters] SSE poll error for chapter ${this.chapterId}:`, err)
    }

    if (!this.closed) setTimeout(() => this.poll(), 500)
  }
}
