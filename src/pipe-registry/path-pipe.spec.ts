import { describe, it, expect } from 'vitest'
import { PathPipe } from './path-pipe.js'

/**
 * Theme: Formula One Race Automation
 *
 * Building file paths for saving race photos, driver bios,
 * and selection outputs using the |path pipe.
 */
describe('PathPipe', () => {
  const pipe = new PathPipe()

  it('should have id "path"', () => {
    expect(pipe.id).toBe('path')
  })

  it('should have type "pipe"', () => {
    expect(pipe.type).toBe('pipe')
  })

  describe('R-FILE-42: path behavior', () => {
    it('should join array segments with /', async () => {
      // AC-FILE-05: ["drivers", "max", "helmet.png"] -> "drivers/max/helmet.png"
      const result = await pipe.execute(['drivers', 'max', 'helmet.png'], [])
      expect(result).toBe('drivers/max/helmet.png')
    })

    it('should skip empty segments', async () => {
      const result = await pipe.execute(['images', '', 'hero.png'], [])
      expect(result).toBe('images/hero.png')
    })

    it('should normalize double slashes from trailing/leading slashes', async () => {
      const result = await pipe.execute(['images/', '/hero.png'], [])
      expect(result).toBe('images/hero.png')
    })

    it('should coerce non-strings to strings', async () => {
      const result = await pipe.execute([123, true, 'hero.png'], [])
      expect(result).toBe('123/true/hero.png')
    })

    it('should return empty string for empty array', async () => {
      const result = await pipe.execute([], [])
      expect(result).toBe('')
    })

    it('should handle path for selection pattern: ["selection/", "f1-", $index, ".png"]', async () => {
      const result = await pipe.execute(['selection/', 'f1-', 0, '.png'], [])
      expect(result).toBe('selection/f1-/0/.png')
    })

    it('should build path for race output folders', async () => {
      const result = await pipe.execute(['output', 'races', 'monaco', 'lap1.jpg'], [])
      expect(result).toBe('output/races/monaco/lap1.jpg')
    })
  })

  describe('R-FILE-43: security - reject ".." segments', () => {
    it('should reject ".." in a segment', async () => {
      // AC-FILE-06
      await expect(pipe.execute(['output', '..', 'secrets'], [])).rejects.toThrow(
        "Path pipe rejects '..' segments (security)",
      )
    })

    it('should reject ".." even when mixed with other text after coercion', async () => {
      await expect(pipe.execute(['..'], [])).rejects.toThrow(
        "Path pipe rejects '..' segments (security)",
      )
    })

    it('should reject ".." in a coerced segment', async () => {
      // A segment that is literally ".." after coercion
      await expect(pipe.execute([{ toString: () => '..' }], [])).rejects.toThrow(
        "Path pipe rejects '..' segments (security)",
      )
    })
  })

  describe('R-FILE-44: pure function (no I/O, no context)', () => {
    it('should not prepend ~/ or resolve against any root', async () => {
      const result = await pipe.execute(['photos', 'monaco.png'], [])
      expect(result).toBe('photos/monaco.png')
      expect(result).not.toContain('~/')
    })
  })

  describe('edge cases', () => {
    it('should handle single segment', async () => {
      const result = await pipe.execute(['solo.txt'], [])
      expect(result).toBe('solo.txt')
    })

    it('should handle all empty segments', async () => {
      const result = await pipe.execute(['', '', ''], [])
      expect(result).toBe('')
    })

    it('should throw for non-array input', async () => {
      await expect(pipe.execute('not-array', [])).rejects.toThrow()
    })
  })
})
