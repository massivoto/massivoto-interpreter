import { describe, it, expect, vi } from 'vitest'
import { ReverseImageHandler } from './reverse-image.handler.js'
import type { AiProvider, ImageAnalysisResult } from '../types.js'
import { createEmptyExecutionContext } from '@massivoto/kit'
import type { OtoFile } from '../../../utils/file-utils.js'

/**
 * Theme: Photography Studio -- photographer Carlos and Emma analyze reference photos
 * to reproduce their style using reverse-prompting.
 */

function createMockProvider(result: ImageAnalysisResult): AiProvider {
  return {
    name: 'mock',
    generateText: vi.fn().mockResolvedValue({ text: '', tokensUsed: 0 }),
    generateImage: vi.fn().mockResolvedValue({ base64: '', costUnits: 0 }),
    analyzeImage: vi.fn().mockResolvedValue(result),
  }
}

const FAKE_BASE64_IMAGE = 'iVBORw0KGgoAAAANSUhEUg=='

describe('ReverseImageHandler', () => {
  describe('R-RIMG-41: handler registration', () => {
    it('should have id @ai/prompt/reverseImage', () => {
      const handler = new ReverseImageHandler()
      expect(handler.id).toBe('@ai/prompt/reverseImage')
    })

    it('should have type command', () => {
      const handler = new ReverseImageHandler()
      expect(handler.type).toBe('command')
    })
  })

  describe('R-RIMG-42: required args validation', () => {
    it('should fail when image arg is missing', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')

      const result = await handler.run({ output: 'prompt' }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Image is required')
    })

    it('should fail when image arg is empty string', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')

      const result = await handler.run({ image: '', output: 'prompt' }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Image is required')
    })
  })

  describe('R-RIMG-44: system prompt construction', () => {
    it('should send the image to analyzeImage', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({
        text: 'A detailed prompt with {{variation}} in a racing scene',
      })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
        expect.objectContaining({ image: FAKE_BASE64_IMAGE }),
      )
    })

    it('should include reverse-prompting instructions in the system prompt', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({
        text: 'A prompt with {{variation}}',
      })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.prompt).toContain('{{variation}}')
    })

    it('should mention style, composition, colors, lighting in system prompt', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({
        text: 'A prompt with {{variation}}',
      })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const prompt = call.prompt.toLowerCase()
      expect(prompt).toContain('style')
      expect(prompt).toContain('composition')
      expect(prompt).toContain('color')
      expect(prompt).toContain('lighting')
    })
  })

  describe('R-RIMG-45: returns generated prompt as value', () => {
    it('should return the AI response as ActionResult.value', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const expectedPrompt = 'A cinematic photograph of {{variation}} with warm golden lighting'
      const mockProvider = createMockProvider({ text: expectedPrompt })
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      expect(result.success).toBe(true)
      expect(result.value).toBe(expectedPrompt)
    })
  })

  // AC-RIMG-03
  describe('R-RIMG-102: focus arg injection', () => {
    it('should inject focus into the system prompt sent to analyzeImage', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({
        text: 'A prompt emphasizing warm lighting and bokeh with {{variation}}',
      })
      handler.setProvider('gemini', mockProvider)

      await handler.run(
        { image: FAKE_BASE64_IMAGE, focus: 'warm lighting and bokeh effect' },
        context,
      )

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.prompt).toContain('warm lighting and bokeh effect')
    })

    it('should not include focus section when focus is not provided', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({
        text: 'A prompt with {{variation}}',
      })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.prompt).not.toContain('Pay special attention')
    })
  })

  // AC-RIMG-01, AC-RIMG-02
  describe('R-RIMG-103: model tier resolution', () => {
    it('should resolve "best" to gemini-2.0-flash', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt with {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64_IMAGE, model: 'best' }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.model).toBe('gemini-2.0-flash')
    })

    it('should resolve "light" to gemini-2.0-flash-lite', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt with {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64_IMAGE, model: 'light' }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.model).toBe('gemini-2.0-flash-lite')
    })

    it('should pass raw model ID through unchanged', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt with {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run(
        { image: FAKE_BASE64_IMAGE, model: 'gemini-2.0-flash-lite' },
        context,
      )

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.model).toBe('gemini-2.0-flash-lite')
    })

    it('should default to "best" when no model arg is provided', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({ text: 'prompt with {{variation}}' })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.model).toBe('gemini-2.0-flash')
    })
  })

  describe('R-RIMG-104: error cases', () => {
    it('should fail when API key is missing', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = {}

      const result = await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('GEMINI_API_KEY')
    })

    it('should fail with actionable error message for missing key', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = {}

      const result = await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      expect(result.fatalError).toContain('env.dist')
    })

    it('should handle provider errors gracefully', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider: AiProvider = {
        name: 'mock',
        generateText: vi.fn().mockResolvedValue({ text: '', tokensUsed: 0 }),
        generateImage: vi.fn().mockResolvedValue({ base64: '', costUnits: 0 }),
        analyzeImage: vi.fn().mockRejectedValue(new Error('Vision API rate limit')),
      }
      handler.setProvider('gemini', mockProvider)

      const result = await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Vision API rate limit')
    })
  })

  describe('OtoFile input support', () => {
    it('should accept an OtoFile and extract base64 and mimeType', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({
        text: 'A prompt with {{variation}}',
      })
      handler.setProvider('gemini', mockProvider)

      const otoFile: OtoFile = {
        path: '~/photos/emma-portrait.jpg',
        base64: '/9j/4AAQSkZJRgABAQ==',
        mimeType: 'image/jpeg',
        size: 2048,
      }

      await handler.run({ image: otoFile }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.image).toBe('/9j/4AAQSkZJRgABAQ==')
      expect(call.mimeType).toBe('image/jpeg')
    })

    it('should accept a raw base64 string and default to image/png', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }
      const mockProvider = createMockProvider({
        text: 'A prompt with {{variation}}',
      })
      handler.setProvider('gemini', mockProvider)

      await handler.run({ image: FAKE_BASE64_IMAGE }, context)

      const call = (mockProvider.analyzeImage as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.image).toBe(FAKE_BASE64_IMAGE)
      expect(call.mimeType).toBe('image/png')
    })

    it('should fail with clear error for invalid image type', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('carlos-123')
      context.env = { GEMINI_API_KEY: 'test-key' }

      const result = await handler.run({ image: 42 }, context)

      expect(result.success).toBe(false)
      expect(result.fatalError).toContain('Invalid image')
    })
  })

  describe('R-RIMG-91 to R-RIMG-93: dummy model', () => {
    it('should return dummy prompt when model is "dummy"', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('emma-123')

      const result = await handler.run(
        { image: FAKE_BASE64_IMAGE, model: 'dummy' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toBe(ReverseImageHandler.buildDummyPrompt(true))
    })

    it('should not call analyzeImage when model is "dummy"', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      const mockProvider = createMockProvider({ text: 'should not be called' })
      handler.setProvider('gemini', mockProvider)

      await handler.run(
        { image: FAKE_BASE64_IMAGE, model: 'dummy' },
        context,
      )

      expect(mockProvider.analyzeImage).not.toHaveBeenCalled()
    })

    it('should not require API key when model is "dummy"', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('emma-123')
      context.env = {}

      const result = await handler.run(
        { image: FAKE_BASE64_IMAGE, model: 'dummy' },
        context,
      )

      expect(result.success).toBe(true)
    })

    it('should ignore focus when model is "dummy"', async () => {
      const handler = new ReverseImageHandler()
      const context = createEmptyExecutionContext('emma-123')

      const result = await handler.run(
        { image: FAKE_BASE64_IMAGE, model: 'dummy', focus: 'warm lighting' },
        context,
      )

      expect(result.value).toBe(ReverseImageHandler.buildDummyPrompt(true))
    })

    it('buildDummyPrompt(true) should contain {{variation}}', () => {
      const prompt = ReverseImageHandler.buildDummyPrompt(true)
      expect(prompt).toContain('{{variation}}')
    })

    it('buildDummyPrompt(false) should NOT contain {{variation}}', () => {
      const prompt = ReverseImageHandler.buildDummyPrompt(false)
      expect(prompt).not.toContain('{{variation}}')
    })

    it('buildDummyPrompt should return a detailed photography prompt', () => {
      const prompt = ReverseImageHandler.buildDummyPrompt(true)
      const lower = prompt.toLowerCase()
      expect(lower).toContain('lighting')
      expect(lower).toContain('composition')
      expect(prompt.length).toBeGreaterThan(100)
    })
  })
})
