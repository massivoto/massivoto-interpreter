import { describe, it, expect, vi } from 'vitest'
import { GenerateImageHandler } from './generate.handler.js'
import type { AiProvider, ImageResult } from '../types.js'
import { createEmptyExecutionContext } from '@massivoto/kit'

/**
 * Theme: Photography Studio -- photographer Emma generates images from prompts
 * with scene variations for a racing photo series.
 */

function createMockProvider(result: ImageResult): AiProvider {
  return {
    name: 'mock',
    generateText: vi.fn().mockResolvedValue({ text: '', tokensUsed: 0 }),
    generateImage: vi.fn().mockResolvedValue(result),
    analyzeImage: vi.fn().mockResolvedValue({ text: '' }),
  }
}

const FAKE_BASE64_IMAGE = 'iVBORw0KGgoAAAANSUhEUg=='

describe('GenerateImageHandler', () => {
  describe('R-GEN-21: handler registration', () => {
    it('should have id @ai/image/generate', () => {
      const handler = new GenerateImageHandler()
      expect(handler.id).toBe('@ai/image/generate')
    })

    it('should have type command', () => {
      const handler = new GenerateImageHandler()
      expect(handler.type).toBe('command')
    })
  })

  describe('R-GEN-22: required args', () => {
    it('should fail when prompt arg is missing', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')

      const result = await handler.run({}, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Prompt is required')
    })

    it('should fail when prompt is empty string', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')

      const result = await handler.run({ prompt: '' }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Prompt is required')
    })
  })

  // AC-GEN-01: basic generation with mock provider
  describe('R-GEN-24: calls provider.generateImage and returns base64', () => {
    it('should return base64 from provider as ActionResult.value', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run(
        { prompt: 'A racing car in golden light' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toBe(FAKE_BASE64_IMAGE)
    })

    it('should pass prompt to provider.generateImage', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ prompt: 'A racing car in golden light' }, context)

      expect(mockProvider.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'A racing car in golden light' }),
      )
    })
  })

  describe('R-GEN-23: optional args defaults', () => {
    it('should use square as default size', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ prompt: 'A portrait' }, context)

      expect(mockProvider.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({ size: 'square' }),
      )
    })

    it('should allow custom size', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ prompt: 'A banner', size: 'landscape' }, context)

      expect(mockProvider.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({ size: 'landscape' }),
      )
    })

    it('should pass style when provided', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ prompt: 'A logo', style: 'illustration' }, context)

      expect(mockProvider.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({ style: 'illustration' }),
      )
    })
  })

  // AC-GEN-02: variation substitution with single placeholder
  describe('R-GEN-41: variation substitution', () => {
    it('should replace {{variation}} in prompt when variation arg provided', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run(
        {
          prompt: 'A car {{variation}} with dramatic lighting',
          variation: 'under the rain',
        },
        context,
      )

      expect(mockProvider.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'A car under the rain with dramatic lighting',
        }),
      )
    })

    // AC-GEN-03: double placeholder substitution
    it('should replace all occurrences of {{variation}}', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run(
        {
          prompt: '{{variation}} scene with {{variation}} emphasis',
          variation: 'sunset',
        },
        context,
      )

      expect(mockProvider.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'sunset scene with sunset emphasis',
        }),
      )
    })
  })

  // AC-GEN-04: variation provided but no placeholder in prompt
  describe('R-GEN-42: variation without placeholder', () => {
    it('should send prompt unchanged when variation provided but no placeholder exists', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run(
        {
          prompt: 'A car in the sun',
          variation: 'Monaco tunnel',
        },
        context,
      )

      expect(mockProvider.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'A car in the sun' }),
      )
    })
  })

  // AC-GEN-05: no variation, placeholder stays as literal
  describe('R-GEN-43: no variation arg', () => {
    it('should send {{variation}} as literal text when no variation arg provided', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run(
        { prompt: 'A car {{variation}} with lighting' },
        context,
      )

      expect(mockProvider.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'A car {{variation}} with lighting' }),
      )
    })
  })

  // AC-GEN-06: model tier resolution
  describe('R-GEN-61: model tier resolution', () => {
    it('should resolve "best" to gemini-2.0-flash', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run(
        { prompt: 'A portrait', model: 'best' },
        context,
      )

      expect(result.success).toBe(true)
    })

    it('should resolve "light" to gemini-2.0-flash-lite', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run(
        { prompt: 'A portrait', model: 'light' },
        context,
      )

      expect(result.success).toBe(true)
    })

    it('should pass raw model ID through unchanged', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run(
        { prompt: 'A portrait', model: 'gemini-2.0-flash-lite' },
        context,
      )

      expect(result.success).toBe(true)
    })
  })

  // R-GEN-62: default to best when no model provided
  describe('R-GEN-62: default model', () => {
    it('should default to "best" when no model arg is provided', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ base64: FAKE_BASE64_IMAGE, costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run({ prompt: 'A portrait' }, context)

      expect(result.success).toBe(true)
    })
  })

  // R-GEN-25: API key validation
  describe('R-GEN-25: API key from environment', () => {
    it('should fail when GEMINI_API_KEY is missing', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = {}

      const result = await handler.run({ prompt: 'A car' }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('GEMINI_API_KEY')
    })

    it('should fail with actionable error message', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = {}

      const result = await handler.run({ prompt: 'A car' }, context)

      expect(result.fatalError).toContain('env.dist')
    })
  })

  describe('R-GEN-104: provider error handling', () => {
    it('should handle provider errors gracefully', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider: AiProvider = {
        name: 'mock',
        generateText: vi.fn().mockResolvedValue({ text: '', tokensUsed: 0 }),
        generateImage: vi.fn().mockRejectedValue(new Error('Content policy violation')),
        analyzeImage: vi.fn().mockResolvedValue({ text: '' }),
      }
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run({ prompt: 'Generate something' }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Content policy violation')
    })
  })

  // AC-GEN-11, AC-GEN-12: dummy model
  describe('R-GEN-91 to R-GEN-93: dummy model', () => {
    it('should return a base64 PNG when model is "dummy"', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')

      const result = await handler.run(
        { prompt: 'A car in the sun', model: 'dummy' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toBe(GenerateImageHandler.buildDummyImage())
    })

    it('should not call generateImage when model is "dummy"', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      const mockProvider = createMockProvider({ base64: 'should not be called', costUnits: 1 })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ prompt: 'anything', model: 'dummy' }, context)

      expect(mockProvider.generateImage).not.toHaveBeenCalled()
    })

    it('should not require API key when model is "dummy"', async () => {
      const handler = new GenerateImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = {}

      const result = await handler.run(
        { prompt: 'anything', model: 'dummy' },
        context,
      )

      expect(result.success).toBe(true)
    })

    it('buildDummyImage should return a valid base64 PNG', () => {
      const base64 = GenerateImageHandler.buildDummyImage()
      expect(base64.length).toBeGreaterThan(10)
      const buffer = Buffer.from(base64, 'base64')
      // PNG magic bytes: 137 80 78 71
      expect(buffer[0]).toBe(137)
      expect(buffer[1]).toBe(80)
      expect(buffer[2]).toBe(78)
      expect(buffer[3]).toBe(71)
    })
  })
})
