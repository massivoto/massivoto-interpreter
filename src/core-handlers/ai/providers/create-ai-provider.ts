import type { AiProvider, AiProviderName } from '@massivoto/kit'
import { GeminiProvider } from './gemini.provider.js'

export function createAiProvider(name: AiProviderName, apiKey: string): AiProvider {
  switch (name) {
    case 'gemini':
      return new GeminiProvider(apiKey)
    default:
      throw new Error(`Provider "${name}" is not yet implemented`)
  }
}
