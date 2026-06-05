# Book-to-Video

Converts software development books (EPUB or PDF) into narrated, chapter-by-chapter video series.

## Local dev prerequisites

1. **Node.js 20+**
2. **Docker** — used to run PostgreSQL and Redis

## Setup

```bash
cp .env.local.example .env.local
# Fill in your API keys

npm install
npm run services:up   # Start PostgreSQL + Redis in Docker
npm run db:migrate    # Run Prisma migrations
```

## Two-terminal workflow

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — BullMQ background worker
npm run worker
```

## Required environment variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS key |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (default: `redis://localhost:6379`) |

## Database

```bash
npm run db:migrate    # Create / apply migrations
npm run db:generate   # Regenerate Prisma client after schema changes
npm run db:push       # Push schema without migration (dev only)
```
