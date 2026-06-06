import { useState } from 'react'
import { EpubUpload } from './components/EpubUpload'
import { ChapterTree } from './components/ChapterTree'
import type { BookResponse } from '../lib/types'

type State =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'done'; book: BookResponse }
  | { status: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<State>({ status: 'idle' })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-2xl px-8 py-16">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Book to Video
        </h1>

        {state.status === 'idle' && (
          <EpubUpload
            onUploadStart={() => setState({ status: 'uploading' })}
            onUploadError={(message) => setState({ status: 'error', message })}
            onUploadDone={(data) => setState({ status: 'done', book: data as BookResponse })}
          />
        )}

        {state.status === 'uploading' && (
          <div className="flex flex-col items-center gap-4 py-12 text-zinc-500 dark:text-zinc-400">
            <svg
              className="h-8 w-8 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm">Parsing EPUB and generating manifest…</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {state.message}
            </div>
            <button
              onClick={() => setState({ status: 'idle' })}
              className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Try again
            </button>
          </div>
        )}

        {state.status === 'done' && (
          <ChapterTree
            book={state.book}
            onReset={() => setState({ status: 'idle' })}
          />
        )}
      </main>
    </div>
  )
}
