/**
 * Integration test: @crawl commands against a real website
 *
 * Target: https://www.robusta.build/learn
 * A blog listing page with article cards. Each card has:
 * - Title: .font-alt.little-bar.text-2xl
 * - "Read More" span: .btn.btn-secondary
 * - Wrapping <a> with href to the article
 *
 * This test proves the full crawl pipeline works against real HTML
 * served over the network: fetch, extract, follow — no mocks.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { SimpleCrawlAdapter } from './adapter/simple-crawl-adapter.js'
import { CrawlFetchHandler } from './fetch/crawl-fetch.handler.js'
import { CrawlExtractHandler } from './extract/crawl-extract.handler.js'
import { CrawlFollowHandler } from './follow/crawl-follow.handler.js'
import { CrawlPageHandler } from './page/crawl-page.handler.js'
import { SessionOpenHandler } from './session/session-open.handler.js'
import { createEmptyExecutionContext } from '@massivoto/kit'
import type { CrawlPage } from './adapter/crawl-adapter.js'
import type { CrawlSession } from './session/crawl-session.js'

const LEARN_URL = 'https://www.robusta.build/learn'

describe('Real website crawl: robusta.build/learn', () => {
  const adapter = new SimpleCrawlAdapter()
  const ctx = createEmptyExecutionContext('test-user')

  // Handlers
  const fetchHandler = new CrawlFetchHandler(adapter)
  const extractHandler = new CrawlExtractHandler()
  const followHandler = new CrawlFollowHandler()
  const sessionOpenHandler = new SessionOpenHandler(adapter)
  const pageHandler = new CrawlPageHandler(adapter)

  // ------------------------------------------------------------------
  // @crawl/fetch — one-shot
  // ------------------------------------------------------------------

  describe('@crawl/fetch one-shot', () => {
    it('fetches the page as markdown by default', async () => {
      const result = await fetchHandler.run({ url: LEARN_URL }, ctx)

      expect(result.success).toBe(true)
      expect(typeof result.value).toBe('string')
      expect(result.value.length).toBeGreaterThan(100)
      // Markdown should contain some readable text, not raw HTML tags
      expect(result.value).not.toContain('<!DOCTYPE')
    }, 15_000)

    it('extracts article titles with CSS selector', async () => {
      const result = await fetchHandler.run(
        { url: LEARN_URL, selector: '.font-alt.little-bar.text-2xl', as: 'text' },
        ctx,
      )

      expect(result.success).toBe(true)
      // Should be an array of title strings
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.value.length).toBeGreaterThan(3)
      // Each title should be a non-empty string
      for (const title of result.value) {
        expect(typeof title).toBe('string')
        expect(title.length).toBeGreaterThan(0)
      }
      console.log(`Found ${result.value.length} article titles:`, result.value.slice(0, 5))
    }, 15_000)

    it('extracts article links', async () => {
      const result = await fetchHandler.run(
        { url: LEARN_URL, selector: 'a[href*="/learn/"]', as: 'links' },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.value.length).toBeGreaterThan(3)
      // Each link should be an absolute URL to a learn article
      for (const link of result.value) {
        expect(link).toContain('robusta.build/learn/')
      }
      console.log(`Found ${result.value.length} article links:`, result.value.slice(0, 5))
    }, 15_000)
  })

  // ------------------------------------------------------------------
  // Full session loop: open → page → extract → follow
  // ------------------------------------------------------------------

  describe('session loop: open → page → extract → follow', () => {
    let session: CrawlSession
    let firstPage: CrawlPage

    it('opens a session on the learn page', async () => {
      const result = await sessionOpenHandler.run(
        { url: LEARN_URL, limit: 3 },
        ctx,
      )

      expect(result.success).toBe(true)
      session = result.value!
      expect(session.hasNext).toBe(true)
    })

    it('fetches the first page from the queue', async () => {
      const result = await pageHandler.run({ session }, ctx)

      expect(result.success).toBe(true)
      firstPage = result.value!
      expect(firstPage.status).toBe(200)
      expect(firstPage.url).toBe(LEARN_URL)
      expect(session.pageCount).toBe(1)
    }, 15_000)

    it('extracts article titles from the fetched page', async () => {
      const result = await extractHandler.run(
        { input: firstPage, selector: '.font-alt.little-bar.text-2xl', as: 'text' },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.value.length).toBeGreaterThan(3)
      console.log('Extracted titles:', result.value.slice(0, 5))
    })

    it('follows "Read More" links to article pages', async () => {
      const result = await followHandler.run(
        { session, input: firstPage, follow: 'Read More' },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.value!.length).toBeGreaterThan(0)
      // All URLs should be on robusta.build
      for (const url of result.value!) {
        expect(url).toContain('robusta.build')
      }
      console.log(`Followed ${result.value!.length} "Read More" links:`, result.value!.slice(0, 3))
    })

    it('fetches a second page (an article) from the queue', async () => {
      expect(session.hasNext).toBe(true)

      const result = await pageHandler.run({ session }, ctx)

      expect(result.success).toBe(true)
      const articlePage = result.value!
      expect(articlePage.status).toBe(200)
      expect(articlePage.url).toContain('robusta.build/learn/')
      expect(session.pageCount).toBe(2)
      console.log('Fetched article:', articlePage.url)
    }, 15_000)

    it('stops after hitting the limit', async () => {
      // Limit is 3, we fetched 2, fetch one more
      if (session.hasNext) {
        await pageHandler.run({ session }, ctx)
      }
      expect(session.pageCount).toBe(3)
      expect(session.hasNext).toBe(false)
    }, 15_000)
  })
})
