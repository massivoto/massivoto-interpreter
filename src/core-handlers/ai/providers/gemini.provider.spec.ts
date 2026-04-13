import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GeminiProvider } from './gemini.provider.js'

/**
 * Test file: gemini.provider.spec.ts
 * Theme: Social Media Automation (Emma, Carlos, content generation)
 *
 * Tests for GeminiProvider (R-AI-31 to R-AI-33)
 *
 * Note: These tests mock the global fetch to avoid actual API calls.
 */

describe('GeminiProvider', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('R-AI-31: text generation via Gemini API', () => {
    it('should have name property set to gemini', () => {
      const provider = new GeminiProvider('test-api-key')

      expect(provider.name).toBe('gemini')
    })

    it('should call Gemini API with correct endpoint for text generation', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Generated tagline for Emma' }],
                },
              },
            ],
            usageMetadata: {
              totalTokenCount: 15,
            },
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-api-key')
      await provider.generateText({ prompt: 'Write a tagline' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.any(Object),
      )
    })

    it('should include API key in request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Generated text' }],
                },
              },
            ],
            usageMetadata: {
              totalTokenCount: 10,
            },
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('my-secret-key')
      await provider.generateText({ prompt: 'Hello' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=my-secret-key'),
        expect.any(Object),
      )
    })

    it('should return generated text and token count', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Emma is a social media expert' }],
                },
              },
            ],
            usageMetadata: {
              totalTokenCount: 25,
            },
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      const result = await provider.generateText({
        prompt: 'Tell me about Emma',
      })

      expect(result.text).toBe('Emma is a social media expert')
      expect(result.tokensUsed).toBe(25)
    })

    it('should pass temperature to API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Creative text' }],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 5 },
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateText({ prompt: 'Be creative', temperature: 0.9 })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.generationConfig.temperature).toBe(0.9)
    })

    it('should pass maxTokens to API as maxOutputTokens', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Short text' }],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 10 },
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateText({ prompt: 'Be brief', maxTokens: 50 })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.generationConfig.maxOutputTokens).toBe(50)
    })

    it('should pass system prompt as system instruction', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Professional response' }],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 8 },
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateText({
        prompt: 'Write content',
        system: 'You are a marketing expert',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.systemInstruction.parts[0].text).toBe(
        'You are a marketing expert',
      )
    })

    it('should use specified model', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Response' }],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 5 },
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateText({
        prompt: 'Hello',
        model: 'gemini-1.5-flash',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-1.5-flash'),
        expect.any(Object),
      )
    })

    it('should use default model when not specified', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Response' }],
                },
              },
            ],
            usageMetadata: { totalTokenCount: 5 },
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateText({ prompt: 'Hello' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.5-flash'),
        expect.any(Object),
      )
    })

    it('should throw error on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('Rate limit exceeded'),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')

      await expect(provider.generateText({ prompt: 'Hello' })).rejects.toThrow(
        'Rate limit exceeded',
      )
    })
  })

  describe('R-AI-32: image generation via Gemini generateContent', () => {
    function mockImageResponse(base64: string) {
      return vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: base64,
                      },
                    },
                  ],
                },
              },
            ],
          }),
      })
    }

    it('should call Gemini generateContent API for image generation', async () => {
      const mockFetch = mockImageResponse('iVBORw0KGgoAAAANSUhEUg==')
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateImage({ prompt: 'A fox in a forest' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generateContent'),
        expect.any(Object),
      )
    })

    it('should use gemini-2.5-flash-image as default image model', async () => {
      const mockFetch = mockImageResponse('iVBORw0KGgoAAAANSUhEUg==')
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateImage({ prompt: 'A fox' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.5-flash-image'),
        expect.any(Object),
      )
    })

    it('should use specified model when provided', async () => {
      const mockFetch = mockImageResponse('iVBORw0KGgoAAAANSUhEUg==')
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateImage({ prompt: 'A fox', model: 'gemini-2.5-flash' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.5-flash'),
        expect.any(Object),
      )
    })

    it('should send responseModalities IMAGE in generationConfig', async () => {
      const mockFetch = mockImageResponse('iVBORw0KGgoAAAANSUhEUg==')
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.generateImage({ prompt: 'A fox' })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.generationConfig.responseModalities).toEqual(['IMAGE'])
    })

    it('should return base64 image data from inlineData', async () => {
      const expectedBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const mockFetch = mockImageResponse(expectedBase64)
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      const result = await provider.generateImage({ prompt: 'A red pixel' })

      expect(result.base64).toBe(expectedBase64)
    })

    it('should return cost units (1 per image)', async () => {
      const mockFetch = mockImageResponse('aW1hZ2U=')
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      const result = await provider.generateImage({ prompt: 'An image' })

      expect(result.costUnits).toBe(1)
    })

    it('should throw error when response has no image data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Sorry, I cannot generate that image.' }],
                },
              },
            ],
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')

      await expect(
        provider.generateImage({ prompt: 'Generate something' }),
      ).rejects.toThrow('No image data in Gemini response')
    })

    it('should throw error on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Content policy violation'),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')

      await expect(
        provider.generateImage({ prompt: 'Inappropriate content' }),
      ).rejects.toThrow('Content policy violation')
    })
  })

  describe('R-RIMG-21: image analysis via Gemini Vision API', () => {
    it('should call generateContent endpoint with vision model', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'A prompt describing the image' }],
                },
              },
            ],
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.analyzeImage({
        image: 'iVBORw0KGgoAAAANSUhEUg==',
        prompt: 'Describe this image',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generateContent'),
        expect.any(Object),
      )
    })

    it('should use gemini-2.5-flash as default vision model', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Analysis result' }],
                },
              },
            ],
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.analyzeImage({
        image: 'iVBORw0KGgoAAAANSUhEUg==',
        prompt: 'Analyze this',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.5-flash'),
        expect.any(Object),
      )
    })

    it('should use specified model when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Analysis result' }],
                },
              },
            ],
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.analyzeImage({
        image: 'iVBORw0KGgoAAAANSUhEUg==',
        prompt: 'Analyze this',
        model: 'gemini-2.5-flash-lite',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.5-flash-lite'),
        expect.any(Object),
      )
    })

    it('should send image as inlineData with image/png mimeType', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Analysis' }],
                },
              },
            ],
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.analyzeImage({
        image: 'base64ImageData',
        prompt: 'Describe',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const parts = callBody.contents[0].parts
      expect(parts[1]).toEqual({
        inlineData: { mimeType: 'image/png', data: 'base64ImageData' },
      })
    })

    it('should send text prompt as the first part', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Analysis' }],
                },
              },
            ],
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      await provider.analyzeImage({
        image: 'base64data',
        prompt: 'Reverse-engineer this image',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      const parts = callBody.contents[0].parts
      expect(parts[0]).toEqual({ text: 'Reverse-engineer this image' })
    })

    it('should return text from the response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'A cinematic photograph with warm tones' }],
                },
              },
            ],
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')
      const result = await provider.analyzeImage({
        image: 'someBase64',
        prompt: 'Analyze',
      })

      expect(result.text).toBe('A cinematic photograph with warm tones')
    })

    it('should throw error on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid image data'),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('test-key')

      await expect(
        provider.analyzeImage({
          image: 'badData',
          prompt: 'Analyze',
        }),
      ).rejects.toThrow('Invalid image data')
    })

    it('should include API key in request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Result' }],
                },
              },
            ],
          }),
      })
      global.fetch = mockFetch

      const provider = new GeminiProvider('my-vision-key')
      await provider.analyzeImage({
        image: 'data',
        prompt: 'Analyze',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=my-vision-key'),
        expect.any(Object),
      )
    })
  })
})
