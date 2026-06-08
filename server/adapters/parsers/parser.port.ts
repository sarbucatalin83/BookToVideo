import type { ParsedBook } from './parsed-book'

export interface BookParser {
  parse(filePath: string): Promise<ParsedBook>
}
