import multer from 'multer'
import path from 'path'
import os from 'os'
import type { Provider } from '../../adapters/llm/provider-registry'

export const VALID_PROVIDERS: Provider[] = ['anthropic', 'google', 'openai']
export const VALID_TIERS = ['fast', 'balanced', 'best'] as const
export const VALID_DEPTHS = ['overview', 'standard', 'deep_dive'] as const
export const VALID_THEMES = ['dark', 'light', 'high_contrast'] as const

export function isValidProvider(v: unknown): v is Provider {
  return VALID_PROVIDERS.includes(v as Provider)
}

export function isValidModelTier(v: unknown): v is (typeof VALID_TIERS)[number] {
  return VALID_TIERS.includes(v as (typeof VALID_TIERS)[number])
}

export function isValidDepthPreset(v: unknown): v is (typeof VALID_DEPTHS)[number] {
  return VALID_DEPTHS.includes(v as (typeof VALID_DEPTHS)[number])
}

export function isValidThemePreset(v: unknown): v is (typeof VALID_THEMES)[number] {
  return VALID_THEMES.includes(v as (typeof VALID_THEMES)[number])
}

export const upload = multer({
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
