import { describe, expect, it } from 'vitest'
import { CommandHandler, createEmptyExecutionContext } from '@massivoto/kit'
import { CoreInterpreter, RESERVED_ARG_PRECEDENCE } from '../../core-interpreter.js'
import { CoreCommandRegistry } from '../../command-registry/index.js'
import { BasicHandler } from '../../core-handlers/basic-handler.js'
import { buildProgramParser } from '../program-parser.js'
import { Stream } from '@masala/parser'
import { buildInstructionParserForTest } from '../instruction-parser.js'

/**
 * Theme: Formula One Race Automation - Edge Cases
 *
 * Validate precedence model, arg order independence, and boundary conditions
 * for the full reserved args system.
 */
describe('Filter Pattern Edge Cases', () => {
  const parser = buildProgramParser()

  describe('R-FILTER-01: Precedence constant', () => {
    it('documents the canonical precedence chain', () => {
      expect(RESERVED_ARG_PRECEDENCE).toEqual([
        'forEach',
        'if',
        'retry',
        'execute',
        'output/collect',
      ])
    })
  })

  describe('R-FILTER-02: position independence', () => {
    const grammar = buildInstructionParserForTest()

    function parse(instruction: string) {
      return grammar.parse(Stream.ofChars(instruction))
    }

    it('AC-FP-12: all reserved args extracted regardless of order (variant A)', () => {
      const parsing = parse(
        '@race/run retry=3 if={x} collect=r forEach=items -> item',
      )
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.retry).toEqual({ type: 'literal-number', value: 3 })
      expect(instr.condition).toBeDefined()
      expect(instr.collect).toEqual({ type: 'identifier', value: 'r' })
      expect(instr.forEach).toBeDefined()
    })

    it('AC-FP-12: all reserved args extracted regardless of order (variant B)', () => {
      const parsing = parse(
        '@race/run forEach=items -> item collect=r retry=3 if={x}',
      )
      expect(parsing.isAccepted()).toBe(true)
      const instr = parsing.value

      expect(instr.retry).toEqual({ type: 'literal-number', value: 3 })
      expect(instr.condition).toBeDefined()
      expect(instr.collect).toEqual({ type: 'identifier', value: 'r' })
      expect(instr.forEach).toBeDefined()
    })
  })

  describe('R-FILTER-03: reserved args on blocks vs instructions', () => {
    it('block with forEach and if is valid', () => {
      const program = parser.val(`@block/begin forEach=items -> item if={item > 0}
@utils/log message=item
@block/end`)
      expect(program.body).toHaveLength(1)
      const block = program.body[0]
      expect(block.type).toBe('block')
    })

    it('instruction with all reserved args is valid', () => {
      const grammar = buildInstructionParserForTest()
      const parsing = grammar.parse(
        Stream.ofChars(
          '@ai/gen prompt="F1" forEach=items -> item if={item.ok} retry=2 collect=results',
        ),
      )
      expect(parsing.isAccepted()).toBe(true)
    })
  })

  describe('full precedence chain integration', () => {
    it('forEach + if + retry + collect all work together', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.prompts = ['rain', 'pit stop', 'grid']

      const callsByPrompt: Record<string, number> = {}

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async (args: Record<string, any>) => {
          const prompt = args.prompt as string
          callsByPrompt[prompt] = (callsByPrompt[prompt] || 0) + 1

          // 'rain' fails once then succeeds
          if (prompt === 'rain' && callsByPrompt[prompt] < 2) {
            throw new Error('Flaky')
          }
          return {
            success: true,
            cost: 1,
            messages: [],
            value: `image:${prompt}`,
          }
        },
      )

      const registry = new CoreCommandRegistry()
      await registry.addRegistryItem('@ai/generateImage', handler)

      const program = parser.val(
        '@ai/generateImage prompt=prompt forEach=prompts -> prompt if={prompt != "pit stop"} retry=2 collect=images',
      )

      const interpreter = new CoreInterpreter(registry)
      const result = await interpreter.executeProgram(program, context)

      // 'rain' retried once, 'pit stop' filtered, 'grid' succeeded first try
      expect(result.data.images).toEqual(['image:rain', 'image:grid'])
      expect(callsByPrompt.rain).toBe(2)
      expect(callsByPrompt.grid).toBe(1)
      expect(callsByPrompt['pit stop']).toBeUndefined()
    })

    it('all items filtered produces empty collection', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.prompts = ['pit stop', 'pit stop']

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async (args: Record<string, any>) => ({
          success: true,
          cost: 1,
          messages: [],
          value: `image:${args.prompt}`,
        }),
      )

      const registry = new CoreCommandRegistry()
      await registry.addRegistryItem('@ai/generateImage', handler)

      const program = parser.val(
        '@ai/generateImage prompt=prompt forEach=prompts -> prompt if={prompt != "pit stop"} collect=images',
      )

      const interpreter = new CoreInterpreter(registry)
      const result = await interpreter.executeProgram(program, context)

      expect(result.data.images).toEqual([])
    })

    it('retry exhaustion in forEach does not affect other items', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.prompts = ['bad', 'good']

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async (args: Record<string, any>) => {
          if (args.prompt === 'bad') {
            throw new Error('Always fails')
          }
          return {
            success: true,
            cost: 1,
            messages: [],
            value: `image:${args.prompt}`,
          }
        },
      )

      const registry = new CoreCommandRegistry()
      await registry.addRegistryItem('@ai/generateImage', handler)

      const program = parser.val(
        '@ai/generateImage prompt=prompt forEach=prompts -> prompt retry=1',
      )

      const interpreter = new CoreInterpreter(registry)

      // The first item exhausts retries and throws
      await expect(
        interpreter.executeProgram(program, context),
      ).rejects.toThrow('Always fails')
    })
  })
})
