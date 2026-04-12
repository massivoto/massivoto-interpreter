import { describe, it, expect } from 'vitest'
import { TextHandler } from './text.handler.js'
import { GenerateImageHandler } from './image/generate.handler.js'
import { ReverseImageHandler } from './prompt/reverse-image.handler.js'
import { AiCommandHandler } from '../../handlers/ai-command-handler.js'

/**
 * R-PAR-05, R-PAR-06: Verify all AI handlers extend AiCommandHandler
 * and declare their capability. No acceptedProviders, no setProvider.
 */

describe('AI handler declarations', () => {
  describe('R-PAR-05: AiCommandHandler subclass with capability', () => {
    it('TextHandler should extend AiCommandHandler', () => {
      const handler = new TextHandler()
      expect(handler).toBeInstanceOf(AiCommandHandler)
    })

    it('GenerateImageHandler should extend AiCommandHandler', () => {
      const handler = new GenerateImageHandler()
      expect(handler).toBeInstanceOf(AiCommandHandler)
    })

    it('ReverseImageHandler should extend AiCommandHandler', () => {
      const handler = new ReverseImageHandler()
      expect(handler).toBeInstanceOf(AiCommandHandler)
    })
  })

  describe('R-HC-30 to R-HC-33: capability tags on handlers', () => {
    it('TextHandler should declare capability = text', () => {
      const handler = new TextHandler()
      expect(handler.capability).toBe('text')
    })

    it('GenerateImageHandler should declare capability = image', () => {
      const handler = new GenerateImageHandler()
      expect(handler.capability).toBe('image')
    })

    it('ReverseImageHandler should declare capability = image-analysis', () => {
      const handler = new ReverseImageHandler()
      expect(handler.capability).toBe('image-analysis')
    })
  })

  describe('R-PAR-06: no duplicated credential/provider logic', () => {
    it('TextHandler should not have setProvider', () => {
      const handler = new TextHandler() as any
      expect(handler.setProvider).toBeUndefined()
    })

    it('TextHandler should not have acceptedProviders', () => {
      const handler = new TextHandler() as any
      expect(handler.acceptedProviders).toBeUndefined()
    })

    it('TextHandler should not have getApiKey', () => {
      const handler = new TextHandler() as any
      expect(handler.getApiKey).toBeUndefined()
    })

    it('GenerateImageHandler should not have setProvider', () => {
      const handler = new GenerateImageHandler() as any
      expect(handler.setProvider).toBeUndefined()
    })

    it('ReverseImageHandler should not have setProvider', () => {
      const handler = new ReverseImageHandler() as any
      expect(handler.setProvider).toBeUndefined()
    })
  })
})
