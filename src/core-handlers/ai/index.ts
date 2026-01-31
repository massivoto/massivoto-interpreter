/**
 * AI Commands Module
 *
 * R-AI-01: Create ai/ directory in core-handlers with index barrel export
 */

export type {
  AiProvider,
  AiProviderName,
  TextRequest,
  TextResult,
  ImageRequest,
  ImageResult,
} from './types.js'
export { DEFAULT_AI_PROVIDER } from './types.js'
export { GeminiProvider } from './providers/index.js'
