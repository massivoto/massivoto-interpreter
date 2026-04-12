import type { AiProvider } from '@massivoto/kit'
import { GeminiProvider } from './gemini.provider.js'

export function createAiProvider(name: string, apiKey: string): AiProvider {
  switch (name) {
    case 'gemini':
      return new GeminiProvider(apiKey)
    default:
      throw new Error(`Provider "${name}" is not yet implemented`)
  }
}
