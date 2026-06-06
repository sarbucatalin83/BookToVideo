import type { BookResponse } from '../../lib/types'

interface Props {
  book: BookResponse
  onReset: () => void
}

const levelColors: Record<string, string> = {
  beginner: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  unknown: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

export function ChapterTree({ book, onReset }: Props) {
  const levelClass = levelColors[book.prerequisiteLevel] ?? levelColors.unknown

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

      {/* Book header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-black dark:text-white">{book.title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{book.author}</p>
      </div>

      {/* Badges row */}
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

      {/* Key concepts */}
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

      {/* Chapter list */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {book.chapters.length} chapter{book.chapters.length !== 1 ? 's' : ''}
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

      <button
        onClick={onReset}
        className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        Upload a different book
      </button>
    </div>
  )
}
