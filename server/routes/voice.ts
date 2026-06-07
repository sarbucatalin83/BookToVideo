import { Router } from 'express'

export const voiceRouter = Router()

const SAMPLE_TEXT = "Hello, I'm your narration voice for this book. How does this sound to you?"

voiceRouter.get('/preview', async (req, res): Promise<void> => {
  const voiceId = req.query.voiceId as string
  if (!voiceId) {
    res.status(400).json({ error: 'voiceId required' })
    return
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'ElevenLabs API key not configured' })
    return
  }

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: SAMPLE_TEXT,
        model_id: 'eleven_turbo_v2_5',
      }),
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      res.status(upstream.status).json({ error: text })
      return
    }

    const buffer = await upstream.arrayBuffer()
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(Buffer.from(buffer))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'TTS request failed' })
  }
})
