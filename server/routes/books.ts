import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { prisma } from '../../lib/prisma'
import { parseEpub } from '../epub'
import { parsePdf } from '../pdf'
import { extractManifestFields, getProviderEnvError } from '../llm'
import type { Provider } from '../llm'
import type { BookResponse } from '../../lib/types'

export const booksRouter = Router()

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `book-${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const mime = file.mimetype
    if (
      ext === '.epub' || mime === 'application/epub+zip' ||
      ext === '.pdf' || mime === 'application/pdf'
    ) {
      cb(null, true)
    } else {
      cb(new Error('Only EPUB or PDF files are accepted'))
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
})

const VALID_PROVIDERS: Provider[] = ['anthropic', 'google', 'openai']
const VALID_TIERS = ['fast', 'balanced', 'best']
const VALID_DEPTHS = ['overview', 'standard', 'deep_dive']
const VALID_THEMES = ['dark', 'light', 'high_contrast']

booksRouter.post(
  '/',
  (_req, _res, next) => { console.log('[books] POST / hit — before multer'); next() },
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const provider = req.body?.provider as string
    const force = req.body?.force === 'true'
    if (!VALID_PROVIDERS.includes(provider as Provider)) {
      res.status(400).json({ error: 'A provider must be selected before uploading (anthropic, google, or openai)' })
      return
    }

    const providerErr = getProviderEnvError(provider as Provider)
    if (providerErr) {
      res.status(400).json({ error: providerErr })
      return
    }

    const tmpPath = req.file.path

    const ext = path.extname(req.file.originalname).toLowerCase()
    const isPdf = ext === '.pdf'
    const fileMeta = `"${req.file.originalname}" (${req.file.size} bytes)`

    console.log(`[books] processing upload: ${fileMeta} → tmpPath=${tmpPath}`)

    try {
      let parsed: Awaited<ReturnType<typeof parsePdf>> | Awaited<ReturnType<typeof parseEpub>>
      try {
        parsed = isPdf ? await parsePdf(tmpPath) : await parseEpub(tmpPath)
      } catch (err) {
        console.error(`[books] file parse step failed for ${fileMeta}:`, err)
        res.status(422).json({ error: 'Failed to parse uploaded file' })
        return
      }

      // Deduplication: same title + author → return existing record
      let existing: Awaited<ReturnType<typeof prisma.book.findFirst>>
      try {
        existing = await prisma.book.findFirst({
          where: { title: parsed.title, author: parsed.author },
          include: { chapters: { orderBy: { position: 'asc' } } },
        })
      } catch (err) {
        console.error(`[books] DB lookup failed for ${fileMeta}:`, err)
        res.status(500).json({ error: 'Database error during deduplication check' })
        return
      }

      if (existing && !force) {
        console.log(`[books] duplicate found — returning existing book id=${existing.id} for ${fileMeta}`)
        const body: BookResponse = {
          id: existing.id,
          title: existing.title,
          author: existing.author,
          keyConcepts: existing.keyConcepts as string[],
          prerequisiteLevel: existing.prerequisiteLevel ?? 'unknown',
          primaryLanguages: [],
          provider: existing.provider,
          modelTier: existing.modelTier,
          depthPreset: existing.depthPreset,
          themePreset: existing.themePreset,
          voice: existing.voice,
          chapters: existing.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            position: c.position,
            status: c.status as 'pending' | 'processing' | 'done' | 'error',
          })),
          alreadyExisted: true,
          isPdfUpload: isPdf,
        }
        res.status(200).json(body)
        return
      }

      if (existing && force) {
        console.log(`[books] force reprocess — deleting existing book id=${existing.id} for ${fileMeta}`)
        await prisma.book.delete({ where: { id: existing.id } })
      }

      // LLM second pass: key concepts + prerequisite level + chapters
      console.log(`[books] calling LLM (${provider}) for manifest fields…`)
      const llm = await extractManifestFields(parsed.tocText, parsed.introText, provider as Provider)
      console.log(`[books] LLM done — keyConcepts=${llm.keyConcepts.length} prerequisiteLevel="${llm.prerequisiteLevel}" chapters=${llm.chapters.length}`)

      // Prefer LLM-extracted chapters when the count is plausible relative to
      // what the parser found (LLM may filter front matter, but returning fewer
      // than half the parsed chapters almost always means truncation or aggressive
      // filtering — fall back to the parser in that case).
      const llmCountOk = llm.chapters.length > 0 && llm.chapters.length >= Math.ceil(parsed.chapters.length / 2)
      const chaptersToStore = llmCountOk
        ? llm.chapters.map((c, i) => ({ title: c.title, position: i }))
        : parsed.chapters.map((c) => ({ title: c.title, position: c.position }))

      // Persist book + chapters in a single transaction
      let book: Awaited<ReturnType<typeof prisma.book.create>>
      try {
        book = await prisma.$transaction(async (tx) => {
          const b = await tx.book.create({
            data: {
              title: parsed.title,
              author: parsed.author,
              keyConcepts: llm.keyConcepts,
              prerequisiteLevel: llm.prerequisiteLevel,
              provider: provider as Provider,
            },
          })
          await tx.chapter.createMany({
            data: chaptersToStore.map((c) => ({
              bookId: b.id,
              title: c.title,
              position: c.position,
            })),
          })
          return b
        })
      } catch (err) {
        console.error(`[books] DB transaction failed for ${fileMeta} (title="${parsed.title}", author="${parsed.author}"):`, err)
        res.status(500).json({ error: 'Database error while saving book' })
        return
      }

      let chapters: Array<{ id: string; title: string; position: number; status: 'pending' | 'processing' | 'done' | 'error' }>
      try {
        const raw = await prisma.chapter.findMany({
          where: { bookId: book.id },
          orderBy: { position: 'asc' },
          select: { id: true, title: true, position: true, status: true },
        })
        chapters = raw.map(c => ({ ...c, status: c.status as 'pending' | 'processing' | 'done' | 'error' }))
      } catch (err) {
        console.error(`[books] failed to fetch chapters for bookId=${book.id}:`, err)
        res.status(500).json({ error: 'Database error while fetching chapters' })
        return
      }

      console.log(`[books] created book id=${book.id} title="${book.title}" chapters=${chapters.length} for ${fileMeta}`)

      const body: BookResponse = {
        id: book.id,
        title: book.title,
        author: book.author,
        keyConcepts: llm.keyConcepts,
        prerequisiteLevel: llm.prerequisiteLevel,
        primaryLanguages: parsed.primaryLanguages,
        provider: book.provider,
        modelTier: book.modelTier,
        depthPreset: book.depthPreset,
        themePreset: book.themePreset,
        voice: book.voice,
        chapters,
        isPdfUpload: isPdf,
      }

      res.status(201).json(body)
    } catch (err) {
      console.error(`[books] unexpected error processing ${fileMeta}:`, err)
      res.status(500).json({ error: 'Failed to process file' })
    } finally {
      await fs.unlink(tmpPath).catch((err) => {
        console.warn(`[books] failed to delete temp file "${tmpPath}":`, err)
      })
    }
  },
)

booksRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const { provider, modelTier, depthPreset, themePreset, voice } = req.body as {
    provider?: string
    modelTier?: string
    depthPreset?: string
    themePreset?: string
    voice?: string | null
  }

  if (provider !== undefined && !VALID_PROVIDERS.includes(provider as Provider)) {
    res.status(400).json({ error: 'Invalid provider' })
    return
  }
  if (modelTier !== undefined && !VALID_TIERS.includes(modelTier)) {
    res.status(400).json({ error: 'Invalid modelTier' })
    return
  }
  if (depthPreset !== undefined && !VALID_DEPTHS.includes(depthPreset)) {
    res.status(400).json({ error: 'Invalid depthPreset' })
    return
  }
  if (themePreset !== undefined && !VALID_THEMES.includes(themePreset)) {
    res.status(400).json({ error: 'Invalid themePreset' })
    return
  }

  try {
    const book = await prisma.book.update({
      where: { id },
      data: {
        ...(provider && { provider: provider as Provider }),
        ...(modelTier && { modelTier: modelTier as 'fast' | 'balanced' | 'best' }),
        ...(depthPreset && { depthPreset: depthPreset as 'overview' | 'standard' | 'deep_dive' }),
        ...(themePreset && { themePreset: themePreset as 'dark' | 'light' | 'high_contrast' }),
        ...(voice !== undefined && { voice: voice ?? null }),
      },
    })
    console.log(`[books] PATCH /${id} — saved config provider=${book.provider} tier=${book.modelTier} depth=${book.depthPreset}`)
    res.json({
      provider: book.provider,
      modelTier: book.modelTier,
      depthPreset: book.depthPreset,
      themePreset: book.themePreset,
      voice: book.voice,
    })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'P2025') {
      res.status(404).json({ error: 'Book not found' })
      return
    }
    console.error(`[books] PATCH /${id} failed:`, err)
    res.status(500).json({ error: 'Failed to update book settings' })
  }
})

// Multer error handler (e.g. wrong file type, size limit)
booksRouter.use((err: Error, _req: Request, res: Response, _next: unknown) => {
  if (err.message === 'Only EPUB or PDF files are accepted') {
    console.warn('[books] rejected upload — wrong file type:', err.message)
    res.status(400).json({ error: err.message })
  } else {
    console.error('[books] multer/upload error:', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})
