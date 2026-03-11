import { describe, it, expect, beforeEach } from 'vitest'
import { CrawlSession } from './crawl-session.js'
import { InMemoryCrawlQueue } from '../adapter/in-memory-crawl-queue.js'
import type { CrawlSessionConfig } from '../adapter/crawl-adapter.js'

/**
 * Theme: Vintage Vinyl Record Shop
 * Marco configures crawl sessions for his prog-rock record searches.
 */

describe('CrawlSession', () => {
  let session: CrawlSession
  let queue: InMemoryCrawlQueue
  const config: CrawlSessionConfig = {
    startUrl: 'https://forum.example.com/prog-rock',
    limit: 5,
    maxRequestsPerMinute: 30,
  }

  beforeEach(() => {
    queue = new InMemoryCrawlQueue()
    session = new CrawlSession(config, queue)
  })

  describe('R-CRAWL-21: initial state', () => {
    it('should store the config', () => {
      expect(session.config).toBe(config)
      expect(session.config.startUrl).toBe('https://forum.example.com/prog-rock')
      expect(session.config.limit).toBe(5)
      expect(session.config.maxRequestsPerMinute).toBe(30)
    })

    it('should start with null learnedSelectors', () => {
      expect(session.learnedSelectors).toBeNull()
    })

    it('should start with null basePrompt', () => {
      expect(session.basePrompt).toBeNull()
    })

    it('should start with empty examplePages', () => {
      expect(session.examplePages).toEqual([])
    })

    it('should start with pageCount 0', () => {
      expect(session.pageCount).toBe(0)
    })
  })

  describe('R-CRAWL-22: hasNext with limit enforcement', () => {
    it('should return true when queue has URLs and under limit', () => {
      queue.add('https://forum.example.com/topic/1')

      expect(session.hasNext).toBe(true)
    })

    it('should return false when queue is empty', () => {
      expect(session.hasNext).toBe(false)
    })

    it('should return false when pageCount reaches limit', () => {
      queue.add('https://forum.example.com/topic/1')
      session.pageCount = 5 // matches limit of 5

      expect(session.hasNext).toBe(false)
    })

    it('should return false when pageCount exceeds limit', () => {
      queue.add('https://forum.example.com/topic/1')
      session.pageCount = 10

      expect(session.hasNext).toBe(false)
    })
  })

  describe('R-CRAWL-23: learnedSelectors', () => {
    it('should accept learned selectors', () => {
      session.learnedSelectors = {
        follow: ['a.next-page'],
        extract: [
          { field: 'title', selector: 'h2.album-title', as: 'text' },
          { field: 'artist', selector: 'span.artist', as: 'text' },
        ],
      }

      expect(session.learnedSelectors!.follow).toEqual(['a.next-page'])
      expect(session.learnedSelectors!.extract).toHaveLength(2)
      expect(session.learnedSelectors!.extract[0].field).toBe('title')
    })
  })

  describe('R-CRAWL-24: prompt inheritance via applyPrompt', () => {
    it('should set base prompt on first call', () => {
      session.applyPrompt('Extract album title and artist')

      expect(session.basePrompt).toBe('Extract album title and artist')
    })

    it('should augment prompt on subsequent calls', () => {
      session.applyPrompt('Extract album title and artist')
      session.applyPrompt('Also extract the price')

      expect(session.basePrompt).toBe(
        'Extract album title and artist\nAlso extract the price',
      )
    })

    it('should return current basePrompt', () => {
      const result = session.applyPrompt('Extract album title')

      expect(result).toBe('Extract album title')
    })

    it('should return existing basePrompt when called with undefined', () => {
      session.applyPrompt('Extract album title')
      const result = session.applyPrompt(undefined)

      expect(result).toBe('Extract album title')
    })

    it('should return null when no prompt ever set and called with undefined', () => {
      const result = session.applyPrompt(undefined)

      expect(result).toBeNull()
    })
  })
})
