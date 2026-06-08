import fs from 'fs/promises'
import path from 'path'

// pdf-parse is imported dynamically inside parsePdf so that pdfjs-dist
// (which it bundles) is never loaded at server startup. pdfjs-dist runs
// initialisation code that can stall the event loop before app.listen()
// is even called, making the entire server unresponsive.

import type { ParsedBook } from '../parsed-book'
import { chaptersFromOutline } from './outline-chapters'
import { chaptersFromTocText } from './toc-text-chapters'
import { detectChapters } from './regex-headings'
import { extractIntroText } from './intro-text'
import { detectCodeBlocks } from './code-detect'

const PDF_PARSE_TIMEOUT_MS = 60_000

export async function parsePdf(filePath: string): Promise<ParsedBook> {
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

  let infoResult: Awaited<ReturnType<typeof parser.getInfo>>
  let textResult: Awaited<ReturnType<typeof parser.getText>>
  let outlineChapters: Array<{ id: string; title: string; position: number }> | null = null
  try {
    let timeoutHandle: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`PDF parsing timed out after ${PDF_PARSE_TIMEOUT_MS / 1000}s — document may be corrupt or unsupported`)),
        PDF_PARSE_TIMEOUT_MS,
      )
    })
    timeout.catch(() => {}) // prevent unhandled rejection if timer fires after success
    infoResult = await Promise.race([parser.getInfo(), timeout])

    // After getInfo() the pdfjs document proxy is available — use it to read
    // the PDF outline (bookmarks), which is the most reliable chapter source.
    const pdfDoc = (parser as unknown as { doc?: { getOutline?: () => Promise<Array<{ title?: string; items?: unknown[] }> | null> } }).doc
    if (typeof pdfDoc?.getOutline === 'function') {
      try {
        const outline = await pdfDoc.getOutline()
        outlineChapters = chaptersFromOutline(outline)
        console.log(`[pdf] outline chapters: ${outlineChapters?.length ?? 0}`)
      } catch (err) {
        console.warn('[pdf] getOutline() failed, skipping:', err)
      }
    }

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

  // Chapter detection priority:
  // 1. PDF outline (bookmarks) — authoritative when present
  // 2. Visible TOC page in extracted text
  // 3. Regex heading scan
  // 4. Page-break fallback (inside detectChapters)
  console.log(`[pdf] detecting chapters…`)
  let chapters: Array<{ id: string; title: string; position: number }>
  if (outlineChapters) {
    console.log(`[pdf] using PDF outline — ${outlineChapters.length} chapter(s)`)
    chapters = outlineChapters
  } else {
    const tocChapters = chaptersFromTocText(lines)
    if (tocChapters) {
      console.log(`[pdf] using TOC text — ${tocChapters.length} chapter(s)`)
      chapters = tocChapters
    } else {
      chapters = detectChapters(lines)
      console.log(`[pdf] using regex scan — ${chapters.length} chapter(s)`)
    }
  }

  const introText = extractIntroText(lines)
  console.log(`[pdf] intro text — ${introText.length} chars`)

  console.log(`[pdf] detecting code blocks…`)
  const { codeBlocksDetected, languages } = detectCodeBlocks(lines)
  console.log(`[pdf] code detection — codeBlocksDetected=${codeBlocksDetected} languages=[${languages.join(', ')}]`)

  const chapterContents = splitTextByChapters(textResult.text, chapters)
  console.log(`[pdf] split into ${chapterContents.length} chapter segment(s)`)

  const tocText = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')

  return {
    title,
    author,
    language: 'en',
    chapters,
    chapterContents,
    primaryLanguages: languages,
    tocText,
    introText,
    codeBlocksDetected,
  }
}
