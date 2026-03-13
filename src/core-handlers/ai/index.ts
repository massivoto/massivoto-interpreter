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
  ImageAnalysisRequest,
  ImageAnalysisResult,
} from '@massivoto/kit'
export { DEFAULT_AI_PROVIDER } from '@massivoto/kit'
export { GeminiProvider } from './providers/index.js'
