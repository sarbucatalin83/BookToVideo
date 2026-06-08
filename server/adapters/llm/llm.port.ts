export interface LlmManifestFields {
  keyConcepts: string[]
  prerequisiteLevel: string
  chapters: Array<{ title: string }>
}

export interface LlmProvider {
  extractManifestFields(tocText: string, introText: string): Promise<LlmManifestFields>
}
