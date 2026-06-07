export interface ManifestChapter {
  id: string
  title: string
  position: number
}

export interface BookResponse {
  id: string
  title: string
  author: string
  keyConcepts: string[]
  prerequisiteLevel: string
  primaryLanguages: string[]
  chapters: ManifestChapter[]
  provider: string
  modelTier: string
  depthPreset: string
  themePreset: string
  voice: string | null
  alreadyExisted?: boolean
  isPdfUpload?: boolean
}
