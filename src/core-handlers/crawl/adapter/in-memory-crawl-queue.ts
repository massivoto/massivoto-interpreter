// R-CRAWL-04: InMemoryCrawlQueue with deduplication via visited set

import type { CrawlQueue } from './crawl-adapter.js'

export class InMemoryCrawlQueue implements CrawlQueue {
  private queue: string[] = []
  private visited: Set<string> = new Set()

  add(url: string): void {
    if (!this.visited.has(url) && !this.queue.includes(url)) {
      this.queue.push(url)
    }
  }

  addMany(urls: string[]): void {
    for (const url of urls) {
      this.add(url)
    }
  }

  next(): string | null {
    const url = this.queue.shift() ?? null
    if (url) {
      this.visited.add(url)
    }
    return url
  }

  hasNext(): boolean {
    return this.queue.length > 0
  }

  isVisited(url: string): boolean {
    return this.visited.has(url)
  }

  markVisited(url: string): void {
    this.visited.add(url)
  }

  size(): number {
    return this.queue.length
  }
}
