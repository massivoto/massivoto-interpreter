// SimpleCrawlAdapter - real HTTP fetch + cheerio, no Crawlee dependency
// Useful for testing against real websites and as a lightweight alternative to CrawleeAdapter
// Does NOT handle: rate limiting, robots.txt, retries (CrawleeAdapter will)

import * as cheerio from 'cheerio'
import type {
  CrawlAdapter,
  CrawlFetchOptions,
  CrawlPage,
  CrawlQueue,
} from './crawl-adapter.js'
import { InMemoryCrawlQueue } from './in-memory-crawl-queue.js'

export class SimpleCrawlAdapter implements CrawlAdapter {
  async fetch(url: string, _options?: CrawlFetchOptions): Promise<CrawlPage> {
    try {
      const response = await globalThis.fetch(url, {
        headers: {
          'User-Agent': 'Massivoto-Crawler/0.1 (+https://massivoto.com)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })

      const html = await response.text()

      return {
        url,
        status: response.status,
        html,
        cheerio: cheerio.load(html),
        contentType: response.headers.get('content-type') ?? 'text/html',
      }
    } catch (error: any) {
      return {
        url,
        status: 0,
        html: '',
        cheerio: cheerio.load(''),
        contentType: 'text/html',
      }
    }
  }

  createQueue(): CrawlQueue {
    return new InMemoryCrawlQueue()
  }
}
