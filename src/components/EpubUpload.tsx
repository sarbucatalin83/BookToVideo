import { useRef, useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import type { BookResponse } from '../../lib/types'

type Provider = 'anthropic' | 'google' | 'openai'

interface ProviderOption {
  id: Provider
  label: string
  description: string
}

const PROVIDERS: ProviderOption[] = [
  { id: 'anthropic', label: 'Anthropic', description: 'Claude Haiku' },
  { id: 'google', label: 'Google', description: 'Gemini 2.5 Flash' },
  { id: 'openai', label: 'OpenAI', description: 'GPT-4o mini' },
]

type Stage =
  | { kind: 'idle' }
  | { kind: 'uploading'; logs: string[] }
  | { kind: 'confirming'; existingBook: BookResponse; file: File; provider: Provider; fileType: 'epub' | 'pdf' }

interface Props {
  onUploadStart: (fileType: 'epub' | 'pdf') => void
  onUploadError: (message: string) => void
  onUploadDone: (data: unknown) => void
}

export function EpubUpload({ onUploadStart, onUploadError, onUploadDone }: Props) {
  const [dragging, setDragging] = useState(false)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  function appendLog(msg: string) {
    console.log('[upload]', msg)
    setStage((prev) =>
      prev.kind === 'uploading'
        ? { ...prev, logs: [...prev.logs, msg] }
        : prev
    )
  }

  async function uploadFile(file: File, opts?: { force?: boolean }) {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.epub') && !name.endsWith('.pdf')) {
      onUploadError('Only EPUB or PDF files are accepted')
      return
    }

    const fileType = name.endsWith('.pdf') ? 'pdf' : 'epub'

    if (opts?.force) {
      onUploadStart(fileType)
    } else {
      setStage({ kind: 'uploading', logs: [`Uploading ${file.name} (${(file.size / 1024).toFixed(1)} KB)…`] })
    }

    const form = new FormData()
    form.append('file', file)
    form.append('provider', provider!)
    if (opts?.force) form.append('force', 'true')

    try {
      appendLog(`POST /api/books  provider=${provider} fileType=${fileType}${opts?.force ? ' force=true' : ''}`)
      const res = await fetch('/api/books', { method: 'POST', body: form })
      appendLog(`Server responded: HTTP ${res.status}`)
      const json = await res.json()

      if (!res.ok) {
        const errMsg = (json as { error?: string }).error ?? 'Upload failed'
        appendLog(`Error from server: ${errMsg}`)
        setStage({ kind: 'idle' })
        onUploadError(errMsg)
        return
      }

      if ((json as BookResponse).alreadyExisted) {
        setStage({
          kind: 'confirming',
          existingBook: json as BookResponse,
          file,
          provider: provider!,
          fileType,
        })
        return
      }

      setStage({ kind: 'idle' })
      onUploadDone(json)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      appendLog(`Network error: ${detail}`)
      setStage({ kind: 'idle' })
      onUploadError(`Network error — ${detail}`)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (!provider || stage.kind !== 'idle') return
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // reset so the same file can be re-selected
    e.target.value = ''
  }

  if (stage.kind === 'uploading') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-zinc-500 dark:text-zinc-400">
        <svg
          className="h-8 w-8 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm">Parsing file and generating manifest…</p>
        {stage.logs.length > 0 && (
          <div className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-mono text-xs text-zinc-300 dark:bg-zinc-950">
            {stage.logs.map((line, i) => (
              <div key={i} className="leading-relaxed">
                <span className="select-none text-zinc-600">{String(i + 1).padStart(2, '0')} </span>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (stage.kind === 'confirming') {
    const { existingBook, file } = stage
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Book already registered
        </p>
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            &ldquo;{existingBook.title}&rdquo;
          </span>
          {existingBook.author ? ` by ${existingBook.author}` : ''} is already in the database
          with {existingBook.chapters.length} chapter{existingBook.chapters.length !== 1 ? 's' : ''}.
          Would you like to reprocess it?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setStage({ kind: 'idle' })
              onUploadDone(existingBook)
            }}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-500"
          >
            Use existing
          </button>
          <button
            type="button"
            onClick={() => {
              setStage({ kind: 'idle' })
              uploadFile(file, { force: true })
            }}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Reprocess
          </button>
          <button
            type="button"
            onClick={() => {
              setStage({ kind: 'idle' })
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="ml-auto text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600">
          Reprocessing deletes the existing record and all its data.
        </p>
      </div>
    )
  }

  const uploadDisabled = !provider

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Select AI provider
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              className={[
                'flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors',
                provider === p.id
                  ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500',
              ].join(' ')}
            >
              <span className="text-sm font-semibold">{p.label}</span>
              <span className={[
                'text-xs',
                provider === p.id
                  ? 'text-zinc-300 dark:text-zinc-600'
                  : 'text-zinc-400 dark:text-zinc-500',
              ].join(' ')}>{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        role="button"
        tabIndex={uploadDisabled ? -1 : 0}
        aria-label="Upload EPUB or PDF file"
        aria-disabled={uploadDisabled}
        onDragEnter={(e) => { e.preventDefault(); if (!uploadDisabled) setDragging(true) }}
        onDragOver={(e) => { e.preventDefault(); if (!uploadDisabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => { if (!uploadDisabled) inputRef.current?.click() }}
        onKeyDown={(e) => { if (!uploadDisabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click() }}
        className={[
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-colors select-none',
          uploadDisabled
            ? 'cursor-not-allowed opacity-40 border-zinc-200 dark:border-zinc-800'
            : dragging
              ? 'cursor-pointer border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800'
              : 'cursor-pointer border-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900',
        ].join(' ')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5v-9m0 0-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.632-8.683 3 3 0 0 1 5.764-1.458A4.5 4.5 0 1 1 17.25 19.5H6.75Z"
          />
        </svg>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {uploadDisabled
            ? 'Select a provider above to enable upload'
            : <>Drop an EPUB or PDF file here or{' '}
              <span className="text-black dark:text-white underline underline-offset-2">browse</span></>
          }
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600">.epub or .pdf — EPUB preferred</p>
        <input
          ref={inputRef}
          type="file"
          accept=".epub,application/epub+zip,.pdf,application/pdf"
          className="hidden"
          onChange={handleChange}
          disabled={uploadDisabled}
        />
      </div>
    </div>
  )
}
