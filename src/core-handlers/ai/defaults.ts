// R-GEN-01: Shared defaults for AI image commands
export const AI_IMAGE_DEFAULTS = {
  size: 'square' as const,
  style: undefined as ('photo' | 'illustration' | '3d' | undefined),
  model: 'best',
}

// R-GEN-02: Gemini model tier aliases
export const GEMINI_MODEL_TIERS: Record<string, string> = {
  best: 'gemini-2.0-flash',
  light: 'gemini-2.0-flash-lite',
}

// R-GEN-02: Resolve model alias to concrete model ID
export function resolveModel(model: string | undefined, provider: string): string {
  const raw = model ?? AI_IMAGE_DEFAULTS.model
  if (provider === 'gemini' && raw in GEMINI_MODEL_TIERS) {
    return GEMINI_MODEL_TIERS[raw]
  }
  return raw
}
