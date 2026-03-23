import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CrawlDirectoryHandler } from './crawl-directory.handler.js'
import { MockCrawlAdapter } from '../adapter/mock-crawl-adapter.js'
import { createEmptyExecutionContext } from '@massivoto/kit'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

/**
 * Theme: Vintage Vinyl Record Shop (consistent with existing crawl tests)
 * Marco wants to download an entire vinyl collector site as markdown files.
 */

describe('CrawlDirectoryHandler', () => {
  let handler: CrawlDirectoryHandler
  let adapter: MockCrawlAdapter
  let outputDir: string

  const homePageHtml = `
    <html><head><title>Vinyl Paradise</title></head><body>
      <nav><a href="/">Home</a><a href="/catalog">Catalog</a></nav>
      <main>
        <h1>Vinyl Paradise</h1>
        <p>The best vintage vinyl records online.</p>
        <a href="/catalog/rock">Rock Collection</a>
        <a href="/catalog/jazz">Jazz Collection</a>
      </main>
      <footer><p>Copyright 2026</p></footer>
    </body></html>
  `

  const rockPageHtml = `
    <html><head><title>Rock Collection</title></head><body>
      <nav><a href="/">Home</a></nav>
      <main>
        <h1>Rock Collection</h1>
        <p>Classic rock vinyl records from the 70s and 80s.</p>
        <div class="album">
          <h2>Wish You Were Here</h2>
          <span class="price">$38</span>
        </div>
        <a href="/catalog/rock/pink-floyd">Pink Floyd Albums</a>
      </main>
      <footer><p>Copyright 2026</p></footer>
    </body></html>
  `

  const jazzPageHtml = `
    <html><head><title>Jazz Collection</title></head><body>
      <nav><a href="/">Home</a></nav>
      <main>
        <h1>Jazz Collection</h1>
        <p>Smooth jazz vinyl records.</p>
      </main>
      <footer><p>Copyright 2026</p></footer>
    </body></html>
  `

  const pinkFloydPageHtml = `
    <html><head><title>Pink Floyd Albums</title></head><body>
      <nav><a href="/">Home</a></nav>
      <main>
        <h1>Pink Floyd Albums</h1>
        <p>All Pink Floyd vinyl records in our collection.</p>
        <a href="/catalog/rock/pink-floyd/the-wall">The Wall</a>
      </main>
      <footer><p>Copyright 2026</p></footer>
    </body></html>
  `

  const theWallPageHtml = `
    <html><head><title>The Wall</title></head><body>
      <nav><a href="/">Home</a></nav>
      <main>
        <h1>The Wall</h1>
        <p>Original 1979 double LP. Mint condition. $120.</p>
      </main>
      <footer><p>Copyright 2026</p></footer>
    </body></html>
  `

  beforeEach(async () => {
    adapter = new MockCrawlAdapter()

    adapter.addPage('https://vinyl-paradise.example.com/', homePageHtml)
    adapter.addPage('https://vinyl-paradise.example.com/catalog/rock', rockPageHtml)
    adapter.addPage('https://vinyl-paradise.example.com/catalog/jazz', jazzPageHtml)
    adapter.addPage('https://vinyl-paradise.example.com/catalog/rock/pink-floyd', pinkFloydPageHtml)
    adapter.addPage('https://vinyl-paradise.example.com/catalog/rock/pink-floyd/the-wall', theWallPageHtml)

    handler = new CrawlDirectoryHandler(adapter)
    outputDir = path.join(os.tmpdir(), `crawl-test-${Date.now()}`)
  })

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('R-DIR-01: handler identity', () => {
    it('should have id @crawl/directory', () => {
      expect(handler.id).toBe('@crawl/directory')
    })
  })

  describe('R-DIR-02 + R-DIR-60: required parameter validation', () => {
    it('should fail when url is missing', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run({ output: outputDir }, ctx)
      expect(result.success).toBe(false)
      expect(result.message).toContain('url')
    })

    it('should fail when url is invalid', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run({ url: 'ftp://bad', output: outputDir }, ctx)
      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid URL')
    })

    it('should fail when output is missing', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run({ url: 'https://vinyl-paradise.example.com/' }, ctx)
      expect(result.success).toBe(false)
      expect(result.message).toContain('output')
    })
  })

  describe('R-DIR-10 + R-DIR-20 + R-DIR-30: single page crawl', () => {
    it('should crawl a single page and save as markdown', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          limit: 1,
          delay: 0,
        },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(result.value!.pagesSaved).toBe(1)
      expect(result.value!.pagesTotal).toBe(1)

      // Check file was saved
      const indexFile = await fs.readFile(path.join(outputDir, 'index.md'), 'utf-8')
      expect(indexFile).toContain('Vinyl Paradise')
      expect(indexFile).toContain('vinyl-paradise.example.com')
    })

    it('should strip navigation chrome in auto-detect mode', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          limit: 1,
          delay: 0,
        },
        ctx,
      )

      expect(result.success).toBe(true)
      const file = await fs.readFile(path.join(outputDir, 'index.md'), 'utf-8')
      // Main content should be present
      expect(file).toContain('best vintage vinyl records')
      // Nav content should be stripped (nav tag is removed, and "Catalog" link is in nav)
      // Footer copyright should be stripped
      expect(file).not.toContain('Copyright 2026')
    })

    it('should use custom selector when provided', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/catalog/rock',
          output: outputDir,
          limit: 1,
          delay: 0,
          selector: '.album',
        },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(result.value!.pagesSaved).toBe(1)
      // Start URL /catalog/rock becomes index.md (base path = /catalog/rock)
      const file = await fs.readFile(path.join(outputDir, 'index.md'), 'utf-8')
      expect(file).toContain('Wish You Were Here')
      expect(file).toContain('$38')
    })
  })

  describe('R-DIR-40: link following with depth', () => {
    it('should follow links to crawl multiple pages', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          depth: 1,
          delay: 0,
        },
        ctx,
      )

      expect(result.success).toBe(true)
      // Home page (depth 0) + rock + jazz (depth 1) + catalog link
      expect(result.value!.pagesSaved).toBeGreaterThanOrEqual(2)
    })

    it('should respect depth limit', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          depth: 0,
          delay: 0,
        },
        ctx,
      )

      expect(result.success).toBe(true)
      // Only the start page (depth 0), no links followed
      expect(result.value!.pagesSaved).toBe(1)
    })

    it('should respect page limit', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          limit: 2,
          depth: 5,
          delay: 0,
        },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(result.value!.pagesTotal).toBeLessThanOrEqual(2)
    })
  })

  describe('R-DIR-31: index file', () => {
    it('should create _index.md with all crawled pages', async () => {
      const ctx = createEmptyExecutionContext('marco')
      await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          depth: 1,
          delay: 0,
        },
        ctx,
      )

      const indexContent = await fs.readFile(path.join(outputDir, '_index.md'), 'utf-8')
      expect(indexContent).toContain('vinyl-paradise.example.com')
      expect(indexContent).toContain('Vinyl Paradise')
      expect(indexContent).toContain('pages crawled')
    })
  })

  describe('R-DIR-03: output format options', () => {
    it('should save as html when as=html', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          limit: 1,
          delay: 0,
          as: 'html',
        },
        ctx,
      )

      expect(result.success).toBe(true)
      const file = await fs.readFile(path.join(outputDir, 'index.html'), 'utf-8')
      expect(file).toContain('<h1>')
      expect(file).toContain('<!-- title:')
    })

    it('should save as text when as=text', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          limit: 1,
          delay: 0,
          as: 'text',
        },
        ctx,
      )

      expect(result.success).toBe(true)
      const file = await fs.readFile(path.join(outputDir, 'index.txt'), 'utf-8')
      expect(file).toContain('Vinyl Paradise')
      expect(file).not.toContain('<h1>')
    })
  })

  describe('R-DIR-60: error handling', () => {
    it('should skip pages with HTTP errors and continue', async () => {
      adapter.addPage('https://vinyl-paradise.example.com/broken', '', 500)
      // Replace home page HTML with a link to the broken page
      const homeWithBrokenLink = `
        <html><head><title>Test</title></head><body>
          <main>
            <h1>Test Page</h1>
            <a href="/broken">Broken Link</a>
            <a href="/catalog/jazz">Jazz</a>
          </main>
        </body></html>
      `
      adapter.addPage('https://vinyl-paradise.example.com/', homeWithBrokenLink)

      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          depth: 1,
          delay: 0,
        },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(result.value!.pagesSkipped).toBeGreaterThanOrEqual(1)
      expect(result.value!.pagesSaved).toBeGreaterThanOrEqual(1)
    })

    it('should fail when relative output path has no projectRoot', async () => {
      const ctx = createEmptyExecutionContext('marco')
      // No fileSystem.projectRoot set
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: './relative/path',
        },
        ctx,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('projectRoot')
    })
  })

  describe('R-DIR-50: return value', () => {
    it('should return correct CrawlDirectoryResult', async () => {
      const ctx = createEmptyExecutionContext('marco')
      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: outputDir,
          limit: 1,
          delay: 0,
        },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(result.value).toMatchObject({
        pagesTotal: 1,
        pagesSaved: 1,
        pagesSkipped: 0,
        outputDir,
      })
      expect(result.value!.indexFile).toContain('_index.md')
    })
  })

  describe('R-DIR-30: relative output with projectRoot', () => {
    it('should resolve relative output against projectRoot', async () => {
      const ctx = createEmptyExecutionContext('marco')
      ctx.fileSystem = { projectRoot: outputDir }

      // Create the output dir so we have a valid projectRoot
      await fs.mkdir(outputDir, { recursive: true })

      const result = await handler.run(
        {
          url: 'https://vinyl-paradise.example.com/',
          output: 'crawled-site',
          limit: 1,
          delay: 0,
        },
        ctx,
      )

      expect(result.success).toBe(true)
      const expectedDir = path.join(outputDir, 'crawled-site')
      expect(result.value!.outputDir).toBe(expectedDir)

      // Verify files exist
      const files = await fs.readdir(expectedDir)
      expect(files).toContain('index.md')
      expect(files).toContain('_index.md')
    })
  })
})
