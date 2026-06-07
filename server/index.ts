import 'dotenv/config'
import express from 'express'
import { booksRouter } from './routes/books'
import { chaptersRouter } from './routes/chapters'
import { voiceRouter } from './routes/voice'
import { getProviderEnvError } from './llm'
import type { Provider } from './llm'

process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException — server will exit:', err)
  console.error(err?.stack ?? String(err))
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection (non-fatal):', reason)
})

const app = express()
const PORT = process.env.API_PORT ?? 3001

app.use(express.json())
app.get('/health', (_req, res) => res.json({ ok: true }))
app.get('/api/config', (_req, res) => {
  const all: Provider[] = ['anthropic', 'google', 'openai']
  res.json({ availableProviders: all.filter((p) => !getProviderEnvError(p)) })
})
app.use('/api/books', booksRouter)
app.use('/api/chapter', chaptersRouter)
app.use('/api/voice', voiceRouter)

app.listen(PORT, () => {
  console.log(`[server] API server running on http://localhost:${PORT}`)
  const keys = {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  }
  const configured = Object.entries(keys).filter(([, v]) => v).map(([k]) => k)
  if (configured.length === 0) {
    console.warn('[server] WARNING: No LLM provider API keys are set — all uploads will fail')
  } else {
    console.log(`[server] LLM providers configured: ${configured.join(', ')}`)
  }
})
