// R-CRAWL-161: Re-exports all crawl handlers and types

export { SessionOpenHandler } from './session/session-open.handler.js'
export { CrawlPageHandler } from './page/crawl-page.handler.js'
export { CrawlFollowHandler } from './follow/crawl-follow.handler.js'
export { CrawlExtractHandler } from './extract/crawl-extract.handler.js'
export { CrawlExampleHandler } from './example/crawl-example.handler.js'
export { CrawlFetchHandler } from './fetch/crawl-fetch.handler.js'

export { CrawlSession } from './session/crawl-session.js'
export { InMemoryCrawlQueue } from './adapter/in-memory-crawl-queue.js'
export { MockCrawlAdapter } from './adapter/mock-crawl-adapter.js'
export { DummyAI } from './example/dummy-ai.js'

export type {
  CrawlAdapter,
  CrawlFetchOptions,
  CrawlPage,
  CrawlQueue,
  CrawlSessionConfig,
  ExtractAs,
  ExtractSelector,
  LearnedSelectors,
} from './adapter/crawl-adapter.js'
