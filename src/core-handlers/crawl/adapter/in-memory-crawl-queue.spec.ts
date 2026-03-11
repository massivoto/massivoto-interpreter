import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCrawlQueue } from './in-memory-crawl-queue.js'

/**
 * Theme: Vintage Vinyl Record Shop
 * Marco queues URLs from his favorite prog-rock forums.
 */

describe('InMemoryCrawlQueue', () => {
  let queue: InMemoryCrawlQueue

  beforeEach(() => {
    queue = new InMemoryCrawlQueue()
  })

  describe('R-CRAWL-04: deduplication', () => {
    it('should add a URL and retrieve it with next()', () => {
      queue.add('https://vinyl-forum.example.com/topic/1')

      expect(queue.next()).toBe('https://vinyl-forum.example.com/topic/1')
    })

    it('should return null when queue is empty', () => {
      expect(queue.next()).toBeNull()
    })

    it('should skip duplicate URLs', () => {
      queue.add('https://vinyl-forum.example.com/topic/1')
      queue.add('https://vinyl-forum.example.com/topic/1')

      expect(queue.size()).toBe(1)
    })

    it('should skip already visited URLs', () => {
      queue.add('https://vinyl-forum.example.com/topic/1')
      queue.next() // visits it

      queue.add('https://vinyl-forum.example.com/topic/1')
      expect(queue.hasNext()).toBe(false)
    })

    it('should track visited URLs after next()', () => {
      queue.add('https://vinyl-forum.example.com/topic/1')
      queue.next()

      expect(queue.isVisited('https://vinyl-forum.example.com/topic/1')).toBe(true)
    })
  })

  describe('addMany()', () => {
    it('should add multiple URLs at once', () => {
      queue.addMany([
        'https://vinyl-forum.example.com/topic/1',
        'https://vinyl-forum.example.com/topic/2',
        'https://vinyl-forum.example.com/topic/3',
      ])

      expect(queue.size()).toBe(3)
    })

    it('should deduplicate within addMany batch', () => {
      queue.addMany([
        'https://vinyl-forum.example.com/topic/1',
        'https://vinyl-forum.example.com/topic/1',
      ])

      expect(queue.size()).toBe(1)
    })
  })

  describe('hasNext() and size()', () => {
    it('should report hasNext correctly', () => {
      expect(queue.hasNext()).toBe(false)

      queue.add('https://vinyl-forum.example.com/topic/1')
      expect(queue.hasNext()).toBe(true)

      queue.next()
      expect(queue.hasNext()).toBe(false)
    })

    it('should report size correctly as URLs are consumed', () => {
      queue.addMany([
        'https://vinyl-forum.example.com/topic/1',
        'https://vinyl-forum.example.com/topic/2',
      ])
      expect(queue.size()).toBe(2)

      queue.next()
      expect(queue.size()).toBe(1)
    })
  })

  describe('markVisited()', () => {
    it('should manually mark a URL as visited', () => {
      queue.markVisited('https://vinyl-forum.example.com/topic/1')

      expect(queue.isVisited('https://vinyl-forum.example.com/topic/1')).toBe(true)
    })

    it('should prevent add() after markVisited()', () => {
      queue.markVisited('https://vinyl-forum.example.com/topic/1')
      queue.add('https://vinyl-forum.example.com/topic/1')

      expect(queue.hasNext()).toBe(false)
    })
  })
})
