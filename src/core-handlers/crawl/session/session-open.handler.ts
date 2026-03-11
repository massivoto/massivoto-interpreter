// R-CRAWL-41 to R-CRAWL-44: @crawl/session/open handler

import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import type { CrawlAdapter } from '../adapter/crawl-adapter.js'
import { CrawlSession } from './crawl-session.js'

export class SessionOpenHandler extends BaseCommandHandler<CrawlSession> {
  private adapter: CrawlAdapter

  constructor(adapter: CrawlAdapter) {
    super('@crawl/session/open')
    this.adapter = adapter
  }

  async run(
    args: Record<string, any>,
    _context: ExecutionContext,
  ): Promise<ActionResult<CrawlSession>> {
    const url = args.url as string | undefined

    // R-CRAWL-43: validate URL
    if (!url) {
      return this.handleFailure('Missing required arg: url')
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return this.handleFailure(`Invalid URL: ${url}. Must start with http:// or https://`)
    }

    const limit = args.limit ?? 100
    const maxRequestsPerMinute = args.maxRequestsPerMinute ?? 30

    const queue = this.adapter.createQueue()
    const session = new CrawlSession(
      { startUrl: url, limit, maxRequestsPerMinute },
      queue,
    )

    // R-CRAWL-42: add starting URL to queue
    queue.add(url)

    return this.handleSuccess(`Session opened for ${url}`, session)
  }
}
