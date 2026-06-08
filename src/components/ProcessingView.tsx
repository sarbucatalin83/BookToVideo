import { useState, useRef, useCallback, useEffect } from 'react'
import type { BookResponse } from '../../lib/types'

type ChapterStatus = 'pending' | 'processing' | 'done' | 'error'

interface ChunkData {
  id: string
  position: number
  content: string
  tokenCount: number
  status: ChapterStatus
}

interface Progress {
  done: number
  total: number
  costUsd: number
}

interface Props {
  book: BookResponse
  onReset: () => void
}

const statusClasses: Record<ChapterStatus, string> = {
  pending:    'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  done:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  error:      'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export function ProcessingView({ book, onReset }: Props) {
  const [statuses, setStatuses] = useState<Record<string, ChapterStatus>>(
    () => Object.fromEntries(book.chapters.map(c => [c.id, c.status]))
  )
  const [activeChapter, setActiveChapter] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [totalCostUsd, setTotalCostUsd] = useState(0)
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null)
  const [chunksByChapter, setChunksByChapter] = useState<Record<string, ChunkData[]>>({})
  const [synthesisByChapter, setSynthesisByChapter] = useState<Record<string, string | null>>({})
  const esRef = useRef<EventSource | null>(null)
  const expandedRef = useRef<string | null>(null)

  useEffect(() => () => { esRef.current?.close() }, [])

  const fetchChunks = useCallback(async (chapterId: string) => {
    try {
      const res = await fetch(`/api/chapter/${chapterId}/chunks`)
      if (!res.ok) return
      const data = await res.json() as ChunkData[]
      setChunksByChapter(prev => ({ ...prev, [chapterId]: data }))
    } catch { /* ignore */ }
  }, [])

  const fetchSynthesis = useCallback(async (chapterId: string) => {
    try {
      const res = await fetch(`/api/chapter/${chapterId}/summary`)
      if (!res.ok) return
      const data = await res.json() as { content: string | null }
      setSynthesisByChapter(prev => ({ ...prev, [chapterId]: data.content }))
    } catch { /* ignore */ }
  }, [])

  // Re-fetch chunks on each SSE tick if that chapter is expanded
  useEffect(() => {
    if (activeChapter && expandedRef.current === activeChapter) {
      fetchChunks(activeChapter)
    }
  }, [progress, activeChapter, fetchChunks])

  const toggleExpand = useCallback((chapterId: string) => {
    if (expandedRef.current === chapterId) {
      expandedRef.current = null
      setExpandedChapterId(null)
    } else {
      expandedRef.current = chapterId
      setExpandedChapterId(chapterId)
      fetchChunks(chapterId)
      fetchSynthesis(chapterId)
    }
  }, [fetchChunks, fetchSynthesis])

  const processChapter = useCallback(async (chapterId: string) => {
    esRef.current?.close()
    esRef.current = null
    setActiveChapter(chapterId)
    setProgress(null)
    setStatuses(prev => ({ ...prev, [chapterId]: 'processing' }))

    try {
      const res = await fetch(`/api/chapter/${chapterId}/process`, { method: 'POST' })
      const data = await res.json() as { jobId: string | null; alreadyDone?: boolean }

      if (!res.ok) {
        setStatuses(prev => ({ ...prev, [chapterId]: 'error' }))
        setActiveChapter(null)
        return
      }

      if (data.alreadyDone) {
        setStatuses(prev => ({ ...prev, [chapterId]: 'done' }))
        setActiveChapter(null)
        return
      }

      const es = new EventSource(`/api/chapter/${chapterId}/progress`)
      esRef.current = es

      es.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as { type: string; done?: number; total?: number; costUsd?: number }
        if (msg.type === 'progress' && msg.total !== undefined && msg.done !== undefined) {
          setProgress({ done: msg.done, total: msg.total, costUsd: msg.costUsd ?? 0 })
          if (msg.costUsd !== undefined) setTotalCostUsd(msg.costUsd)
        } else if (msg.type === 'complete') {
          setStatuses(prev => ({ ...prev, [chapterId]: 'done' }))
          setActiveChapter(null)
          setProgress(null)
          es.close()
          esRef.current = null
          if (expandedRef.current === chapterId) {
            fetchChunks(chapterId)
            fetchSynthesis(chapterId)
          }
        }
      }

      es.onerror = () => {
        setStatuses(prev => ({ ...prev, [chapterId]: 'error' }))
        setActiveChapter(null)
        setProgress(null)
        es.close()
        esRef.current = null
      }
    } catch {
      setStatuses(prev => ({ ...prev, [chapterId]: 'error' }))
      setActiveChapter(null)
    }
  }, [fetchChunks, fetchSynthesis])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-black dark:text-white">{book.title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{book.author}</p>
      </div>

      {totalCostUsd > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Cost so far</span>
          <span className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
            ${totalCostUsd.toFixed(4)}
          </span>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {book.chapters.length} chapter{book.chapters.length !== 1 ? 's' : ''}
        </p>
        <ol className="space-y-1">
          {book.chapters.map(chapter => {
            const status = statuses[chapter.id] ?? 'pending'
            const isActive = activeChapter === chapter.id
            const isExpanded = expandedChapterId === chapter.id
            const chunks = chunksByChapter[chapter.id]

            return (
              <li key={chapter.id} className="rounded-md border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                    {chapter.position + 1}
                  </span>
                  <button
                    onClick={() => toggleExpand(chapter.id)}
                    className="flex-1 text-left text-sm text-zinc-800 hover:text-black dark:text-zinc-200 dark:hover:text-white"
                  >
                    {chapter.title}
                  </button>
                  {isActive && progress && (
                    <span className="text-xs tabular-nums text-zinc-400">
                      {progress.done}/{progress.total}
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}>
                    {status}
                  </span>
                  <button
                    disabled={status === 'done' || !!activeChapter}
                    onClick={() => processChapter(chapter.id)}
                    className="rounded px-2.5 py-1 text-xs font-medium bg-black text-white hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Process
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-100 px-3 py-3 space-y-4 dark:border-zinc-800">
                    {!chunks || chunks.length === 0 ? (
                      <p className="text-xs text-zinc-400">No chunks yet — press Process to create them.</p>
                    ) : (
                      chunks.map(chunk => (
                        <div key={chunk.id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              Chunk {chunk.position + 1}
                            </span>
                            <span className="text-xs text-zinc-400">{chunk.tokenCount} tokens</span>
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${statusClasses[chunk.status]}`}>
                              {chunk.status}
                            </span>
                          </div>
                          <pre className="rounded bg-zinc-50 p-3 text-xs text-zinc-700 whitespace-pre-wrap font-mono dark:bg-zinc-900 dark:text-zinc-300">
                            {chunk.content}
                          </pre>
                        </div>
                      ))
                    )}

                    {synthesisByChapter[chapter.id] && (
                      <div className="space-y-1.5 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Chapter Synthesis
                        </span>
                        <pre className="rounded bg-indigo-50 p-3 text-xs text-indigo-900 whitespace-pre-wrap font-mono dark:bg-indigo-950 dark:text-indigo-200">
                          {synthesisByChapter[chapter.id]}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <button
        onClick={onReset}
        className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        Start over
      </button>
    </div>
  )
}
