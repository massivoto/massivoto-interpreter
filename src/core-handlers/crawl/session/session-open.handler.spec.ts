import { describe, it, expect, beforeEach } from 'vitest'
import { SessionOpenHandler } from './session-open.handler.js'
import { MockCrawlAdapter } from '../adapter/mock-crawl-adapter.js'
import { CrawlSession } from './crawl-session.js'
import { createEmptyExecutionContext } from '@massivoto/kit'

/**
 * Theme: Vintage Vinyl Record Shop
 * Marco opens crawl sessions to browse prog-rock forums.
 */

describe('SessionOpenHandler', () => {
  let handler: SessionOpenHandler
  let adapter: MockCrawlAdapter

  beforeEach(() => {
    adapter = new MockCrawlAdapter()
    handler = new SessionOpenHandler(adapter)
  })

  describe('R-CRAWL-41: handler identity', () => {
    it('should have id @crawl/session/open', () => {
      expect(handler.id).toBe('@crawl/session/open')
    })

    it('should have type command', () => {
      expect(handler.type).toBe('command')
    })
  })

  describe('R-CRAWL-42: session creation', () => {
    it('should create a CrawlSession with url in queue', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://forum.example.com/prog-rock' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toBeInstanceOf(CrawlSession)

      const session = result.value!
      expect(session.config.startUrl).toBe('https://forum.example.com/prog-rock')
      expect(session.hasNext).toBe(true)
    })

    it('should use default limit of 100', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://forum.example.com/prog-rock' },
        context,
      )

      expect(result.value!.config.limit).toBe(100)
    })

    it('should use default maxRequestsPerMinute of 30', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://forum.example.com/prog-rock' },
        context,
      )

      expect(result.value!.config.maxRequestsPerMinute).toBe(30)
    })

    it('should accept custom limit', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://forum.example.com/prog-rock', limit: 50 },
        context,
      )

      expect(result.value!.config.limit).toBe(50)
    })

    it('should accept custom maxRequestsPerMinute', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://forum.example.com/prog-rock', maxRequestsPerMinute: 10 },
        context,
      )

      expect(result.value!.config.maxRequestsPerMinute).toBe(10)
    })
  })

  describe('R-CRAWL-43: URL validation', () => {
    it('should fail on missing url', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run({}, context)

      expect(result.success).toBe(false)
      expect(result.message).toContain('url')
    })

    it('should fail on invalid url (no protocol)', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'forum.example.com/prog-rock' },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid URL')
    })

    it('should accept http:// url', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'http://forum.example.com/prog-rock' },
        context,
      )

      expect(result.success).toBe(true)
    })

    it('should accept https:// url', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://forum.example.com/prog-rock' },
        context,
      )

      expect(result.success).toBe(true)
    })
  })
})
