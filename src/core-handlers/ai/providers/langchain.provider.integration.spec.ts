import { describe, it, expect } from 'vitest'
import { LangchainProvider } from './langchain.provider.js'

/**
 * Integration tests for LangchainProvider.
 *
 * These tests call real APIs and consume paid tokens.
 * Run with: npm run integration
 * Requires real API keys in environment variables.
 *
 * DO NOT run in CI or casually -- each test costs real money.
 */

describe('LangchainProvider Integration', () => {
  describe('text generation', () => {
    it('should generate text with OpenAI', async () => {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('OPENAI_API_KEY not set')

      const provider = new LangchainProvider('openai', apiKey)
      const result = await provider.generateText({
        prompt: 'Say hello in exactly 3 words',
        model: 'gpt-4o-mini',
        maxTokens: 20,
      })

      expect(result.text).toBeTruthy()
      expect(result.text.length).toBeGreaterThan(0)
      expect(result.tokensUsed).toBeGreaterThan(0)
    })

    it('should generate text with Anthropic', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

      const provider = new LangchainProvider('anthropic', apiKey)
      const result = await provider.generateText({
        prompt: 'Say hello in exactly 3 words',
        model: 'claude-haiku-4-20250414',
        maxTokens: 20,
      })

      expect(result.text).toBeTruthy()
      expect(result.text.length).toBeGreaterThan(0)
      expect(result.tokensUsed).toBeGreaterThan(0)
    })

    it('should generate text with Gemini via Langchain', async () => {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('GEMINI_API_KEY not set')

      const provider = new LangchainProvider('gemini', apiKey)
      const result = await provider.generateText({
        prompt: 'Say hello in exactly 3 words',
        model: 'gemini-2.5-flash',
        maxTokens: 20,
      })

      expect(result.text).toBeTruthy()
      expect(result.text.length).toBeGreaterThan(0)
    })

    it('should pass system prompt to model', async () => {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('OPENAI_API_KEY not set')

      const provider = new LangchainProvider('openai', apiKey)
      const result = await provider.generateText({
        prompt: 'What are you?',
        system: 'You are a pirate. Always respond in pirate speak.',
        model: 'gpt-4o-mini',
        maxTokens: 50,
      })

      expect(result.text).toBeTruthy()
    })
  })

  describe('image analysis', () => {
    // A minimal 1x1 red pixel PNG in base64
    const redPixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

    it('should analyze image with OpenAI', async () => {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('OPENAI_API_KEY not set')

      const provider = new LangchainProvider('openai', apiKey)
      const result = await provider.analyzeImage({
        image: redPixelPng,
        prompt: 'What color is this pixel?',
        model: 'gpt-4o-mini',
      })

      expect(result.text).toBeTruthy()
      expect(result.text.length).toBeGreaterThan(0)
    })

    it('should analyze image with Anthropic', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

      const provider = new LangchainProvider('anthropic', apiKey)
      const result = await provider.analyzeImage({
        image: redPixelPng,
        prompt: 'What color is this pixel?',
        model: 'claude-haiku-4-20250414',
      })

      expect(result.text).toBeTruthy()
      expect(result.text.length).toBeGreaterThan(0)
    })
  })
})
