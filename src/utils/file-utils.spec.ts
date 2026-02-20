import { describe, it, expect } from 'vitest'
import { mimeTypeFromExtension, toImageData, readFile } from './file-utils.js'
import type { OtoFile } from './file-utils.js'
import { join } from 'node:path'

describe('mimeTypeFromExtension', () => {
  it('should detect png', () => {
    expect(mimeTypeFromExtension('photo.png')).toBe('image/png')
  })

  it('should detect jpg', () => {
    expect(mimeTypeFromExtension('photo.jpg')).toBe('image/jpeg')
  })

  it('should detect jpeg', () => {
    expect(mimeTypeFromExtension('photo.jpeg')).toBe('image/jpeg')
  })

  it('should detect webp', () => {
    expect(mimeTypeFromExtension('photo.webp')).toBe('image/webp')
  })

  it('should detect gif', () => {
    expect(mimeTypeFromExtension('anim.gif')).toBe('image/gif')
  })

  it('should be case-insensitive', () => {
    expect(mimeTypeFromExtension('PHOTO.PNG')).toBe('image/png')
    expect(mimeTypeFromExtension('photo.JPG')).toBe('image/jpeg')
  })

  it('should return octet-stream for unknown extensions', () => {
    expect(mimeTypeFromExtension('data.xyz')).toBe('application/octet-stream')
  })

  it('should handle paths with directories', () => {
    expect(mimeTypeFromExtension('~/images/races/f1.png')).toBe('image/png')
  })
})

describe('toImageData', () => {
  it('should handle raw base64 string with default png mimeType', () => {
    const result = toImageData('iVBORw0KGgoAAAANSUhEUg==')
    expect(result.base64).toBe('iVBORw0KGgoAAAANSUhEUg==')
    expect(result.mimeType).toBe('image/png')
  })

  it('should extract base64 and mimeType from OtoFile', () => {
    const file: OtoFile = {
      path: '~/photos/emma-portrait.jpg',
      base64: '/9j/4AAQSkZJRgABAQ==',
      mimeType: 'image/jpeg',
      size: 1024,
    }
    const result = toImageData(file)
    expect(result.base64).toBe('/9j/4AAQSkZJRgABAQ==')
    expect(result.mimeType).toBe('image/jpeg')
  })

  it('should throw on invalid input (number)', () => {
    expect(() => toImageData(42)).toThrow('Invalid image')
  })

  it('should throw on invalid input (null)', () => {
    expect(() => toImageData(null)).toThrow('Invalid image')
  })

  it('should throw on invalid input (object without base64)', () => {
    expect(() => toImageData({ path: '~/photo.png' })).toThrow('Invalid image')
  })
})

describe('readFile', () => {
  it('should read a fixture file and return OtoFile', async () => {
    const fixturePath = join(import.meta.dirname, 'fixtures', 'tiny.png')
    const file = await readFile(fixturePath)

    expect(file.path).toBe(fixturePath)
    expect(file.mimeType).toBe('image/png')
    expect(file.size).toBeGreaterThan(0)
    expect(file.base64.length).toBeGreaterThan(0)
  })

  it('should detect jpeg mimeType from extension', async () => {
    const fixturePath = join(import.meta.dirname, 'fixtures', 'tiny.jpg')
    const file = await readFile(fixturePath)

    expect(file.mimeType).toBe('image/jpeg')
    expect(file.size).toBeGreaterThan(0)
  })
})
