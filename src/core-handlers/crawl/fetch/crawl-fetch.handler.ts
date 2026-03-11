// R-CRAWL-141 to R-CRAWL-143: @crawl/fetch handler (one-shot fetch + extract)

import TurndownService from 'turndown'
import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import type { CrawlAdapter, CrawlPage, ExtractAs } from '../adapter/crawl-adapter.js'

const turndown = new TurndownService()

export class CrawlFetchHandler extends BaseCommandHandler<any> {
  private adapter: CrawlAdapter

  constructor(adapter: CrawlAdapter) {
    super('@crawl/fetch')
    this.adapter = adapter
  }

  async run(
    args: Record<string, any>,
    _context: ExecutionContext,
  ): Promise<ActionResult<any>> {
    const url = args.url as string | undefined
    const selector = args.selector as string | undefined
    const as = (args.as as ExtractAs | undefined) ?? (selector ? 'text' : 'markdown')

    if (!url) {
      return this.handleFailure('Missing required arg: url')
    }

    const page = await this.adapter.fetch(url)

    if (page.status === 0 || page.status >= 400) {
      return this.handleFailure(`Failed to fetch: ${url} (status ${page.status})`)
    }

    // R-CRAWL-142: with selector
    if (selector) {
      const value = this.extractWithSelector(page, selector, as)
      return this.handleSuccess(`Fetched and extracted from ${url}`, value)
    }

    // R-CRAWL-143: full page content
    const value = this.formatFullPage(page, as)
    return this.handleSuccess(`Fetched ${url}`, value)
  }

  private extractWithSelector(page: CrawlPage, selector: string, as: ExtractAs): any {
    const $ = page.cheerio
    const elements = $(selector)

    if (elements.length === 0) return null

    switch (as) {
      case 'text': {
        if (elements.length === 1) return $(elements[0]).text().trim()
        return elements.toArray().map((el: any) => $(el).text().trim())
      }
      case 'markdown': {
        if (elements.length === 1) return turndown.turndown($(elements[0]).html() ?? '').trim()
        return elements.toArray().map((el: any) => turndown.turndown($(el).html() ?? '').trim())
      }
      case 'html': {
        if (elements.length === 1) return $(elements[0]).html() ?? ''
        return elements.toArray().map((el: any) => $(el).html() ?? '')
      }
      case 'images': {
        return elements.toArray().map((el: any) => {
          const src = $(el).attr('src') ?? ''
          try { return new URL(src, page.url).href } catch { return src }
        })
      }
      case 'links': {
        return elements.toArray().map((el: any) => {
          const href = $(el).attr('href') ?? ''
          try { return new URL(href, page.url).href } catch { return href }
        })
      }
      default:
        return $(elements[0]).text().trim()
    }
  }

  private formatFullPage(page: CrawlPage, as: ExtractAs): string {
    const $ = page.cheerio
    switch (as) {
      case 'html':
        return page.html
      case 'text':
        return $('body').text().replace(/\s+/g, ' ').trim()
      case 'markdown':
      default:
        return turndown.turndown(page.html).trim()
    }
  }
}
