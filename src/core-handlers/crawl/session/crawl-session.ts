// R-CRAWL-21 to R-CRAWL-24: CrawlSession state management

import type {
  CrawlPage,
  CrawlQueue,
  CrawlSessionConfig,
  LearnedSelectors,
} from '../adapter/crawl-adapter.js'

export class CrawlSession {
  readonly config: CrawlSessionConfig
  readonly queue: CrawlQueue
  learnedSelectors: LearnedSelectors | null = null
  basePrompt: string | null = null
  examplePages: CrawlPage[] = []
  pageCount = 0

  constructor(config: CrawlSessionConfig, queue: CrawlQueue) {
    this.config = config
    this.queue = queue
  }

  // R-CRAWL-22: limit check + queue state
  get hasNext(): boolean {
    if (this.pageCount >= this.config.limit) {
      return false
    }
    return this.queue.hasNext()
  }

  // R-CRAWL-24: prompt inheritance
  applyPrompt(prompt: string | undefined): string | null {
    if (prompt) {
      if (this.basePrompt === null) {
        this.basePrompt = prompt
      } else {
        this.basePrompt = this.basePrompt + '\n' + prompt
      }
    }
    return this.basePrompt
  }
}
