import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'
import { extractPageContent, extractPageTitle } from './content-extractor.js'

describe('content-extractor', () => {
  const fullPageHtml = `
    <html><head><title>Page Title</title></head><body>
      <nav><a href="/">Home</a><a href="/about">About</a></nav>
      <header><h2>Site Header</h2></header>
      <main>
        <h1>Main Content Title</h1>
        <p>This is the main content paragraph.</p>
        <ul><li>Item one</li><li>Item two</li></ul>
      </main>
      <footer><p>Footer text here</p></footer>
      <script>alert('hi')</script>
      <style>.hidden { display: none }</style>
    </body></html>
  `

  describe('extractPageContent', () => {
    it('should auto-detect main content and strip chrome', () => {
      const $ = cheerio.load(fullPageHtml)
      const content = extractPageContent($, 'markdown')

      expect(content).toContain('Main Content Title')
      expect(content).toContain('main content paragraph')
      // Nav, header, footer, script, style should be removed
      expect(content).not.toContain('Footer text here')
      expect(content).not.toContain("alert('hi')")
      expect(content).not.toContain('display: none')
    })

    it('should use custom selector when provided', () => {
      const html = `
        <html><body>
          <main><h1>Main</h1><p>Main content</p></main>
          <aside><h2>Sidebar</h2><p>Sidebar content</p></aside>
        </body></html>
      `
      const $ = cheerio.load(html)
      const content = extractPageContent($, 'text', 'aside')

      expect(content).toContain('Sidebar content')
      // When using selector, main content is not necessarily included
    })

    it('should return markdown format by default', () => {
      const $ = cheerio.load(fullPageHtml)
      const content = extractPageContent($, 'markdown')

      // Turndown may use setext-style (===) or atx-style (#) headings
      expect(content).toContain('Main Content Title')
      expect(content).toContain('main content paragraph')
      // Should contain list items
      expect(content).toContain('Item one')
    })

    it('should return html format when requested', () => {
      const $ = cheerio.load(fullPageHtml)
      const content = extractPageContent($, 'html')

      expect(content).toContain('<h1>')
      expect(content).toContain('<p>')
    })

    it('should return text format when requested', () => {
      const $ = cheerio.load(fullPageHtml)
      const content = extractPageContent($, 'text')

      expect(content).toContain('Main Content Title')
      expect(content).not.toContain('<h1>')
      expect(content).not.toContain('#')
    })

    it('should fallback to body when no content selectors match', () => {
      const html = `
        <html><body>
          <div class="custom-layout">
            <h1>Custom Page</h1>
            <p>Content in a custom layout</p>
          </div>
        </body></html>
      `
      const $ = cheerio.load(html)
      const content = extractPageContent($, 'markdown')

      expect(content).toContain('Custom Page')
      expect(content).toContain('Content in a custom layout')
    })
  })

  describe('extractPageTitle', () => {
    it('should prefer h1 over title tag', () => {
      const $ = cheerio.load(fullPageHtml)
      const title = extractPageTitle($, 'fallback')
      expect(title).toBe('Main Content Title')
    })

    it('should use title tag when no h1', () => {
      const html = '<html><head><title>From Title Tag</title></head><body><p>No heading</p></body></html>'
      const $ = cheerio.load(html)
      const title = extractPageTitle($, 'fallback')
      expect(title).toBe('From Title Tag')
    })

    it('should use fallback when no h1 or title', () => {
      const html = '<html><body><p>No heading or title</p></body></html>'
      const $ = cheerio.load(html)
      const title = extractPageTitle($, 'my-fallback')
      expect(title).toBe('my-fallback')
    })
  })
})
