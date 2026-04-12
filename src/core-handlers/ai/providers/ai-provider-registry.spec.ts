import { describe, it, expect, vi } from 'vitest'
import { AiProviderRegistry } from './ai-provider-registry.js'
import type { AiProvider, AiProviderConfig } from '@massivoto/kit'

/**
 * R-PC-01 to R-PC-03: AiProviderRegistry unit tests.
 *
 * Theme: Social Media Automation -- Emma and Carlos share providers
 * across text generation, image generation, and reverse-prompting.
 */

function createMockProvider(name: string = 'mock'): AiProvider {
  return {
    name,
    generateText: vi.fn().mockResolvedValue({ text: '', tokensUsed: 0 }),
    generateImage: vi.fn().mockResolvedValue({ base64: '', costUnits: 0 }),
    analyzeImage: vi.fn().mockResolvedValue({ text: '' }),
  }
}

function createConfig(providers: { name: string; apiKey: string }[]): AiProviderConfig {
  return {
    providers: providers.map((p) => ({ name: p.name as any, apiKey: p.apiKey })),
  }
}

describe('AiProviderRegistry', () => {
  describe('R-PC-01: get/set/clear API', () => {
    it('should return a provider set via set()', () => {
      const registry = new AiProviderRegistry()
      const mock = createMockProvider()
      registry.set('gemini', mock)

      const result = registry.get('gemini', ['gemini'], { env: {} })

      expect(result).toBe(mock)
    })

    it('should clear all cached providers', () => {
      const registry = new AiProviderRegistry()
      registry.set('gemini', createMockProvider())

      registry.clear()

      expect(() => registry.get('gemini', ['gemini'], { env: {} })).toThrow('GEMINI_API_KEY')
    })
  })

  describe('R-PC-02: resolution via config or env fallback', () => {
    it('should resolve from aiConfig when available', () => {
      const registry = new AiProviderRegistry()
      const config = createConfig([{ name: 'gemini', apiKey: 'cfg-key' }])

      const provider = registry.get(undefined, ['gemini'], { aiConfig: config })

      expect(provider).toBeDefined()
    })

    it('should fall back to env vars when no aiConfig', () => {
      const registry = new AiProviderRegistry()

      const provider = registry.get('gemini', ['gemini'], {
        env: { GEMINI_API_KEY: 'env-key' },
      })

      expect(provider).toBeDefined()
    })

    it('should throw for missing env key when no config', () => {
      const registry = new AiProviderRegistry()

      expect(() => registry.get('gemini', ['gemini'], { env: {} })).toThrow('GEMINI_API_KEY')
    })

    it('should throw actionable error for missing key', () => {
      const registry = new AiProviderRegistry()

      expect(() => registry.get('gemini', ['gemini'], { env: {} })).toThrow('env.dist')
    })

    it('should throw for unknown provider name', () => {
      const registry = new AiProviderRegistry()

      expect(() =>
        registry.get('dalle', ['gemini'], { env: { GEMINI_API_KEY: 'key' } }),
      ).toThrow('Unknown provider "dalle"')
    })

    it('should include valid options in unknown provider error', () => {
      const registry = new AiProviderRegistry()

      expect(() =>
        registry.get('dalle', ['gemini'], { env: {} }),
      ).toThrow('gemini')
    })
  })

  describe('R-PC-03: caching', () => {
    it('should return the same instance on subsequent calls', () => {
      const registry = new AiProviderRegistry()
      const mock = createMockProvider()
      registry.set('gemini', mock)

      const first = registry.get('gemini', ['gemini'], { env: {} })
      const second = registry.get('gemini', ['gemini'], { env: {} })

      expect(first).toBe(second)
    })

    it('should cache provider created from config', () => {
      const registry = new AiProviderRegistry()
      const config = createConfig([{ name: 'gemini', apiKey: 'cfg-key' }])

      const first = registry.get(undefined, ['gemini'], { aiConfig: config })
      const second = registry.get(undefined, ['gemini'], { aiConfig: config })

      expect(first).toBe(second)
    })

    it('should cache provider created from env fallback', () => {
      const registry = new AiProviderRegistry()
      const env = { GEMINI_API_KEY: 'env-key' }

      const first = registry.get('gemini', ['gemini'], { env })
      const second = registry.get('gemini', ['gemini'], { env })

      expect(first).toBe(second)
    })
  })

  describe('provider hint resolution', () => {
    it('should use explicit hint over config resolution', () => {
      const registry = new AiProviderRegistry()
      const mock = createMockProvider()
      registry.set('gemini', mock)
      const config = createConfig([{ name: 'gemini', apiKey: 'key' }])

      const result = registry.get('gemini', ['gemini', 'openai'], { aiConfig: config })

      expect(result).toBe(mock)
    })

    it('should default to gemini when no hint and no config', () => {
      const registry = new AiProviderRegistry()

      const provider = registry.get(undefined, ['gemini'], {
        env: { GEMINI_API_KEY: 'key' },
      })

      expect(provider).toBeDefined()
    })
  })
})
