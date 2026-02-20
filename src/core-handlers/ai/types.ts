/**
 * AI Provider Types
 *
 * R-AI-02: Define AiProvider interface for text and image generation
 * R-AI-30: AiProvider interface with generateText() and generateImage() methods
 */

/**
 * Request for text generation.
 */
export interface TextRequest {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  system?: string
}

/**
 * Result of text generation.
 */
export interface TextResult {
  text: string
  tokensUsed: number
}

/**
 * Request for image generation.
 */
export interface ImageRequest {
  prompt: string
  size?: 'square' | 'landscape' | 'portrait'
  style?: 'photo' | 'illustration' | '3d'
}

/**
 * Result of image generation.
 */
export interface ImageResult {
  base64: string
  costUnits: number
}

/**
 * R-RIMG-01: Request for image analysis (vision).
 */
export interface ImageAnalysisRequest {
  image: string        // base64-encoded image
  prompt: string       // instructions for the AI (system prompt)
  model?: string       // model ID or undefined for default
  mimeType?: string    // e.g. "image/png", "image/jpeg" — defaults to "image/png"
}

/**
 * R-RIMG-02: Result of image analysis.
 */
export interface ImageAnalysisResult {
  text: string         // generated text response
}

/**
 * AiProvider interface for text generation, image generation, and image analysis.
 *
 * Implementations: GeminiProvider, (future) OpenAiProvider, AnthropicProvider
 */
export interface AiProvider {
  readonly name: string
  generateText(request: TextRequest): Promise<TextResult>
  generateImage(request: ImageRequest): Promise<ImageResult>
  // R-RIMG-03: Vision analysis capability
  analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult>
}

/**
 * Supported AI provider names.
 */
export type AiProviderName = 'gemini' | 'openai' | 'anthropic'

/**
 * Default provider for AI commands.
 */
export const DEFAULT_AI_PROVIDER: AiProviderName = 'gemini'
