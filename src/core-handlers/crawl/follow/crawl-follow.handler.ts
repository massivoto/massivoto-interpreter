// R-CRAWL-81 to R-CRAWL-85: @crawl/follow handler

import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import type { CrawlPage } from '../adapter/crawl-adapter.js'
import type { CrawlSession } from '../session/crawl-session.js'
import { isCssSelector } from './selector-resolver.js'

export class CrawlFollowHandler extends BaseCommandHandler<string[]> {
  constructor() {
    super('@crawl/follow')
  }

  async run(
    args: Record<string, any>,
    _context: ExecutionContext,
  ): Promise<ActionResult<string[]>> {
    const session = args.session as CrawlSession | undefined
    const page = args.input as CrawlPage | undefined
    const followArg = args.follow as string | undefined

    if (!session) {
      return this.handleFailure('Missing required arg: session')
    }
    if (!page) {
      return this.handleFailure('Missing required arg: input')
    }

    // R-CRAWL-82: resolve selectors
    const selectors = this.resolveFollowSelectors(followArg, session)
    if (!selectors) {
      return this.handleFailure(
        'No follow selector. Provide follow= arg or use @crawl/example first.',
      )
    }

    const $ = page.cheerio
    const pageUrl = new URL(page.url)
    const baseDomain = pageUrl.hostname
    const allUrls: string[] = []

    for (const selector of selectors) {
      const elements = this.findAnchors($, selector, followArg)
      elements.each((_: number, el: any) => {
        const href = $(el).attr('href')
        if (!href) return

        try {
          const resolved = new URL(href, page.url).href
          const resolvedUrl = new URL(resolved)

          // R-CRAWL-83: same-domain filter
          if (resolvedUrl.hostname !== baseDomain) return

          allUrls.push(resolved)
        } catch {
          // skip invalid URLs
        }
      })
    }

    // R-CRAWL-84: add to queue, return only newly added (not visited)
    const newUrls = allUrls.filter((url) => !session.queue.isVisited(url))
    session.queue.addMany(newUrls)

    // R-CRAWL-85: zero matches is not an error
    return this.handleSuccess(
      newUrls.length > 0
        ? `Added ${newUrls.length} URLs to queue`
        : `Follow selector matched 0 links on ${page.url}`,
      newUrls,
    )
  }

  private resolveFollowSelectors(
    followArg: string | undefined,
    session: CrawlSession,
  ): string[] | null {
    if (followArg) {
      return [followArg]
    }
    if (session.learnedSelectors?.follow?.length) {
      return session.learnedSelectors.follow
    }
    return null
  }

  private findAnchors($: any, selector: string, originalArg: string | undefined): any {
    if (originalArg && !isCssSelector(originalArg)) {
      // Text-based matching: find <a> elements whose text contains the string
      const text = originalArg.toLowerCase()
      return $('a').filter(function (this: any) {
        return $(this).text().toLowerCase().includes(text)
      })
    }
    return $(selector)
  }
}
