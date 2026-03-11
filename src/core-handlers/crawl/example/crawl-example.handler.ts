// R-CRAWL-121 to R-CRAWL-125: @crawl/example handler

import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import type { AiProvider } from '../../ai/types.js'
import type { CrawlAdapter, LearnedSelectors } from '../adapter/crawl-adapter.js'
import type { CrawlSession } from '../session/crawl-session.js'

const SYSTEM_PROMPT = `You are a web scraping assistant. Analyze the provided HTML pages and extract CSS selectors for navigation and data extraction.

Return a JSON object with exactly this structure:
{
  "follow": ["css-selector-1", "css-selector-2"],
  "extract": [
    { "field": "fieldName", "selector": "css-selector", "as": "text|html|markdown|images|links" }
  ]
}

Rules:
- "follow" contains CSS selectors for navigation links (pagination, next page, etc.)
- "extract" contains field definitions with CSS selectors for data extraction
- "as" should be inferred from context: use "images" for image fields, "links" for link fields, "text" for short text, "markdown" for rich content
- Return ONLY valid JSON, no explanation or markdown fencing`

export class CrawlExampleHandler extends BaseCommandHandler<LearnedSelectors> {
  private adapter: CrawlAdapter
  private aiProvider: AiProvider

  constructor(adapter: CrawlAdapter, aiProvider: AiProvider) {
    super('@crawl/example')
    this.adapter = adapter
    this.aiProvider = aiProvider
  }

  async run(
    args: Record<string, any>,
    _context: ExecutionContext,
  ): Promise<ActionResult<LearnedSelectors>> {
    const url = args.url as string | undefined
    const session = args.session as CrawlSession | undefined
    const promptArg = args.prompt as string | undefined

    if (!url) {
      return this.handleFailure('Missing required arg: url')
    }
    if (!session) {
      return this.handleFailure('Missing required arg: session')
    }

    // R-CRAWL-122: fetch the example page
    const page = await this.adapter.fetch(url)

    // R-CRAWL-125: fail on fetch error
    if (page.status >= 400) {
      return this.handleFailure(`Failed to fetch example page: ${page.status}`)
    }

    // R-CRAWL-122: prompt inheritance
    const effectivePrompt = session.applyPrompt(promptArg)
    if (!effectivePrompt) {
      return this.handleFailure('First @crawl/example requires a prompt= arg')
    }

    // Add page to examples
    session.examplePages.push(page)

    // R-CRAWL-123: call AI with all example pages
    const allHtml = session.examplePages
      .map((p, i) => `--- Page ${i + 1}: ${p.url} ---\n${p.html}`)
      .join('\n\n')

    try {
      const aiResult = await this.aiProvider.generateText({
        prompt: `${effectivePrompt}\n\nHTML content:\n${allHtml}`,
        system: SYSTEM_PROMPT,
      })

      const selectors = JSON.parse(aiResult.text) as LearnedSelectors
      session.learnedSelectors = selectors

      return this.handleSuccess(
        `Learned selectors from ${session.examplePages.length} example(s)`,
        selectors,
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return this.handleFailure(`AI selector learning failed: ${msg}`)
    }
  }
}
