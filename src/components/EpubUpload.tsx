import { useRef, useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'

interface Props {
  onUploadStart: () => void
  onUploadError: (message: string) => void
  onUploadDone: (data: unknown) => void
}

export function EpubUpload({ onUploadStart, onUploadError, onUploadDone }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.epub')) {
      onUploadError('Only EPUB files are accepted')
      return
    }

    onUploadStart()

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/books', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        onUploadError((json as { error?: string }).error ?? 'Upload failed')
        return
      }

      onUploadDone(json)
    } catch {
      onUploadError('Network error — is the server running?')
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload EPUB file"
      onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors select-none',
        dragging
          ? 'border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800'
          : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900',
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
        Drop an EPUB file here or{' '}
        <span className="text-black dark:text-white underline underline-offset-2">browse</span>
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-600">Only .epub files accepted</p>
      <input
        ref={inputRef}
        type="file"
        accept=".epub,application/epub+zip"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
