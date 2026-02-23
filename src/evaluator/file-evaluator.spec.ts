import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { ExpressionEvaluator, EvaluationError } from './evaluators.js'
import { createEmptyExecutionContext, ExecutionContext } from '@massivoto/kit'
import type { FileLiteralNode, GlobLiteralNode } from '../parser/ast.js'

/**
 * Theme: Formula One Race Automation
 *
 * Evaluating file paths and globs for race photo management.
 * Monaco Grand Prix photo organization pipeline.
 */

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-evaluator-'))
  fs.mkdirSync(path.join(tmpDir, 'photos', 'races'), { recursive: true })
  fs.writeFileSync(path.join(tmpDir, 'photos', 'monaco.png'), 'monaco-data')
  fs.writeFileSync(path.join(tmpDir, 'photos', 'races', 'lap1.jpg'), 'lap1')
  fs.writeFileSync(path.join(tmpDir, 'photos', 'races', 'overtake.jpg'), 'overtake')
  fs.writeFileSync(path.join(tmpDir, 'photos', 'races', 'podium.jpg'), 'podium')
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function makeContext(projectRoot?: string): ExecutionContext {
  const ctx = createEmptyExecutionContext('max-33')
  if (projectRoot !== undefined) {
    ctx.fileSystem = { projectRoot }
  }
  return ctx
}

describe('File Evaluator', () => {
  let evaluator: ExpressionEvaluator

  beforeEach(() => {
    evaluator = new ExpressionEvaluator()
  })

  describe('R-FILE-21: literal-file evaluation', () => {
    it('AC-FILE-01: should resolve ~/photos/monaco.png to a FileReference', async () => {
      const expr: FileLiteralNode = { type: 'literal-file', value: '~/photos/monaco.png' }
      const context = makeContext(tmpDir)

      const result = await evaluator.evaluate(expr, context)

      expect(result.type).toBe('file-ref')
      expect(result.relativePath).toBe('photos/monaco.png')
      expect(result.absolutePath).toBe(path.resolve(tmpDir, 'photos/monaco.png'))
    })
  })

  describe('R-FILE-22: literal-glob evaluation', () => {
    it('AC-FILE-02: should resolve glob matching 3 files sorted alphabetically', async () => {
      const expr: GlobLiteralNode = { type: 'literal-glob', value: '~/photos/races/*.jpg' }
      const context = makeContext(tmpDir)

      const result = await evaluator.evaluate(expr, context)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(3)
      expect(result[0].relativePath).toBe('photos/races/lap1.jpg')
      expect(result[1].relativePath).toBe('photos/races/overtake.jpg')
      expect(result[2].relativePath).toBe('photos/races/podium.jpg')
      expect(result[0].type).toBe('file-ref')
    })

    it('AC-FILE-03: should return empty array for glob matching 0 files', async () => {
      const expr: GlobLiteralNode = { type: 'literal-glob', value: '~/photos/empty/*.jpg' }
      const context = makeContext(tmpDir)

      const result = await evaluator.evaluate(expr, context)

      expect(result).toEqual([])
    })
  })

  describe('R-FILE-24: error when fileSystem.projectRoot undefined', () => {
    it('AC-FILE-04: should throw when fileSystem is undefined', async () => {
      const expr: FileLiteralNode = { type: 'literal-file', value: '~/photos/monaco.png' }
      const context = makeContext() // no projectRoot

      await expect(evaluator.evaluate(expr, context)).rejects.toThrow(
        'File access requires a projectRoot. Configure it in the runner.',
      )
    })

    it('should throw for glob when fileSystem is undefined', async () => {
      const expr: GlobLiteralNode = { type: 'literal-glob', value: '~/photos/*.jpg' }
      const context = makeContext() // no projectRoot

      await expect(evaluator.evaluate(expr, context)).rejects.toThrow(
        'File access requires a projectRoot. Configure it in the runner.',
      )
    })
  })

  describe('R-FILE-25: security - path escape prevention', () => {
    it('should throw when file path escapes projectRoot', async () => {
      const expr: FileLiteralNode = { type: 'literal-file', value: '~/../../etc/passwd' }
      const context = makeContext(tmpDir)

      await expect(evaluator.evaluate(expr, context)).rejects.toThrow()
    })
  })
})
