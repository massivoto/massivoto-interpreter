import { describe, it, expect } from 'vitest'
import { buildInstructionParserForTest } from '../instruction-parser.js'
import { Stream } from '@masala/parser'
import {
  ArgumentNode,
  FileLiteralNode,
  GlobLiteralNode,
  InstructionNode,
} from '../ast.js'

/**
 * Integration tests for file/glob path literals in full OTO command parsing.
 *
 * Theme: F1 Image Pipeline (The Race Was Great)
 * We parse complete @package/command instructions containing ~/file and ~/glob arguments
 * and verify the resulting InstructionNode structure end-to-end.
 */

function parseInstruction(source: string): InstructionNode {
  const parser = buildInstructionParserForTest()
  const stream = Stream.ofChars(source)
  const result = parser.parse(stream)

  if (!result.isAccepted()) {
    throw new Error(`Parse failed for: ${source}`)
  }
  return result.value as InstructionNode
}

function findArg(instruction: InstructionNode, name: string): ArgumentNode {
  const arg = instruction.args.find((a) => a.name.value === name)
  if (!arg) {
    throw new Error(
      `Argument "${name}" not found. Available: ${instruction.args.map((a) => a.name.value).join(', ')}`,
    )
  }
  return arg
}

describe('File path integration: full command parsing', () => {
  describe('nominal cases', () => {
    it('AC-FP-01: @ai/describe image=~/images/hero.png output=description', () => {
      const instruction = parseInstruction(
        '@ai/describe image=~/images/hero.png output=description',
      )

      expect(instruction.action.package).toBe('ai')
      expect(instruction.action.name).toBe('describe')

      const imageArg = findArg(instruction, 'image')
      expect(imageArg.value).toEqual({
        type: 'literal-file',
        value: '~/images/hero.png',
      } satisfies FileLiteralNode)

      expect(instruction.output).toEqual({
        type: 'identifier',
        value: 'description',
      })
    })

    it('glob in a forEach command: @start/forEach item="photo" of=~/images/races/*.jpg', () => {
      const instruction = parseInstruction(
        '@start/forEach item="photo" of=~/images/races/*.jpg',
      )

      expect(instruction.action.package).toBe('start')
      expect(instruction.action.name).toBe('forEach')

      const itemArg = findArg(instruction, 'item')
      expect(itemArg.value).toEqual({
        type: 'literal-string',
        value: 'photo',
      })

      const ofArg = findArg(instruction, 'of')
      expect(ofArg.value).toEqual({
        type: 'literal-glob',
        value: '~/images/races/*.jpg',
      } satisfies GlobLiteralNode)
    })

    it('double glob: @ai/describe image=~/images/**/*.png', () => {
      const instruction = parseInstruction(
        '@ai/describe image=~/images/**/*.png',
      )

      const imageArg = findArg(instruction, 'image')
      expect(imageArg.value).toEqual({
        type: 'literal-glob',
        value: '~/images/**/*.png',
      } satisfies GlobLiteralNode)
    })

    it('file path as destination: @core/save input=data path=~/output/results.json', () => {
      const instruction = parseInstruction(
        '@core/save input=data path=~/output/results.json',
      )

      expect(instruction.action.package).toBe('core')
      expect(instruction.action.name).toBe('save')

      const inputArg = findArg(instruction, 'input')
      expect(inputArg.value).toEqual({
        type: 'identifier',
        value: 'data',
      })

      const pathArg = findArg(instruction, 'path')
      expect(pathArg.value).toEqual({
        type: 'literal-file',
        value: '~/output/results.json',
      } satisfies FileLiteralNode)
    })
  })

  describe('edge cases', () => {
    it('two file paths in the same command: @utils/copy a=~/x b=~/y', () => {
      const instruction = parseInstruction('@utils/copy a=~/x b=~/y')

      expect(instruction.args).toHaveLength(2)

      const aArg = findArg(instruction, 'a')
      expect(aArg.value).toEqual({
        type: 'literal-file',
        value: '~/x',
      } satisfies FileLiteralNode)

      const bArg = findArg(instruction, 'b')
      expect(bArg.value).toEqual({
        type: 'literal-file',
        value: '~/y',
      } satisfies FileLiteralNode)
    })

    it('glob + file mixed: @utils/process glob=~/photos/*.jpg file=~/photos/cover.png', () => {
      const instruction = parseInstruction(
        '@utils/process glob=~/photos/*.jpg file=~/photos/cover.png',
      )

      expect(instruction.args).toHaveLength(2)

      const globArg = findArg(instruction, 'glob')
      expect(globArg.value).toEqual({
        type: 'literal-glob',
        value: '~/photos/*.jpg',
      } satisfies GlobLiteralNode)

      const fileArg = findArg(instruction, 'file')
      expect(fileArg.value).toEqual({
        type: 'literal-file',
        value: '~/photos/cover.png',
      } satisfies FileLiteralNode)
    })

    it('trailing slash normalized: @utils/load dir=~/images/', () => {
      const instruction = parseInstruction('@utils/load dir=~/images/')

      const dirArg = findArg(instruction, 'dir')
      expect(dirArg.value).toEqual({
        type: 'literal-file',
        value: '~/images',
      } satisfies FileLiteralNode)
    })

    it('dots, hyphens, underscores accumulated: @utils/load path=~/race-data/2024_monaco-Q1.final.json', () => {
      const instruction = parseInstruction(
        '@utils/load path=~/race-data/2024_monaco-Q1.final.json',
      )

      const pathArg = findArg(instruction, 'path')
      expect(pathArg.value).toEqual({
        type: 'literal-file',
        value: '~/race-data/2024_monaco-Q1.final.json',
      } satisfies FileLiteralNode)
    })

    it('path traversal rejected: @utils/load image=~/images/../secrets/key.pem', () => {
      const parser = buildInstructionParserForTest()
      const stream = Stream.ofChars(
        '@utils/load image=~/images/../secrets/key.pem',
      )
      const result = parser.parse(stream)

      // The instruction may parse partially (action parsed, but argument fails).
      // What matters is that the path traversal does NOT silently produce a valid file node.
      if (result.isAccepted()) {
        const instruction = result.value as InstructionNode
        const imageArg = instruction.args.find(
          (a) => a.name.value === 'image',
        )
        if (imageArg) {
          expect(imageArg.value.type).not.toBe('literal-file')
          expect(imageArg.value.type).not.toBe('literal-glob')
        }
      }
      // If not accepted at all, that is also a valid outcome (parser rejects entirely)
    })
  })
})
