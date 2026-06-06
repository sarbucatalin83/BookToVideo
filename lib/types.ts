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
  alreadyExisted?: boolean
  isPdfUpload?: boolean
}
