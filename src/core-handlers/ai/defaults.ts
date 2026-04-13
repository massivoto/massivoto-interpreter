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

// R-GEN-02: Resolve model alias to concrete image generation model ID
export function resolveImageModel(model: string | undefined, provider: string): string {
  const raw = model ?? AI_IMAGE_DEFAULTS.model
  if (provider === 'gemini' && raw in GEMINI_IMAGE_MODEL_TIERS) {
    return GEMINI_IMAGE_MODEL_TIERS[raw]
  }
  return raw
}

// Resolve model alias to concrete vision/text model ID
export function resolveModel(model: string | undefined, provider: string): string {
  const raw = model ?? AI_IMAGE_DEFAULTS.model
  if (provider === 'gemini' && raw in GEMINI_VISION_MODEL_TIERS) {
    return GEMINI_VISION_MODEL_TIERS[raw]
  }
  return raw
}
