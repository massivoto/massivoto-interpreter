// R-DIR-01 to R-DIR-60: @crawl/directory handler
// High-level orchestrator that crawls an entire website and saves pages to a directory.

import fs from 'fs/promises'
import path from 'path'
import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import type { CrawlAdapter, CrawlPage, ExtractAs } from '../adapter/crawl-adapter.js'
import { CrawlSession } from '../session/crawl-session.js'
import { extractPageContent, extractPageTitle } from './content-extractor.js'
import { isCssSelector } from '../follow/selector-resolver.js'

export interface CrawlDirectoryResult {
  pagesTotal: number
  pagesSaved: number
  pagesSkipped: number
  outputDir: string
  indexFile: string
}

interface CrawledPage {
  title: string
  url: string
  relativePath: string
}

const FORMAT_EXTENSIONS: Record<string, string> = {
  markdown: '.md',
  html: '.html',
  text: '.txt',
}

export class CrawlDirectoryHandler extends BaseCommandHandler<CrawlDirectoryResult> {
  private adapter: CrawlAdapter

  constructor(adapter: CrawlAdapter) {
    super('@crawl/directory')
    this.adapter = adapter
  }

  async run(
    args: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ActionResult<CrawlDirectoryResult>> {
    // R-DIR-02: validate required params
    const url = args.url as string | undefined
    if (!url) {
      return this.handleFailure('Missing required arg: url')
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return this.handleFailure(`Invalid URL: ${url}. Must start with http:// or https://`)
    }

    const outputArg = args.output as string | undefined
    if (!outputArg) {
      return this.handleFailure('Missing required arg: output')
    }

    // R-DIR-03: optional params
    const format = (args.as as ExtractAs | undefined) ?? 'markdown'
    const limit = (args.limit as number | undefined) ?? 500
    const maxDepth = (args.depth as number | undefined) ?? 3
    const delay = (args.delay as number | undefined) ?? 300
    const selector = args.selector as string | undefined
    const followArg = args.follow as string | undefined

    // Resolve output directory
    let outputDir: string
    if (path.isAbsolute(outputArg)) {
      outputDir = outputArg
    } else {
      const projectRoot = context.fileSystem?.projectRoot
      if (!projectRoot) {
        return this.handleFailure(
          'output= is a relative path but no projectRoot is configured. Use an absolute path or configure fileSystem.projectRoot in the runner.',
        )
      }
      outputDir = path.resolve(projectRoot, outputArg)
    }

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true })

    // R-DIR-10: create session and run crawl loop
    const queue = this.adapter.createQueue()
    const session = new CrawlSession(
      { startUrl: url, limit, maxRequestsPerMinute: Math.ceil(60000 / delay) },
      queue,
    )
    queue.add(url)

    // R-DIR-40: depth tracking
    const depthMap = new Map<string, number>()
    depthMap.set(url, 0)

    const baseUrl = new URL(url)
    const baseDomain = baseUrl.hostname
    const basePath = this.getBaseDirectory(baseUrl)

    const crawledPages: CrawledPage[] = []
    let pagesTotal = 0
    let pagesSaved = 0
    let pagesSkipped = 0

    while (session.hasNext) {
      const nextUrl = queue.next()
      if (!nextUrl) break

      session.pageCount++
      pagesTotal++

      const currentDepth = depthMap.get(nextUrl) ?? 0

      // Fetch page
      const page = await this.adapter.fetch(nextUrl)

      // Skip HTTP errors
      if (page.status === 0 || page.status >= 400) {
        pagesSkipped++
        if (delay > 0) await this.sleep(delay)
        continue
      }

      // Skip non-HTML content
      if (!page.contentType.includes('text/html') && !page.contentType.includes('application/xhtml')) {
        pagesSkipped++
        if (delay > 0) await this.sleep(delay)
        continue
      }

      // R-DIR-20: extract content
      const content = extractPageContent(page.cheerio, format, selector)
      const title = extractPageTitle(page.cheerio, this.titleFromUrl(nextUrl))

      // R-DIR-30: save to file
      const relativePath = this.urlToFilePath(nextUrl, basePath, format)
      const absolutePath = path.join(outputDir, relativePath)

      try {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true })

        const fileContent = this.buildFileContent(title, nextUrl, content, format)
        await fs.writeFile(absolutePath, fileContent, 'utf-8')

        crawledPages.push({ title, url: nextUrl, relativePath })
        pagesSaved++
      } catch {
        pagesSkipped++
      }

      // R-DIR-40: follow links
      if (currentDepth < maxDepth) {
        const newUrls = this.extractLinks(page, baseDomain, followArg)
        for (const newUrl of newUrls) {
          if (!depthMap.has(newUrl)) {
            depthMap.set(newUrl, currentDepth + 1)
            queue.add(newUrl)
          }
        }
      }

      // Rate limiting
      if (delay > 0 && session.hasNext) {
        await this.sleep(delay)
      }
    }

    // R-DIR-31: create index file
    const indexPath = path.join(outputDir, '_index.md')
    const indexContent = this.buildIndex(baseDomain, crawledPages)
    await fs.writeFile(indexPath, indexContent, 'utf-8')

    const result: CrawlDirectoryResult = {
      pagesTotal,
      pagesSaved,
      pagesSkipped,
      outputDir,
      indexFile: indexPath,
    }

    return this.handleSuccess(
      `Crawled ${pagesTotal} pages, saved ${pagesSaved} to ${outputDir}`,
      result,
    )
  }

  private extractLinks(
    page: CrawlPage,
    baseDomain: string,
    followArg?: string,
  ): string[] {
    const $ = page.cheerio
    const urls: string[] = []

    // Determine which elements to search for links
    let elements: any
    if (followArg && isCssSelector(followArg)) {
      elements = $(followArg)
    } else {
      elements = $('a[href]')
    }

    elements.each((_: number, el: any) => {
      const href = $(el).attr('href')
      if (!href) return

      // Skip anchors, javascript, mailto
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return

      try {
        const resolved = new URL(href, page.url).href
        const resolvedUrl = new URL(resolved)

        // Same-domain filter
        if (resolvedUrl.hostname !== baseDomain) return

        // Strip hash fragment
        resolvedUrl.hash = ''
        urls.push(resolvedUrl.href)
      } catch {
        // Skip invalid URLs
      }
    })

    return [...new Set(urls)]
  }

  private getBaseDirectory(baseUrl: URL): string {
    const pathParts = baseUrl.pathname.split('/')
    // If the URL ends with a file (has extension), use its parent directory
    const lastPart = pathParts[pathParts.length - 1]
    if (lastPart && lastPart.includes('.')) {
      pathParts.pop()
    }
    return pathParts.join('/')
  }

  private urlToFilePath(url: string, basePath: string, format: ExtractAs): string {
    const parsedUrl = new URL(url)
    let urlPath = parsedUrl.pathname

    // Make path relative to base path
    if (urlPath.startsWith(basePath)) {
      urlPath = urlPath.slice(basePath.length)
    }

    // Remove leading slash
    if (urlPath.startsWith('/')) {
      urlPath = urlPath.slice(1)
    }

    // Handle empty path or directory path
    if (!urlPath || urlPath.endsWith('/')) {
      urlPath = urlPath + 'index'
    }

    // Replace extension
    const ext = FORMAT_EXTENSIONS[format] ?? '.md'
    urlPath = urlPath.replace(/\.(html?|php|asp|aspx|jsp)$/i, '')
    urlPath = urlPath + ext

    // Sanitize
    return urlPath.replace(/[?%*:|"<>]/g, '_')
  }

  private titleFromUrl(url: string): string {
    try {
      const parsed = new URL(url)
      const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() ?? ''
      return lastSegment.replace(/\.(html?|php|asp)$/i, '').replace(/[-_]/g, ' ')
    } catch {
      return 'Untitled'
    }
  }

  private buildFileContent(
    title: string,
    url: string,
    content: string,
    format: ExtractAs,
  ): string {
    const frontmatter = `---\ntitle: "${title.replace(/"/g, '\\"')}"\nurl: ${url}\n---\n\n`

    // Only add frontmatter for markdown and text
    if (format === 'html') {
      return `<!-- title: ${title} -->\n<!-- url: ${url} -->\n${content}`
    }

    return frontmatter + content
  }

  private buildIndex(domain: string, pages: CrawledPage[]): string {
    const lines = [
      `# ${domain} - Crawled Pages`,
      '',
      `${pages.length} pages crawled.`,
      '',
    ]

    for (const page of pages) {
      const linkPath = page.relativePath.replace(/\\/g, '/')
      lines.push(`- [${page.title}](${linkPath})`)
    }

    lines.push('')
    return lines.join('\n')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
