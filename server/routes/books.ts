import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { prisma } from '../../lib/prisma'
import { parseEpub } from '../epub'
import { parsePdf } from '../pdf'
import { extractManifestFields } from '../llm'
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

booksRouter.post(
  '/',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const tmpPath = req.file.path

    const ext = path.extname(req.file.originalname).toLowerCase()
    const isPdf = ext === '.pdf'

    try {
      const parsed = isPdf ? await parsePdf(tmpPath) : await parseEpub(tmpPath)

      // Deduplication: same title + author → return existing record
      const existing = await prisma.book.findFirst({
        where: { title: parsed.title, author: parsed.author },
        include: { chapters: { orderBy: { position: 'asc' } } },
      })

      if (existing) {
        const body: BookResponse = {
          id: existing.id,
          title: existing.title,
          author: existing.author,
          keyConcepts: existing.keyConcepts as string[],
          prerequisiteLevel: existing.prerequisiteLevel ?? 'unknown',
          primaryLanguages: [],
          chapters: existing.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            position: c.position,
          })),
          alreadyExisted: true,
          isPdfUpload: isPdf,
        }
        res.status(200).json(body)
        return
      }

      // LLM second pass: key concepts + prerequisite level
      const llm = await extractManifestFields(parsed.tocText, parsed.introText)

      // Persist book + chapters in a single transaction
      const book = await prisma.$transaction(async (tx) => {
        const b = await tx.book.create({
          data: {
            title: parsed.title,
            author: parsed.author,
            keyConcepts: llm.keyConcepts,
            prerequisiteLevel: llm.prerequisiteLevel,
          },
        })
        await tx.chapter.createMany({
          data: parsed.chapters.map((c) => ({
            bookId: b.id,
            title: c.title,
            position: c.position,
          })),
        })
        return b
      })

      const chapters = await prisma.chapter.findMany({
        where: { bookId: book.id },
        orderBy: { position: 'asc' },
        select: { id: true, title: true, position: true },
      })

      const body: BookResponse = {
        id: book.id,
        title: book.title,
        author: book.author,
        keyConcepts: llm.keyConcepts,
        prerequisiteLevel: llm.prerequisiteLevel,
        primaryLanguages: parsed.primaryLanguages,
        chapters,
        isPdfUpload: isPdf,
      }

      res.status(201).json(body)
    } catch (err) {
      console.error('[books] error processing file:', err)
      res.status(500).json({ error: 'Failed to process file' })
    } finally {
      // Clean up temp file
      await fs.unlink(tmpPath).catch(() => undefined)
    }
  },
)

// Multer error handler (e.g. wrong file type)
booksRouter.use((err: Error, _req: Request, res: Response, _next: unknown) => {
  if (err.message === 'Only EPUB or PDF files are accepted') {
    res.status(400).json({ error: err.message })
  } else {
    res.status(500).json({ error: 'Upload failed' })
  }
})
