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

const NOISE_LANGS = new Set(['text', 'plaintext', 'plain', 'output', 'terminal'])

export function detectCodeBlocks(lines: string[]): {
  codeBlocksDetected: boolean
  languages: string[]
} {
  let consecutiveCodeLines = 0
  let codeBlocksDetected = false
  const langSet = new Set<string>()

  for (const line of lines) {
    const isCode = CODE_SIGNALS.some((p) => p.test(line))
    if (isCode) {
      consecutiveCodeLines++
      if (consecutiveCodeLines >= 3) {
        codeBlocksDetected = true
        for (const [pattern, lang] of LANG_PATTERNS) {
          if (!NOISE_LANGS.has(lang) && pattern.test(line)) langSet.add(lang)
        }
      }
    } else {
      consecutiveCodeLines = 0
    }
  }

  return { codeBlocksDetected, languages: Array.from(langSet) }
}
