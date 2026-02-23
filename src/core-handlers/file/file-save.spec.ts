import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { FileSaveHandler } from './file-save.handler.js'
import { createEmptyExecutionContext, ExecutionContext } from '@massivoto/kit'

/**
 * Theme: Formula One Race Automation
 *
 * Saving race data, driver bios, and selection outputs.
 * Max's F1 project organizes files by race and driver.
 */

let tmpDir: string
let handler: FileSaveHandler
let context: ExecutionContext

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-save-'))
  handler = new FileSaveHandler()
  context = createEmptyExecutionContext('max-33')
  context.fileSystem = { projectRoot: tmpDir }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('FileSaveHandler', () => {
  it('should have id @file/save', () => {
    expect(handler.id).toBe('@file/save')
  })

  describe('R-FILE-62: string data -> UTF-8 text', () => {
    it('AC-FILE-07: should save string content to file', async () => {
      const result = await handler.run(
        {
          data: 'Red Bull racing helmet with #1',
          file: 'drivers/max/bio.txt',
        },
        context,
      )

      expect(result.success).toBe(true)
      const filePath = path.join(tmpDir, 'drivers/max/bio.txt')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toBe('Red Bull racing helmet with #1')
    })
  })

  describe('R-FILE-62: object data -> JSON', () => {
    it('AC-FILE-08: should save object as pretty-printed JSON', async () => {
      const result = await handler.run(
        {
          data: { winner: 'Max', laps: 53 },
          file: 'output/race.json',
        },
        context,
      )

      expect(result.success).toBe(true)
      const filePath = path.join(tmpDir, 'output/race.json')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(JSON.parse(content)).toEqual({ winner: 'Max', laps: 53 })
      expect(content).toContain('  ')
    })
  })

  describe('R-FILE-62: array data -> JSON', () => {
    it('should save array as pretty-printed JSON', async () => {
      const result = await handler.run(
        {
          data: ['Verstappen', 'Hamilton', 'Leclerc'],
          file: 'output/podium.json',
        },
        context,
      )

      expect(result.success).toBe(true)
      const content = fs.readFileSync(path.join(tmpDir, 'output/podium.json'), 'utf-8')
      expect(JSON.parse(content)).toEqual(['Verstappen', 'Hamilton', 'Leclerc'])
    })
  })

  describe('R-FILE-62: Buffer data -> binary', () => {
    it('should save Buffer as binary', async () => {
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47])
      const result = await handler.run(
        {
          data: binaryData,
          file: 'output/race.png',
        },
        context,
      )

      expect(result.success).toBe(true)
      const content = fs.readFileSync(path.join(tmpDir, 'output/race.png'))
      expect(Buffer.compare(content, binaryData)).toBe(0)
    })

    it('should save Uint8Array as binary', async () => {
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      const result = await handler.run(
        {
          data: binaryData,
          file: 'output/race.png',
        },
        context,
      )

      expect(result.success).toBe(true)
      const content = fs.readFileSync(path.join(tmpDir, 'output/race.png'))
      expect(content[0]).toBe(0x89)
    })
  })

  describe('R-FILE-62: FileReference data -> copy file', () => {
    it('should copy source file to destination', async () => {
      const sourceDir = path.join(tmpDir, 'source')
      fs.mkdirSync(sourceDir, { recursive: true })
      fs.writeFileSync(path.join(sourceDir, 'original.png'), 'image-data')

      const result = await handler.run(
        {
          data: {
            type: 'file-ref',
            relativePath: 'source/original.png',
            absolutePath: path.join(tmpDir, 'source/original.png'),
          },
          file: 'output/copy.png',
        },
        context,
      )

      expect(result.success).toBe(true)
      const content = fs.readFileSync(path.join(tmpDir, 'output/copy.png'), 'utf-8')
      expect(content).toBe('image-data')
    })
  })

  describe('R-FILE-63: parent directory creation', () => {
    it('AC-FILE-09: should create parent directories recursively', async () => {
      const result = await handler.run(
        {
          data: 'deep nested content',
          file: 'output/deep/nested/result.txt',
        },
        context,
      )

      expect(result.success).toBe(true)
      const filePath = path.join(tmpDir, 'output/deep/nested/result.txt')
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  describe('R-FILE-64: path resolution', () => {
    it('should resolve FileReference file arg', async () => {
      const result = await handler.run(
        {
          data: 'test content',
          file: {
            type: 'file-ref',
            relativePath: 'output/ref.txt',
            absolutePath: path.join(tmpDir, 'output/ref.txt'),
          },
        },
        context,
      )

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tmpDir, 'output/ref.txt'))).toBe(true)
    })

    it('should resolve ~/ prefixed string', async () => {
      const result = await handler.run(
        {
          data: 'test content',
          file: '~/output/tilde.txt',
        },
        context,
      )

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tmpDir, 'output/tilde.txt'))).toBe(true)
    })

    it('should resolve relative string from |path pipe', async () => {
      const result = await handler.run(
        {
          data: 'pipe output',
          file: 'selection/f1-0.png',
        },
        context,
      )

      expect(result.success).toBe(true)
      expect(fs.existsSync(path.join(tmpDir, 'selection/f1-0.png'))).toBe(true)
    })
  })

  describe('error cases', () => {
    it('should fail when file arg is missing', async () => {
      const result = await handler.run(
        { data: 'content' },
        context,
      )

      expect(result.success).toBe(false)
    })

    it('should fail when data arg is missing', async () => {
      const result = await handler.run(
        { file: 'output/test.txt' },
        context,
      )

      expect(result.success).toBe(false)
    })

    it('should fail when fileSystem.projectRoot is not set for relative paths', async () => {
      const noFsContext = createEmptyExecutionContext('max-33')

      const result = await handler.run(
        {
          data: 'content',
          file: 'output/test.txt',
        },
        noFsContext,
      )

      expect(result.success).toBe(false)
    })
  })
})
