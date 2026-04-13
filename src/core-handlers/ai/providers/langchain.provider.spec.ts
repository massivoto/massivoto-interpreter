import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LangchainProvider } from './langchain.provider.js'
import { AIMessage } from '@langchain/core/messages'

/**
 * Test file: langchain.provider.spec.ts
 * Tests for LangchainProvider (R-LC-01 to R-LC-04)
 *
 * Mocks Langchain model classes via the langchain-models module.
 * No real API calls are made.
 */

// Mock the langchain-models module to intercept model creation
vi.mock('./langchain-models.js', () => ({
  createLangchainModel: vi.fn(),
  LANGCHAIN_PROVIDERS: ['gemini', 'openai', 'anthropic'],
}))

import { createLangchainModel } from './langchain-models.js'

const mockCreateLangchainModel = vi.mocked(createLangchainModel)

function mockModel(response: AIMessage) {
  const model = { invoke: vi.fn().mockResolvedValue(response) }
  mockCreateLangchainModel.mockReturnValue(model as any)
  return model
}

function textResponse(text: string, totalTokens = 10): AIMessage {
  return new AIMessage({
    content: text,
    usage_metadata: { input_tokens: 5, output_tokens: 5, total_tokens: totalTokens },
  })
}

describe('LangchainProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('R-LC-01: constructor and name', () => {
    it('should set name to the provider name', () => {
      const provider = new LangchainProvider('openai', 'test-key')
      expect(provider.name).toBe('openai')
    })

    it('should set name for gemini provider', () => {
      const provider = new LangchainProvider('gemini', 'test-key')
      expect(provider.name).toBe('gemini')
    })

    it('should set name for anthropic provider', () => {
      const provider = new LangchainProvider('anthropic', 'test-key')
      expect(provider.name).toBe('anthropic')
    })
  })

  describe('R-LC-02: text generation via Langchain', () => {
    it('should create model with correct provider, key and model ID', async () => {
      mockModel(textResponse('Hello world'))

      const provider = new LangchainProvider('openai', 'sk-test')
      await provider.generateText({ prompt: 'Hi', model: 'gpt-4o' })

      expect(mockCreateLangchainModel).toHaveBeenCalledWith(
        'openai',
        'sk-test',
        'gpt-4o',
        { temperature: undefined, maxTokens: undefined },
      )
    })

    it('should use default model when model is not specified', async () => {
      mockModel(textResponse('Hello'))

      const provider = new LangchainProvider('openai', 'sk-test')
      await provider.generateText({ prompt: 'Hi' })

      expect(mockCreateLangchainModel).toHaveBeenCalledWith(
        'openai',
        'sk-test',
        'gpt-4o',
        expect.any(Object),
      )
    })

    it('should use gemini default model for gemini provider', async () => {
      mockModel(textResponse('Hello'))

      const provider = new LangchainProvider('gemini', 'key')
      await provider.generateText({ prompt: 'Hi' })

      expect(mockCreateLangchainModel).toHaveBeenCalledWith(
        'gemini',
        'key',
        'gemini-2.5-flash',
        expect.any(Object),
      )
    })

    it('should use anthropic default model for anthropic provider', async () => {
      mockModel(textResponse('Hello'))

      const provider = new LangchainProvider('anthropic', 'key')
      await provider.generateText({ prompt: 'Hi' })

      expect(mockCreateLangchainModel).toHaveBeenCalledWith(
        'anthropic',
        'key',
        'claude-sonnet-4-20250514',
        expect.any(Object),
      )
    })

    it('should pass temperature and maxTokens as model options', async () => {
      mockModel(textResponse('Creative text'))

      const provider = new LangchainProvider('openai', 'key')
      await provider.generateText({
        prompt: 'Be creative',
        temperature: 0.9,
        maxTokens: 500,
      })

      expect(mockCreateLangchainModel).toHaveBeenCalledWith(
        'openai',
        'key',
        'gpt-4o',
        { temperature: 0.9, maxTokens: 500 },
      )
    })

    it('should send prompt as HumanMessage', async () => {
      const model = mockModel(textResponse('Response'))

      const provider = new LangchainProvider('openai', 'key')
      await provider.generateText({ prompt: 'Tell me about cats' })

      const messages = model.invoke.mock.calls[0][0]
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('Tell me about cats')
      expect(messages[0]._getType()).toBe('human')
    })

    it('should send system prompt as SystemMessage before HumanMessage', async () => {
      const model = mockModel(textResponse('Professional response'))

      const provider = new LangchainProvider('openai', 'key')
      await provider.generateText({
        prompt: 'Write content',
        system: 'You are a marketing expert',
      })

      const messages = model.invoke.mock.calls[0][0]
      expect(messages).toHaveLength(2)
      expect(messages[0]._getType()).toBe('system')
      expect(messages[0].content).toBe('You are a marketing expert')
      expect(messages[1]._getType()).toBe('human')
      expect(messages[1].content).toBe('Write content')
    })

    it('should return text from AIMessage content string', async () => {
      mockModel(textResponse('Generated text about social media'))

      const provider = new LangchainProvider('openai', 'key')
      const result = await provider.generateText({ prompt: 'Write about social media' })

      expect(result.text).toBe('Generated text about social media')
    })

    it('should return token count from usage_metadata', async () => {
      mockModel(textResponse('Response', 42))

      const provider = new LangchainProvider('openai', 'key')
      const result = await provider.generateText({ prompt: 'Hi' })

      expect(result.tokensUsed).toBe(42)
    })

    it('should return 0 tokens when usage_metadata is missing', async () => {
      const response = new AIMessage({ content: 'No usage info' })
      mockModel(response)

      const provider = new LangchainProvider('openai', 'key')
      const result = await provider.generateText({ prompt: 'Hi' })

      expect(result.tokensUsed).toBe(0)
    })

    it('should handle array content from AIMessage', async () => {
      const response = new AIMessage({
        content: [{ type: 'text', text: 'Part one' }, { type: 'text', text: ' Part two' }],
      })
      mockModel(response)

      const provider = new LangchainProvider('openai', 'key')
      const result = await provider.generateText({ prompt: 'Hi' })

      expect(result.text).toBe('Part one Part two')
    })

    it('should normalize Langchain errors to plain Error', async () => {
      const model = { invoke: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')) }
      mockCreateLangchainModel.mockReturnValue(model as any)

      const provider = new LangchainProvider('openai', 'key')

      await expect(
        provider.generateText({ prompt: 'Hi' }),
      ).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle non-Error throws', async () => {
      const model = { invoke: vi.fn().mockRejectedValue('string error') }
      mockCreateLangchainModel.mockReturnValue(model as any)

      const provider = new LangchainProvider('openai', 'key')

      await expect(
        provider.generateText({ prompt: 'Hi' }),
      ).rejects.toThrow('string error')
    })
  })

  describe('R-LC-03: image analysis via Langchain multimodal', () => {
    it('should create model for the configured provider', async () => {
      mockModel(textResponse('A beautiful sunset'))

      const provider = new LangchainProvider('openai', 'key')
      await provider.analyzeImage({
        image: 'base64data',
        prompt: 'Describe this image',
      })

      expect(mockCreateLangchainModel).toHaveBeenCalledWith(
        'openai',
        'key',
        'gpt-4o',
        {},
      )
    })

    it('should use specified model', async () => {
      mockModel(textResponse('Analysis'))

      const provider = new LangchainProvider('openai', 'key')
      await provider.analyzeImage({
        image: 'data',
        prompt: 'Analyze',
        model: 'gpt-4-turbo',
      })

      expect(mockCreateLangchainModel).toHaveBeenCalledWith(
        'openai',
        'key',
        'gpt-4-turbo',
        {},
      )
    })

    it('should send multimodal message with text and image_url', async () => {
      const model = mockModel(textResponse('Image analysis'))

      const provider = new LangchainProvider('openai', 'key')
      await provider.analyzeImage({
        image: 'iVBORw0KGgoAAAA',
        prompt: 'What do you see?',
      })

      const messages = model.invoke.mock.calls[0][0]
      expect(messages).toHaveLength(1)
      expect(messages[0]._getType()).toBe('human')

      const content = messages[0].content as any[]
      expect(content).toHaveLength(2)
      expect(content[0]).toEqual({ type: 'text', text: 'What do you see?' })
      expect(content[1]).toEqual({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAA' },
      })
    })

    it('should use specified mimeType in image data URL', async () => {
      const model = mockModel(textResponse('JPEG analysis'))

      const provider = new LangchainProvider('openai', 'key')
      await provider.analyzeImage({
        image: 'jpegBase64',
        prompt: 'Describe',
        mimeType: 'image/jpeg',
      })

      const content = model.invoke.mock.calls[0][0][0].content as any[]
      expect(content[1].image_url.url).toBe('data:image/jpeg;base64,jpegBase64')
    })

    it('should default mimeType to image/png', async () => {
      const model = mockModel(textResponse('PNG analysis'))

      const provider = new LangchainProvider('openai', 'key')
      await provider.analyzeImage({
        image: 'pngData',
        prompt: 'Describe',
      })

      const content = model.invoke.mock.calls[0][0][0].content as any[]
      expect(content[1].image_url.url).toMatch(/^data:image\/png;base64,/)
    })

    it('should return text from response', async () => {
      mockModel(textResponse('A cinematic photograph with warm tones'))

      const provider = new LangchainProvider('openai', 'key')
      const result = await provider.analyzeImage({
        image: 'data',
        prompt: 'Describe',
      })

      expect(result.text).toBe('A cinematic photograph with warm tones')
    })

    it('should normalize errors', async () => {
      const model = { invoke: vi.fn().mockRejectedValue(new Error('Invalid image')) }
      mockCreateLangchainModel.mockReturnValue(model as any)

      const provider = new LangchainProvider('openai', 'key')

      await expect(
        provider.analyzeImage({ image: 'bad', prompt: 'Analyze' }),
      ).rejects.toThrow('Invalid image')
    })
  })

  describe('R-LC-04: image generation', () => {
    let originalFetch: typeof global.fetch

    beforeEach(() => {
      originalFetch = global.fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('should use native Gemini API for gemini provider', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: 'base64ImageData' } }],
            },
          }],
        }),
      })
      global.fetch = mockFetch

      const provider = new LangchainProvider('gemini', 'gemini-key')
      const result = await provider.generateImage({ prompt: 'A fox in a forest' })

      expect(result.base64).toBe('base64ImageData')
      expect(result.costUnits).toBe(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generateContent'),
        expect.any(Object),
      )
    })

    it('should include API key in Gemini image generation request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{ inlineData: { data: 'img' } }],
            },
          }],
        }),
      })
      global.fetch = mockFetch

      const provider = new LangchainProvider('gemini', 'my-gemini-key')
      await provider.generateImage({ prompt: 'A cat' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=my-gemini-key'),
        expect.any(Object),
      )
    })

    it('should use gemini-2.0-flash-exp as default image model', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ inlineData: { data: 'img' } }] },
          }],
        }),
      })
      global.fetch = mockFetch

      const provider = new LangchainProvider('gemini', 'key')
      await provider.generateImage({ prompt: 'Test' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.0-flash-exp'),
        expect.any(Object),
      )
    })

    it('should throw for openai provider', async () => {
      const provider = new LangchainProvider('openai', 'key')

      await expect(
        provider.generateImage({ prompt: 'An image' }),
      ).rejects.toThrow('Image generation is not yet supported for provider "openai"')
    })

    it('should throw for anthropic provider', async () => {
      const provider = new LangchainProvider('anthropic', 'key')

      await expect(
        provider.generateImage({ prompt: 'An image' }),
      ).rejects.toThrow('Image generation is not yet supported for provider "anthropic"')
    })

    it('should throw when Gemini returns no image data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ text: 'Sorry' }] },
          }],
        }),
      })
      global.fetch = mockFetch

      const provider = new LangchainProvider('gemini', 'key')

      await expect(
        provider.generateImage({ prompt: 'Test' }),
      ).rejects.toThrow('No image data in Gemini response')
    })

    it('should throw on Gemini API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Content policy violation'),
      })
      global.fetch = mockFetch

      const provider = new LangchainProvider('gemini', 'key')

      await expect(
        provider.generateImage({ prompt: 'Bad content' }),
      ).rejects.toThrow('Content policy violation')
    })
  })
})
