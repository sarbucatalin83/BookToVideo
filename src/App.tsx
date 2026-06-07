import { useState } from 'react'
import { EpubUpload } from './components/EpubUpload'
import { ParsedReview } from './components/ParsedReview'
import { Configure } from './components/Configure'
import { ProcessingView } from './components/ProcessingView'
import type { BookResponse } from '../lib/types'

type State =
  | { status: 'idle' }
  | { status: 'parsed';      book: BookResponse; file: File; provider: string }
  | { status: 'configuring'; book: BookResponse; file: File; provider: string }
  | { status: 'done';        book: BookResponse }
  | { status: 'error';       message: string }

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
            onUploadError={(message) => setState({ status: 'error', message })}
            onUploadDone={(book, file, provider) =>
              setState({ status: 'parsed', book, file, provider })
            }
          />
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

        {state.status === 'parsed' && (
          <ParsedReview
            book={state.book}
            file={state.file}
            provider={state.provider}
            onContinue={() =>
              setState({ status: 'configuring', book: state.book, file: state.file, provider: state.provider })
            }
            onReprocessed={(book) =>
              setState({ status: 'parsed', book, file: state.file, provider: state.provider })
            }
            onReset={() => setState({ status: 'idle' })}
          />
        )}

        {state.status === 'configuring' && (
          <Configure
            book={state.book}
            onConfirm={(updated) => setState({ status: 'done', book: updated })}
            onBack={() =>
              setState({ status: 'parsed', book: state.book, file: state.file, provider: state.provider })
            }
          />
        )}

        {state.status === 'done' && (
          <ProcessingView
            book={state.book}
            onReset={() => setState({ status: 'idle' })}
          />
        )}
      </main>
    </div>
  )
}
