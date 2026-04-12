import { describe, it, expect, vi } from 'vitest'
import { ReverseImageHandler } from './reverse-image.handler.js'
import type { AiProvider, ImageAnalysisResult } from '@massivoto/kit'
import { createEmptyExecutionContext } from '@massivoto/kit'

/**
 * AC-RIMG-05: Edge cases for ReverseImageHandler.
 *
 * Theme: Photography Studio -- boundary conditions and unusual inputs
 * that go beyond the main happy-path and error-path tests.
 */

function createMockProvider(result: ImageAnalysisResult): AiProvider {
  return {
    name: 'mock',
    generateText: vi.fn().mockResolvedValue({ text: '', tokensUsed: 0 }),
    generateImage: vi.fn().mockResolvedValue({ base64: '', costUnits: 0 }),
    analyzeImage: vi.fn().mockResolvedValue(result),
  }
}

const FAKE_BASE64 = 'iVBORw0KGgoAAAANSUhEUg=='

describe('ReverseImageHandler - edge cases', () => {
  describe('invalid image types', () => {
    it('should fail for null image', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-null')

      const result = await handler.run({ image: null }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Image is required')
    })

    it('should fail for boolean image', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-bool')
      context.env = { GEMINI_API_KEY: 'test-key' }

      const result = await handler.run({ image: true }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Invalid image')
    })

    it('should fail for array image', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-array')
      context.env = { GEMINI_API_KEY: 'test-key' }

      const result = await handler.run({ image: ['data'] }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Invalid image')
    })

    it('should fail for object without base64 property', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-obj')
      context.env = { GEMINI_API_KEY: 'test-key' }

      const result = await handler.run({ image: { path: '/tmp/x.png' } }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Invalid image')
    })
  })

  describe('provider resolution edge cases', () => {
    it('should fail for unknown provider name', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-provider')
      context.env = { GEMINI_API_KEY: 'test-key' }

      const result = await handler.run(
        { image: FAKE_BASE64, provider: 'dalle' },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Unknown provider')
    })

    it('should reuse cached provider on subsequent calls', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-cache')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64 }, context)
      await handler.run({ image: FAKE_BASE64 }, context)

      expect(mockProvider.analyzeImage).toHaveBeenCalledTimes(2)
    })
  })

  describe('provider error edge cases', () => {
    it('should handle non-Error thrown by provider', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-throw')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider: AiProvider = {
        name: 'mock',
        generateText: vi.fn(),
        generateImage: vi.fn(),
        analyzeImage: vi.fn().mockRejectedValue('raw string error'),
      }
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run({ image: FAKE_BASE64 }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toBe('raw string error')
    })

    it('should handle provider returning empty text', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-empty')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: '' })
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run({ image: FAKE_BASE64 }, context)

      // Empty text is still a success -- the provider returned a result
      expect(result.success).toBe(true)
      expect(result.value).toBe('')
    })
  })

  describe('focus arg edge cases', () => {
    it('should handle unicode characters in focus', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-unicode')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run(
        { image: FAKE_BASE64, focus: 'ambiance nocturne et lumieres de la ville' },
        context,
      )

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.prompt).toContain('ambiance nocturne et lumieres de la ville')
    })

    it('should handle very long focus string', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-long')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      const longFocus = 'detailed aspect '.repeat(100).trim()
      await handler.run({ image: FAKE_BASE64, focus: longFocus }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.prompt).toContain(longFocus)
    })

    it('should not include focus section when focus is empty string', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-empty-focus')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64, focus: '' }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      // Empty string is falsy, so focus section should not be added
      expect(call.prompt).not.toContain('Pay special attention')
    })
  })

  describe('model arg edge cases', () => {
    it('should treat empty string model as raw passthrough', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-empty-model')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64, model: '' }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      // Empty string is not "best" or "light", so it passes through as-is
      expect(call.model).toBe('')
    })

    it('should be case-sensitive for model aliases', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-case-model')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64, model: 'Best' }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      // "Best" (capitalized) is not recognized as an alias, passes through raw
      expect(call.model).toBe('Best')
    })
  })

  describe('dummy mode edge cases', () => {
    it('should still validate image even in dummy mode', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-dummy-noimg')

      const result = await handler.run({ model: 'dummy' }, context)

      // Image validation happens before dummy check
      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Image is required')
    })

    it('should work with OtoFile in dummy mode', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('edge-dummy-otofile')

      const otoFile = {
        path: '~/test.png',
        base64: FAKE_BASE64,
        mimeType: 'image/png',
        size: 100,
      }

      const result = await handler.run(
        { image: otoFile, model: 'dummy' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toContain('{{variation}}')
    })
  })
})
