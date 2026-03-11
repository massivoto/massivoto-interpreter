import { describe, it, expect, beforeEach } from 'vitest'
import { CrawlFollowHandler } from './crawl-follow.handler.js'
import { MockCrawlAdapter } from '../adapter/mock-crawl-adapter.js'
import { CrawlSession } from '../session/crawl-session.js'
import { createEmptyExecutionContext } from '@massivoto/kit'
import type { CrawlPage } from '../adapter/crawl-adapter.js'

/**
 * Theme: Vintage Vinyl Record Shop
 * Marco navigates prog-rock forum pages, following pagination and topic links.
 */

describe('CrawlFollowHandler', () => {
  let handler: CrawlFollowHandler
  let adapter: MockCrawlAdapter
  let session: CrawlSession

  const forumPageHtml = `
    <html><body>
      <h1>Prog Rock Forum</h1>
      <ul>
        <li><a class="topic-link" href="/topic/1">Wish You Were Here</a></li>
        <li><a class="topic-link" href="/topic/2">Dark Side of the Moon</a></li>
        <li><a class="topic-link" href="/topic/3">Animals</a></li>
        <li><a href="https://external-site.com/ad">Ad Link</a></li>
      </ul>
      <a class="next-page" href="/page/2">Next</a>
      <a href="/page/3">Next Page</a>
    </body></html>
  `

  beforeEach(() => {
    adapter = new MockCrawlAdapter()
    adapter.addPage('https://forum.example.com/prog-rock', forumPageHtml)

    handler = new CrawlFollowHandler()

    const queue = adapter.createQueue()
    session = new CrawlSession(
      { startUrl: 'https://forum.example.com/prog-rock', limit: 100, maxRequestsPerMinute: 30 },
      queue,
    )
  })

  function createMockPage(url: string, html: string): CrawlPage {
    const cheerio = require('cheerio')
    return {
      url,
      status: 200,
      html,
      cheerio: cheerio.load(html),
      contentType: 'text/html',
    }
  }

  describe('R-CRAWL-81: handler identity', () => {
    it('should have id @crawl/follow', () => {
      expect(handler.id).toBe('@crawl/follow')
    })
  })

  describe('R-CRAWL-82: CSS selector resolution', () => {
    // AC-CRAWL-07
    it('should follow links matched by CSS selector', async () => {
      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page, follow: 'a.next-page' },
        context,
      )

      expect(result.success).toBe(true)
      const urls = result.value as string[]
      expect(urls).toContain('https://forum.example.com/page/2')
    })

    it('should follow multiple links with same selector', async () => {
      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page, follow: 'a.topic-link' },
        context,
      )

      const urls = result.value as string[]
      expect(urls).toHaveLength(3)
      expect(urls).toContain('https://forum.example.com/topic/1')
      expect(urls).toContain('https://forum.example.com/topic/2')
      expect(urls).toContain('https://forum.example.com/topic/3')
    })
  })

  describe('R-CRAWL-82: text-based selector resolution', () => {
    // AC-CRAWL-08
    it('should auto-resolve plain text to anchor match', async () => {
      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page, follow: 'Next Page' },
        context,
      )

      expect(result.success).toBe(true)
      const urls = result.value as string[]
      expect(urls).toContain('https://forum.example.com/page/3')
    })

    it('should match text case-insensitively', async () => {
      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page, follow: 'next page' },
        context,
      )

      expect(result.success).toBe(true)
      const urls = result.value as string[]
      expect(urls).toContain('https://forum.example.com/page/3')
    })
  })

  describe('R-CRAWL-82: learned selectors fallback', () => {
    it('should use learned selectors when no follow= arg', async () => {
      session.learnedSelectors = {
        follow: ['a.next-page'],
        extract: [],
      }

      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page },
        context,
      )

      expect(result.success).toBe(true)
      const urls = result.value as string[]
      expect(urls).toContain('https://forum.example.com/page/2')
    })

    it('should fail when no follow= and no learned selectors', async () => {
      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('No follow selector')
    })
  })

  describe('R-CRAWL-83: relative URL resolution and same-domain filter', () => {
    it('should resolve relative URLs against page base URL', async () => {
      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page, follow: 'a.topic-link' },
        context,
      )

      const urls = result.value as string[]
      urls.forEach((url: string) => {
        expect(url).toMatch(/^https:\/\/forum\.example\.com\//)
      })
    })

    it('should filter out external-domain links', async () => {
      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page, follow: 'a' },
        context,
      )

      const urls = result.value as string[]
      const external = urls.filter((u: string) => !u.includes('forum.example.com'))
      expect(external).toHaveLength(0)
    })
  })

  describe('R-CRAWL-84: queue integration and dedup', () => {
    // AC-CRAWL-06
    it('should not add already-visited URLs', async () => {
      session.queue.add('https://forum.example.com/topic/1')
      session.queue.next() // marks /topic/1 as visited

      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page, follow: 'a.topic-link' },
        context,
      )

      const urls = result.value as string[]
      // /topic/1 was visited, so only /topic/2 and /topic/3 should be returned
      expect(urls).not.toContain('https://forum.example.com/topic/1')
      expect(urls).toContain('https://forum.example.com/topic/2')
    })
  })

  describe('R-CRAWL-85: zero matches', () => {
    it('should return empty array when selector matches nothing', async () => {
      const page = createMockPage('https://forum.example.com/prog-rock', forumPageHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { session, input: page, follow: 'a.nonexistent' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toEqual([])
    })
  })
})
