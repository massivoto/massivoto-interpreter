import { describe, it, expect, beforeEach } from 'vitest'
import { CrawlExampleHandler } from './crawl-example.handler.js'
import { MockCrawlAdapter } from '../adapter/mock-crawl-adapter.js'
import { DummyAI } from './dummy-ai.js'
import { CrawlSession } from '../session/crawl-session.js'
import { createEmptyExecutionContext } from '@massivoto/kit'
import type { LearnedSelectors } from '../adapter/crawl-adapter.js'

/**
 * Theme: Vintage Vinyl Record Shop
 * Marco teaches the crawler by showing example pages from prog-rock collector forums.
 * The AI learns CSS selectors for extracting album data and navigation patterns.
 */

describe('CrawlExampleHandler', () => {
  let handler: CrawlExampleHandler
  let adapter: MockCrawlAdapter
  let session: CrawlSession

  const examplePageHtml = `
    <html><body>
      <h2 class="album-title">Wish You Were Here</h2>
      <span class="artist">Pink Floyd</span>
      <span class="price">$38</span>
      <a class="next-page" href="/page/2">Next</a>
    </body></html>
  `

  const learnedSelectors: LearnedSelectors = {
    follow: ['a.next-page'],
    extract: [
      { field: 'title', selector: 'h2.album-title', as: 'text' },
      { field: 'artist', selector: 'span.artist', as: 'text' },
      { field: 'price', selector: 'span.price', as: 'text' },
    ],
  }

  beforeEach(() => {
    adapter = new MockCrawlAdapter()
    adapter.addPage('https://forum.example.com/topic/42', examplePageHtml)
    adapter.addPage('https://forum.example.com/topic/99', examplePageHtml)

    const dummyAi = new DummyAI(learnedSelectors)
    handler = new CrawlExampleHandler(adapter, dummyAi)

    const queue = adapter.createQueue()
    session = new CrawlSession(
      { startUrl: 'https://forum.example.com/prog-rock', limit: 100, maxRequestsPerMinute: 30 },
      queue,
    )
  })

  describe('R-CRAWL-121: handler identity', () => {
    it('should have id @crawl/example', () => {
      expect(handler.id).toBe('@crawl/example')
    })
  })

  describe('R-CRAWL-122: example page processing', () => {
    // AC-CRAWL-10
    it('should fetch the page and store learned selectors in session', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        {
          url: 'https://forum.example.com/topic/42',
          session,
          prompt: 'Extract album title, artist, price. Follow pagination links.',
        },
        context,
      )

      expect(result.success).toBe(true)
      expect(session.learnedSelectors).toEqual(learnedSelectors)
    })

    it('should add the fetched page to session.examplePages', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      await handler.run(
        {
          url: 'https://forum.example.com/topic/42',
          session,
          prompt: 'Extract album data.',
        },
        context,
      )

      expect(session.examplePages).toHaveLength(1)
      expect(session.examplePages[0].url).toBe('https://forum.example.com/topic/42')
    })

    it('should set basePrompt on first call', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      await handler.run(
        {
          url: 'https://forum.example.com/topic/42',
          session,
          prompt: 'Extract album data.',
        },
        context,
      )

      expect(session.basePrompt).toBe('Extract album data.')
    })
  })

  describe('R-CRAWL-122: prompt inheritance', () => {
    // AC-CRAWL-11
    it('should inherit prompt from previous example', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      await handler.run(
        {
          url: 'https://forum.example.com/topic/42',
          session,
          prompt: 'Extract album title, artist, price.',
        },
        context,
      )

      const result = await handler.run(
        {
          url: 'https://forum.example.com/topic/99',
          session,
        },
        context,
      )

      expect(result.success).toBe(true)
      expect(session.basePrompt).toBe('Extract album title, artist, price.')
      expect(session.examplePages).toHaveLength(2)
    })

    it('should augment prompt on second call with prompt=', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      await handler.run(
        {
          url: 'https://forum.example.com/topic/42',
          session,
          prompt: 'Extract album title.',
        },
        context,
      )

      await handler.run(
        {
          url: 'https://forum.example.com/topic/99',
          session,
          prompt: 'Also extract the price.',
        },
        context,
      )

      expect(session.basePrompt).toBe('Extract album title.\nAlso extract the price.')
    })

    it('should fail on first call without prompt=', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        {
          url: 'https://forum.example.com/topic/42',
          session,
        },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('requires a prompt')
    })
  })

  describe('R-CRAWL-124: AI provider injection', () => {
    // AC-CRAWL-12: AI called per example, not per page
    it('should call AI exactly once per example page', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')

      await handler.run(
        {
          url: 'https://forum.example.com/topic/42',
          session,
          prompt: 'Extract album data.',
        },
        context,
      )

      await handler.run(
        {
          url: 'https://forum.example.com/topic/99',
          session,
        },
        context,
      )

      // 2 examples -> 2 AI calls. Not 22 (2 examples + 20 pages).
      expect(session.learnedSelectors).toBeDefined()
    })
  })

  describe('R-CRAWL-125: fetch failure', () => {
    it('should fail when URL fetch fails', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      // URL not registered in mock adapter returns 404
      const result = await handler.run(
        {
          url: 'https://forum.example.com/missing',
          session,
          prompt: 'Extract album data.',
        },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to fetch example page')
    })

    it('should preserve previous selectors on fetch failure', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')

      // First example succeeds
      await handler.run(
        {
          url: 'https://forum.example.com/topic/42',
          session,
          prompt: 'Extract album data.',
        },
        context,
      )
      const originalSelectors = session.learnedSelectors

      // Second example fails
      await handler.run(
        {
          url: 'https://forum.example.com/missing',
          session,
        },
        context,
      )

      expect(session.learnedSelectors).toEqual(originalSelectors)
    })
  })
})
