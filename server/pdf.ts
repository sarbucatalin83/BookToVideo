import fs from 'fs/promises'
import path from 'path'

// pdf-parse is imported dynamically inside parsePdf so that pdfjs-dist
// (which it bundles) is never loaded at server startup. pdfjs-dist runs
// initialisation code that can stall the event loop before app.listen()
// is even called, making the entire server unresponsive.

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
  console.log(`[pdf] parsing: ${filePath}`)

  let raw: Buffer
  try {
    raw = await fs.readFile(filePath)
  } catch (err) {
    console.error(`[pdf] failed to read file "${filePath}":`, err)
    throw err
  }
  console.log(`[pdf] file read — ${(raw.length / 1024).toFixed(1)} KB`)

  // Patch structuredClone before pdfjs-dist touches it (must happen before import).
  // pdfjs-dist calls structuredClone(msg, { transfer: [arrayBuffer] }) inside its
  // fake in-process worker; on some Node.js builds this throws DataCloneError.
  // Stripping the transfer list makes it do a deep copy instead, which is fine.
  const _origClone = globalThis.structuredClone as typeof structuredClone
  ;(globalThis as Record<string, unknown>).structuredClone = <T>(
    val: T,
    opts?: StructuredSerializeOptions,
  ): T => _origClone(val, opts?.transfer?.length ? { ...opts, transfer: [] } : opts)

  console.log(`[pdf] extracting text via pdf-parse…`)
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(raw) })

  // If PDFParse is an EventEmitter, an unhandled 'error' event becomes an
  // uncaught exception and kills the process. Register a listener so the
  // error surfaces as a rejected promise instead.
  let eventError: unknown
  ;(parser as unknown as { on?: (e: string, h: (err: unknown) => void) => void })
    .on?.('error', (err) => { eventError = err })

  const PDF_PARSE_TIMEOUT_MS = 60_000

  let infoResult: Awaited<ReturnType<typeof parser.getInfo>>
  let textResult: Awaited<ReturnType<typeof parser.getText>>
  try {
    // Call sequentially so load() only runs once — calling both in Promise.all
    // triggers two concurrent pdfjs.getDocument() calls on the same data, which
    // can deadlock inside the fake in-process PDF.js worker.
    let timeoutHandle: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`PDF parsing timed out after ${PDF_PARSE_TIMEOUT_MS / 1000}s — document may be corrupt or unsupported`)),
        PDF_PARSE_TIMEOUT_MS,
      )
    })
    timeout.catch(() => {}) // prevent unhandled rejection if timer fires after success
    infoResult = await Promise.race([parser.getInfo(), timeout])
    textResult = await Promise.race([parser.getText(), timeout])
    clearTimeout(timeoutHandle!)
    if (eventError) throw eventError
  } catch (err) {
    console.error(`[pdf] pdf-parse failed for "${filePath}":`, err)
    await parser.destroy().catch((destroyErr: unknown) => {
      console.error('[pdf] parser.destroy() also failed:', destroyErr)
    })
    throw err
  }
  await parser.destroy()

  const rawTitle: string = (infoResult.info as Record<string, string>)?.Title ?? ''
  const rawAuthor: string = (infoResult.info as Record<string, string>)?.Author ?? ''
  const title = rawTitle.trim() || path.basename(filePath, '.pdf').replace(/[-_]/g, ' ')
  const author = rawAuthor.trim() || 'Unknown Author'
  console.log(`[pdf] metadata — title="${title}" author="${author}"`)

  const lines: string[] = textResult.text.split('\n')
  console.log(`[pdf] text extracted — ${lines.length} lines, ${textResult.text.length} chars`)

  console.log(`[pdf] detecting chapters…`)
  const chapters = detectChapters(lines)
  console.log(`[pdf] detected ${chapters.length} chapter(s)`)

  const introText = extractIntroText(lines)
  console.log(`[pdf] intro text — ${introText.length} chars`)

  console.log(`[pdf] detecting code blocks…`)
  const { codeBlocksDetected, languages } = detectCodeBlocks(lines)
  console.log(`[pdf] code detection — codeBlocksDetected=${codeBlocksDetected} languages=[${languages.join(', ')}]`)

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
