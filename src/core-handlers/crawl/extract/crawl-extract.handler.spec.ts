import { describe, it, expect, beforeEach } from 'vitest'
import { CrawlExtractHandler } from './crawl-extract.handler.js'
import { CrawlSession } from '../session/crawl-session.js'
import { InMemoryCrawlQueue } from '../adapter/in-memory-crawl-queue.js'
import { createEmptyExecutionContext } from '@massivoto/kit'
import type { CrawlPage } from '../adapter/crawl-adapter.js'
import * as cheerio from 'cheerio'

/**
 * Theme: Vintage Vinyl Record Shop
 * Marco extracts album titles, artists, prices, cover images, and review text
 * from prog-rock forum pages and collector databases.
 */

function createPage(url: string, html: string): CrawlPage {
  return {
    url,
    status: 200,
    html,
    cheerio: cheerio.load(html),
    contentType: 'text/html',
  }
}

describe('CrawlExtractHandler', () => {
  let handler: CrawlExtractHandler

  beforeEach(() => {
    handler = new CrawlExtractHandler()
  })

  const listingHtml = `
    <html><body>
      <h2 class="album-title">Wish You Were Here</h2>
      <span class="artist">Pink Floyd</span>
      <span class="price">$38</span>
      <div class="review"><p>A masterpiece of progressive rock...</p></div>
      <img class="cover" src="/img/dark-side.jpg">
      <img class="cover" src="/img/animals.jpg">
      <a class="shop-link" href="/shop/1">Buy Here</a>
      <a class="shop-link" href="/shop/2">Buy There</a>
    </body></html>
  `

  describe('R-CRAWL-101: handler identity', () => {
    it('should have id @crawl/extract', () => {
      expect(handler.id).toBe('@crawl/extract')
    })
  })

  describe('R-CRAWL-102: manual selector extraction', () => {
    // AC-CRAWL-09
    it('should extract text with selector= and default as=text', async () => {
      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, selector: 'h2.album-title' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toBe('Wish You Were Here')
    })

    it('should fail when no selector and no learned selectors', async () => {
      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run({ input: page }, context)

      expect(result.success).toBe(false)
      expect(result.message).toContain('No extract selector')
    })
  })

  describe('R-CRAWL-103: output formatting', () => {
    it('should extract as text (default)', async () => {
      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, selector: 'span.price', as: 'text' },
        context,
      )

      expect(result.value).toBe('$38')
    })

    // AC-CRAWL-16
    it('should extract as markdown', async () => {
      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, selector: 'div.review', as: 'markdown' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toContain('A masterpiece of progressive rock')
    })

    it('should extract as html', async () => {
      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, selector: 'div.review', as: 'html' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toContain('<p>')
    })

    // AC-CRAWL-15
    it('should extract as images (array of absolute src URLs)', async () => {
      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, selector: 'img.cover', as: 'images' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toEqual([
        'https://forum.example.com/img/dark-side.jpg',
        'https://forum.example.com/img/animals.jpg',
      ])
    })

    it('should extract as links (array of absolute href URLs)', async () => {
      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, selector: 'a.shop-link', as: 'links' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toEqual([
        'https://forum.example.com/shop/1',
        'https://forum.example.com/shop/2',
      ])
    })
  })

  describe('R-CRAWL-102: learned selectors with multiple fields', () => {
    it('should extract structured object with learned selectors', async () => {
      const queue = new InMemoryCrawlQueue()
      const session = new CrawlSession(
        { startUrl: 'https://forum.example.com/prog-rock', limit: 100, maxRequestsPerMinute: 30 },
        queue,
      )
      session.learnedSelectors = {
        follow: [],
        extract: [
          { field: 'title', selector: 'h2.album-title', as: 'text' },
          { field: 'artist', selector: 'span.artist', as: 'text' },
          { field: 'price', selector: 'span.price', as: 'text' },
        ],
      }

      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, session },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toEqual({
        title: 'Wish You Were Here',
        artist: 'Pink Floyd',
        price: '$38',
      })
    })
  })

  describe('R-CRAWL-104: missing fields in learned selectors', () => {
    it('should set field to null when selector matches nothing', async () => {
      const queue = new InMemoryCrawlQueue()
      const session = new CrawlSession(
        { startUrl: 'https://forum.example.com/prog-rock', limit: 100, maxRequestsPerMinute: 30 },
        queue,
      )
      session.learnedSelectors = {
        follow: [],
        extract: [
          { field: 'title', selector: 'h2.album-title', as: 'text' },
          { field: 'condition', selector: 'span.condition', as: 'text' }, // not on page
        ],
      }

      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, session },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toEqual({
        title: 'Wish You Were Here',
        condition: null,
      })
    })
  })

  describe('R-CRAWL-105: as= override on learned selectors', () => {
    it('should override all fields as= when as= arg provided', async () => {
      const queue = new InMemoryCrawlQueue()
      const session = new CrawlSession(
        { startUrl: 'https://forum.example.com/prog-rock', limit: 100, maxRequestsPerMinute: 30 },
        queue,
      )
      session.learnedSelectors = {
        follow: [],
        extract: [
          { field: 'title', selector: 'h2.album-title', as: 'markdown' },
          { field: 'artist', selector: 'span.artist', as: 'markdown' },
        ],
      }

      const page = createPage('https://forum.example.com/topic/42', listingHtml)
      const context = createEmptyExecutionContext('marco-vinyl')

      const result = await handler.run(
        { input: page, session, as: 'html' },
        context,
      )

      expect(result.success).toBe(true)
      // With as=html override, should return raw innerHTML
      const value = result.value as any
      expect(typeof value.title).toBe('string')
      expect(typeof value.artist).toBe('string')
    })
  })
})
