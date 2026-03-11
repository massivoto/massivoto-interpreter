// Mock adapter for testing - returns pre-configured pages

import * as cheerio from 'cheerio'
import type {
  CrawlAdapter,
  CrawlFetchOptions,
  CrawlPage,
  CrawlQueue,
} from './crawl-adapter.js'
import { InMemoryCrawlQueue } from './in-memory-crawl-queue.js'

export class MockCrawlAdapter implements CrawlAdapter {
  private pages: Map<string, { html: string; status: number; contentType: string }> = new Map()

  addPage(url: string, html: string, status = 200, contentType = 'text/html'): void {
    this.pages.set(url, { html, status, contentType })
  }

  async fetch(url: string, _options?: CrawlFetchOptions): Promise<CrawlPage> {
    const page = this.pages.get(url)
    if (!page) {
      return {
        url,
        status: 404,
        html: '',
        cheerio: cheerio.load(''),
        contentType: 'text/html',
      }
    }
    return {
      url,
      status: page.status,
      html: page.html,
      cheerio: cheerio.load(page.html),
      contentType: page.contentType,
    }
  }

  createQueue(): CrawlQueue {
    return new InMemoryCrawlQueue()
  }
}
