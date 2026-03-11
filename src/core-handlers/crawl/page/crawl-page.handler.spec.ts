import { describe, it, expect, beforeEach } from 'vitest'
import { CrawlPageHandler } from './crawl-page.handler.js'
import { MockCrawlAdapter } from '../adapter/mock-crawl-adapter.js'
import { CrawlSession } from '../session/crawl-session.js'
import { createEmptyExecutionContext } from '@massivoto/kit'
import type { CrawlPage } from '../adapter/crawl-adapter.js'

/**
 * Theme: Vintage Vinyl Record Shop
 * Marco consumes pages from his crawl queue, one prog-rock forum topic at a time.
 */

describe('CrawlPageHandler', () => {
  let handler: CrawlPageHandler
  let adapter: MockCrawlAdapter
  let session: CrawlSession

  beforeEach(() => {
    adapter = new MockCrawlAdapter()
    handler = new CrawlPageHandler(adapter)

    adapter.addPage(
      'https://forum.example.com/topic/1',
      '<html><body><h1>Wish You Were Here</h1></body></html>',
    )
    adapter.addPage(
      'https://forum.example.com/topic/2',
      '<html><body><h1>Dark Side of the Moon</h1></body></html>',
    )
    adapter.addPage(
      'https://forum.example.com/topic/3',
      '<html><body><h1>Animals</h1></body></html>',
    )

    const queue = adapter.createQueue()
    session = new CrawlSession(
      { startUrl: 'https://forum.example.com/prog-rock', limit: 5, maxRequestsPerMinute: 30 },
      queue,
    )
    queue.add('https://forum.example.com/topic/1')
    queue.add('https://forum.example.com/topic/2')
    queue.add('https://forum.example.com/topic/3')
  })

  describe('R-CRAWL-61: handler identity', () => {
    it('should have id @crawl/page', () => {
      expect(handler.id).toBe('@crawl/page')
    })
  })

  describe('R-CRAWL-62: consume URL, fetch, increment pageCount', () => {
    it('should fetch the next page from queue', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run({ session }, context)

      expect(result.success).toBe(true)
      const page = result.value as CrawlPage
      expect(page.url).toBe('https://forum.example.com/topic/1')
      expect(page.html).toContain('Wish You Were Here')
    })

    it('should increment pageCount after each fetch', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      expect(session.pageCount).toBe(0)

      await handler.run({ session }, context)
      expect(session.pageCount).toBe(1)

      await handler.run({ session }, context)
      expect(session.pageCount).toBe(2)
    })

    // AC-CRAWL-05
    it('should return different pages on consecutive calls', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')

      const r1 = await handler.run({ session }, context)
      const r2 = await handler.run({ session }, context)
      const r3 = await handler.run({ session }, context)

      expect((r1.value as CrawlPage).url).toBe('https://forum.example.com/topic/1')
      expect((r2.value as CrawlPage).url).toBe('https://forum.example.com/topic/2')
      expect((r3.value as CrawlPage).url).toBe('https://forum.example.com/topic/3')
      expect(session.pageCount).toBe(3)
    })

    // AC-CRAWL-14: limit enforcement
    it('should set hasNext to false when pageCount reaches limit', async () => {
      const limitedQueue = adapter.createQueue()
      const limitedSession = new CrawlSession(
        { startUrl: 'https://forum.example.com/prog-rock', limit: 2, maxRequestsPerMinute: 30 },
        limitedQueue,
      )
      limitedQueue.add('https://forum.example.com/topic/1')
      limitedQueue.add('https://forum.example.com/topic/2')
      limitedQueue.add('https://forum.example.com/topic/3')

      const context = createEmptyExecutionContext('marco-vinyl')
      await handler.run({ session: limitedSession }, context)
      expect(limitedSession.hasNext).toBe(true)

      await handler.run({ session: limitedSession }, context)
      expect(limitedSession.hasNext).toBe(false) // limit=2 reached
    })
  })

  describe('R-CRAWL-63: empty queue handling', () => {
    it('should fail when queue is empty', async () => {
      const emptyQueue = adapter.createQueue()
      const emptySession = new CrawlSession(
        { startUrl: 'https://forum.example.com/prog-rock', limit: 100, maxRequestsPerMinute: 30 },
        emptyQueue,
      )

      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run({ session: emptySession }, context)

      expect(result.success).toBe(false)
      expect(result.message).toContain('No more pages')
    })
  })

  describe('R-CRAWL-64: HTTP error handling', () => {
    it('should return CrawlPage with error status on 404', async () => {
      adapter.addPage('https://forum.example.com/missing', '', 404)
      const queue = adapter.createQueue()
      const errorSession = new CrawlSession(
        { startUrl: 'https://forum.example.com/missing', limit: 100, maxRequestsPerMinute: 30 },
        queue,
      )
      queue.add('https://forum.example.com/missing')

      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run({ session: errorSession }, context)

      expect(result.success).toBe(true) // command succeeds even on HTTP error
      expect((result.value as CrawlPage).status).toBe(404)
    })

    it('should still increment pageCount on error pages', async () => {
      adapter.addPage('https://forum.example.com/error', '', 500)
      const queue = adapter.createQueue()
      const errorSession = new CrawlSession(
        { startUrl: 'https://forum.example.com/error', limit: 100, maxRequestsPerMinute: 30 },
        queue,
      )
      queue.add('https://forum.example.com/error')

      const context = createEmptyExecutionContext('marco-vinyl')
      await handler.run({ session: errorSession }, context)

      expect(errorSession.pageCount).toBe(1)
    })
  })
})
