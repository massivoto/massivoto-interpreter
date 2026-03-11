// R-CRAWL-01: CrawlAdapter interface and types

import type { CheerioAPI } from 'cheerio'

export interface CrawlAdapter {
  fetch(url: string, options?: CrawlFetchOptions): Promise<CrawlPage>
  createQueue(): CrawlQueue
}

export interface CrawlFetchOptions {
  maxRequestsPerMinute?: number
  respectRobotsTxt?: boolean // default: true
}

export interface CrawlPage {
  url: string
  status: number
  html: string
  cheerio: CheerioAPI
  contentType: string
}

export interface CrawlQueue {
  add(url: string): void
  addMany(urls: string[]): void
  next(): string | null
  hasNext(): boolean
  isVisited(url: string): boolean
  markVisited(url: string): void
  size(): number
}

export type ExtractAs = 'markdown' | 'text' | 'html' | 'images' | 'links'

export interface LearnedSelectors {
  follow: string[]
  extract: ExtractSelector[]
}

export interface ExtractSelector {
  field: string
  selector: string
  as: ExtractAs
}

export interface CrawlSessionConfig {
  startUrl: string
  limit: number
  maxRequestsPerMinute: number
}
