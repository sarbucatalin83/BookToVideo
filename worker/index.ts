// BullMQ worker — real job processing logic added in Slice 5
// Prerequisites: Redis running on REDIS_URL (default: redis://localhost:6379)
import { Worker } from "bullmq"

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" }

const worker = new Worker(
  "chapter-processing",
  async (job) => {
    console.log(`[worker] received job ${job.id}: chapter ${job.data.chapterId}`)
    // TODO: implement in Slice 5
  },
  { connection }
)

worker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`))
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err))

console.log("[worker] BullMQ worker started — waiting for jobs")
