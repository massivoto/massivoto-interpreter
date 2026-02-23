import { describe, expect, it } from 'vitest'
import { CommandHandler, createEmptyExecutionContext } from '@massivoto/kit'
import { runProgram } from '../../program-runner.js'
import { CoreInterpreter } from '../../core-interpreter.js'
import { CoreCommandRegistry } from '../../command-registry/index.js'
import { BasicHandler } from '../../core-handlers/basic-handler.js'
import { buildProgramParser } from '../program-parser.js'

/**
 * Theme: Formula One Race Automation
 *
 * The race director uses AI to generate images for different race situations.
 * Some situations are filtered out (e.g. pit stops don't need AI images),
 * and the system must handle the forEach + if combination (filter pattern).
 */
describe('Filter Pattern: forEach + if (R-FILTER-41 to R-FILTER-44)', () => {
  describe('R-FILTER-41/42: per-item if evaluation inside forEach block', () => {
    it('AC-FP-01: skips items that fail the if condition', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.situations = [
        'rain overtake',
        'monaco tunnel',
        'pit stop',
        'start grid',
      ]

      const described: string[] = []
      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/describe',
        async (args: Record<string, any>) => {
          described.push(args.situation)
          return {
            success: true,
            cost: 0,
            messages: [],
            value: `desc:${args.situation}`,
          }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/describe', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        `@block/begin forEach=situations -> situation if={situation != "pit stop"}
@ai/describe situation=situation
@block/end`,
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(described).toEqual(['rain overtake', 'monaco tunnel', 'start grid'])
      expect(described).not.toContain('pit stop')
    })

    it('AC-FP-03: block with forEach + if executes only for matching items', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.drivers = [
        { name: 'Max', points: 100 },
        { name: 'Rookie', points: 10 },
      ]

      const logged: string[] = []
      const handler: CommandHandler<void> = new BasicHandler(
        '@utils/log',
        async (args: Record<string, any>) => {
          logged.push(args.message)
          return { success: true, cost: 0, messages: [] }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@utils/log', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        `@block/begin forEach=drivers -> driver if={driver.points > 50}
@utils/log message=driver.name
@block/end`,
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(logged).toEqual(['Max'])
    })
  })

  describe('R-FILTER-43: single instruction forEach + if', () => {
    it('filters items on single instruction with forEach + if', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.situations = ['rain overtake', 'pit stop', 'start grid']

      const described: string[] = []
      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/describe',
        async (args: Record<string, any>) => {
          described.push(args.situation)
          return {
            success: true,
            cost: 0,
            messages: [],
            value: `desc:${args.situation}`,
          }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/describe', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        `@ai/describe situation=situation forEach=situations -> situation if={situation != "pit stop"}`,
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(described).toEqual(['rain overtake', 'start grid'])
    })
  })

  describe('R-FILTER-44: system variables count ALL items', () => {
    it('AC-FP-04: _index and _length count all items, not just filtered ones', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.drivers = [
        { name: 'Max', points: 100 },
        { name: 'Rookie', points: 10 },
        { name: 'Lewis', points: 80 },
        { name: 'Newbie', points: 5 },
      ]

      const indices: number[] = []
      const lengths: number[] = []
      const handler: CommandHandler<void> = new BasicHandler(
        '@utils/log',
        async (args: Record<string, any>) => {
          indices.push(args.idx)
          lengths.push(args.len)
          return { success: true, cost: 0, messages: [] }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@utils/log', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        `@block/begin forEach=drivers -> driver if={driver.points > 50}
@utils/log idx=_index len=_length
@block/end`,
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      // Only Max (index 0) and Lewis (index 2) pass the filter
      expect(indices).toEqual([0, 2])
      // _length is always 4 (total drivers count)
      expect(lengths).toEqual([4, 4])
    })
  })

  describe('filter pattern with condition-only block (no forEach)', () => {
    it('condition-only block still works', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.isRaceDay = true

      const logged: string[] = []
      const handler: CommandHandler<void> = new BasicHandler(
        '@utils/log',
        async (args: Record<string, any>) => {
          logged.push(args.message)
          return { success: true, cost: 0, messages: [] }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@utils/log', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        `@block/begin if=isRaceDay
@utils/log message="race on"
@block/end`,
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(logged).toEqual(['race on'])
    })

    it('falsy condition skips block', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.isRaceDay = false

      const logged: string[] = []
      const handler: CommandHandler<void> = new BasicHandler(
        '@utils/log',
        async (args: Record<string, any>) => {
          logged.push(args.message)
          return { success: true, cost: 0, messages: [] }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@utils/log', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        `@block/begin if=isRaceDay
@utils/log message="race on"
@block/end`,
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(logged).toEqual([])
    })
  })
})
