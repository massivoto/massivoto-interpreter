import { describe, it, expect } from 'vitest'
import { AI_IMAGE_DEFAULTS, GEMINI_MODEL_TIERS, resolveModel } from './defaults.js'

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

describe('GEMINI_MODEL_TIERS (R-GEN-02)', () => {
  it('should map best to gemini-2.0-flash', () => {
    expect(GEMINI_MODEL_TIERS.best).toBe('gemini-2.0-flash')
  })

  it('should map light to gemini-2.0-flash-lite', () => {
    expect(GEMINI_MODEL_TIERS.light).toBe('gemini-2.0-flash-lite')
  })
})

describe('resolveModel (R-GEN-02)', () => {
  it('should resolve "best" to gemini-2.0-flash for gemini provider', () => {
    expect(resolveModel('best', 'gemini')).toBe('gemini-2.0-flash')
  })

  it('should resolve "light" to gemini-2.0-flash-lite for gemini provider', () => {
    expect(resolveModel('light', 'gemini')).toBe('gemini-2.0-flash-lite')
  })

  it('should pass raw model ID through unchanged for gemini provider', () => {
    expect(resolveModel('gemini-2.0-flash-lite', 'gemini')).toBe('gemini-2.0-flash-lite')
  })

  it('should default to "best" (gemini-2.0-flash) when model is undefined', () => {
    expect(resolveModel(undefined, 'gemini')).toBe('gemini-2.0-flash')
  })

  it('should pass through alias unchanged for non-gemini provider', () => {
    expect(resolveModel('best', 'openai')).toBe('best')
  })

  it('should pass through raw model ID for non-gemini provider', () => {
    expect(resolveModel('gpt-4o', 'openai')).toBe('gpt-4o')
  })
})
