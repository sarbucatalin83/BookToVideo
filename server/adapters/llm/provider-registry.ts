import type { LlmProvider } from './llm.port'
import { AnthropicProvider } from './anthropic.provider'
import { GoogleProvider } from './google.provider'
import { OpenAIProvider } from './openai.provider'

export type Provider = 'anthropic' | 'google' | 'openai'

const PROVIDER_ENV: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
}

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  openai: 'OpenAI',
}

export function getProviderEnvError(provider: Provider): string | null {
  const envVar = PROVIDER_ENV[provider]
  if (!process.env[envVar]) {
    return `${envVar} is not set on the server. Add it to your .env file to use the ${PROVIDER_LABEL[provider]} provider.`
  }
  return null
}

export function getProvider(provider: Provider): LlmProvider {
  switch (provider) {
    case 'anthropic': return new AnthropicProvider()
    case 'google': return new GoogleProvider()
    case 'openai': return new OpenAIProvider()
  }
}
