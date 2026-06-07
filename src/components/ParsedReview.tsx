import { useState } from 'react'
import type { BookResponse } from '../../lib/types'

interface Props {
  book: BookResponse
  file: File
  provider: string
  onContinue: () => void
  onReprocessed: (book: BookResponse) => void
  onReset: () => void
}

const levelColors: Record<string, string> = {
  beginner:     'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  advanced:     'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  unknown:      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

export function ParsedReview({ book, file, provider, onContinue, onReprocessed, onReset }: Props) {
  const [reprocessing, setReprocessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const levelClass = levelColors[book.prerequisiteLevel] ?? levelColors.unknown

  async function handleReprocess() {
    setReprocessing(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('provider', provider)
      form.append('force', 'true')
      const res = await fetch('/api/books', { method: 'POST', body: form })
      const json = await res.json() as BookResponse | { error?: string }
      if (!res.ok) {
        setError((json as { error?: string }).error ?? 'Reprocess failed')
        return
      }
      onReprocessed(json as BookResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setReprocessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {book.isPdfUpload && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            PDF uploaded — code block detection is best-effort
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            PDF parsing cannot reliably detect code blocks or programming languages. For accurate
            results, use an EPUB version of this book where available.
          </p>
        </div>
      )}

      {book.alreadyExisted && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          This book was already in the library — showing existing record.
        </p>
      )}

      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-black dark:text-white">{book.title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{book.author}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${levelClass}`}>
          {book.prerequisiteLevel}
        </span>
        {book.primaryLanguages.map((lang) => (
          <span
            key={lang}
            className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {lang}
          </span>
        ))}
      </div>

      {book.keyConcepts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Key concepts</p>
          <div className="flex flex-wrap gap-2">
            {book.keyConcepts.map((concept) => (
              <span
                key={concept}
                className="inline-flex items-center rounded-md border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {book.chapters.length} chapter{book.chapters.length !== 1 ? 's' : ''} found
        </p>
        <ol className="space-y-1">
          {book.chapters.map((chapter) => (
            <li
              key={chapter.id}
              className="flex items-start gap-3 rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                {chapter.position + 1}
              </span>
              <span className="text-zinc-800 dark:text-zinc-200">{chapter.title}</span>
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={reprocessing}
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Continue to settings →
        </button>
        <button
          type="button"
          onClick={handleReprocess}
          disabled={reprocessing}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500"
        >
          {reprocessing && (
            <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {reprocessing ? 'Reprocessing…' : 'Reprocess'}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={reprocessing}
          className="ml-auto text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-50 dark:hover:text-zinc-300"
        >
          Upload a different book
        </button>
      </div>
      <p className="text-xs text-zinc-400 dark:text-zinc-600">
        Reprocessing deletes the existing record and all its data.
      </p>
    </div>
  )
}
