import type { AiProvider } from '@massivoto/kit'
import { LangchainProvider } from './langchain.provider.js'
import { LANGCHAIN_PROVIDERS } from './langchain-models.js'

export function createAiProvider(name: string, apiKey: string): AiProvider {
  if ((LANGCHAIN_PROVIDERS as readonly string[]).includes(name)) {
    return new LangchainProvider(name, apiKey)
  }

  throw new Error(`Provider "${name}" is not yet implemented`)
}
