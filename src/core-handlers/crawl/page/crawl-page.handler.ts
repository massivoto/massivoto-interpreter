// R-CRAWL-61 to R-CRAWL-64: @crawl/page handler

import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import type { CrawlAdapter, CrawlPage } from '../adapter/crawl-adapter.js'
import type { CrawlSession } from '../session/crawl-session.js'

export class CrawlPageHandler extends BaseCommandHandler<CrawlPage> {
  private adapter: CrawlAdapter

  constructor(adapter: CrawlAdapter) {
    super('@crawl/page')
    this.adapter = adapter
  }

  async run(
    args: Record<string, any>,
    _context: ExecutionContext,
  ): Promise<ActionResult<CrawlPage>> {
    const session = args.session as CrawlSession | undefined

    if (!session) {
      return this.handleFailure('Missing required arg: session')
    }

    // R-CRAWL-63: empty queue
    const url = session.queue.next()
    if (!url) {
      return this.handleFailure('No more pages in queue')
    }

    // R-CRAWL-62: fetch and increment
    const page = await this.adapter.fetch(url, {
      maxRequestsPerMinute: session.config.maxRequestsPerMinute,
    })

    session.pageCount++

    // R-CRAWL-64: HTTP errors are not fatal
    if (page.status >= 400) {
      return this.handleSuccess(
        `Fetched ${url} with status ${page.status}`,
        page,
      )
    }

    return this.handleSuccess(`Fetched ${url}`, page)
  }
}
