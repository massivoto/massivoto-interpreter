// R-GEN-01: Shared defaults for AI image commands
export const AI_IMAGE_DEFAULTS = {
  size: 'square' as const,
  style: undefined as ('photo' | 'illustration' | '3d' | undefined),
  model: 'best',
}

// R-GEN-02: Gemini model tier aliases for image generation
// Uses gemini-2.5-flash-image which supports native image generation via generateContent
export const GEMINI_IMAGE_MODEL_TIERS: Record<string, string> = {
  best: 'gemini-2.5-flash-image',
  light: 'gemini-2.5-flash-image',
}

// Gemini model tier aliases for text/vision (analyzeImage, reverse-image)
export const GEMINI_VISION_MODEL_TIERS: Record<string, string> = {
  best: 'gemini-2.5-flash',
  light: 'gemini-2.5-flash',
}

// R-LC-07: OpenAI model tier aliases for text/vision
export const OPENAI_MODEL_TIERS: Record<string, string> = {
  best: 'gpt-4o',
  light: 'gpt-4o-mini',
}

// R-LC-07: Anthropic model tier aliases for text/vision
export const ANTHROPIC_MODEL_TIERS: Record<string, string> = {
  best: 'claude-sonnet-4-20250514',
  light: 'claude-haiku-4-20250414',
}

// All provider model tier maps
const MODEL_TIERS: Record<string, Record<string, string>> = {
  gemini: GEMINI_VISION_MODEL_TIERS,
  openai: OPENAI_MODEL_TIERS,
  anthropic: ANTHROPIC_MODEL_TIERS,
}

const IMAGE_MODEL_TIERS: Record<string, Record<string, string>> = {
  gemini: GEMINI_IMAGE_MODEL_TIERS,
}

// R-GEN-02: Resolve model alias to concrete image generation model ID
export function resolveImageModel(model: string | undefined, provider: string): string {
  const raw = model ?? AI_IMAGE_DEFAULTS.model
  const tiers = IMAGE_MODEL_TIERS[provider]
  if (tiers && raw in tiers) {
    return tiers[raw]
  }
  return raw
}

// Resolve model alias to concrete vision/text model ID
export function resolveModel(model: string | undefined, provider: string): string {
  const raw = model ?? AI_IMAGE_DEFAULTS.model
  const tiers = MODEL_TIERS[provider]
  if (tiers && raw in tiers) {
    return tiers[raw]
  }
  return raw
}
