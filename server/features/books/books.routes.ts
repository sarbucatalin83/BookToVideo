import { Router, Request, Response } from 'express'
import path from 'path'
import { upload, isValidProvider, isValidModelTier, isValidDepthPreset, isValidThemePreset } from './books.validators'
import { getProviderEnvError } from '../../adapters/llm/provider-registry'
import type { Provider } from '../../adapters/llm/provider-registry'
import { createBookFromUpload, updateBookSettings } from './books.service'

export const booksRouter = Router()

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

    if (!isValidProvider(provider)) {
      res.status(400).json({ error: 'A provider must be selected before uploading (anthropic, google, or openai)' })
      return
    }

    const providerErr = getProviderEnvError(provider)
    if (providerErr) {
      res.status(400).json({ error: providerErr })
      return
    }

    const ext = path.extname(req.file.originalname).toLowerCase()
    const fileMeta = `"${req.file.originalname}" (${req.file.size} bytes)`

    const body = await createBookFromUpload({ tmpPath: req.file.path, ext, provider, force, fileMeta })
    res.status(body.alreadyExisted ? 200 : 201).json(body)
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

  if (provider !== undefined && !isValidProvider(provider)) {
    res.status(400).json({ error: 'Invalid provider' })
    return
  }
  if (modelTier !== undefined && !isValidModelTier(modelTier)) {
    res.status(400).json({ error: 'Invalid modelTier' })
    return
  }
  if (depthPreset !== undefined && !isValidDepthPreset(depthPreset)) {
    res.status(400).json({ error: 'Invalid depthPreset' })
    return
  }
  if (themePreset !== undefined && !isValidThemePreset(themePreset)) {
    res.status(400).json({ error: 'Invalid themePreset' })
    return
  }

  const result = await updateBookSettings(id, {
    ...(provider && { provider: provider as Provider }),
    ...(modelTier && { modelTier: modelTier as 'fast' | 'balanced' | 'best' }),
    ...(depthPreset && { depthPreset: depthPreset as 'overview' | 'standard' | 'deep_dive' }),
    ...(themePreset && { themePreset: themePreset as 'dark' | 'light' | 'high_contrast' }),
    ...(voice !== undefined && { voice: voice ?? null }),
  })
  res.json(result)
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
