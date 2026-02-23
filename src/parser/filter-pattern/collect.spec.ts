import { describe, expect, it } from 'vitest'
import { CommandHandler, createEmptyExecutionContext } from '@massivoto/kit'
import { CoreInterpreter } from '../../core-interpreter.js'
import { CoreCommandRegistry } from '../../command-registry/index.js'
import { BasicHandler } from '../../core-handlers/basic-handler.js'
import { buildProgramParser } from '../program-parser.js'

/**
 * Theme: Formula One Race Automation
 *
 * After generating AI images for race situations, the race director collects
 * all results into an array for human validation on a grid applet.
 * collect= accumulates results into an array variable.
 */
describe('Collect Execution (R-FILTER-101 to R-FILTER-103)', () => {
  describe('R-FILTER-101: collect without forEach wraps in array', () => {
    it('AC-FP-10: single result wrapped in array', async () => {
      const context = createEmptyExecutionContext('test')

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/describe',
        async () => ({
          success: true,
          cost: 1,
          messages: [],
          value: 'F1 championship overview',
        }),
      )

      const registry = new CoreCommandRegistry()
      await registry.addRegistryItem('@ai/describe', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/describe prompt="F1" collect=results',
      )

      const interpreter = new CoreInterpreter(registry)
      const result = await interpreter.executeProgram(program, context)

      expect(result.data.results).toEqual(['F1 championship overview'])
    })
  })

  describe('R-FILTER-102: collect with forEach accumulates results', () => {
    it('AC-FP-08: collects 3 results from forEach over 3 situations', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.situations = ['rain overtake', 'monaco tunnel', 'start grid']

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async (args: Record<string, any>) => ({
          success: true,
          cost: 1,
          messages: [],
          value: `image:${args.situation}`,
        }),
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage situation=situation forEach=situations -> situation collect=images',
      )

      const interpreter = new CoreInterpreter(registry)
      const result = await interpreter.executeProgram(program, context)

      expect(result.data.images).toEqual([
        'image:rain overtake',
        'image:monaco tunnel',
        'image:start grid',
      ])
    })

    it('AC-FP-09: filtered items not collected', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.situations = [
        'rain overtake',
        'monaco tunnel',
        'pit stop',
        'start grid',
      ]

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async (args: Record<string, any>) => ({
          success: true,
          cost: 1,
          messages: [],
          value: `image:${args.situation}`,
        }),
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage situation=situation forEach=situations -> situation if={situation != "pit stop"} collect=images',
      )

      const interpreter = new CoreInterpreter(registry)
      const result = await interpreter.executeProgram(program, context)

      expect(result.data.images).toEqual([
        'image:rain overtake',
        'image:monaco tunnel',
        'image:start grid',
      ])
      expect(result.data.images).toHaveLength(3)
    })
  })

  describe('R-FILTER-103: collect and output mutually exclusive (parser)', () => {
    it('AC-FP-11: parser rejects both output= and collect=', () => {
      const parser = buildProgramParser()

      expect(() =>
        parser.val('@ai/describe prompt="F1" output=result collect=results'),
      ).toThrow(/Cannot use both output= and collect=/)
    })
  })

  describe('collect with empty forEach', () => {
    it('produces empty array when forEach iterates over empty collection', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.situations = [] as string[]

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async (args: Record<string, any>) => ({
          success: true,
          cost: 1,
          messages: [],
          value: `image:${args.situation}`,
        }),
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage situation=situation forEach=situations -> situation collect=images',
      )

      const interpreter = new CoreInterpreter(registry)
      const result = await interpreter.executeProgram(program, context)

      expect(result.data.images).toEqual([])
    })
  })
})
