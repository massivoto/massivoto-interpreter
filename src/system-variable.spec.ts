import { describe, it, expect } from 'vitest'
import { CommandHandler, createEmptyExecutionContext } from '@massivoto/kit'
import { CoreInterpreter } from './core-interpreter.js'
import { CoreCommandRegistry } from './command-registry/index.js'
import { BasicHandler } from './core-handlers/basic-handler.js'
import { buildProgramParser } from './parser/program-parser.js'
import { runProgram } from './program-runner.js'

/**
 * Formula One Race theme: system variables with $-prefix in forEach loops.
 *
 * Three F1 drivers on the grid: Verstappen, Hamilton, Leclerc.
 * The $-prefixed system variables ($index, $count, $length, $first, $last, $odd, $even)
 * are injected per iteration and resolved via scope chain.
 */
describe('System Variables End-to-End (AC-SYSVAR-01 to 08)', () => {
  const drivers = ['Verstappen', 'Hamilton', 'Leclerc']

  function createF1Context() {
    const context = createEmptyExecutionContext('f1-race')
    context.data.drivers = drivers
    return context
  }

  function createCaptureRegistry() {
    const captured: any[] = []
    const handler: CommandHandler<void> = new BasicHandler(
      'id',
      async (args: Record<string, any>) => {
        captured.push(args.value)
        return { success: true, cost: 0, messages: [] }
      },
    )
    const registry = new CoreCommandRegistry()
    registry.addRegistryItem('@utils/capture', handler)
    return { registry, captured }
  }

  it('AC-SYSVAR-01: $index provides 0, 1, 2 for 3 drivers', async () => {
    const { registry, captured } = createCaptureRegistry()
    const parser = buildProgramParser()
    const program = parser.val(`@block/begin forEach=drivers -> driver
@utils/capture value=$index
@block/end`)

    const interpreter = new CoreInterpreter(registry)
    const context = createF1Context()
    await interpreter.executeProgram(program, context)

    expect(captured).toEqual([0, 1, 2])
  })

  it('AC-SYSVAR-02: $count provides 1, 2, 3 for 3 drivers', async () => {
    const { registry, captured } = createCaptureRegistry()
    const parser = buildProgramParser()
    const program = parser.val(`@block/begin forEach=drivers -> driver
@utils/capture value=$count
@block/end`)

    const interpreter = new CoreInterpreter(registry)
    const context = createF1Context()
    await interpreter.executeProgram(program, context)

    expect(captured).toEqual([1, 2, 3])
  })

  it('AC-SYSVAR-03: $length is always 3 for 3 drivers', async () => {
    const { registry, captured } = createCaptureRegistry()
    const parser = buildProgramParser()
    const program = parser.val(`@block/begin forEach=drivers -> driver
@utils/capture value=$length
@block/end`)

    const interpreter = new CoreInterpreter(registry)
    const context = createF1Context()
    await interpreter.executeProgram(program, context)

    expect(captured).toEqual([3, 3, 3])
  })

  it('AC-SYSVAR-04: $first is true only for Verstappen (first driver)', async () => {
    const { registry, captured } = createCaptureRegistry()
    const parser = buildProgramParser()
    const program = parser.val(`@block/begin forEach=drivers -> driver
@utils/capture value=$first
@block/end`)

    const interpreter = new CoreInterpreter(registry)
    const context = createF1Context()
    await interpreter.executeProgram(program, context)

    expect(captured).toEqual([true, false, false])
  })

  it('AC-SYSVAR-05: $last is true only for Leclerc (last driver)', async () => {
    const { registry, captured } = createCaptureRegistry()
    const parser = buildProgramParser()
    const program = parser.val(`@block/begin forEach=drivers -> driver
@utils/capture value=$last
@block/end`)

    const interpreter = new CoreInterpreter(registry)
    const context = createF1Context()
    await interpreter.executeProgram(program, context)

    expect(captured).toEqual([false, false, true])
  })

  it('AC-SYSVAR-06: nested forEach - inner $index shadows outer $index', async () => {
    const outerIndices: number[] = []
    const innerIndices: number[] = []

    const outerCapture: CommandHandler<void> = new BasicHandler(
      'id',
      async (args: Record<string, any>) => {
        outerIndices.push(args.value)
        return { success: true, cost: 0, messages: [] }
      },
    )
    const innerCapture: CommandHandler<void> = new BasicHandler(
      'id',
      async (args: Record<string, any>) => {
        innerIndices.push(args.value)
        return { success: true, cost: 0, messages: [] }
      },
    )

    const registry = new CoreCommandRegistry()
    registry.addRegistryItem('@capture/outer', outerCapture)
    registry.addRegistryItem('@capture/inner', innerCapture)

    const context = createEmptyExecutionContext('f1-race')
    context.data.teams = ['Red Bull', 'Mercedes']
    context.data.laps = ['Lap1', 'Lap2', 'Lap3']

    const parser = buildProgramParser()
    const program = parser.val(`@block/begin forEach=teams -> team
@block/begin forEach=laps -> lap
@capture/inner value=$index
@block/end
@capture/outer value=$index
@block/end`)

    const interpreter = new CoreInterpreter(registry)
    await interpreter.executeProgram(program, context)

    // Inner loop: 0,1,2 for each outer iteration (2 teams)
    expect(innerIndices).toEqual([0, 1, 2, 0, 1, 2])
    // Outer $index is restored after inner loop
    expect(outerIndices).toEqual([0, 1])
  })

  it('AC-SYSVAR-08: $index outside forEach resolves to undefined', async () => {
    const context = createEmptyExecutionContext('f1-race')

    const source = `@utils/set input=$index output=result`
    const result = await runProgram(source, context)

    expect(result.data.result).toBeUndefined()
  })

  describe('$odd and $even with F1 drivers', () => {
    it('$odd alternates true/false/true for 3 drivers', async () => {
      const { registry, captured } = createCaptureRegistry()
      const parser = buildProgramParser()
      const program = parser.val(`@block/begin forEach=drivers -> driver
@utils/capture value=$odd
@block/end`)

      const interpreter = new CoreInterpreter(registry)
      const context = createF1Context()
      await interpreter.executeProgram(program, context)

      expect(captured).toEqual([true, false, true])
    })

    it('$even alternates false/true/false for 3 drivers', async () => {
      const { registry, captured } = createCaptureRegistry()
      const parser = buildProgramParser()
      const program = parser.val(`@block/begin forEach=drivers -> driver
@utils/capture value=$even
@block/end`)

      const interpreter = new CoreInterpreter(registry)
      const context = createF1Context()
      await interpreter.executeProgram(program, context)

      expect(captured).toEqual([false, true, false])
    })
  })

  describe('instruction-level forEach with $-prefix', () => {
    it('$index works with instruction-level forEach', async () => {
      const { registry, captured } = createCaptureRegistry()
      const context = createF1Context()

      const parser = buildProgramParser()
      const program = parser.val(
        `@utils/capture value=$index forEach=drivers -> driver`,
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(captured).toEqual([0, 1, 2])
    })
  })

  describe('$-prefix in braced expressions', () => {
    it('$index in arithmetic expression {$index + 1}', async () => {
      const { registry, captured } = createCaptureRegistry()
      const context = createF1Context()

      const parser = buildProgramParser()
      const program = parser.val(`@block/begin forEach=drivers -> driver
@utils/capture value={$index + 1}
@block/end`)

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(captured).toEqual([1, 2, 3])
    })
  })
})
