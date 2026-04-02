import { describe, it, expect } from 'vitest'
import { TextHandler } from './text.handler.js'
import { GenerateImageHandler } from './image/generate.handler.js'
import { ReverseImageHandler } from './prompt/reverse-image.handler.js'

/**
 * R-AIC-41, R-AIC-42: Verify all AI handlers declare acceptedProviders.
 * R-AIC-43: Verify duplicated credential logic is removed.
 */

describe('AI handler declarations', () => {
  describe('R-AIC-41: acceptedProviders on handlers', () => {
    it('TextHandler should declare acceptedProviders', () => {
      const handler = new TextHandler()
      expect(handler.acceptedProviders).toBeDefined()
      expect(handler.acceptedProviders).toContain('gemini')
    })

    it('GenerateImageHandler should declare acceptedProviders', () => {
      const handler = new GenerateImageHandler()
      expect(handler.acceptedProviders).toBeDefined()
      expect(handler.acceptedProviders).toContain('gemini')
    })

    it('ReverseImageHandler should declare acceptedProviders', () => {
      const handler = new ReverseImageHandler()
      expect(handler.acceptedProviders).toBeDefined()
      expect(handler.acceptedProviders).toContain('gemini')
    })
  })

  describe('R-AIC-43: no duplicated credential logic', () => {
    it('TextHandler should not have getApiKey as own method', () => {
      const handler = new TextHandler() as any
      expect(handler.getApiKey).toBeUndefined()
    })

    it('TextHandler should not have createProvider as own method', () => {
      const handler = new TextHandler() as any
      expect(handler.createProvider).toBeUndefined()
    })

    it('GenerateImageHandler should not have getApiKey as own method', () => {
      const handler = new GenerateImageHandler() as any
      expect(handler.getApiKey).toBeUndefined()
    })

    it('ReverseImageHandler should not have getApiKey as own method', () => {
      const handler = new ReverseImageHandler() as any
      expect(handler.getApiKey).toBeUndefined()
    })
  })
})
