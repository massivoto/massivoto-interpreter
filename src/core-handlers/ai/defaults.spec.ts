import { describe, it, expect } from 'vitest'
import {
  AI_IMAGE_DEFAULTS,
  GEMINI_IMAGE_MODEL_TIERS,
  GEMINI_VISION_MODEL_TIERS,
  OPENAI_MODEL_TIERS,
  ANTHROPIC_MODEL_TIERS,
  resolveImageModel,
  resolveModel,
} from './defaults.js'

describe('AI_IMAGE_DEFAULTS (R-GEN-01)', () => {
  it('should have size set to square', () => {
    expect(AI_IMAGE_DEFAULTS.size).toBe('square')
  })

  it('should have style undefined', () => {
    expect(AI_IMAGE_DEFAULTS.style).toBeUndefined()
  })

  it('should have model set to best', () => {
    expect(AI_IMAGE_DEFAULTS.model).toBe('best')
  })
})

describe('GEMINI_IMAGE_MODEL_TIERS (R-GEN-02)', () => {
  it('should map best to gemini-2.5-flash-image', () => {
    expect(GEMINI_IMAGE_MODEL_TIERS.best).toBe('gemini-2.5-flash-image')
  })

  it('should map light to gemini-2.5-flash-image', () => {
    expect(GEMINI_IMAGE_MODEL_TIERS.light).toBe('gemini-2.5-flash-image')
  })
})

describe('GEMINI_VISION_MODEL_TIERS', () => {
  it('should map best to gemini-2.5-flash', () => {
    expect(GEMINI_VISION_MODEL_TIERS.best).toBe('gemini-2.5-flash')
  })

  it('should map light to gemini-2.5-flash', () => {
    expect(GEMINI_VISION_MODEL_TIERS.light).toBe('gemini-2.5-flash')
  })
})

describe('OPENAI_MODEL_TIERS (R-LC-07)', () => {
  it('should map best to gpt-4o', () => {
    expect(OPENAI_MODEL_TIERS.best).toBe('gpt-4o')
  })

  it('should map light to gpt-4o-mini', () => {
    expect(OPENAI_MODEL_TIERS.light).toBe('gpt-4o-mini')
  })
})

describe('ANTHROPIC_MODEL_TIERS (R-LC-07)', () => {
  it('should map best to claude-sonnet-4-20250514', () => {
    expect(ANTHROPIC_MODEL_TIERS.best).toBe('claude-sonnet-4-20250514')
  })

  it('should map light to claude-haiku-4-20250414', () => {
    expect(ANTHROPIC_MODEL_TIERS.light).toBe('claude-haiku-4-20250414')
  })
})

describe('resolveImageModel (R-GEN-02)', () => {
  it('should resolve "best" to gemini-2.5-flash-image for gemini provider', () => {
    expect(resolveImageModel('best', 'gemini')).toBe('gemini-2.5-flash-image')
  })

  it('should resolve "light" to gemini-2.5-flash-image for gemini provider', () => {
    expect(resolveImageModel('light', 'gemini')).toBe('gemini-2.5-flash-image')
  })

  it('should pass raw model ID through unchanged for gemini provider', () => {
    expect(resolveImageModel('gemini-2.5-flash-image', 'gemini')).toBe('gemini-2.5-flash-image')
  })

  it('should default to "best" (gemini-2.5-flash-image) when model is undefined', () => {
    expect(resolveImageModel(undefined, 'gemini')).toBe('gemini-2.5-flash-image')
  })

  it('should pass through alias unchanged for provider without image tiers', () => {
    expect(resolveImageModel('best', 'openai')).toBe('best')
  })

  it('should pass through raw model ID for non-gemini provider', () => {
    expect(resolveImageModel('gpt-4o', 'openai')).toBe('gpt-4o')
  })
})

describe('resolveModel (vision/text)', () => {
  it('should resolve "best" to gemini-2.5-flash for gemini provider', () => {
    expect(resolveModel('best', 'gemini')).toBe('gemini-2.5-flash')
  })

  it('should resolve "light" to gemini-2.5-flash for gemini provider', () => {
    expect(resolveModel('light', 'gemini')).toBe('gemini-2.5-flash')
  })

  it('should default to "best" (gemini-2.5-flash) when model is undefined', () => {
    expect(resolveModel(undefined, 'gemini')).toBe('gemini-2.5-flash')
  })

  it('should resolve "best" to gpt-4o for openai provider', () => {
    expect(resolveModel('best', 'openai')).toBe('gpt-4o')
  })

  it('should resolve "light" to gpt-4o-mini for openai provider', () => {
    expect(resolveModel('light', 'openai')).toBe('gpt-4o-mini')
  })

  it('should resolve "best" to claude-sonnet-4-20250514 for anthropic provider', () => {
    expect(resolveModel('best', 'anthropic')).toBe('claude-sonnet-4-20250514')
  })

  it('should resolve "light" to claude-haiku-4-20250414 for anthropic provider', () => {
    expect(resolveModel('light', 'anthropic')).toBe('claude-haiku-4-20250414')
  })

  it('should pass through raw model ID for any provider', () => {
    expect(resolveModel('gpt-4o-mini', 'openai')).toBe('gpt-4o-mini')
  })

  it('should pass through alias unchanged for unknown provider', () => {
    expect(resolveModel('best', 'mistral')).toBe('best')
  })
})
