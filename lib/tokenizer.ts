import { get_encoding } from 'tiktoken'

let enc: ReturnType<typeof get_encoding> | null = null

function getEncoder() {
  if (!enc) enc = get_encoding('cl100k_base')
  return enc
}

export function countTokens(text: string): number {
  return getEncoder().encode(text).length
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const encoder = getEncoder()
  const tokens = encoder.encode(text)
  if (tokens.length <= maxTokens) return text
  const decoded = encoder.decode(tokens.slice(0, maxTokens))
  return new TextDecoder().decode(decoded)
}
