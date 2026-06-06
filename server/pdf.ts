import fs from 'fs/promises'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

export interface ParsedPdf {
  title: string
  author: string
  language: string
  chapters: Array<{ id: string; title: string; position: number }>
  primaryLanguages: string[]
  tocText: string
  introText: string
  codeBlocksDetected: boolean
}

const CHAPTER_PATTERNS = [
  /^(?:chapter|section|part)\s+\d+/i,
  /^\d+\.\s+[A-Z][^\n]{3,60}$/,
  /^[IVX]+\.\s+[A-Z][^\n]{3,60}$/,
]

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 80 || trimmed.length < 3) return false
  return CHAPTER_PATTERNS.some((p) => p.test(trimmed))
}

function detectChapters(
  lines: string[],
): Array<{ id: string; title: string; position: number }> {
  const chapters: Array<{ id: string; title: string; position: number }> = []

  for (let i = 0; i < lines.length && chapters.length < 100; i++) {
    const line = lines[i].trim()
    if (!isHeadingLine(line)) continue

    // Require surrounding blank lines (or start/end of content) to reduce noise
    const prevBlank = i === 0 || lines[i - 1].trim() === ''
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === ''

    if (prevBlank || nextBlank) {
      chapters.push({
        id: `chapter-${chapters.length}`,
        title: line,
        position: chapters.length,
      })
    }
  }

  // Fallback: split by page into pseudo-chapters if nothing detected
  if (chapters.length === 0) {
    const pages = lines.join('\n').split('\f').slice(0, 100)
    for (let i = 0; i < pages.length; i++) {
      chapters.push({ id: `page-${i}`, title: `Page ${i + 1}`, position: i })
    }
  }

  return chapters
}

function extractIntroText(lines: string[]): string {
  const meaningful = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 30)
    .join(' ')
  return meaningful.slice(0, 1500)
}

const CODE_SIGNALS = [
  /^\s{4,}\S/, // 4+ space indent
  /^\t\S/, // tab indent
  /[{};]$/, // ends with brace/semicolon
  /(?:=>|->|::|===|!==)/, // operators
  /^\s*(?:def |class |import |const |let |var |function |public |private |return )/, // keywords
]

const LANG_PATTERNS: Array<[RegExp, string]> = [
  [/\bdef\s+\w+\s*\(|import\s+\w+|print\s*\(/i, 'python'],
  [/\b(?:const|let|var)\s+\w+\s*=|=>\s*\{|console\.log/i, 'javascript'],
  [/interface\s+\w+\s*\{|:\s*(?:string|number|boolean)\b/i, 'typescript'],
  [/public\s+(?:class|void|static)|System\.out\.print/i, 'java'],
  [/\bfn\s+\w+\s*\(|let\s+mut\s+|\.unwrap\(\)/i, 'rust'],
  [/#include\s+[<"]|printf\s*\(/i, 'c'],
  [/\busing\s+System;|Console\.Write/i, 'csharp'],
  [/\bpackage\s+main\b|fmt\.Print/i, 'go'],
]

function detectCodeBlocks(lines: string[]): {
  codeBlocksDetected: boolean
  languages: string[]
} {
  let consecutiveCodeLines = 0
  let codeBlocksDetected = false
  const langSet = new Set<string>()
  const noise = new Set(['text', 'plaintext', 'plain', 'output', 'terminal'])

  for (const line of lines) {
    const isCode = CODE_SIGNALS.some((p) => p.test(line))
    if (isCode) {
      consecutiveCodeLines++
      if (consecutiveCodeLines >= 3) {
        codeBlocksDetected = true
        for (const [pattern, lang] of LANG_PATTERNS) {
          if (!noise.has(lang) && pattern.test(line)) {
            langSet.add(lang)
          }
        }
      }
    } else {
      consecutiveCodeLines = 0
    }
  }

  return { codeBlocksDetected, languages: Array.from(langSet) }
}

export async function parsePdf(filePath: string): Promise<ParsedPdf> {
  const buffer = await fs.readFile(filePath)
  const data = await pdfParse(buffer)

  const rawTitle: string = data.info?.Title ?? ''
  const rawAuthor: string = data.info?.Author ?? ''
  const title = rawTitle.trim() || path.basename(filePath, '.pdf').replace(/[-_]/g, ' ')
  const author = rawAuthor.trim() || 'Unknown Author'

  const lines: string[] = data.text.split('\n')

  const chapters = detectChapters(lines)
  const introText = extractIntroText(lines)
  const { codeBlocksDetected, languages } = detectCodeBlocks(lines)

  const tocText = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')

  return {
    title,
    author,
    language: 'en',
    chapters,
    primaryLanguages: languages,
    tocText,
    introText,
    codeBlocksDetected,
  }
}
