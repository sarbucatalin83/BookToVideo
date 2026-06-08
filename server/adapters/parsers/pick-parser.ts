import type { BookParser } from './parser.port'
import { parseEpub } from './epub/epub.parser'
import { parsePdf } from './pdf/pdf.parser'

export function pickParser(ext: string): BookParser {
  if (ext === '.epub') return { parse: parseEpub }
  if (ext === '.pdf') return { parse: parsePdf }
  throw new Error(`Unsupported file format: ${ext}`)
}
