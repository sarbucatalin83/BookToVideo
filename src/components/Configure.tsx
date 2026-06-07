import { useState, useEffect, useRef } from 'react'
import type { BookResponse } from '../../lib/types'
import { MODELS, ELEVENLABS_VOICES, estimateCost } from '../../lib/model-config'
import type { Provider, ModelTier, DepthPreset, ThemePreset } from '../../lib/model-config'

interface Props {
  book: BookResponse
  onConfirm: (updated: BookResponse) => void
  onBack: () => void
}

const PROVIDER_META: Record<Provider, { label: string; sub: string }> = {
  anthropic: { label: 'Anthropic', sub: 'Claude' },
  google:    { label: 'Google',    sub: 'Gemini' },
  openai:    { label: 'OpenAI',    sub: 'GPT' },
}

const TIERS: { id: ModelTier; label: string; sub: string }[] = [
  { id: 'fast',     label: 'Fast',     sub: 'Lowest cost' },
  { id: 'balanced', label: 'Balanced', sub: 'Best tradeoff' },
  { id: 'best',     label: 'Best',     sub: 'Highest quality' },
]

const DEPTHS: { id: DepthPreset; label: string; sub: string }[] = [
  { id: 'overview',  label: 'Overview',   sub: 'High-level summaries' },
  { id: 'standard',  label: 'Standard',   sub: 'Balanced analysis' },
  { id: 'deep_dive', label: 'Deep Dive',  sub: 'Full in-depth pass' },
]

const THEMES: { id: ThemePreset; label: string }[] = [
  { id: 'dark',          label: 'Dark' },
  { id: 'light',         label: 'Light' },
  { id: 'high_contrast', label: 'High Contrast' },
]

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001'
  if (usd < 1)     return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

export function Configure({ book, onConfirm, onBack }: Props) {
  const [provider, setProvider]   = useState<Provider>((book.provider as Provider) ?? 'anthropic')
  const [tier, setTier]           = useState<ModelTier>((book.modelTier as ModelTier) ?? 'balanced')
  const [depth, setDepth]         = useState<DepthPreset>((book.depthPreset as DepthPreset) ?? 'standard')
  const [theme, setTheme]         = useState<ThemePreset>((book.themePreset as ThemePreset) ?? 'dark')
  const [voice, setVoice]               = useState<string>(book.voice ?? ELEVENLABS_VOICES[0].id)
  const [available, setAvailable]       = useState<Provider[]>(['anthropic', 'google', 'openai'])
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const audioRef                        = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: { availableProviders: Provider[] }) => {
        setAvailable(data.availableProviders)
        if (!data.availableProviders.includes(provider) && data.availableProviders.length > 0) {
          setProvider(data.availableProviders[0])
        }
      })
      .catch(() => {/* keep all enabled on network failure */})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalCost = estimateCost(provider, tier, depth, book.chapters.length)

  function stopPreview() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPreviewState('idle')
  }

  async function handlePreview() {
    if (previewState === 'loading') return
    if (previewState === 'playing') { stopPreview(); return }

    setPreviewState('loading')
    setError(null)
    try {
      const res = await fetch(`/api/voice/preview?voiceId=${encodeURIComponent(voice)}`)
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        setError(json.error ?? 'Voice preview failed')
        setPreviewState('idle')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); setPreviewState('idle') }
      audio.onerror = () => { URL.revokeObjectURL(url); setPreviewState('idle') }
      setPreviewState('playing')
      await audio.play()
    } catch {
      setPreviewState('idle')
    }
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, modelTier: tier, depthPreset: depth, themePreset: theme, voice }),
      })
      const json = await res.json() as Record<string, unknown>
      if (!res.ok) {
        setError((json.error as string | undefined) ?? 'Failed to save settings')
        return
      }
      onConfirm({ ...book, ...json })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Book header */}
      <div>
        <h2 className="text-xl font-semibold text-black dark:text-white">{book.title}</h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {book.author} · {book.chapters.length} chapter{book.chapters.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Provider */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">AI Provider</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(PROVIDER_META) as [Provider, { label: string; sub: string }][]).map(([id, meta]) => {
            const disabled = !available.includes(id)
            const active = provider === id
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setProvider(id)}
                title={disabled ? `${meta.label} API key not configured` : undefined}
                className={[
                  'flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors',
                  disabled
                    ? 'cursor-not-allowed opacity-40 border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                    : active
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500',
                ].join(' ')}
              >
                <span className="text-sm font-semibold">{meta.label}</span>
                <span className={['text-xs', active && !disabled ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'].join(' ')}>
                  {meta.sub}{disabled ? ' — no key' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Model Tier */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Model Tier</p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => {
            const spec = MODELS[provider][t.id]
            const perChapter = estimateCost(provider, t.id, depth, 1)
            const active = tier === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                className={[
                  'flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                    : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500',
                ].join(' ')}
              >
                <span className="text-sm font-semibold">{t.label}</span>
                <span className={['text-xs truncate w-full', active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'].join(' ')}>
                  {spec.displayName}
                </span>
                <span className={['mt-1 text-xs font-medium tabular-nums', active ? 'text-zinc-200 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'].join(' ')}>
                  {formatCost(perChapter)}/chapter
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Depth Preset */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Depth</p>
        <div className="grid grid-cols-3 gap-2">
          {DEPTHS.map((d) => {
            const active = depth === d.id
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDepth(d.id)}
                className={[
                  'flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                    : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500',
                ].join(' ')}
              >
                <span className="text-sm font-semibold">{d.label}</span>
                <span className={['text-xs', active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'].join(' ')}>
                  {d.sub}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Theme Preset */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Video Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => setTheme(th.id)}
              className={[
                'rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors',
                theme === th.id
                  ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500',
              ].join(' ')}
            >
              {th.label}
            </button>
          ))}
        </div>
      </section>

      {/* Voice */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Narration Voice</p>
        <div className="flex items-center gap-2">
          <select
            value={voice}
            onChange={(e) => { stopPreview(); setVoice(e.target.value) }}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-zinc-600"
          >
            {ELEVENLABS_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.accent} · {v.gender}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewState === 'loading'}
            title={previewState === 'playing' ? 'Stop preview' : 'Preview voice'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
          >
            {previewState === 'loading' ? (
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : previewState === 'playing' ? (
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            )}
          </button>
        </div>
      </section>

      {/* Cost Estimate */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Estimated cost</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {book.chapters.length} chapter{book.chapters.length !== 1 ? 's' : ''} · {MODELS[provider][tier].displayName} · {depth.replace('_', '-')}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-bold tabular-nums text-black dark:text-white">
            {formatCost(totalCost)}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving}
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {saving ? 'Saving…' : 'Confirm & continue'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Back
        </button>
      </div>
    </div>
  )
}
