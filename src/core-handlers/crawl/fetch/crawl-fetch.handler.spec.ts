import { describe, it, expect, beforeEach } from 'vitest'
import { CrawlFetchHandler } from './crawl-fetch.handler.js'
import { MockCrawlAdapter } from '../adapter/mock-crawl-adapter.js'
import { createEmptyExecutionContext } from '@massivoto/kit'

/**
 * Theme: Vintage Vinyl Record Shop
 * Marco does quick one-shot fetches to check vinyl prices on collector sites.
 */

describe('CrawlFetchHandler', () => {
  let handler: CrawlFetchHandler
  let adapter: MockCrawlAdapter

  const pricePageHtml = `
    <html><body>
      <h1>Vinyl Price Guide</h1>
      <div class="listing">
        <h2 class="album-title">Wish You Were Here</h2>
        <span class="price">$38</span>
        <div class="description"><p>Original 1975 pressing, <strong>excellent</strong> condition.</p></div>
        <img class="cover" src="/img/wish-you-were-here.jpg">
        <a class="shop" href="/buy/42">Buy Now</a>
      </div>
    </body></html>
  `

  beforeEach(() => {
    adapter = new MockCrawlAdapter()
    adapter.addPage('https://vinyl-prices.example.com', pricePageHtml)
    handler = new CrawlFetchHandler(adapter)
  })

  describe('R-CRAWL-141: handler identity', () => {
    it('should have id @crawl/fetch', () => {
      expect(handler.id).toBe('@crawl/fetch')
    })
  })

  describe('R-CRAWL-143: full page fetch without selector', () => {
    // AC-CRAWL-01: default as=markdown
    it('should return full page as markdown by default', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://vinyl-prices.example.com' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toContain('Wish You Were Here')
      expect(result.value).toContain('$38')
    })

    // AC-CRAWL-02
    it('should return full page as html when as=html', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://vinyl-prices.example.com', as: 'html' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toContain('<h1>')
      expect(result.value).toContain('<span class="price">')
    })

    it('should return full page as text when as=text', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://vinyl-prices.example.com', as: 'text' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toContain('Wish You Were Here')
      expect(result.value).not.toContain('<h2')
    })
  })

  describe('R-CRAWL-142: fetch with selector', () => {
    it('should extract using CSS selector with default as=text', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://vinyl-prices.example.com', selector: 'h2.album-title' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toBe('Wish You Were Here')
    })

    it('should extract using selector with as=markdown', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://vinyl-prices.example.com', selector: 'div.description', as: 'markdown' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toContain('excellent')
    })

    it('should extract images with selector and as=images', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://vinyl-prices.example.com', selector: 'img.cover', as: 'images' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.value).toEqual([
        'https://vinyl-prices.example.com/img/wish-you-were-here.jpg',
      ])
    })
  })

  describe('error handling', () => {
    it('should fail when url is missing', async () => {
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run({}, context)

      expect(result.success).toBe(false)
      expect(result.message).toContain('url')
    })

    // AC-CRAWL-03
    it('should fail when page cannot be fetched', async () => {
      adapter.addPage('https://does-not-exist.example.com', '', 0)
      const context = createEmptyExecutionContext('marco-vinyl')
      const result = await handler.run(
        { url: 'https://does-not-exist.example.com' },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to fetch')
    })
  })
})
