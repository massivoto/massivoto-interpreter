// R-CRAWL-101 to R-CRAWL-105: @crawl/extract handler

import TurndownService from 'turndown'
import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import type {
  CrawlPage,
  ExtractAs,
  ExtractSelector,
} from '../adapter/crawl-adapter.js'
import type { CrawlSession } from '../session/crawl-session.js'

const turndown = new TurndownService()

export class CrawlExtractHandler extends BaseCommandHandler<any> {
  constructor() {
    super('@crawl/extract')
  }

  async run(
    args: Record<string, any>,
    _context: ExecutionContext,
  ): Promise<ActionResult<any>> {
    const page = args.input as CrawlPage | undefined
    const session = args.session as CrawlSession | undefined
    const selectorArg = args.selector as string | undefined
    const asArg = args.as as ExtractAs | undefined

    if (!page) {
      return this.handleFailure('Missing required arg: input')
    }

    // R-CRAWL-102: selector resolution
    if (selectorArg) {
      const as = asArg ?? 'text'
      const value = this.extractSingle(page, selectorArg, as)
      return this.handleSuccess(`Extracted with selector ${selectorArg}`, value)
    }

    if (session?.learnedSelectors?.extract?.length) {
      const result: Record<string, any> = {}
      for (const field of session.learnedSelectors.extract) {
        const fieldAs = asArg ?? field.as // R-CRAWL-105: as= override
        result[field.field] = this.extractField(page, field.selector, fieldAs)
      }
      return this.handleSuccess('Extracted with learned selectors', result)
    }

    return this.handleFailure(
      'No extract selector. Provide selector= arg or use @crawl/example first.',
    )
  }

  private extractSingle(page: CrawlPage, selector: string, as: ExtractAs): any {
    const $ = page.cheerio
    const elements = $(selector)

    if (elements.length === 0) return null

    return this.formatOutput($, elements, as, page.url)
  }

  // R-CRAWL-104: per-field extraction, null when no match
  private extractField(
    page: CrawlPage,
    selector: string,
    as: ExtractAs,
  ): any {
    const $ = page.cheerio
    const elements = $(selector)

    if (elements.length === 0) return null

    return this.formatOutput($, elements, as, page.url)
  }

  // R-CRAWL-103: output formatting
  private formatOutput(
    $: any,
    elements: any,
    as: ExtractAs,
    baseUrl: string,
  ): any {
    switch (as) {
      case 'text': {
        if (elements.length === 1) {
          return $(elements[0]).text().trim()
        }
        return elements.toArray().map((el: any) => $(el).text().trim())
      }

      case 'markdown': {
        if (elements.length === 1) {
          const html = $(elements[0]).html() ?? ''
          return turndown.turndown(html).trim()
        }
        return elements
          .toArray()
          .map((el: any) => turndown.turndown($(el).html() ?? '').trim())
      }

      case 'html': {
        if (elements.length === 1) {
          return $(elements[0]).html() ?? ''
        }
        return elements.toArray().map((el: any) => $(el).html() ?? '')
      }

      case 'images': {
        return elements.toArray().map((el: any) => {
          const src = $(el).attr('src') ?? ''
          try {
            return new URL(src, baseUrl).href
          } catch {
            return src
          }
        })
      }

      case 'links': {
        return elements.toArray().map((el: any) => {
          const href = $(el).attr('href') ?? ''
          try {
            return new URL(href, baseUrl).href
          } catch {
            return href
          }
        })
      }

      default:
        return $(elements[0]).text().trim()
    }
  }
}
